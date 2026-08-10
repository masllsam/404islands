/**
 * The climate layer.
 *
 * Two things are tested here. First, that the modelled fallback is physically
 * plausible everywhere — it stands in for real observations, so a nonsense
 * value would be an outright fabrication. Second, that derivation into render
 * parameters is total: every island, every hour, valid uniforms.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { getAtlas, getIsland } from '../app/src/core/catalog.js';
import { simulateClimate } from '../app/src/climate/simulate.js';
import {
  deriveScene,
  readouts,
  beaufort,
  compassPoint,
  seaState,
  describeWeather,
} from '../app/src/climate/derive.js';

const HOURS = [0, 5, 11, 17, 23];
const DATES = ['2024-01-15', '2024-04-15', '2024-07-15', '2024-10-15'];

function everyIslandEveryHour(fn) {
  for (const day of DATES) {
    for (const hour of HOURS) {
      const date = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`);
      for (const island of getAtlas().islands) fn(island, date);
    }
  }
}

test('modelled climate is physically plausible everywhere, all year', () => {
  everyIslandEveryHour((island, date) => {
    const c = simulateClimate(island, date);
    const where = `island ${island.number} at ${island.lat}° on ${date.toISOString()}`;

    assert.ok(c.temperature > -70 && c.temperature < 55, `temperature ${c.temperature} — ${where}`);
    assert.ok(c.humidity >= 0 && c.humidity <= 100, `humidity ${c.humidity} — ${where}`);
    assert.ok(c.cloudCover >= 0 && c.cloudCover <= 100, `cloud ${c.cloudCover} — ${where}`);
    assert.ok(c.windSpeed >= 0 && c.windSpeed < 200, `wind ${c.windSpeed} — ${where}`);
    assert.ok(c.windDirection >= 0 && c.windDirection <= 360, `direction — ${where}`);
    assert.ok(c.precipitation >= 0 && c.precipitation < 60, `precipitation — ${where}`);
    assert.ok(c.pressure > 900 && c.pressure < 1090, `pressure ${c.pressure} — ${where}`);
    assert.ok(c.waveHeight > 0 && c.waveHeight < 25, `waves ${c.waveHeight} — ${where}`);
    assert.ok(
      c.seaSurfaceTemperature >= -1.8 && c.seaSurfaceTemperature < 40,
      `sea temperature ${c.seaSurfaceTemperature} — ${where}`
    );
    assert.ok(Number.isFinite(c.observedAt));
    assert.equal(c.source, 'modelled', 'the fallback must always declare itself');
  });
});

test('the tropics are warmer than the poles, in both hemispheres', () => {
  const date = new Date('2024-07-15T12:00:00Z');
  const byLatitude = getAtlas()
    .islands.map((i) => ({ lat: Math.abs(i.lat), t: simulateClimate(i, date).temperature }));

  const tropical = byLatitude.filter((x) => x.lat < 15);
  const polar = byLatitude.filter((x) => x.lat > 60);

  const mean = (xs) => xs.reduce((s, x) => s + x.t, 0) / xs.length;
  assert.ok(tropical.length > 20 && polar.length > 3);
  assert.ok(
    mean(tropical) > mean(polar) + 15,
    `tropics ${mean(tropical).toFixed(1)}°C vs poles ${mean(polar).toFixed(1)}°C`
  );
});

test('the modelled climate is deterministic for a given island and instant', () => {
  const island = getIsland(217);
  const date = new Date('2024-05-05T08:00:00Z');
  assert.deepEqual(simulateClimate(island, date), simulateClimate(island, date));
});

test('derived scenes produce finite, in-range uniforms for every island', () => {
  const unitInterval = [
    'night', 'twilight', 'cloudCover', 'rain', 'snow', 'fog', 'haze',
    'waterWarmth', 'vegetation',
  ];

  everyIslandEveryHour((island, date) => {
    const scene = deriveScene(island, simulateClimate(island, date), date);
    const where = `island ${island.number} on ${date.toISOString()}`;

    for (const key of unitInterval) {
      const value = scene[key];
      assert.ok(
        Number.isFinite(value) && value >= 0 && value <= 1,
        `${key}=${value} outside [0,1] — ${where}`
      );
    }

    assert.equal(scene.sunDir.length, 3);
    for (const component of scene.sunDir) assert.ok(Number.isFinite(component));
    assert.ok(Math.abs(Math.hypot(...scene.sunDir) - 1) < 1e-9, `sun direction — ${where}`);

    assert.ok(scene.waveAmp > 0 && scene.waveAmp < 0.05, `waveAmp — ${where}`);
    assert.ok(scene.wavePeriod > 0 && scene.wavePeriod < 40, `wavePeriod — ${where}`);
    assert.ok(scene.snowline >= 0 && scene.snowline <= 4, `snowline — ${where}`);
    assert.ok(scene.cloudHeight > 0, `cloudHeight — ${where}`);
  });
});

test('the snowline sits above the summit in the warm tropics', () => {
  const date = new Date('2024-07-15T12:00:00Z');
  const warm = getAtlas().islands.filter((i) => Math.abs(i.lat) < 12);
  assert.ok(warm.length > 20);

  for (const island of warm) {
    const climate = simulateClimate(island, date);
    if (climate.temperature < 15) continue; // an unusually cold draw; skip
    const scene = deriveScene(island, climate, date);
    assert.ok(
      scene.snowline > 1.05,
      `island ${island.number} at ${island.lat}° and ${climate.temperature}°C has snowline ${scene.snowline}`
    );
  }
});

test('a cold island keeps its snowline on the mountain', () => {
  const island = getIsland(getAtlas().islands.find((i) => i.lat > 65).number);
  const cold = { ...simulateClimate(island), temperature: -6 };
  const scene = deriveScene(island, cold, new Date('2024-01-15T12:00:00Z'));
  assert.ok(scene.snowline < 0.4, `snowline ${scene.snowline} should be low at -6 °C`);
});

test('readouts describe what the numbers say', () => {
  const island = getIsland(42);
  const climate = simulateClimate(island, new Date('2024-06-01T12:00:00Z'));
  const r = readouts(island, climate, new Date('2024-06-01T12:00:00Z'));

  assert.equal(typeof r.condition, 'string');
  assert.ok(r.condition.length > 0);
  assert.ok(r.wind.force >= 0 && r.wind.force <= 12);
  assert.ok(typeof r.windFrom === 'string' && r.windFrom.length <= 3);
  assert.equal(r.source, 'modelled');
});

test('Beaufort, compass and Douglas scales agree with their definitions', () => {
  assert.equal(beaufort(0).force, 0);
  assert.equal(beaufort(0.5).label, 'Calm');
  assert.equal(beaufort(25).force, 4);
  assert.equal(beaufort(45).force, 6);
  assert.equal(beaufort(200).force, 12);

  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(90), 'E');
  assert.equal(compassPoint(180), 'S');
  assert.equal(compassPoint(270), 'W');
  assert.equal(compassPoint(360), 'N');
  assert.equal(compassPoint(-90), 'W');

  assert.equal(seaState(0.05).label, 'Glassy');
  assert.equal(seaState(3).label, 'Rough');
  assert.equal(seaState(null).label, 'Unreported');

  assert.equal(describeWeather(0), 'Clear');
  assert.equal(describeWeather(95), 'Thunderstorm');
  assert.equal(describeWeather(4242), 'Unsettled');
});
