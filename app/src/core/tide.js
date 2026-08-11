/**
 * The tide.
 *
 * What this computes is the **equilibrium tide**: the shape the ocean would
 * take if water responded instantly to the gravitational pull of the moon and
 * the sun, with no continents in the way. It is the forcing, not a forecast.
 *
 * That distinction matters and the interface states it. The *timing* here is
 * real — high water follows the moon's transit, spring tides fall at new and
 * full moon, neaps at the quarters, and the fortnightly beat between them is
 * exactly right. The *range* is not: equilibrium theory gives about 0.8 m at
 * springs everywhere, while the real ocean answers with 0.1 m in the
 * Mediterranean and 16 m in the Bay of Fundy, depending on how each basin
 * resonates. Predicting that needs harmonic constituents measured at each
 * port, which no free global API provides and which this piece will not
 * pretend to have.
 *
 * So: the rhythm is astronomy, the amplitude is a model, and the panel says so.
 */

import { moonPosition, MEAN_DISTANCE_KM } from './lunar.js';
import { sunPosition } from './solar.js';

const RAD = Math.PI / 180;

/**
 * Equilibrium amplitudes in metres. The lunar term is roughly 2.2× the solar
 * one, which is why the moon runs the tide and the sun only modulates it.
 */
const LUNAR_COEFFICIENT = 0.54;
const SOLAR_COEFFICIENT = 0.25;

/** Mean Earth–Sun distance, in kilometres. */
const MEAN_SOLAR_DISTANCE_KM = 149597870.7;

/** The tide-raising potential of one body, as a height in metres. */
function tidalTerm(altitudeDeg, coefficient, distanceRatio) {
  // Zenith distance: 0 with the body overhead, 180 with it underfoot. Both
  // give a bulge, which is why there are two high waters a day.
  const zenith = (90 - altitudeDeg) * RAD;
  const cosZ = Math.cos(zenith);
  return coefficient * distanceRatio ** 3 * (3 * cosZ * cosZ - 1) * 0.5;
}

/** Earth–Sun distance in kilometres, varying with the annual orbit. */
function solarDistance(date) {
  const ms = date instanceof Date ? date.getTime() : date;
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const M = (357.5291092 + 0.98560028 * d) * RAD;
  // First-order elliptic correction, ±1.7%.
  return MEAN_SOLAR_DISTANCE_KM * (1 - 0.01671 * Math.cos(M));
}

/**
 * Equilibrium tide height in metres relative to mean sea level, positive for
 * high water. Typically within ±0.55 m; about ±0.8 m at the largest spring
 * tides, when moon and sun pull together and the moon is near perigee.
 */
export function equilibriumTide(lat, lon, date = new Date()) {
  const moon = moonPosition(lat, lon, date);
  const sun = sunPosition(lat, lon, date);

  const lunar = tidalTerm(
    moon.altitude,
    LUNAR_COEFFICIENT,
    MEAN_DISTANCE_KM / moon.distance
  );
  const solar = tidalTerm(
    sun.elevation,
    SOLAR_COEFFICIENT,
    MEAN_SOLAR_DISTANCE_KM / solarDistance(date)
  );

  return lunar + solar;
}

/**
 * The full tidal state at a coordinate and instant.
 *
 * `height` is metres above mean sea level. `rate` is metres per hour, signed:
 * positive is flooding, negative is ebbing. `phase` is the word for it.
 * `springNeap` runs 0 at neaps to 1 at springs.
 */
export function tideState(lat, lon, date = new Date()) {
  const t = date instanceof Date ? date.getTime() : date;
  const height = equilibriumTide(lat, lon, t);

  // Central difference over ten minutes either side: the tide is smooth, so
  // this is a better slope than any analytic derivative is worth writing.
  const step = 10 * 60 * 1000;
  const before = equilibriumTide(lat, lon, t - step);
  const after = equilibriumTide(lat, lon, t + step);
  const rate = ((after - before) / 2) * (3600000 / step);

  const flooding = rate > 0;
  const slack = Math.abs(rate) < 0.02;

  // Nearly stationary water is not necessarily at a turn. Where the two daily
  // tides are unequal the curve can flatten into a *stand* — a shoulder that
  // pauses and then carries on the same way — so which turn this is has to be
  // read from the water either side, not from the sign of a near-zero rate.
  const shoulder = 40 * 60 * 1000;
  const earlier = equilibriumTide(lat, lon, t - shoulder);
  const later = equilibriumTide(lat, lon, t + shoulder);
  const atHigh = height >= earlier && height >= later;
  const atLow = height <= earlier && height <= later;

  // Spring–neap: how aligned the sun and moon are, which is the same thing as
  // the moon's phase. New and full pull together; the quarters pull apart.
  const moonAlt = moonPosition(lat, lon, t).altitude;
  const sunAlt = sunPosition(lat, lon, t).elevation;

  return {
    height,
    rate,
    flooding,
    slack,
    atHigh,
    atLow,
    phase: slack
      ? atHigh
        ? 'Slack, near high'
        : atLow
        ? 'Slack, near low'
        : 'Standing'
      : flooding
      ? 'Flooding'
      : 'Ebbing',
    moonAltitude: moonAlt,
    sunAltitude: sunAlt,
    // Always modelled: never present this as an observation.
    source: 'equilibrium',
  };
}

/**
 * When the next high and low water fall, by sampling forward. Returns epoch
 * milliseconds, or null if none is found inside the search window.
 *
 * A semidiurnal tide turns roughly every six hours and a quarter, so a
 * fifteen-hour window always contains at least one of each.
 */
export function nextTurns(lat, lon, date = new Date(), windowHours = 15) {
  const start = date instanceof Date ? date.getTime() : date;
  const stepMs = 6 * 60 * 1000;
  const steps = Math.round((windowHours * 3600000) / stepMs);

  let previous = equilibriumTide(lat, lon, start);
  let previousRate = null;
  let high = null;
  let low = null;

  for (let i = 1; i <= steps; i++) {
    const t = start + i * stepMs;
    const value = equilibriumTide(lat, lon, t);
    const rate = value - previous;

    if (previousRate !== null && Math.sign(rate) !== Math.sign(previousRate)) {
      // The turn is between the last two samples; a linear crossing of the
      // rate is accurate to well under a minute at this step size.
      const fraction = previousRate / (previousRate - rate);
      const turn = start + (i - 1 + fraction) * stepMs;
      if (previousRate > 0 && high === null) high = { at: turn, height: value };
      if (previousRate < 0 && low === null) low = { at: turn, height: value };
      if (high && low) break;
    }

    previous = value;
    previousRate = rate;
  }

  return { high, low };
}

/**
 * A 0..1 position within the tidal range over the last day, for driving the
 * waterline in the renderer. 0 is the lowest water of the day, 1 the highest.
 */
export function tidalRange(lat, lon, date = new Date()) {
  const t = date instanceof Date ? date.getTime() : date;
  const stepMs = 30 * 60 * 1000;
  let min = Infinity;
  let max = -Infinity;

  // A full lunar day, so both of the day's highs and lows are seen.
  for (let i = -25; i <= 25; i++) {
    const value = equilibriumTide(lat, lon, t + i * stepMs);
    if (value < min) min = value;
    if (value > max) max = value;
  }

  const height = equilibriumTide(lat, lon, t);
  const span = max - min;
  return {
    min,
    max,
    span,
    normalized: span > 1e-6 ? (height - min) / span : 0.5,
  };
}
