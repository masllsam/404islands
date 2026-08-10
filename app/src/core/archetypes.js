/**
 * Island archetypes.
 *
 * Seven ways for rock to meet water. The renderer branches on `index`; every
 * other field here is either a parameter range the island generator samples
 * from, or copy the atlas shows to a human. Keeping both in one table is what
 * stops the pictures and the prose from drifting apart.
 */

export const ARCHETYPES = [
  {
    index: 0,
    id: 'volcanic',
    name: 'Volcanic',
    blurb: 'A single young cone, still arguing with the sea.',
    detail:
      'Ridged fractal uplift with a steep flank and a narrow beach. These are the loudest islands in the atlas — high relief, hard shadows, weather that piles up on the windward side.',
    height: [0.62, 1.0],
    sharpness: [1.15, 1.75],
    ridgeMix: [0.62, 0.92],
    warp: [0.10, 0.26],
    freq: [1.5, 2.4],
    octaves: 7,
    coast: [0.60, 0.76],
    // Regions where this shape is plausible; used to bias generation.
    affinity: ['volcanic-arc', 'hotspot'],
    rarity: 1.0,
  },
  {
    index: 1,
    id: 'atoll',
    name: 'Atoll',
    blurb: 'A ring of coral around water that used to be a mountain.',
    detail:
      'A drowned cone remembered only by its reef. The lagoon reads pale turquoise because the light reaches the floor and comes back; the ocean beyond it does not.',
    height: [0.10, 0.22],
    sharpness: [0.75, 1.1],
    ridgeMix: [0.05, 0.30],
    warp: [0.06, 0.16],
    freq: [2.2, 3.6],
    octaves: 6,
    coast: [0.66, 0.84],
    affinity: ['reef'],
    rarity: 1.0,
  },
  {
    index: 2,
    id: 'plateau',
    name: 'Plateau',
    blurb: 'A table of old stone, cut off clean.',
    detail:
      'Uplifted limestone with a flat crown and undercut cliffs. Rain runs off the top rather than into it, so the interior stays dry while the walls stay dark.',
    height: [0.34, 0.56],
    sharpness: [0.55, 0.85],
    ridgeMix: [0.10, 0.35],
    warp: [0.05, 0.14],
    freq: [1.2, 2.0],
    octaves: 6,
    coast: [0.62, 0.78],
    affinity: ['uplift'],
    rarity: 0.9,
  },
  {
    index: 3,
    id: 'archipelago',
    name: 'Archipelago',
    blurb: 'Not one island. Several, pretending.',
    detail:
      'Three or four separate masses sharing a shelf. Channels between them run fast, and the shallow water between the lobes carries most of the colour.',
    height: [0.30, 0.60],
    sharpness: [0.95, 1.4],
    ridgeMix: [0.35, 0.7],
    warp: [0.16, 0.34],
    freq: [1.8, 3.0],
    octaves: 7,
    coast: [0.52, 0.70],
    affinity: ['shelf'],
    rarity: 1.0,
  },
  {
    index: 4,
    id: 'sandbar',
    name: 'Sandbar',
    blurb: 'A rumour of land. Moves with the season.',
    detail:
      'Barely above the waterline: a long, low spine of sediment with no interior to speak of. The least permanent thing in the atlas and, at low sun, the most beautiful.',
    height: [0.05, 0.13],
    sharpness: [0.6, 0.95],
    ridgeMix: [0.0, 0.18],
    warp: [0.18, 0.40],
    freq: [1.1, 2.0],
    octaves: 5,
    coast: [0.55, 0.72],
    affinity: ['shelf', 'reef'],
    rarity: 0.8,
  },
  {
    index: 5,
    id: 'fjordland',
    name: 'Fjordland',
    blurb: 'Stone that ice went through and left open.',
    detail:
      'Deep glacial incisions carve the mass into fingers of rock. Cold water, near-vertical walls, and a snowline that the live temperature feed moves up and down in real time.',
    height: [0.55, 0.92],
    sharpness: [1.25, 1.9],
    ridgeMix: [0.55, 0.85],
    warp: [0.08, 0.20],
    freq: [1.6, 2.6],
    octaves: 7,
    coast: [0.58, 0.74],
    affinity: ['glacial'],
    rarity: 0.85,
  },
  {
    index: 6,
    id: 'karst',
    name: 'Karst',
    blurb: 'Towers. Dissolved, not built.',
    detail:
      'Limestone spires standing in shallow water, undercut at the tideline. Vertical, improbable, and the hardest shape in the atlas to light well — which is the point.',
    height: [0.45, 0.78],
    sharpness: [1.6, 2.6],
    ridgeMix: [0.7, 0.95],
    warp: [0.22, 0.44],
    freq: [2.4, 3.8],
    octaves: 7,
    coast: [0.50, 0.66],
    affinity: ['reef', 'shelf'],
    rarity: 0.55,
  },
];

export const ARCHETYPE_BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));
export const ARCHETYPE_BY_INDEX = ARCHETYPES.slice().sort((a, b) => a.index - b.index);

/**
 * How likely each archetype is in a given region, expressed as weights over
 * `ARCHETYPES`. This is what keeps Svalbard from sprouting coral atolls.
 */
export function archetypeWeightsForRegion(region) {
  const absLat = Math.abs((region.lat[0] + region.lat[1]) / 2);
  const tropical = absLat < 24;
  const polar = absLat > 55;
  const temperate = !tropical && !polar;

  // Order matches ARCHETYPES: volcanic, atoll, plateau, archipelago,
  // sandbar, fjordland, karst.
  if (polar) return [1.4, 0.0, 1.2, 1.6, 0.15, 3.2, 0.1];
  if (temperate) return [1.6, 0.05, 1.5, 1.8, 0.5, 1.4, 0.4];
  if (tropical) return [1.8, 2.4, 1.0, 1.5, 1.3, 0.0, 1.0];
  return [1, 1, 1, 1, 1, 1, 1];
}
