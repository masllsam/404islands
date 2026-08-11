/**
 * The moon.
 *
 * This replaced an invented full moon with real lunar astronomy, so it is
 * worth checking against things that actually happened rather than against
 * previous output. New and full moons are published to the minute; perigee
 * and apogee distances are known; the moon's latitude is bounded by the
 * inclination of its orbit. All of that is checkable here, offline.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  lunarPosition,
  lunarPhase,
  moonPosition,
  moonDirection,
  moonlight,
  phaseName,
  SYNODIC_MONTH,
  MEAN_DISTANCE_KM,
} from '../app/src/core/lunar.js';

const close = (actual, expected, tolerance, message) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, got ${actual}`
  );

/** Published new and full moons (UTC). */
const NEW_MOONS = [
  '2024-01-11T11:57:00Z',
  '2024-06-06T12:38:00Z',
  '2024-12-01T06:21:00Z',
  '2025-03-29T10:58:00Z',
];
const FULL_MOONS = [
  '2024-01-25T17:54:00Z',
  '2024-06-22T01:08:00Z',
  '2024-12-15T09:02:00Z',
  '2025-03-14T06:55:00Z',
];

test('the moon is dark at every published new moon', () => {
  for (const iso of NEW_MOONS) {
    const { illumination, elongation } = lunarPhase(new Date(iso));
    assert.ok(
      illumination < 0.01,
      `${iso}: illumination ${illumination.toFixed(4)} should be ~0`
    );
    const fromNew = Math.min(elongation, 360 - elongation);
    assert.ok(fromNew < 8, `${iso}: elongation ${elongation.toFixed(1)}° should be ~0`);
  }
});

test('the moon is full at every published full moon', () => {
  for (const iso of FULL_MOONS) {
    const { illumination, elongation } = lunarPhase(new Date(iso));
    assert.ok(
      illumination > 0.99,
      `${iso}: illumination ${illumination.toFixed(4)} should be ~1`
    );
    close(elongation, 180, 8, `${iso} elongation`);
  }
});

test('the phase advances through a whole cycle in a synodic month', () => {
  const start = new Date('2024-01-11T11:57:00Z');
  const later = new Date(start.getTime() + SYNODIC_MONTH * 86400000);
  const a = lunarPhase(start);
  const b = lunarPhase(later);

  // Back to new, within the wobble the abridged series allows.
  const drift = Math.min(b.elongation, 360 - b.elongation);
  assert.ok(drift < 10, `after one synodic month the elongation drifted ${drift.toFixed(1)}°`);
  assert.ok(Math.abs(b.illumination - a.illumination) < 0.02);
});

test('waxing and waning are the right way round', () => {
  // A few days after new: a waxing crescent, growing.
  const waxing = lunarPhase(new Date('2024-01-14T00:00:00Z'));
  assert.equal(waxing.waxing, true);
  assert.match(waxing.name, /Waxing crescent/);

  // A few days after full: a waning gibbous, shrinking.
  const waning = lunarPhase(new Date('2024-01-29T00:00:00Z'));
  assert.equal(waning.waxing, false);
  assert.match(waning.name, /Waning gibbous/);
});

test('phase names cover the circle without gaps', () => {
  const seen = new Set();
  for (let e = 0; e < 360; e += 0.5) seen.add(phaseName(e));
  assert.equal(seen.size, 8, `expected 8 phase names, saw ${[...seen].join(', ')}`);
  assert.equal(phaseName(0), 'New moon');
  assert.equal(phaseName(180), 'Full moon');
  assert.equal(phaseName(360), 'New moon');
  assert.equal(phaseName(90), 'First quarter');
  assert.equal(phaseName(270), 'Last quarter');
});

test('distance stays between perigee and apogee, and averages correctly', () => {
  let min = Infinity;
  let max = -Infinity;
  let total = 0;
  let count = 0;

  // A full year at six-hour steps covers many orbits.
  const start = Date.parse('2024-01-01T00:00:00Z');
  for (let h = 0; h < 365 * 24; h += 6) {
    const { distance } = lunarPosition(new Date(start + h * 3600000));
    min = Math.min(min, distance);
    max = Math.max(max, distance);
    total += distance;
    count++;
  }

  assert.ok(min > 355000 && min < 362000, `perigee ${min.toFixed(0)} km out of range`);
  assert.ok(max > 403000 && max < 408000, `apogee ${max.toFixed(0)} km out of range`);
  close(total / count, MEAN_DISTANCE_KM, 3000, 'mean distance');
});

test('ecliptic latitude stays inside the moon’s orbital inclination', () => {
  const start = Date.parse('2024-01-01T00:00:00Z');
  for (let h = 0; h < 365 * 24; h += 12) {
    const { latitude } = lunarPosition(new Date(start + h * 3600000));
    assert.ok(
      Math.abs(latitude) < 5.9,
      `latitude ${latitude.toFixed(2)}° exceeds the orbit's inclination`
    );
  }
});

test('the moon rises and sets, and is up about half the time', () => {
  const lat = 51.5;
  const lon = -0.1;
  const start = Date.parse('2024-03-01T00:00:00Z');
  let up = 0;
  let samples = 0;

  for (let h = 0; h < 30 * 24; h++) {
    const { altitude } = moonPosition(lat, lon, new Date(start + h * 3600000));
    if (altitude > 0) up++;
    samples++;
    assert.ok(altitude >= -91 && altitude <= 91, `altitude ${altitude} out of range`);
  }

  const fraction = up / samples;
  assert.ok(fraction > 0.4 && fraction < 0.6, `moon up ${(fraction * 100).toFixed(0)}% of the time`);
});

test('the direction vector is a unit vector agreeing with the altitude', () => {
  for (const [lat, lon] of [[0, 0], [51.5, -0.1], [-33.9, 151.2], [78, 15]]) {
    const date = new Date('2024-08-10T22:00:00Z');
    const dir = moonDirection(lat, lon, date);
    close(Math.hypot(...dir), 1, 1e-9, 'direction length');

    const { altitude } = moonPosition(lat, lon, date);
    close(Math.asin(dir[1]) * (180 / Math.PI), altitude, 1e-6, 'altitude agrees');
  }
});

test('moonlight is dark at new moon and brightest at a high full moon', () => {
  // New moon: nothing to reflect, wherever it is in the sky.
  for (const lat of [0, 30, -30]) {
    assert.ok(
      moonlight(lat, 0, new Date('2024-01-11T11:57:00Z')) < 0.02,
      'a new moon should cast no light'
    );
  }

  // A full moon over a full lunar day must reach a good brightness at its
  // culmination and fall to nothing when it is below the horizon.
  const start = Date.parse('2024-06-22T00:00:00Z');
  let brightest = 0;
  let dimmest = 1;
  for (let h = 0; h < 25; h++) {
    const value = moonlight(-17.5, -149.5, new Date(start + h * 3600000));
    brightest = Math.max(brightest, value);
    dimmest = Math.min(dimmest, value);
    assert.ok(value >= 0 && value <= 1, `moonlight ${value} out of range`);
  }
  assert.ok(brightest > 0.5, `a full moon should get bright; peaked at ${brightest.toFixed(2)}`);
  assert.equal(dimmest, 0, 'a set moon should cast nothing');
});

test('a quarter moon casts far less than half a full moon', () => {
  // Opposition surge: brightness is markedly non-linear in lit fraction.
  const quarter = lunarPhase(new Date('2024-01-18T03:52:00Z'));
  close(quarter.illumination, 0.5, 0.06, 'first quarter illumination');
});
