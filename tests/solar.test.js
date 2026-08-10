/**
 * Solar geometry.
 *
 * The light in this piece is not art-directed, it is computed — so if these
 * equations drift, the artwork becomes a lie rather than merely ugly. Expected
 * values are checked against known astronomical facts rather than against
 * previous output.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sunPosition,
  sunDirection,
  daylight,
  solarTerms,
  julianDay,
} from '../app/src/core/solar.js';

const close = (actual, expected, tolerance, message) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, got ${actual}`
  );

test('J2000.0 has the canonical Julian day', () => {
  close(julianDay(new Date('2000-01-01T12:00:00Z')), 2451545.0, 1e-6, 'JD at J2000');
});

test('solar declination tracks the seasons', () => {
  // The obliquity of the ecliptic bounds declination at about ±23.44°.
  const june = solarTerms(new Date('2024-06-20T12:00:00Z')).declination;
  const december = solarTerms(new Date('2024-12-21T12:00:00Z')).declination;
  const march = solarTerms(new Date('2024-03-20T03:06:00Z')).declination;

  close(june, 23.44, 0.15, 'June solstice declination');
  close(december, -23.44, 0.15, 'December solstice declination');
  close(march, 0, 0.2, 'March equinox declination');
});

test('the equinox sun stands overhead on the equator at local noon', () => {
  // Local solar noon at 0° longitude on the equinox is close to 12:00 UTC,
  // shifted by the equation of time.
  const { elevation } = sunPosition(0, 0, new Date('2024-03-20T12:07:00Z'));
  close(elevation, 90, 1.2, 'equinox noon elevation on the equator');
});

test('midnight sun and polar night are reported where they occur', () => {
  const svalbardSummer = daylight(78.5, 16, new Date('2024-06-21T12:00:00Z'));
  assert.equal(svalbardSummer.midnightSun, true);
  assert.equal(svalbardSummer.polarNight, false);
  assert.equal(svalbardSummer.sunrise, null);

  const svalbardWinter = daylight(78.5, 16, new Date('2024-12-21T12:00:00Z'));
  assert.equal(svalbardWinter.polarNight, true);
  assert.equal(svalbardWinter.midnightSun, false);

  const tropics = daylight(-17.5, -149.5, new Date('2024-06-21T12:00:00Z'));
  assert.equal(tropics.midnightSun, false);
  assert.equal(tropics.polarNight, false);
  assert.ok(tropics.dayLengthMinutes > 500 && tropics.dayLengthMinutes < 800);
});

test('day length at the equator is close to twelve hours all year', () => {
  for (const iso of ['2024-01-15', '2024-04-15', '2024-07-15', '2024-10-15']) {
    const { dayLengthMinutes } = daylight(0, 0, new Date(`${iso}T12:00:00Z`));
    // A shade over 12 h, because sunrise is defined at the upper limb with
    // refraction included.
    close(dayLengthMinutes, 727, 12, `equatorial day length on ${iso}`);
  }
});

test('the sun direction is a unit vector with a matching elevation', () => {
  for (const [lat, lon] of [[0, 0], [51.5, -0.1], [-33.9, 151.2], [78, 15]]) {
    const date = new Date('2024-08-10T09:30:00Z');
    const dir = sunDirection(lat, lon, date);
    const length = Math.hypot(...dir);
    close(length, 1, 1e-9, 'sun direction length');

    const { apparentElevation } = sunPosition(lat, lon, date);
    // +Y is up, so the Y component is the sine of the elevation angle.
    close(Math.asin(dir[1]) * (180 / Math.PI), apparentElevation, 1e-6, 'elevation agrees');
  }
});

test('refraction lifts the sun at the horizon and not at the zenith', () => {
  const horizon = sunPosition(0, 0, new Date('2024-03-20T06:05:00Z'));
  assert.ok(
    horizon.apparentElevation > horizon.elevation,
    'a low sun should be refracted upward'
  );

  const noon = sunPosition(0, 0, new Date('2024-03-20T12:07:00Z'));
  close(noon.apparentElevation - noon.elevation, 0, 0.01, 'no refraction overhead');
});

test('azimuth stays within a compass circle everywhere', () => {
  for (let hour = 0; hour < 24; hour += 3) {
    for (const lat of [-80, -45, 0, 45, 80]) {
      const date = new Date(Date.UTC(2024, 6, 15, hour));
      const { azimuth } = sunPosition(lat, 12, date);
      assert.ok(
        azimuth >= 0 && azimuth <= 360 && Number.isFinite(azimuth),
        `azimuth ${azimuth} out of range at ${lat}° / ${hour}h`
      );
    }
  }
});
