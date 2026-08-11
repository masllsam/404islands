/**
 * How islands are built and taken apart.
 *
 * These are published, measured rates, so the tests check against the
 * literature rather than against previous output: the Parsons–Sclater cooling
 * law, coral accretion limits, denudation rates measured on real volcanic
 * islands, and the age progression along the Hawaiian–Emperor chain.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  seafloorDepth,
  subsidenceRate,
  erosionRate,
  reefAccretion,
  stageForAge,
  islandAge,
  islandHistory,
  impliedPressureGradient,
  lithostaticGradient,
  ARCHETYPE_AGE_MYR,
  STAGES,
} from '../app/src/core/geology.js';
import {
  normalGravity,
  gravityAtHeight,
  coriolisParameter,
  inertialPeriodHours,
  isostaticRoot,
  atmosphericColumn,
  boilingPoint,
  geocentricRadius,
} from '../app/src/core/geodesy.js';
import { getAtlas, getIsland } from '../app/src/core/catalog.js';

const within = (actual, expected, tolerance, message) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected} ± ${tolerance}, got ${actual}`
  );

// ── Plate cooling ────────────────────────────────────────────────────────

test('the seafloor deepens as the square root of its age', () => {
  // Parsons & Sclater: 2500 m at a ridge crest, ~5600 m at 80 Myr.
  within(seafloorDepth(0), 2500, 1, 'ridge crest depth');
  within(seafloorDepth(1), 2850, 1, 'depth at 1 Myr');
  within(seafloorDepth(25), 4250, 5, 'depth at 25 Myr');
  within(seafloorDepth(80), 5630, 20, 'depth at 80 Myr');

  // Monotonic, and it flattens rather than deepening without limit.
  let previous = 0;
  for (let t = 0; t <= 180; t += 1) {
    const d = seafloorDepth(t);
    assert.ok(d >= previous, `depth decreased at ${t} Myr`);
    assert.ok(d < 7000, `depth ${d.toFixed(0)} m at ${t} Myr is deeper than any ocean basin`);
    previous = d;
  }
});

test('subsidence is fastest when the plate is young', () => {
  // The derivative of a square root: steep at first, then slackening.
  const young = subsidenceRate(1);
  const middling = subsidenceRate(25);
  const old = subsidenceRate(80);

  assert.ok(young > middling && middling > old, 'subsidence should slow with age');

  // Hawaiian-type islands subside at a few tenths of a millimetre a year.
  within(young * 1000, 0.175, 0.02, 'subsidence at 1 Myr, mm/yr');
  assert.ok(middling * 1000 < 0.05, 'a 25 Myr plate should be nearly done sinking');
});

// ── Erosion ──────────────────────────────────────────────────────────────

test('erosion scales with rainfall and with relief', () => {
  // Measured denudation on wet volcanic islands: 0.02–0.3 mm/yr.
  const hawaiian = erosionRate(2000, 1000) * 1000;
  within(hawaiian, 0.2, 0.05, 'wet island denudation, mm/yr');

  // Twice the rain, twice the erosion; twice the relief, twice again.
  within(erosionRate(4000, 1000), 2 * erosionRate(2000, 1000), 1e-12, 'linear in rainfall');
  within(erosionRate(2000, 2000), 2 * erosionRate(2000, 1000), 1e-12, 'linear in relief');

  // A desert island barely erodes at all.
  assert.ok(erosionRate(50, 500) * 1000 < 0.01, 'an arid island should barely erode');
  assert.equal(erosionRate(0, 1000), 0);
});

// ── Reefs ────────────────────────────────────────────────────────────────

test('coral grows in warm shallow water and nowhere else', () => {
  // Peak accretion near 26 °C, up to about 10 mm/yr.
  const optimum = reefAccretion(26, 0) * 1000;
  within(optimum, 10, 0.5, 'peak reef accretion, mm/yr');

  // Cold water stops it outright.
  assert.equal(reefAccretion(15), 0, 'coral should not grow at 15 °C');
  assert.equal(reefAccretion(10), 0);

  // And so does depth: below about 20 m the light has gone.
  assert.equal(reefAccretion(26, 25), 0, 'coral should not grow at 25 m depth');
  assert.ok(reefAccretion(26, 10) < reefAccretion(26, 0), 'accretion should fall with depth');
});

test('reef growth outruns subsidence, which is why atolls exist at all', () => {
  // Darwin's mechanism in one assertion: coral can build upward an order of
  // magnitude faster than the plate sinks, so a reef keeps its summit at the
  // surface while the volcano beneath it disappears.
  const accretion = reefAccretion(26, 0);
  const sinking = subsidenceRate(20);
  assert.ok(
    accretion > sinking * 10,
    `accretion ${(accretion * 1000).toFixed(2)} mm/yr vs subsidence ${(sinking * 1000).toFixed(3)} mm/yr`
  );
});

// ── The Darwin sequence ──────────────────────────────────────────────────

test('the stages run in order with age, as they do along the Hawaiian chain', () => {
  const order = ['seamount', 'shield', 'dissected', 'fringing', 'barrier', 'atoll', 'guyot'];
  const seen = [];

  for (const age of [0.1, 1, 3, 7, 15, 28, 50]) {
    seen.push(stageForAge(age, { seaTemperatureC: 26 }).id);
  }
  assert.deepEqual(seen, order);
});

test('cold water gives no atolls, only erosion and then drowning', () => {
  // There are no coral atolls off Norway, and the model has to agree.
  for (const age of [7, 15, 28]) {
    const stage = stageForAge(age, { seaTemperatureC: 8 });
    assert.ok(
      ['dissected', 'guyot'].includes(stage.id),
      `cold water produced a ${stage.id} at ${age} Myr`
    );
  }
  assert.equal(stageForAge(50, { seaTemperatureC: 8 }).id, 'guyot');
});

test('every archetype implies a plausible age, and every island gets one', () => {
  for (const island of getAtlas().islands) {
    const age = islandAge(island);
    const [lo, hi] = ARCHETYPE_AGE_MYR[island.archetype.id];
    assert.ok(age >= lo && age <= hi, `island ${island.number} aged ${age} outside [${lo}, ${hi}]`);
    // Deterministic, like everything else in the catalogue.
    assert.equal(age, islandAge(island));
  }
});

test('sandbars are the youngest things in the atlas and atolls among the oldest', () => {
  const ages = {};
  for (const island of getAtlas().islands) {
    (ages[island.archetype.id] ||= []).push(islandAge(island));
  }
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

  assert.ok(mean(ages.sandbar) < 1, 'sandbars should be young');
  assert.ok(mean(ages.atoll) > 15, 'atolls should be old');
  assert.ok(mean(ages.volcanic) < mean(ages.atoll), 'volcanoes are younger than atolls');
});

test('an island history balances four competing rates', () => {
  const island = getIsland(217); // an atoll
  const history = islandHistory(island, {
    precipitationMmYr: 2000,
    seaTemperatureC: 27,
    reliefMetres: 150,
  });

  assert.ok(history.ageMyr > 0);
  assert.ok(STAGES.some((s) => s.id === history.stage.id));
  for (const key of ['building', 'reefAccretion', 'subsidence', 'erosion', 'net']) {
    assert.ok(Number.isFinite(history.rates[key]), `${key} is not finite`);
  }

  // On a warm atoll the reef should be winning, or it would not be an atoll.
  assert.ok(history.rates.reefAccretion > history.rates.subsidence);
  assert.ok(history.driftKm > 0, 'an old island should have travelled');
  assert.ok(history.subsidenceSinceFormationM > 0, 'and sunk');
});

test('a wet island erodes faster than a dry one, from live rainfall', () => {
  const island = getIsland(42);
  const dry = islandHistory(island, {
    precipitationMmYr: 200,
    seaTemperatureC: 27,
    reliefMetres: 800,
  });
  const wet = islandHistory(island, {
    precipitationMmYr: 4000,
    seaTemperatureC: 27,
    reliefMetres: 800,
  });

  assert.ok(
    wet.rates.erosion > dry.rates.erosion * 10,
    'rainfall should drive denudation'
  );
  assert.equal(wet.ageMyr, dry.ageMyr, 'the age is a property of the island, not the weather');
});

// ── Pressure ─────────────────────────────────────────────────────────────

test('the wind implies a real pressure gradient, except on the equator', () => {
  // A 20 m/s wind at 45° implies a few hPa per hundred kilometres, which is
  // what a synoptic chart looks like.
  const midLatitude = impliedPressureGradient(45, 20);
  assert.equal(midLatitude.valid, true);
  within(midLatitude.hPaPer100km, 2.5, 0.6, 'implied gradient, hPa/100 km');

  // Geostrophic balance fails where the Coriolis force vanishes, and the model
  // says so rather than returning a number it cannot justify.
  assert.equal(impliedPressureGradient(0, 20).valid, false);
  assert.equal(impliedPressureGradient(2, 20).valid, false);
  assert.equal(impliedPressureGradient(-45, 20).valid, true);

  // Stronger wind, steeper gradient.
  assert.ok(
    impliedPressureGradient(45, 40).hPaPer100km >
      impliedPressureGradient(45, 20).hPaPer100km
  );
});

test('rock pressure rises about 25 kPa for every metre of depth', () => {
  const gradient = lithostaticGradient(2900, 9.81);
  within(gradient / 1000, 28.4, 0.5, 'basalt gradient, kPa/m');
  // A hundred metres of basalt outweighs the entire atmosphere.
  assert.ok(gradient * 100 > 101325 * 25);
});

// ── Geodesy ──────────────────────────────────────────────────────────────

test('gravity varies with latitude exactly as WGS84 says', () => {
  within(normalGravity(0), 9.7803253359, 1e-6, 'equatorial gravity');
  within(normalGravity(90), 9.8321849, 1e-4, 'polar gravity');
  within(normalGravity(45), 9.806, 0.002, 'gravity at 45°');
  // Symmetric about the equator.
  within(normalGravity(-30), normalGravity(30), 1e-12, 'hemispheric symmetry');
});

test('gravity falls with height, and a person is measurably lighter on a summit', () => {
  const sea = normalGravity(20);
  const summit = gravityAtHeight(20, 900);
  assert.ok(summit < sea);
  within((sea - summit) * 1e6, 2777, 5, 'free-air drop over 900 m, µm/s²');

  // An 80 kg person loses about 23 g going up 900 m.
  const grams = ((sea - summit) / sea) * 80 * 1000;
  within(grams, 22.7, 1, 'weight loss in grams');
});

test('the Earth is wider at the equator than at the poles', () => {
  within(geocentricRadius(0) / 1000, 6378.137, 0.001, 'equatorial radius km');
  within(geocentricRadius(90) / 1000, 6356.752, 0.001, 'polar radius km');
  assert.ok(geocentricRadius(0) - geocentricRadius(90) > 21000, 'flattening is ~21 km');
});

test('Coriolis vanishes on the equator and peaks at the poles', () => {
  assert.equal(coriolisParameter(0), 0);
  within(coriolisParameter(90), 1.4584e-4, 1e-8, 'polar Coriolis parameter');
  assert.ok(coriolisParameter(-45) < 0, 'the southern hemisphere turns the other way');
  within(inertialPeriodHours(45), 16.9, 0.2, 'inertial period at 45°, hours');
  assert.equal(inertialPeriodHours(0), Infinity);
});

test('an island needs a root about seven times its height', () => {
  const root = isostaticRoot(1000);
  within(root.ratio, 7.25, 0.01, 'Airy ratio for basalt on peridotite');
  within(root.rootMetres, 7250, 10, 'root beneath a 1 km island');
  assert.equal(root.model, 'Airy');
});

test('the air column follows the live pressure that is fed to it', () => {
  // A standard day at sea level, on a 900 m island.
  const column = atmosphericColumn(20, 900, 1013.25, 25);

  assert.ok(column.summitHpa < 1013.25, 'pressure must fall with height');
  within(column.dropHpa, 103, 8, 'pressure drop over 900 m, hPa');
  within(column.airDensity, 1.18, 0.03, 'air density at 25 °C, kg/m³');
  within(column.scaleHeightMetres, 8730, 200, 'scale height, m');
  within(column.summitTemperatureC, 19.15, 0.1, 'summit temperature at ISA lapse rate');

  // The whole atmosphere weighs about 10 tonnes per square metre.
  within(column.columnMassKgPerM2, 10330, 60, 'atmospheric column mass, kg/m²');

  // A storm低 changes the answer, which is the point of using live data.
  const storm = atmosphericColumn(20, 900, 975, 25);
  assert.ok(storm.summitPa < column.summitPa, 'a deeper low means lower summit pressure');
});

test('water boils below 100 °C on a summit', () => {
  within(boilingPoint(101325), 100, 0.2, 'boiling point at sea level');
  const summit = atmosphericColumn(20, 900, 1013.25, 25);
  within(summit.boilingPointC, 96.9, 0.6, 'boiling point at 900 m');
  assert.ok(summit.boilingPointC < 100);
});

test('reef growth is not added to the island’s height', () => {
  // Coral grows up to sea level and stops. It cannot lift a summit, so it must
  // not appear in the land's budget — the first draft summed it in and made
  // every warm island appear to be gaining a centimetre a year.
  const island = getIsland(217);
  const warm = islandHistory(island, {
    precipitationMmYr: 2000,
    seaTemperatureC: 27,
    reliefMetres: 173,
  });

  assert.ok(warm.rates.reefAccretion > 0.009, 'the reef should be growing fast');
  assert.ok(
    warm.rates.net < 0,
    `an old eroding atoll must be losing land, got ${warm.ratesMmYr.net.toFixed(3)} mm/yr`
  );

  // The net is exactly construction minus the two losses, with no reef in it.
  const expected = warm.rates.building - warm.rates.subsidence - warm.rates.erosion;
  within(warm.rates.net, expected, 1e-15, 'net excludes reef accretion');

  // And the reef is reported as a race against subsidence instead.
  assert.equal(warm.reefWinning, true);
  within(
    warm.reefMarginMmYr,
    (warm.rates.reefAccretion - warm.rates.subsidence) * 1000,
    1e-9,
    'reef margin'
  );
});

test('a cold island has no reef to save it', () => {
  const island = getAtlas().islands.find((i) => Math.abs(i.lat) > 55);
  const history = islandHistory(island, {
    precipitationMmYr: 1200,
    seaTemperatureC: 6,
    reliefMetres: 600,
  });

  assert.equal(history.reefCapable, false);
  assert.equal(history.rates.reefAccretion, 0);
  assert.equal(history.reefWinning, false);
  assert.ok(history.rates.net < 0, 'with nothing building, it can only lose');
  assert.ok(Number.isFinite(history.yearsRemaining), 'and it has a finite lifetime');
});

test('the dominant process describes the land, not the reef', () => {
  // Reef accretion is an order of magnitude larger than any land process, so
  // including it would make every warm island "dominated by reef growth" and
  // say nothing about the island itself.
  const island = getIsland(217);
  const history = islandHistory(island, {
    precipitationMmYr: 2000,
    seaTemperatureC: 27,
    reliefMetres: 173,
  });
  assert.ok(
    ['Volcanism', 'Subsidence', 'Erosion'].includes(history.dominant.name),
    `dominant process was "${history.dominant.name}"`
  );
});
