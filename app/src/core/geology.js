/**
 * How an island is built, and how it is taken apart again.
 *
 * The terrain in this atlas is fractal noise, and fractal noise is not how
 * mountains form. This module is the process behind the shape: the four
 * competing rates that decide what an oceanic island looks like at any moment
 * in its life.
 *
 *   **Construction.** Magma arrives and piles up. A Hawaiian-type hotspot
 *   delivers on the order of 0.1 km³/yr, which builds a shield volcano from
 *   the abyssal plain to several kilometres above the sea in under a million
 *   years — geologically, almost instantly.
 *
 *   **Subsidence.** The plate the island rides on cools as it moves away from
 *   its ridge, and cooling lithosphere is denser lithosphere, so it sinks.
 *   Parsons & Sclater (1977) give the depth of normal ocean floor as
 *   2500 + 350·√t metres for an age t in millions of years — a square-root
 *   law, because it is a diffusive cooling problem. The island sinks with it.
 *
 *   **Erosion.** Rain takes the mountain apart. Denudation scales with both
 *   rainfall and relief, which is why this module takes the island's *live*
 *   precipitation: a wet island is being dismantled measurably faster than a
 *   dry one, right now.
 *
 *   **Reef accretion.** In warm water, coral grows upward — up to about
 *   10 mm/yr, far faster than the plate sinks. This is Darwin's insight from
 *   the Beagle, published in 1842 and confirmed by drilling at Enewetak in
 *   1952: a fringing reef becomes a barrier reef becomes an atoll, not because
 *   three different things happened, but because one volcano sank slowly
 *   enough for the coral to keep up.
 *
 * Which is why the seven archetypes in this atlas are not seven unrelated
 * categories. Most of them are one island at different ages.
 */

/**
 * Where the square-root cooling law gives way to a flattening plate, and the
 * constants that make the transition continuous in both depth and slope:
 * 2500 + 350·√80 = 5630 m, and a slope of 350/(2·√80) = 19.57 m/Myr.
 */
const PLATE_FLATTENS_MYR = 80;
const PLATE_ASYMPTOTE_M = 770; // 6400 − 5630
const PLATE_TAU_MYR = PLATE_ASYMPTOTE_M / (350 / (2 * Math.sqrt(PLATE_FLATTENS_MYR)));

/** Rates in metres per year unless noted. */
export const RATES = {
  /** Coral vertical accretion, healthy reef in warm water. */
  reefAccretionMax: 0.010,
  /** Typical Hawaiian-type island subsidence. */
  subsidenceTypical: 0.00026,
  /** Hotspot magma supply, km³/yr. */
  magmaSupply: 0.1,
  /** Plate speed, m/yr. */
  plateSpeed: 0.09,
};

/**
 * Depth of normal ocean floor at age `ageMyr`, in metres below sea level.
 * Parsons & Sclater's square-root-of-age law, which holds to about 80 Myr
 * before the plate stops cooling appreciably and flattens out.
 */
export function seafloorDepth(ageMyr) {
  const t = Math.max(0, ageMyr);
  if (t < PLATE_FLATTENS_MYR) return 2500 + 350 * Math.sqrt(t);

  // Beyond about 80 Myr the plate has cooled through and stops deepening as
  // √t, approaching a steady state near 6400 m. The constants are chosen so
  // that both the depth *and* its slope are continuous at the join — the
  // first draft was not, and dropped the ocean floor two kilometres in one
  // step at exactly 80 Myr.
  return 6400 - PLATE_ASYMPTOTE_M * Math.exp(-(t - PLATE_FLATTENS_MYR) / PLATE_TAU_MYR);
}

/**
 * How fast the plate is sinking at that age, in metres per year.
 * The derivative of the cooling law: fastest when young, slowing as √t.
 */
export function subsidenceRate(ageMyr) {
  const t = Math.max(0.01, ageMyr);
  if (t < PLATE_FLATTENS_MYR) return 350 / (2 * Math.sqrt(t)) / 1e6;
  return (
    (PLATE_ASYMPTOTE_M / PLATE_TAU_MYR) *
    Math.exp(-(t - PLATE_FLATTENS_MYR) / PLATE_TAU_MYR) /
    1e6
  );
}

/**
 * Denudation rate in metres per year.
 *
 * Erosion of a volcanic island scales with how much rain falls on it and how
 * steep it is — the stream-power family of laws. Calibrated against measured
 * rates on Hawaii and Réunion, which run 0.02–0.3 mm/yr under 1–3 m of annual
 * rainfall at kilometre relief.
 *
 * @param {number} precipitationMmYr  Annual rainfall, mm.
 * @param {number} reliefMetres       Height above the sea.
 */
export function erosionRate(precipitationMmYr, reliefMetres) {
  const rain = Math.max(0, precipitationMmYr);
  const relief = Math.max(0, reliefMetres);
  // 0.0001 mm/yr per (mm/yr of rain) per km of relief, in metres per year.
  return (1e-4 * rain * (relief / 1000)) / 1000;
}

/**
 * Whether the reef can keep up with the sinking.
 *
 * Coral needs warmth and light: it accretes fastest between about 23 °C and
 * 29 °C, stops below roughly 18 °C, and drowns if it falls more than about
 * 20 m below the surface, where the light runs out.
 */
export function reefAccretion(seaTemperatureC, depthBelowSurfaceM = 0) {
  if (seaTemperatureC < 18) return 0;

  // A broad thermal optimum, tailing off either side.
  const warmth = Math.exp(-(((seaTemperatureC - 26) / 6) ** 2));
  // Light falls off with depth; below ~20 m accretion effectively stops.
  const light = Math.max(0, 1 - Math.max(0, depthBelowSurfaceM) / 20);

  return RATES.reefAccretionMax * warmth * light;
}

/**
 * The stages of Darwin's sequence, and what an island looks like in each.
 */
export const STAGES = [
  {
    id: 'seamount',
    name: 'Submarine seamount',
    detail: 'Building, still below the surface. Magma arriving faster than the sea can quench it.',
  },
  {
    id: 'shield',
    name: 'Shield volcano',
    detail: 'Emergent and growing. Construction outruns everything trying to remove it.',
  },
  {
    id: 'dissected',
    name: 'Dissected volcano',
    detail: 'The supply has moved on with the plate. Rain is now the fastest process here, cutting the cone into ridges and amphitheatre valleys.',
  },
  {
    id: 'fringing',
    name: 'Fringing reef',
    detail: 'Coral has taken the shoreline. The island is sinking, slowly, and the reef is keeping pace at the edge.',
  },
  {
    id: 'barrier',
    name: 'Barrier reef',
    detail: 'The reef has held its level while the land behind it sank, opening a lagoon between the two.',
  },
  {
    id: 'atoll',
    name: 'Atoll',
    detail: 'The volcano is gone beneath the lagoon. Only the ring it grew is still at the surface, still building upward on a column of its own dead coral.',
  },
  {
    id: 'guyot',
    name: 'Guyot',
    detail: 'The reef lost the race. A flat-topped drowned seamount, its summit planed off at the sea level of the day it died.',
  },
];

export const STAGE_BY_ID = new Map(STAGES.map((s) => [s.id, s]));

/**
 * Which stage an island of a given age and setting is in.
 *
 * Ages follow the Hawaiian–Emperor chain, where the progression from Kīlauea
 * to Midway is laid out along 2500 km of plate motion and reads as a clock.
 */
export function stageForAge(ageMyr, { seaTemperatureC = 26, reefCapable = true } = {}) {
  const canReef = reefCapable && seaTemperatureC >= 18;

  if (ageMyr < 0.3) return STAGE_BY_ID.get('seamount');
  if (ageMyr < 2) return STAGE_BY_ID.get('shield');
  if (ageMyr < 5) return STAGE_BY_ID.get('dissected');

  if (!canReef) {
    // Too cold for coral: the island simply erodes and sinks, with nothing
    // building upward to replace it. This is why there are no atolls off
    // Norway, only skerries and then nothing.
    return ageMyr < 25 ? STAGE_BY_ID.get('dissected') : STAGE_BY_ID.get('guyot');
  }

  if (ageMyr < 10) return STAGE_BY_ID.get('fringing');
  if (ageMyr < 20) return STAGE_BY_ID.get('barrier');
  if (ageMyr < 35) return STAGE_BY_ID.get('atoll');
  return STAGE_BY_ID.get('guyot');
}

/**
 * The age each archetype implies.
 *
 * The catalogue's archetypes were fixed before this module existed, so this
 * reads them rather than the other way round — the island is what it is, and
 * this is how old something that looks like that would have to be. A shield
 * volcano is young by necessity; an atoll cannot be.
 */
export const ARCHETYPE_AGE_MYR = {
  volcanic: [0.4, 4],
  karst: [8, 40], // uplifted and dissolved limestone: old rock, young landscape
  archipelago: [3, 15],
  plateau: [10, 60], // uplifted carbonate platform
  fjordland: [1, 20], // the landscape is glacial, and glacial means recent
  atoll: [18, 34],
  sandbar: [0.01, 0.5], // sediment, not rock: the youngest thing in the atlas
};

/**
 * A deterministic age for an island, consistent with what it looks like.
 * Derived from the seed, so it is as permanent as everything else.
 */
export function islandAge(island) {
  const range = ARCHETYPE_AGE_MYR[island.archetype.id] || [1, 10];
  // A stable fraction from the seed's high bits, which nothing else uses.
  const fraction = ((island.seed >>> 18) % 4096) / 4096;
  return range[0] + (range[1] - range[0]) * fraction;
}

/**
 * The whole history and future of one island, as rates that can be compared.
 *
 * This is where "how mountains form" becomes a number: at any moment the
 * island is gaining height from volcanism and reef growth, and losing it to
 * subsidence and erosion. Which sum wins decides what happens next.
 *
 * @param {object} island
 * @param {object} conditions  Live values: precipitation mm/yr, sea temp °C,
 *   and the island's relief in metres.
 */
export function islandHistory(island, { precipitationMmYr, seaTemperatureC, reliefMetres }) {
  const ageMyr = islandAge(island);
  const absLat = Math.abs(island.lat);
  const reefCapable = absLat < 32 && island.archetype.id !== 'fjordland';

  const subsiding = subsidenceRate(ageMyr);
  const eroding = erosionRate(precipitationMmYr, reliefMetres);
  const reefing = reefCapable ? reefAccretion(seaTemperatureC) : 0;

  // Construction only continues while the island sits over its magma source.
  const building = ageMyr < 2 ? 0.002 : ageMyr < 4 ? 0.0002 : 0;

  // The land's own budget. Reef accretion is deliberately *not* in this sum:
  // coral grows upward to sea level and stops, so it cannot lift a summit —
  // it can only hold a ring at the surface. Adding it here made every warm
  // island appear to be gaining a centimetre a year, which is nonsense.
  const net = building - subsiding - eroding;

  // The race that decides whether anything is left at the surface once the
  // volcano has gone: coral building up against the plate sinking down. This
  // is Darwin's mechanism stated as an inequality.
  const reefWinning = reefing > subsiding;
  const reefMargin = reefing - subsiding;

  const stage = stageForAge(ageMyr, { seaTemperatureC, reefCapable });

  // How long the island has left above water at the present net rate. Only
  // meaningful when it is losing; a growing island has no such number.
  const yearsRemaining = net < 0 ? reliefMetres / -net : Infinity;

  return {
    ageMyr,
    stage,
    reefCapable,
    rates: {
      building,
      reefAccretion: reefing,
      subsidence: subsiding,
      erosion: eroding,
      net,
    },
    /** Millimetres per year, which is the unit geologists actually speak in. */
    ratesMmYr: {
      building: building * 1000,
      reefAccretion: reefing * 1000,
      subsidence: subsiding * 1000,
      erosion: eroding * 1000,
      net: net * 1000,
    },
    reefWinning,
    reefMarginMmYr: reefMargin * 1000,
    dominant: dominantProcess({ building, reefing, subsiding, eroding }),
    yearsRemaining,
    /** How far the plate beneath it has sunk since it formed. */
    subsidenceSinceFormationM: seafloorDepth(ageMyr) - seafloorDepth(0),
    /** How far it has travelled from where it was built. */
    driftKm: (ageMyr * 1e6 * RATES.plateSpeed) / 1000,
    seafloorDepthM: seafloorDepth(ageMyr),
  };
}

/**
 * Which process is doing most to the *land*. The reef is excluded for the same
 * reason it is excluded from the net: it is not acting on the island's height,
 * it is racing the plate at the waterline.
 */
function dominantProcess({ building, subsiding, eroding }) {
  const entries = [
    ['Volcanism', building],
    ['Subsidence', subsiding],
    ['Erosion', eroding],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0], rateMmYr: entries[0][1] * 1000 };
}

/**
 * Lithostatic pressure gradient in the island's own rock, in pascals per metre.
 * About 25 kPa per metre in basalt — a hundred metres down is already a
 * quarter of the atmosphere's entire weight.
 */
export function lithostaticGradient(densityKgM3, gravity) {
  return densityKgM3 * gravity;
}

/**
 * The synoptic pressure gradient implied by the wind actually blowing.
 *
 * Above the friction layer, wind follows geostrophic balance: the Coriolis
 * force balances the pressure-gradient force, so v = (1/ρf)·∂p/∂n. Running it
 * backwards turns a measured wind speed into the pressure difference driving
 * it — which is a real pressure difference, inferred from a real measurement,
 * without asking the API for a second point.
 *
 * Meaningless within a few degrees of the equator, where f goes to zero and
 * the balance does not hold. That is reported rather than papered over.
 */
export function impliedPressureGradient(latitude, windSpeedMs, airDensity = 1.225) {
  const omega = 7.292115e-5;
  const f = 2 * omega * Math.sin((latitude * Math.PI) / 180);

  if (Math.abs(f) < 2e-5) {
    return {
      valid: false,
      reason: 'Too near the equator for geostrophic balance to mean anything.',
      hPaPer100km: null,
    };
  }

  // Pa per metre, then per 100 km, then in hectopascals.
  const gradientPaPerM = airDensity * Math.abs(f) * windSpeedMs;
  return {
    valid: true,
    coriolis: f,
    gradientPaPerM,
    hPaPer100km: (gradientPaPerM * 100000) / 100,
  };
}
