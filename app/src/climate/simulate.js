/**
 * The understudy.
 *
 * When the live feed cannot be reached — offline, rate-limited, blocked by a
 * network the visitor does not control — the atlas must not go grey. This
 * module produces a physically plausible climate for a coordinate and an
 * instant: seasonal temperature, diurnal swing, trade winds, ITCZ convection,
 * storm tracks.
 *
 * It is always labelled as modelled, never as observed. An art piece that
 * lies about its data is just a screensaver.
 */

import { makeRng } from '../core/rng.js';
import { daylight } from '../core/solar.js';

const DAY_MS = 86400000;

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return (date.getTime() - start) / DAY_MS;
}

/** Smooth pseudo-noise over a scalar, deterministic per island. */
function drift(seed, t, scale) {
  const rng = makeRng((seed ^ Math.floor(t / scale)) >>> 0);
  const a = rng.float();
  const rng2 = makeRng((seed ^ (Math.floor(t / scale) + 1)) >>> 0);
  const b = rng2.float();
  const f = (t / scale) % 1;
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

/**
 * Mean sea-level temperature for a latitude and time of year, in °C.
 * A cosine in latitude, tilted by the season, with the southern hemisphere's
 * milder swing accounted for by its greater ocean fraction.
 */
function baseTemperature(lat, doy) {
  const absLat = Math.abs(lat);
  const annualMean = 27.5 - 0.0072 * absLat ** 2;
  // Peak of summer lags the solstice by ~30 days over water.
  const seasonPhase = ((doy - 202) / 365.25) * Math.PI * 2;
  const hemisphere = lat >= 0 ? 1 : -1;
  const swing = (absLat / 90) ** 1.5 * (lat >= 0 ? 14 : 9);
  return annualMean + hemisphere * swing * Math.cos(seasonPhase);
}

/**
 * A complete synthetic observation. Shape matches the normalized record the
 * live path produces, so nothing downstream needs to know which it got.
 */
export function simulateClimate(island, date = new Date()) {
  const { lat, lon, seed } = island;
  const doy = dayOfYear(date);
  const t = date.getTime();
  const absLat = Math.abs(lat);

  const light = daylight(lat, lon, date);
  const utcMinutes = ((t / 60000) % 1440 + 1440) % 1440;
  const solarMinutes = (utcMinutes + lon * 4 + 1440) % 1440;
  const diurnal = Math.cos(((solarMinutes - 870) / 1440) * Math.PI * 2);

  // Maritime climates barely swing across a day; continental ones are not
  // represented in this atlas at all, since every island is surrounded.
  const diurnalRange = 2.2 + (1 - Math.min(1, absLat / 60)) * 2.6;

  const synoptic = (drift(seed, t, 26 * 3600000) - 0.5) * 6.5;
  const temperature =
    baseTemperature(lat, doy) + diurnal * diurnalRange * 0.5 + synoptic;

  // Trade winds either side of the equator, westerlies in the roaring
  // latitudes, doldrums on the line and under the subtropical highs.
  const tradeBand = Math.exp(-(((absLat - 15) / 12) ** 2));
  const westerlies = Math.exp(-(((absLat - 52) / 16) ** 2));
  const doldrums = Math.exp(-((absLat / 6) ** 2)) * 0.7;
  const gust = drift(seed ^ 0x51, t, 9 * 3600000);
  const windSpeed = Math.max(
    1.5,
    (8 + tradeBand * 16 + westerlies * 26 - doldrums * 9) * (0.55 + gust)
  );

  // Direction follows the prevailing pattern with a slow wander.
  const prevailing = lat >= 0
    ? absLat > 35 ? 250 : 75
    : absLat > 35 ? 290 : 105;
  const windDirection =
    (prevailing + (drift(seed ^ 0x77, t, 20 * 3600000) - 0.5) * 90 + 360) % 360;

  // Convection over the ITCZ, plus mid-latitude frontal systems.
  const itcz = Math.exp(-(((absLat - 6) / 9) ** 2));
  const frontal = westerlies;
  const wetness = drift(seed ^ 0x9c, t, 15 * 3600000);
  const stormy = Math.max(0, wetness - 0.55) / 0.45;

  const cloudCover = Math.min(
    100,
    Math.max(
      0,
      (18 + itcz * 45 + frontal * 48 + stormy * 55 - (1 - itcz) * 12) *
        (0.7 + drift(seed ^ 0x3b, t, 6 * 3600000) * 0.6)
    )
  );

  const precipitation =
    stormy > 0
      ? Number((stormy ** 2 * (itcz * 7 + frontal * 4 + 0.6)).toFixed(2))
      : 0;

  const snowing = temperature < 1.2 && precipitation > 0;
  const humidity = Math.min(
    99,
    Math.max(40, 62 + itcz * 20 + cloudCover * 0.18 + (drift(seed ^ 0xab, t, 8 * 3600000) - 0.5) * 14)
  );

  const pressure =
    1013 + (1 - stormy) * 9 - itcz * 5 - westerlies * 6 + (drift(seed ^ 0xd1, t, 30 * 3600000) - 0.5) * 8;

  // Sea surface temperature lags the air by weeks and never freezes below
  // about -1.8 °C.
  const seaSurfaceTemperature = Math.max(
    -1.8,
    baseTemperature(lat, doy - 26) * 0.94 + 1.4
  );

  // Fully-developed sea from wind speed, plus swell from far away.
  const waveHeight = Number(
    Math.max(0.15, 0.0155 * windSpeed ** 1.62 + westerlies * 1.4 + 0.25).toFixed(2)
  );
  const wavePeriod = Number((3.4 + Math.sqrt(waveHeight) * 4.1).toFixed(1));

  const isDay = light.midnightSun
    ? true
    : light.polarNight
    ? false
    : solarMinutes > (light.sunrise + lon * 4 + 1440) % 1440 &&
      solarMinutes < (light.sunset + lon * 4 + 1440) % 1440;

  return {
    islandNumber: island.number,
    lat,
    lon,
    source: 'modelled',
    observedAt: t,
    fetchedAt: t,
    temperature: Number(temperature.toFixed(1)),
    apparentTemperature: Number(
      (temperature - windSpeed * 0.06 + (humidity - 60) * 0.02).toFixed(1)
    ),
    humidity: Math.round(humidity),
    precipitation,
    rain: snowing ? 0 : precipitation,
    snowfall: snowing ? Number((precipitation * 0.7).toFixed(2)) : 0,
    weatherCode: weatherCodeFor({ precipitation, cloudCover, snowing, stormy }),
    cloudCover: Math.round(cloudCover),
    pressure: Math.round(pressure),
    windSpeed: Number(windSpeed.toFixed(1)),
    windDirection: Math.round(windDirection),
    windGusts: Number((windSpeed * (1.28 + stormy * 0.5)).toFixed(1)),
    isDay,
    seaSurfaceTemperature: Number(seaSurfaceTemperature.toFixed(1)),
    waveHeight,
    wavePeriod,
    waveDirection: Math.round(windDirection),
  };
}

/** Map simulated conditions onto the same WMO codes the live feed uses. */
function weatherCodeFor({ precipitation, cloudCover, snowing, stormy }) {
  if (precipitation <= 0) {
    if (cloudCover < 12) return 0;
    if (cloudCover < 40) return 1;
    if (cloudCover < 78) return 2;
    return 3;
  }
  if (snowing) return precipitation > 2.5 ? 75 : precipitation > 0.8 ? 73 : 71;
  if (stormy > 0.92) return 95;
  if (precipitation > 4) return 65;
  if (precipitation > 1.4) return 63;
  if (precipitation > 0.4) return 61;
  return 51;
}
