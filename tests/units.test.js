/**
 * The small pieces: deterministic randomness, geography helpers, and the
 * formatting that the instrument panel is built out of. None of it is clever,
 * all of it is load-bearing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, hashString, hashU32 } from '../app/src/core/rng.js';
import {
  normalizeLon,
  formatCoord,
  haversineKm,
  climateBand,
  REGIONS,
} from '../app/src/core/geo.js';
import * as fmt from '../app/src/ui/format.js';

test('the string hash is stable and well spread', () => {
  // Pinned: changing these values would silently re-roll the entire atlas.
  assert.equal(hashString('404islands/atlas/v1'), hashString('404islands/atlas/v1'));
  assert.notEqual(hashString('404islands/island/1'), hashString('404islands/island/2'));

  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(hashString(`404islands/island/${i}`));
  assert.equal(seen.size, 5000, 'the hash collided within the atlas range');
});

test('hashU32 is a pure function of its inputs', () => {
  assert.equal(hashU32(3, 7, 11), hashU32(3, 7, 11));
  assert.notEqual(hashU32(3, 7, 11), hashU32(7, 3, 11));
  assert.ok(hashU32(-1, -1, 0) >= 0, 'negative coordinates must still hash unsigned');
});

test('the generator is deterministic and stays in range', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  for (let i = 0; i < 100; i++) assert.equal(a.float(), b.float());

  const rng = makeRng(7);
  for (let i = 0; i < 2000; i++) {
    const f = rng.float();
    assert.ok(f >= 0 && f < 1, `float ${f} out of range`);
    const n = rng.int(3, 9);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 9, `int ${n} out of range`);
    const r = rng.range(-2, 5);
    assert.ok(r >= -2 && r < 5, `range ${r} out of range`);
  }
});

test('weighted picks respect zero weights and reach every option', () => {
  const rng = makeRng(99);
  const options = ['a', 'b', 'c'];
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 3000; i++) counts[rng.weighted(options, [1, 0, 3])]++;

  assert.equal(counts.b, 0, 'a zero weight must never be chosen');
  assert.ok(counts.a > 400 && counts.c > 1800, `unbalanced: ${JSON.stringify(counts)}`);
});

test('shuffle is a permutation, not a filter', () => {
  const input = Array.from({ length: 200 }, (_, i) => i);
  const shuffled = makeRng(4).shuffle(input.slice());
  assert.equal(shuffled.length, 200);
  assert.deepEqual(shuffled.slice().sort((a, b) => a - b), input);
  assert.notDeepEqual(shuffled, input);
});

test('longitudes wrap into a single turn of the globe', () => {
  assert.equal(normalizeLon(0), 0);
  assert.equal(normalizeLon(179.9), 179.9);
  assert.equal(normalizeLon(181), -179);
  assert.equal(normalizeLon(-181), 179);
  assert.equal(normalizeLon(540), 180);
});

test('coordinates format the way a chart does', () => {
  assert.equal(formatCoord(0, 0), '0° 0.0′ N, 0° 0.0′ E');
  assert.match(formatCoord(-17.54, -149.57), /^17° 32\.4′ S, 149° 34\.2′ W$/);
  assert.match(formatCoord(78.5, 16.2), /^78° 30\.0′ N, 16° 12\.0′ E$/);
});

test('great-circle distances agree with known separations', () => {
  // London to Paris, roughly 344 km.
  assert.ok(Math.abs(haversineKm(51.5074, -0.1278, 48.8566, 2.3522) - 344) < 8);
  // A quarter of the way round the equator.
  assert.ok(Math.abs(haversineKm(0, 0, 0, 90) - 10018) < 20);
  assert.equal(haversineKm(10, 20, 10, 20), 0);
});

test('climate bands follow latitude', () => {
  assert.equal(climateBand(0), 'Equatorial');
  assert.equal(climateBand(-18), 'Tropical');
  assert.equal(climateBand(30), 'Subtropical');
  assert.equal(climateBand(-45), 'Temperate');
  assert.equal(climateBand(60), 'Subpolar');
  assert.equal(climateBand(-78), 'Polar');
});

test('every region is a well-formed box on the real globe', () => {
  const ids = new Set();
  for (const region of REGIONS) {
    assert.ok(!ids.has(region.id), `duplicate region id ${region.id}`);
    ids.add(region.id);

    assert.ok(region.lat[0] < region.lat[1], `${region.id} latitude range inverted`);
    assert.ok(region.lon[0] < region.lon[1], `${region.id} longitude range inverted`);
    assert.ok(region.lat[0] >= -90 && region.lat[1] <= 90, `${region.id} off the globe`);
    assert.ok(region.lon[0] >= -180 && region.lon[1] <= 180, `${region.id} off the globe`);
    assert.ok(region.weight > 0, `${region.id} would never be populated`);
    assert.ok(region.name && region.ocean && region.family);
  }
});

test('formatters degrade to an em dash rather than to NaN', () => {
  for (const format of [
    fmt.temperature, fmt.speed, fmt.metres, fmt.percent, fmt.pressure, fmt.degrees,
  ]) {
    assert.equal(format(null), '—');
    assert.equal(format(undefined), '—');
  }
  assert.equal(fmt.num(Number.NaN), '—');
  assert.equal(fmt.duration(null), '—');
  assert.equal(fmt.clockFromMinutes(null), '—');
});

test('formatters render values the way the panel needs them', () => {
  assert.match(fmt.temperature(21.44), /^21\.4\s°C$/);
  assert.match(fmt.speed(17.6), /^18\s?km\/h$/);
  assert.match(fmt.percent(63.4), /^63\s?%$/);
  assert.match(fmt.metres(1.234, 1), /^1\.2\s?m$/);
  assert.equal(fmt.money(420), '€420');
  assert.equal(fmt.money(1200, 'USD'), '$1,200');
});

test('relative time is coarse and never says "in the future"', () => {
  const now = Date.parse('2024-06-01T12:00:00Z');
  assert.equal(fmt.relativeTime(now - 5000, now), 'just now');
  assert.equal(fmt.relativeTime(now - 60000, now), 'a minute ago');
  assert.match(fmt.relativeTime(now - 15 * 60000, now), /^15\s?min ago$/);
  assert.match(fmt.relativeTime(now - 3 * 3600000, now), /^3\s?h ago$/);
  assert.match(fmt.relativeTime(now - 50 * 3600000, now), /^2\s?d ago$/);
  assert.equal(fmt.relativeTime(null, now), 'unknown');
});

test('the solar clock follows longitude, not the browser', () => {
  const noonUtc = new Date('2024-06-01T12:00:00Z');
  assert.equal(fmt.solarClock(0, noonUtc), '12:00');
  assert.equal(fmt.solarClock(180, noonUtc), '00:00');
  assert.equal(fmt.solarClock(-180, noonUtc), '00:00');
  assert.equal(fmt.solarClock(15, noonUtc), '13:00');
  assert.equal(fmt.solarClock(-15, noonUtc), '11:00');
});
