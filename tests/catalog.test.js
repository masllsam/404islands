/**
 * The catalogue is a promise: island #217 is the same island tomorrow, on
 * someone else's machine, after every rewrite. These tests are what makes that
 * promise checkable rather than merely intended.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  getAtlas,
  getIsland,
  serializeIsland,
  ISLAND_COUNT,
} from '../app/src/core/catalog.js';
import { REGION_BY_ID } from '../app/src/core/geo.js';
import { ARCHETYPE_BY_ID } from '../app/src/core/archetypes.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

test('the atlas holds exactly 404 islands, numbered 1 to 404', () => {
  const { islands } = getAtlas();
  assert.equal(islands.length, ISLAND_COUNT);
  assert.equal(islands[0].number, 1);
  assert.equal(islands.at(-1).number, ISLAND_COUNT);

  const numbers = new Set(islands.map((i) => i.number));
  assert.equal(numbers.size, ISLAND_COUNT);
});

test('getIsland rejects anything outside 1–404', () => {
  assert.equal(getIsland(0), null);
  assert.equal(getIsland(405), null);
  assert.equal(getIsland(-1), null);
  assert.equal(getIsland(1.5), null);
  assert.equal(getIsland('nope'), null);
  assert.equal(getIsland(1).number, 1);
  assert.equal(getIsland('404').number, 404);
});

test('every island has a unique name', () => {
  const names = new Set(getAtlas().islands.map((i) => i.name));
  assert.equal(names.size, ISLAND_COUNT, 'two islands share a name');
});

test('every island sits inside its own region’s bounding box', () => {
  for (const island of getAtlas().islands) {
    const region = REGION_BY_ID.get(island.region.id);
    assert.ok(region, `unknown region on island ${island.number}`);
    assert.ok(
      island.lat >= region.lat[0] && island.lat <= region.lat[1],
      `island ${island.number} latitude ${island.lat} outside ${region.id}`
    );

    // Longitudes are normalised to [-180, 180); regions are declared the same
    // way, so a straight comparison is valid.
    assert.ok(
      island.lon >= region.lon[0] - 0.001 && island.lon <= region.lon[1] + 0.001,
      `island ${island.number} longitude ${island.lon} outside ${region.id}`
    );
  }
});

test('terrain parameters stay inside their archetype’s declared ranges', () => {
  for (const island of getAtlas().islands) {
    const archetype = ARCHETYPE_BY_ID.get(island.archetype.id);
    const t = island.terrain;
    const within = (value, [lo, hi], name) =>
      assert.ok(
        value >= lo && value <= hi,
        `island ${island.number} ${name}=${value} outside [${lo}, ${hi}] for ${archetype.id}`
      );

    within(t.height, archetype.height, 'height');
    within(t.sharpness, archetype.sharpness, 'sharpness');
    within(t.ridgeMix, archetype.ridgeMix, 'ridgeMix');
    within(t.warp, archetype.warp, 'warp');
    within(t.freq, archetype.freq, 'freq');
    within(t.coast, archetype.coast, 'coast');
    assert.ok(t.rotation >= 0 && t.rotation < Math.PI * 2);
    assert.ok(t.anisotropy >= 1 && t.anisotropy <= 1.6);
    assert.ok(Number.isInteger(t.noiseSeed) && t.noiseSeed >= 0);
  }
});

test('no polar atolls and no tropical fjords', () => {
  for (const island of getAtlas().islands) {
    const absLat = Math.abs(island.lat);
    if (island.archetype.id === 'atoll') {
      assert.ok(absLat < 55, `atoll at ${island.lat}° (island ${island.number})`);
    }
    if (island.archetype.id === 'fjordland') {
      assert.ok(absLat > 23, `fjord at ${island.lat}° (island ${island.number})`);
    }
  }
});

test('serialisation keeps everything the renderer needs', () => {
  const island = getIsland(217);
  const wire = serializeIsland(island);

  assert.equal(wire.number, 217);
  assert.equal(wire.archetype, island.archetype.id);
  assert.equal(wire.regionId, island.region.id);
  assert.deepEqual(wire.terrain, island.terrain);
  assert.deepEqual(wire.surface, island.surface);
  assert.ok(JSON.stringify(wire).length > 0);
});

test('the atlas is identical in a completely separate process', () => {
  const script = `
    import { getAtlas } from ${JSON.stringify(join(ROOT, 'app/src/core/catalog.js'))};
    import { createHash } from 'node:crypto';
    const digest = createHash('sha256')
      .update(JSON.stringify(getAtlas().islands.map((i) => [
        i.number, i.seed, i.name, i.epithet, i.lat, i.lon,
        i.archetype.id, i.region.id, i.terrain, i.surface,
      ])))
      .digest('hex');
    process.stdout.write(digest);
  `;

  const runs = [0, 1].map(() =>
    execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
      encoding: 'utf8',
      cwd: ROOT,
    })
  );

  assert.equal(runs[0], runs[1], 'the atlas differs between processes');
  assert.match(runs[0], /^[0-9a-f]{64}$/);
});

test('the atlas is built once and shared', () => {
  assert.equal(getAtlas(), getAtlas());
  assert.equal(getIsland(42), getIsland(42));
});
