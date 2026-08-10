/**
 * From observation to image.
 *
 * A climate record is a table of numbers. This module turns it into the two
 * things the rest of the app needs: uniforms the renderer can light a world
 * with, and sentences a person can read. Both come from the same numbers, so
 * the picture and the caption can never disagree.
 */

import { sunDirection, sunPosition, daylight } from '../core/solar.js';

/** WMO 4677 present-weather codes, as Open-Meteo emits them. */
export const WEATHER_CODES = {
  0: 'Clear',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Violent showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

export function describeWeather(code) {
  return WEATHER_CODES[code] || 'Unsettled';
}

const BEAUFORT = [
  [1, 0, 'Calm'],
  [6, 1, 'Light air'],
  [12, 2, 'Light breeze'],
  [20, 3, 'Gentle breeze'],
  [29, 4, 'Moderate breeze'],
  [39, 5, 'Fresh breeze'],
  [50, 6, 'Strong breeze'],
  [62, 7, 'Near gale'],
  [75, 8, 'Gale'],
  [89, 9, 'Strong gale'],
  [103, 10, 'Storm'],
  [118, 11, 'Violent storm'],
  [Infinity, 12, 'Hurricane force'],
];

/** Beaufort force and its name, from wind speed in km/h. */
export function beaufort(kmh) {
  for (const [limit, force, label] of BEAUFORT) {
    if (kmh < limit) return { force, label };
  }
  return { force: 12, label: 'Hurricane force' };
}

const COMPASS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export function compassPoint(deg) {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Sea state on the Douglas scale, from significant wave height in metres. */
export function seaState(waveHeight) {
  if (waveHeight == null) return { code: null, label: 'Unreported' };
  const table = [
    [0.1, 0, 'Glassy'],
    [0.5, 2, 'Smooth'],
    [1.25, 3, 'Slight'],
    [2.5, 4, 'Moderate'],
    [4, 5, 'Rough'],
    [6, 6, 'Very rough'],
    [9, 7, 'High'],
    [14, 8, 'Very high'],
    [Infinity, 9, 'Phenomenal'],
  ];
  for (const [limit, code, label] of table) {
    if (waveHeight < limit) return { code, label };
  }
  return { code: 9, label: 'Phenomenal' };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Everything the scene shader needs, derived from one island and one
 * observation at one instant.
 *
 * @param {object} island   Catalogue entry.
 * @param {object} climate  Normalized climate record.
 * @param {Date}   [date]   Instant to light the scene at.
 */
export function deriveScene(island, climate, date = new Date()) {
  const sun = sunPosition(island.lat, island.lon, date);
  const sunDir = sunDirection(island.lat, island.lon, date);
  const light = daylight(island.lat, island.lon, date);

  const temp = climate.temperature;
  const cloud = clamp01(climate.cloudCover / 100);
  const precip = climate.precipitation || 0;
  const snowing = climate.snowfall > 0 || (precip > 0 && temp < 1.2);

  // The snowline: where 0 °C sits on this island right now, assuming the
  // standard 6.5 °C/km environmental lapse rate and a peak scaled so that a
  // terrain height of 1.0 reads as ~900 m of real relief.
  const peakMetres = island.terrain.height * 900;
  const freezingMetres = (temp / 6.5) * 1000;
  // Deliberately *not* clamped to 1: a value above the summit means no snow at
  // all, and clamping it to 1 was enough to frost every peak in the tropics.
  const snowlineNorm =
    peakMetres > 1
      ? Math.max(0, Math.min(4, freezingMetres / peakMetres + island.surface.snowlineBias))
      : 4;

  // Wave amplitude in world units. The renderer's ocean is ~1 unit ≈ 900 m of
  // island, so real metres of wave would be invisible; this is a deliberate,
  // consistent exaggeration that keeps relative sea states honest.
  const waveH = climate.waveHeight != null
    ? climate.waveHeight
    : 0.0155 * Math.max(1, climate.windSpeed) ** 1.62;
  const waveAmp = 0.0022 + Math.min(0.028, waveH * 0.0075);

  // Choppiness: short wind waves layered on the swell.
  const chop = clamp01(climate.windSpeed / 70);

  // Atmospheric haze rises with humidity and with warm, still air.
  const haze = clamp01(
    0.18 + (climate.humidity - 55) / 140 + cloud * 0.22 - chop * 0.15
  );

  // Water colour: cold seas run slate and green, warm seas run turquoise.
  const sst = climate.seaSurfaceTemperature != null
    ? climate.seaSurfaceTemperature
    : temp;
  const waterWarmth = clamp01((sst + 2) / 30);

  const twilight = 1 - smoothstep(-8, 4, sun.apparentElevation);
  const night = 1 - smoothstep(-6, 1.5, sun.apparentElevation);

  return {
    sunDir,
    sunElevation: sun.apparentElevation,
    sunAzimuth: sun.azimuth,
    night,
    twilight,
    cloudCover: cloud,
    // Overcast decks sit lower and thicker than fair-weather cumulus.
    cloudDensity: 0.35 + cloud * 0.65,
    cloudHeight: 3.2 - cloud * 1.0,
    rain: snowing ? 0 : clamp01(precip / 6),
    snow: snowing ? clamp01(precip / 4 + 0.25) : 0,
    fog: climate.weatherCode === 45 || climate.weatherCode === 48 ? 0.75 : 0,
    haze,
    windSpeed: climate.windSpeed,
    windDir: (climate.windDirection * Math.PI) / 180,
    waveAmp,
    waveChop: chop,
    wavePeriod: climate.wavePeriod || 3.4 + Math.sqrt(Math.max(0.1, waveH)) * 4.1,
    waterWarmth,
    turbidity: island.surface.turbidity,
    snowline: snowlineNorm,
    // Vegetation browns off in drought and in cold.
    vegetation: clamp01(
      island.surface.vegetation * smoothstep(-6, 6, temp) * (0.75 + cloud * 0.25)
    ),
    canopyHue: island.surface.canopyHue,
    sandHue: island.surface.sandHue,
    rockHue: island.surface.rockHue,
    rockValue: island.surface.rockValue,
    reefWidth: island.surface.reefWidth,
    polarNight: Boolean(light.polarNight),
    midnightSun: Boolean(light.midnightSun),
    dayLengthMinutes: light.dayLengthMinutes ?? (light.midnightSun ? 1440 : 0),
  };
}

/** The instrument-panel reading a visitor sees beside the island. */
export function readouts(island, climate, date = new Date()) {
  const sun = sunPosition(island.lat, island.lon, date);
  const wind = beaufort(climate.windSpeed);
  const sea = seaState(climate.waveHeight);

  return {
    condition: describeWeather(climate.weatherCode),
    temperature: climate.temperature,
    apparent: climate.apparentTemperature,
    humidity: climate.humidity,
    pressure: climate.pressure,
    wind,
    windSpeed: climate.windSpeed,
    windGusts: climate.windGusts,
    windFrom: compassPoint(climate.windDirection),
    windDirection: climate.windDirection,
    cloudCover: climate.cloudCover,
    precipitation: climate.precipitation,
    sea,
    waveHeight: climate.waveHeight,
    wavePeriod: climate.wavePeriod,
    seaSurfaceTemperature: climate.seaSurfaceTemperature,
    sunElevation: sun.apparentElevation,
    sunAzimuth: sun.azimuth,
    isDay: climate.isDay != null ? climate.isDay : sun.apparentElevation > 0,
    source: climate.source,
    observedAt: climate.observedAt,
  };
}
