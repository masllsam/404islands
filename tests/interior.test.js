/**
 * The inside of the planet.
 *
 * Nothing here is tabulated except density. Mass, gravity and pressure are
 * integrated from it, which means the published numbers are genuine
 * predictions of this code rather than constants copied into it — and so they
 * are worth testing. If the integration is wrong, the core pressure comes out
 * wrong, and no amount of agreement elsewhere hides it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  density,
  temperature,
  planetProfile,
  conditionsAtDepth,
  crossSection,
  momentOfInertiaFactor,
  layerAtDepth,
  BOUNDARIES,
  EARTH_RADIUS,
} from '../app/src/core/interior.js';

const within = (actual, expected, tolerance, message) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, got ${actual}`
  );

const percentOf = (actual, expected, percent, message) =>
  within(actual, expected, Math.abs(expected) * (percent / 100), message);

test('integrating PREM reproduces the mass of the Earth', () => {
  const { totalMass } = planetProfile();
  // 5.9722e24 kg, known to about one part in ten thousand.
  percentOf(totalMass, 5.9722e24, 0.5, 'total mass');
});

test('and its mean density', () => {
  const { meanDensity } = planetProfile();
  percentOf(meanDensity, 5513, 0.5, 'mean density kg/m³');
});

test('and its surface gravity', () => {
  const { surfaceGravity } = planetProfile();
  // PREM is spherically symmetric, so this is the mean, not the WGS84 value
  // at any particular latitude.
  within(surfaceGravity, 9.82, 0.05, 'surface gravity m/s²');
});

test('and its moment of inertia factor, which is the harder constraint', () => {
  // 0.3307 measured. A uniform sphere gives 0.4; getting 0.33 out of the
  // integration is the density profile proving it has a dense core.
  within(momentOfInertiaFactor(), 0.3307, 0.004, 'I/MR²');
});

test('the pressure at the core–mantle boundary is about 136 GPa', () => {
  const cmb = conditionsAtDepth(BOUNDARIES.coreMantle);
  within(cmb.pressureGPa, 136, 3, 'CMB pressure');

  // At an exact boundary the layer reported is the one *below* it, which is
  // the useful convention: the core–mantle boundary is the top of the core.
  assert.equal(cmb.layer, 'Outer core (liquid)');
  assert.equal(layerAtDepth(BOUNDARIES.coreMantle - 1), 'Lower mantle');
});

test('the pressure at the inner core boundary is about 329 GPa', () => {
  const icb = conditionsAtDepth(BOUNDARIES.innerCore);
  within(icb.pressureGPa, 329, 6, 'ICB pressure');
});

test('the pressure at the centre is about 364 GPa — 3.6 million atmospheres', () => {
  const centre = conditionsAtDepth(BOUNDARIES.centre);
  within(centre.pressureGPa, 364, 6, 'central pressure');
  percentOf(centre.atmospheres, 3.6e6, 5, 'central pressure in atmospheres');
});

test('the atmosphere contributes one bar and nothing else', () => {
  const { pressure, steps } = planetProfile();
  within(pressure[steps], 101325, 1, 'surface pressure');

  // Its share of the central pressure: three parts in ten million.
  const share = 101325 / pressure[0];
  assert.ok(share < 1e-6, `the atmosphere is ${(share * 100).toFixed(6)}% of the core pressure`);
});

test('gravity peaks near the core–mantle boundary, not at the surface', () => {
  // A real and slightly counter-intuitive feature of a differentiated planet:
  // gravity rises going down through the mantle before falling in the core.
  const profile = planetProfile();
  let peak = 0;
  let peakDepth = 0;

  for (let i = 0; i <= profile.steps; i++) {
    if (profile.gravity[i] > peak) {
      peak = profile.gravity[i];
      peakDepth = 6371 - profile.radius[i];
    }
  }

  within(peak, 10.7, 0.4, 'peak gravity m/s²');
  assert.ok(
    Math.abs(peakDepth - BOUNDARIES.coreMantle) < 400,
    `peak gravity at ${peakDepth.toFixed(0)} km, expected near the CMB at 2891 km`
  );
  assert.ok(peak > profile.surfaceGravity, 'gravity should exceed its surface value at depth');
});

test('gravity is zero at the centre and mass is zero with it', () => {
  const profile = planetProfile();
  assert.equal(profile.gravity[0], 0);
  assert.equal(profile.mass[0], 0);
});

test('density increases monotonically inward across every boundary', () => {
  // PREM has jumps but never an inversion: nowhere is deeper material lighter.
  let previous = 0;
  for (let depth = 6371; depth >= 0; depth -= 1) {
    const rho = density(6371 - depth);
    void rho;
  }
  for (let rKm = 6371; rKm >= 0; rKm -= 1) {
    const rho = density(rKm);
    assert.ok(rho >= previous - 1, `density inverted at r=${rKm} km: ${rho} < ${previous}`);
    previous = rho;
  }
});

test('the known density values come out at the known places', () => {
  percentOf(density(6370), 1020, 1, 'ocean');
  percentOf(density(6360), 2600, 1, 'upper crust');
  percentOf(density(6350), 2900, 1, 'lower crust');
  // Just below the core–mantle boundary: liquid iron alloy, about 9900 kg/m³.
  percentOf(density(3479), 9900, 3, 'outer core top');
  // The centre: about 13 090 kg/m³.
  percentOf(density(0), 13088, 1, 'centre');
});

test('the density jump at the core–mantle boundary is the largest in the planet', () => {
  const above = density(3481);
  const below = density(3479);
  assert.ok(below - above > 4000, `CMB jump only ${(below - above).toFixed(0)} kg/m³`);
});

test('temperature rises monotonically with depth', () => {
  let previous = -Infinity;
  for (let depth = 0; depth <= 6371; depth += 5) {
    const t = temperature(depth);
    assert.ok(t >= previous - 20, `temperature fell at ${depth} km`);
    previous = Math.max(previous, t);
  }
  within(temperature(0), 288, 1, 'surface temperature');
  within(temperature(BOUNDARIES.coreMantle), 4000, 50, 'CMB temperature');
  within(temperature(BOUNDARIES.innerCore), 5400, 50, 'ICB temperature');
});

test('layers are named correctly at their own depths', () => {
  assert.equal(layerAtDepth(1), 'Ocean');
  assert.equal(layerAtDepth(10), 'Oceanic crust');
  assert.equal(layerAtDepth(200), 'Upper mantle');
  assert.equal(layerAtDepth(500), 'Transition zone');
  assert.equal(layerAtDepth(2000), 'Lower mantle');
  assert.equal(layerAtDepth(4000), 'Outer core (liquid)');
  assert.equal(layerAtDepth(6000), 'Inner core (solid)');
});

test('the cross-section is ordered, finite, and monotonic in pressure', () => {
  const section = crossSection();
  assert.equal(section.length, 9);

  let lastDepth = -1;
  let lastPressure = -1;
  for (const entry of section) {
    assert.ok(entry.depthKm > lastDepth, `${entry.name} is out of order`);
    assert.ok(entry.pressureGPa >= lastPressure, `${entry.name} pressure fell`);
    assert.ok(Number.isFinite(entry.density) && entry.density > 0);
    assert.ok(Number.isFinite(entry.gravity) && entry.gravity >= 0);
    assert.ok(Number.isFinite(entry.temperatureK) && entry.temperatureK > 0);
    lastDepth = entry.depthKm;
    lastPressure = entry.pressureGPa;
  }

  assert.equal(section[0].name, 'Sea surface');
  assert.equal(section.at(-1).name, 'Centre of the Earth');
});

test('the profile is cached rather than re-integrated', () => {
  assert.equal(planetProfile(), planetProfile());
});

test('the model uses the radius it says it does', () => {
  assert.equal(EARTH_RADIUS, 6371000);
});
