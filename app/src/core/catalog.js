/**
 * The catalogue: 404 islands, fixed forever.
 *
 * This module is the single source of truth for *what* each island is. It runs
 * identically in the browser and in Node, takes under 10 ms, and never touches
 * the network — the live climate feed decorates these islands, it does not
 * define them.
 *
 * Determinism is the product. Island #217 must be the same island tomorrow,
 * on someone else's phone, after every rewrite of the renderer.
 */

import { makeRng, hashString } from './rng.js';
import { REGIONS, climateBand, normalizeLon, formatCoord } from './geo.js';
import { ARCHETYPES, archetypeWeightsForRegion } from './archetypes.js';
import { generateName, generateEpithet } from './names.js';

export const ISLAND_COUNT = 404;

/** Bumping this re-rolls the entire atlas. It should never change again. */
export const ATLAS_SEED = hashString('404islands/atlas/v1');

/**
 * Hand out region slots proportionally to weight, then shuffle so that
 * consecutive island numbers are scattered across the world rather than
 * marching through it region by region.
 */
function assignRegions() {
  const total = REGIONS.reduce((s, r) => s + r.weight, 0);
  const slots = [];
  const remainders = [];

  for (const region of REGIONS) {
    const exact = (ISLAND_COUNT * region.weight) / total;
    const whole = Math.floor(exact);
    for (let i = 0; i < whole; i++) slots.push(region);
    remainders.push({ region, frac: exact - whole });
  }

  remainders.sort((a, b) => b.frac - a.frac || a.region.id.localeCompare(b.region.id));
  let i = 0;
  while (slots.length < ISLAND_COUNT) {
    slots.push(remainders[i % remainders.length].region);
    i++;
  }
  slots.length = ISLAND_COUNT;

  makeRng(ATLAS_SEED ^ 0x5eed).shuffle(slots);
  return slots;
}

/**
 * Terrain parameters. These map one-to-one onto uniforms in the scene shader;
 * the shader is the only place the actual heightfield maths lives, so there is
 * no second implementation to fall out of sync.
 */
function terrainParams(rng, archetype) {
  const lerp = (range) => rng.range(range[0], range[1]);
  return {
    height: lerp(archetype.height),
    sharpness: lerp(archetype.sharpness),
    ridgeMix: lerp(archetype.ridgeMix),
    warp: lerp(archetype.warp),
    freq: lerp(archetype.freq),
    octaves: archetype.octaves,
    coast: lerp(archetype.coast),
    rotation: rng.range(0, Math.PI * 2),
    anisotropy: rng.range(1.0, 1.55),
    lobes: archetype.id === 'archipelago' ? rng.int(3, 5) : 1,
    // Sub-seed for the noise field itself; separate from the identity seed so
    // that tweaking naming or metadata never reshapes the land.
    noiseSeed: (rng.int(0, 0x7fffffff) >>> 0),
  };
}

/** Surface character: what the light lands on. */
function surfaceParams(rng, lat, archetype) {
  const absLat = Math.abs(lat);
  const warmth = Math.max(0, 1 - absLat / 60);

  // Vegetation follows latitude, but atolls and sandbars are bare regardless.
  const bareness = archetype.id === 'sandbar' ? 0.85 : archetype.id === 'atoll' ? 0.55 : 0;
  const vegetation = Math.max(
    0,
    Math.min(1, warmth * rng.range(0.55, 1.15) * (1 - bareness))
  );

  return {
    vegetation,
    // Hue of the dominant canopy, degrees. Tropics run yellow-green, high
    // latitudes run blue-green.
    canopyHue: 70 + (1 - warmth) * 55 + rng.range(-10, 10),
    sandHue: 38 + rng.range(-12, 16),
    rockHue: 20 + rng.range(-8, 26),
    rockValue: rng.range(0.18, 0.42),
    // Snowline as a fraction of island height at 0 °C; the live temperature
    // feed slides this up and down every hour.
    snowlineBias: rng.range(-0.1, 0.12),
    reefWidth: archetype.id === 'atoll' ? rng.range(0.10, 0.22) : rng.range(0.03, 0.13),
    turbidity: rng.range(0.05, 0.4),
  };
}

/**
 * Traits are computed facts, never marketing. Each one is either geometry or
 * geography — something a visitor can verify by looking.
 */
function deriveTraits(island) {
  const traits = [];
  const { lat } = island;
  const a = Math.abs(lat);
  const t = island.terrain;

  if (island.archetype.id === 'atoll') traits.push({ id: 'lagoon', label: 'Enclosed lagoon' });
  if (island.archetype.id === 'archipelago' && t.lobes >= 4)
    traits.push({ id: 'scatter', label: `${t.lobes}-lobe scatter` });
  if (t.height >= 0.88) traits.push({ id: 'highrelief', label: 'High relief' });
  if (t.height <= 0.12) traits.push({ id: 'lowfreeboard', label: 'Sub-metre freeboard' });
  if (t.anisotropy > 1.42) traits.push({ id: 'elongate', label: 'Elongate' });
  if (a > 66.5) traits.push({ id: 'midnightsun', label: 'Midnight sun' });
  else if (a > 55) traits.push({ id: 'auroral', label: 'Auroral latitude' });
  if (a < 2.5) traits.push({ id: 'equatorial', label: 'On the line' });
  if (island.surface.vegetation < 0.08) traits.push({ id: 'bare', label: 'Unvegetated' });
  if (island.surface.vegetation > 0.85) traits.push({ id: 'rainforest', label: 'Closed canopy' });
  if (island.archetype.id === 'karst') traits.push({ id: 'towers', label: 'Limestone towers' });
  if (island.archetype.id === 'fjordland' && t.sharpness > 1.7)
    traits.push({ id: 'sheer', label: 'Sheer walls' });

  return traits;
}

/**
 * A 0..1 measure of how unusual an island is within the atlas. Drives the
 * ordering of the "Singular" filter and nothing else — it is descriptive,
 * not a price tag.
 */
function singularity(island) {
  let s = 0;
  s += (1 - island.archetype.rarity) * 0.45;
  s += Math.min(1, island.traits.length / 4) * 0.3;
  s += Math.min(1, Math.abs(island.lat) / 80) * 0.15;
  s += Math.abs(island.terrain.height - 0.45) * 0.2;
  return Math.max(0, Math.min(1, s));
}

function buildIsland(number, region) {
  const seed = hashString(`404islands/island/${number}`) ^ ATLAS_SEED;
  const rng = makeRng(seed);

  const weights = archetypeWeightsForRegion(region);
  const archetype = rng.weighted(ARCHETYPES, weights);

  // Push coordinates slightly inside the bounding box so an island never sits
  // exactly on a region seam.
  const pad = 0.06;
  const lat = rng.range(
    region.lat[0] + (region.lat[1] - region.lat[0]) * pad,
    region.lat[1] - (region.lat[1] - region.lat[0]) * pad
  );
  const lon = normalizeLon(
    rng.range(
      region.lon[0] + (region.lon[1] - region.lon[0]) * pad,
      region.lon[1] - (region.lon[1] - region.lon[0]) * pad
    )
  );

  const terrain = terrainParams(rng, archetype);
  const surface = surfaceParams(rng, lat, archetype);
  const name = generateName(rng, region.family);
  const epithet = rng.chance(0.12) ? generateEpithet(rng) : null;

  const island = {
    number,
    id: String(number).padStart(3, '0'),
    seed,
    name,
    epithet,
    fullName: epithet ? `${name}, ${epithet}` : name,
    region,
    ocean: region.ocean,
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
    coordLabel: formatCoord(lat, lon),
    band: climateBand(lat),
    archetype,
    terrain,
    surface,
  };

  island.traits = deriveTraits(island);
  island.singularity = Number(singularity(island).toFixed(4));
  return island;
}

let cached = null;

/** The full atlas. Built once per process, then shared. */
export function getAtlas() {
  if (cached) return cached;

  const regions = assignRegions();
  const islands = [];
  for (let i = 0; i < ISLAND_COUNT; i++) {
    islands.push(buildIsland(i + 1, regions[i]));
  }

  cached = {
    islands,
    byNumber: new Map(islands.map((i) => [i.number, i])),
    generatedAt: Date.now(),
  };
  return cached;
}

/** One island by its number, 1–404. Returns null for anything else. */
export function getIsland(number) {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1 || n > ISLAND_COUNT) return null;
  return getAtlas().byNumber.get(n) || null;
}

/**
 * A compact record safe to send over the wire or store — drops the shared
 * region/archetype objects in favour of their ids.
 */
export function serializeIsland(island) {
  return {
    number: island.number,
    id: island.id,
    seed: island.seed,
    name: island.name,
    epithet: island.epithet,
    regionId: island.region.id,
    regionName: island.region.name,
    ocean: island.ocean,
    lat: island.lat,
    lon: island.lon,
    band: island.band,
    archetype: island.archetype.id,
    traits: island.traits.map((t) => t.id),
    singularity: island.singularity,
    terrain: island.terrain,
    surface: island.surface,
  };
}
