/**
 * Where the moon is, and what shape it is.
 *
 * Until now the moon in this atlas was a polite fiction — a full moon in
 * opposition, invented because the climate feed does not carry one. That was
 * the largest untruth in the piece. It did not need to be: the moon's position
 * and phase are computable from the date alone, to far better precision than a
 * horizon can show, with no network and no data source.
 *
 * These are Meeus's abridged lunar series (Astronomical Algorithms, ch. 47),
 * carrying the principal periodic terms. Longitude is good to roughly ten
 * arcminutes, latitude to a few, and distance to a few hundred kilometres —
 * which is to say the moon rises within a minute or two of when it really
 * does, and is the right shape and the right brightness when it gets there.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);

/** The synodic month, in days: new moon to new moon. */
export const SYNODIC_MONTH = 29.530588853;

/** Mean Earth–Moon distance, in kilometres. */
export const MEAN_DISTANCE_KM = 385000.56;

const norm360 = (d) => ((d % 360) + 360) % 360;

function daysSinceJ2000(date) {
  const ms = date instanceof Date ? date.getTime() : date;
  return ms / 86400000 + 2440587.5 - 2451545.0;
}

/**
 * Geocentric ecliptic coordinates of the moon: longitude and latitude in
 * degrees, distance in kilometres.
 */
export function lunarPosition(date = new Date()) {
  const d = daysSinceJ2000(date);

  // Mean elements.
  const L = norm360(218.3164477 + 13.17639648 * d); // mean longitude
  const M = norm360(134.9633964 + 13.06499295 * d); // moon's mean anomaly
  const Ms = norm360(357.5291092 + 0.98560028 * d); // sun's mean anomaly
  const D = norm360(297.8501921 + 12.19074912 * d); // mean elongation
  const F = norm360(93.272095 + 13.2293505 * d); // argument of latitude

  // Principal periodic terms in longitude (degrees).
  const longitude = norm360(
    L +
      6.289 * sin(M) +
      1.274 * sin(2 * D - M) +
      0.658 * sin(2 * D) +
      0.214 * sin(2 * M) -
      0.186 * sin(Ms) -
      0.114 * sin(2 * F) -
      0.059 * sin(2 * D - 2 * M) -
      0.057 * sin(2 * D - Ms - M) +
      0.053 * sin(2 * D + M) +
      0.046 * sin(2 * D - Ms) +
      0.041 * sin(M - Ms) -
      0.035 * sin(D) -
      0.031 * sin(M + Ms)
  );

  // Latitude never exceeds about 5.3°, which is why eclipses are rare.
  const latitude =
    5.128 * sin(F) +
    0.281 * sin(M + F) -
    0.278 * sin(F - M) -
    0.173 * sin(2 * D - F) +
    0.055 * sin(2 * D + F - M) -
    0.046 * sin(2 * D - F - M) +
    0.033 * sin(2 * D + F) +
    0.017 * sin(2 * M + F);

  // Distance in kilometres: perigee ~356 500, apogee ~406 700.
  const distance =
    385000.56 -
    20905.355 * cos(M) -
    3699.111 * cos(2 * D - M) -
    2955.968 * cos(2 * D) -
    569.925 * cos(2 * M) +
    246.158 * cos(2 * D - 2 * M) -
    204.586 * cos(Ms - 2 * D) -
    170.733 * cos(2 * D + M) -
    152.138 * cos(2 * D - Ms - M);

  return { longitude, latitude, distance, elements: { L, M, Ms, D, F } };
}

/** The sun's geometric ecliptic longitude, in degrees. Needed for the phase. */
export function solarLongitude(date = new Date()) {
  const d = daysSinceJ2000(date);
  const L = norm360(280.46646 + 0.9856474 * d);
  const M = norm360(357.5291092 + 0.98560028 * d);
  return norm360(L + 1.9146 * sin(M) + 0.02 * sin(2 * M));
}

/** Mean obliquity of the ecliptic, in degrees. */
function obliquity(date) {
  const t = daysSinceJ2000(date) / 36525;
  return 23.439291 - 0.0130042 * t;
}

/**
 * Phase of the moon.
 *
 * `illumination` is the lit fraction of the visible disc, 0 at new and 1 at
 * full. `age` is days since the last new moon. `waxing` says which way it is
 * going, which is the difference between a crescent that means one thing and
 * a crescent that means the opposite.
 */
export function lunarPhase(date = new Date()) {
  const moon = lunarPosition(date);
  const sunLon = solarLongitude(date);

  // Elongation east of the sun: 0 at new, 180 at full.
  const elongation = norm360(moon.longitude - sunLon);
  const illumination = (1 - cos(elongation)) / 2;
  const age = (elongation / 360) * SYNODIC_MONTH;

  return {
    elongation,
    illumination,
    age,
    waxing: elongation < 180,
    name: phaseName(elongation),
    distance: moon.distance,
    // A "supermoon" is a full moon near perigee; this is the plain number
    // behind the word.
    apparentDiameter: 2 * Math.atan(1737.4 / moon.distance) * DEG,
  };
}

/** The eight traditional phase names, from the elongation in degrees. */
export function phaseName(elongation) {
  const e = norm360(elongation);
  if (e < 11.25 || e >= 348.75) return 'New moon';
  if (e < 78.75) return 'Waxing crescent';
  if (e < 101.25) return 'First quarter';
  if (e < 168.75) return 'Waxing gibbous';
  if (e < 191.25) return 'Full moon';
  if (e < 258.75) return 'Waning gibbous';
  if (e < 281.25) return 'Last quarter';
  return 'Waning crescent';
}

/**
 * Where the moon stands in the sky from a given coordinate: altitude and
 * azimuth in degrees, azimuth measured clockwise from true north.
 */
export function moonPosition(lat, lon, date = new Date()) {
  const moon = lunarPosition(date);
  const eps = obliquity(date);

  // Ecliptic to equatorial.
  const sinDec =
    sin(moon.latitude) * cos(eps) + cos(moon.latitude) * sin(eps) * sin(moon.longitude);
  const declination = Math.asin(Math.max(-1, Math.min(1, sinDec))) * DEG;
  const rightAscension = norm360(
    Math.atan2(
      sin(moon.longitude) * cos(eps) - Math.tan(moon.latitude * RAD) * sin(eps),
      cos(moon.longitude)
    ) * DEG
  );

  // Greenwich mean sidereal time, then the local hour angle.
  const d = daysSinceJ2000(date);
  const gmst = norm360(280.46061837 + 360.98564736629 * d);
  const hourAngle = norm360(gmst + lon - rightAscension);

  const sinAlt =
    sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG;

  const azimuth = norm360(
    Math.atan2(
      -cos(declination) * sin(hourAngle),
      sin(declination) * cos(lat) - cos(declination) * sin(lat) * cos(hourAngle)
    ) * DEG
  );

  return {
    altitude,
    azimuth,
    declination,
    rightAscension,
    hourAngle,
    distance: moon.distance,
  };
}

/**
 * Unit vector to the moon in the renderer's frame: +X east, +Y up, +Z south.
 * Matches `sunDirection` in solar.js so the shader can treat them alike.
 */
export function moonDirection(lat, lon, date = new Date()) {
  const { altitude, azimuth } = moonPosition(lat, lon, date);
  const alt = altitude * RAD;
  const az = azimuth * RAD;
  const horiz = Math.cos(alt);
  return [horiz * Math.sin(az), Math.sin(alt), horiz * Math.cos(az)];
}

/**
 * How much light the moon is actually casting on this island, 0..1.
 *
 * Three things multiply: how much of the disc is lit, how high it stands (a
 * moon on the horizon is dimmed by the same atmosphere that reddens a sunset),
 * and how close it is. Full moonlight is about 0.25 lux against the sun's
 * 100 000 — but this is a long exposure, and the renderer opens up for it.
 */
export function moonlight(lat, lon, date = new Date()) {
  const { altitude, distance } = moonPosition(lat, lon, date);
  const { illumination } = lunarPhase(date);

  if (altitude <= -2) return 0;

  // Extinction near the horizon, and a soft edge below it for the last of the
  // light after moonset.
  const height = Math.max(0, Math.min(1, (altitude + 2) / 12));
  const elevationFactor = height * (0.35 + 0.65 * Math.min(1, altitude / 45));

  // The lit fraction is not linear in brightness: a gibbous moon is far
  // brighter than half a full moon because of opposition surge.
  const brightness = Math.pow(illumination, 1.6);

  const proximity = (MEAN_DISTANCE_KM / distance) ** 2;

  return Math.max(0, Math.min(1, brightness * elevationFactor * proximity));
}
