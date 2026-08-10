/**
 * The world ocean, as this atlas understands it.
 *
 * Each of the 404 islands is anchored to a real coordinate inside a real
 * archipelagic region. That anchor is what makes the piece live: the weather
 * a visitor sees over island #217 is the weather that is actually happening
 * out there, right now, in the Banda Sea.
 *
 * Bounding boxes are deliberately loose — they describe the water a chain
 * occupies, not a survey. `weight` biases how many of the 404 fall in each
 * region so the atlas feels like the ocean does: crowded in the tropics,
 * lonely at the poles.
 */

export const OCEANS = {
  PACIFIC: 'Pacific',
  ATLANTIC: 'Atlantic',
  INDIAN: 'Indian',
  ARCTIC: 'Arctic',
  SOUTHERN: 'Southern',
  MEDITERRANEAN: 'Mediterranean',
};

/**
 * `lat`/`lon` are [min, max]. `family` selects the naming language and the
 * palette of archetypes that region tends to produce.
 */
export const REGIONS = [
  // ── Pacific ────────────────────────────────────────────────────────────
  { id: 'society', name: 'Society Rise', ocean: OCEANS.PACIFIC, lat: [-17.9, -16.2], lon: [-152.3, -148.5], weight: 12, family: 'polynesian' },
  { id: 'tuamotu', name: 'Tuamotu Shelf', ocean: OCEANS.PACIFIC, lat: [-20.5, -14.0], lon: [-148.5, -135.0], weight: 16, family: 'polynesian' },
  { id: 'marquesas', name: 'Marquesan Ridge', ocean: OCEANS.PACIFIC, lat: [-10.6, -7.8], lon: [-140.5, -138.0], weight: 8, family: 'polynesian' },
  { id: 'cook', name: 'Cook Basin', ocean: OCEANS.PACIFIC, lat: [-22.0, -8.9], lon: [-166.0, -157.0], weight: 9, family: 'polynesian' },
  { id: 'tonga', name: 'Tongan Trench', ocean: OCEANS.PACIFIC, lat: [-22.4, -15.5], lon: [-176.5, -173.0], weight: 9, family: 'polynesian' },
  { id: 'samoa', name: 'Samoan Swell', ocean: OCEANS.PACIFIC, lat: [-14.3, -13.4], lon: [-172.8, -169.4], weight: 6, family: 'polynesian' },
  { id: 'fiji', name: 'Koro Sea', ocean: OCEANS.PACIFIC, lat: [-19.2, -16.1], lon: [177.0, 179.9], weight: 9, family: 'melanesian' },
  { id: 'vanuatu', name: 'Vanuatu Arc', ocean: OCEANS.PACIFIC, lat: [-20.3, -13.1], lon: [166.5, 170.2], weight: 8, family: 'melanesian' },
  { id: 'solomon', name: 'Solomon Sea', ocean: OCEANS.PACIFIC, lat: [-11.0, -6.5], lon: [155.5, 167.0], weight: 9, family: 'melanesian' },
  { id: 'caledonia', name: 'Coral Sea', ocean: OCEANS.PACIFIC, lat: [-22.7, -19.5], lon: [163.5, 168.1], weight: 6, family: 'melanesian' },
  { id: 'bismarck', name: 'Bismarck Sea', ocean: OCEANS.PACIFIC, lat: [-5.5, -1.5], lon: [145.0, 152.5], weight: 7, family: 'melanesian' },
  { id: 'palau', name: 'Palauan Shallows', ocean: OCEANS.PACIFIC, lat: [6.8, 8.2], lon: [134.0, 134.7], weight: 5, family: 'micronesian' },
  { id: 'marshall', name: 'Marshall Chain', ocean: OCEANS.PACIFIC, lat: [4.5, 14.7], lon: [160.8, 172.2], weight: 10, family: 'micronesian' },
  { id: 'gilbert', name: 'Gilbert Line', ocean: OCEANS.PACIFIC, lat: [-2.7, 3.4], lon: [172.0, 177.0], weight: 7, family: 'micronesian' },
  { id: 'lineis', name: 'Line Islands', ocean: OCEANS.PACIFIC, lat: [-11.5, 6.5], lon: [-162.5, -150.0], weight: 8, family: 'polynesian' },
  { id: 'caroline', name: 'Caroline Plate', ocean: OCEANS.PACIFIC, lat: [5.2, 10.1], lon: [149.0, 158.4], weight: 8, family: 'micronesian' },
  { id: 'mariana', name: 'Mariana Arc', ocean: OCEANS.PACIFIC, lat: [13.2, 20.6], lon: [144.6, 146.1], weight: 6, family: 'micronesian' },
  { id: 'hawaii', name: 'Hawaiian Hotspot', ocean: OCEANS.PACIFIC, lat: [18.9, 22.3], lon: [-160.3, -154.8], weight: 9, family: 'polynesian' },
  { id: 'aleutian', name: 'Aleutian Arc', ocean: OCEANS.PACIFIC, lat: [51.2, 55.0], lon: [-179.0, -160.0], weight: 8, family: 'boreal' },
  { id: 'kuril', name: 'Kuril Chain', ocean: OCEANS.PACIFIC, lat: [43.5, 50.8], lon: [145.5, 156.5], weight: 8, family: 'boreal' },
  { id: 'ryukyu', name: 'Ryukyu Arc', ocean: OCEANS.PACIFIC, lat: [24.0, 29.0], lon: [122.9, 131.0], weight: 8, family: 'nihon' },
  { id: 'izu', name: 'Izu–Bonin Ridge', ocean: OCEANS.PACIFIC, lat: [24.0, 34.5], lon: [138.0, 142.5], weight: 7, family: 'nihon' },
  { id: 'visayas', name: 'Visayan Sea', ocean: OCEANS.PACIFIC, lat: [9.0, 13.5], lon: [120.5, 125.5], weight: 8, family: 'malay' },
  { id: 'banda', name: 'Banda Sea', ocean: OCEANS.PACIFIC, lat: [-7.5, -3.0], lon: [125.0, 132.0], weight: 9, family: 'malay' },
  { id: 'rajaampat', name: 'Raja Ampat', ocean: OCEANS.PACIFIC, lat: [-2.5, -0.2], lon: [129.5, 131.3], weight: 7, family: 'malay' },
  { id: 'galapagos', name: 'Galápagos Rise', ocean: OCEANS.PACIFIC, lat: [-1.5, 0.7], lon: [-91.7, -89.2], weight: 7, family: 'iberian' },
  { id: 'juanfernandez', name: 'Juan Fernández', ocean: OCEANS.PACIFIC, lat: [-33.9, -33.5], lon: [-80.9, -78.7], weight: 4, family: 'iberian' },
  { id: 'chatham', name: 'Chatham Rise', ocean: OCEANS.PACIFIC, lat: [-44.4, -43.6], lon: [-177.0, -176.0], weight: 4, family: 'austral' },
  { id: 'tasman', name: 'Tasman Sea', ocean: OCEANS.PACIFIC, lat: [-42.0, -29.0], lon: [159.0, 169.0], weight: 6, family: 'austral' },

  // ── Indian ─────────────────────────────────────────────────────────────
  { id: 'maldives', name: 'Maldive Ridge', ocean: OCEANS.INDIAN, lat: [-0.7, 7.1], lon: [72.6, 73.8], weight: 11, family: 'dhivehi' },
  { id: 'lakshadweep', name: 'Laccadive Sea', ocean: OCEANS.INDIAN, lat: [8.2, 12.4], lon: [71.7, 73.7], weight: 6, family: 'dhivehi' },
  { id: 'chagos', name: 'Chagos Bank', ocean: OCEANS.INDIAN, lat: [-7.4, -4.9], lon: [70.7, 72.5], weight: 5, family: 'dhivehi' },
  { id: 'seychelles', name: 'Seychelles Plateau', ocean: OCEANS.INDIAN, lat: [-9.5, -3.7], lon: [46.0, 56.3], weight: 8, family: 'creole' },
  { id: 'comoros', name: 'Comoro Basin', ocean: OCEANS.INDIAN, lat: [-12.5, -11.3], lon: [43.2, 45.3], weight: 5, family: 'swahili' },
  { id: 'mascarene', name: 'Mascarene Plateau', ocean: OCEANS.INDIAN, lat: [-21.4, -19.6], lon: [55.2, 63.5], weight: 6, family: 'creole' },
  { id: 'andaman', name: 'Andaman Sea', ocean: OCEANS.INDIAN, lat: [6.7, 13.7], lon: [92.2, 94.3], weight: 7, family: 'malay' },
  { id: 'mergui', name: 'Mergui Shoals', ocean: OCEANS.INDIAN, lat: [9.5, 13.0], lon: [97.5, 98.7], weight: 5, family: 'malay' },
  { id: 'cocos', name: 'Cocos Basin', ocean: OCEANS.INDIAN, lat: [-12.3, -11.8], lon: [96.7, 97.0], weight: 3, family: 'malay' },
  { id: 'zanzibar', name: 'Zanzibar Channel', ocean: OCEANS.INDIAN, lat: [-6.5, -4.8], lon: [39.1, 39.9], weight: 5, family: 'swahili' },

  // ── Atlantic ───────────────────────────────────────────────────────────
  { id: 'azores', name: 'Azorean Plateau', ocean: OCEANS.ATLANTIC, lat: [36.9, 39.8], lon: [-31.3, -24.9], weight: 8, family: 'iberian' },
  { id: 'madeira', name: 'Madeiran Rise', ocean: OCEANS.ATLANTIC, lat: [32.4, 33.1], lon: [-17.3, -16.2], weight: 4, family: 'iberian' },
  { id: 'canaries', name: 'Canary Ridge', ocean: OCEANS.ATLANTIC, lat: [27.6, 29.5], lon: [-18.2, -13.3], weight: 7, family: 'iberian' },
  { id: 'capeverde', name: 'Cape Verde Rise', ocean: OCEANS.ATLANTIC, lat: [14.8, 17.2], lon: [-25.4, -22.7], weight: 6, family: 'iberian' },
  { id: 'bermuda', name: 'Bermuda Seamount', ocean: OCEANS.ATLANTIC, lat: [32.2, 32.4], lon: [-64.9, -64.6], weight: 3, family: 'anglic' },
  { id: 'bahamas', name: 'Bahama Bank', ocean: OCEANS.ATLANTIC, lat: [22.5, 27.0], lon: [-79.0, -72.7], weight: 9, family: 'anglic' },
  { id: 'lesserant', name: 'Lesser Antilles', ocean: OCEANS.ATLANTIC, lat: [12.0, 18.5], lon: [-63.2, -59.4], weight: 9, family: 'creole' },
  { id: 'greaterant', name: 'Greater Antilles', ocean: OCEANS.ATLANTIC, lat: [17.7, 20.5], lon: [-78.0, -66.0], weight: 7, family: 'iberian' },
  { id: 'saotome', name: 'Gulf of Guinea', ocean: OCEANS.ATLANTIC, lat: [-0.1, 1.7], lon: [6.4, 7.5], weight: 4, family: 'iberian' },
  { id: 'falkland', name: 'Falkland Shelf', ocean: OCEANS.ATLANTIC, lat: [-52.5, -51.0], lon: [-61.4, -57.7], weight: 5, family: 'anglic' },
  { id: 'tristan', name: 'Tristan Seamounts', ocean: OCEANS.ATLANTIC, lat: [-37.4, -37.0], lon: [-12.7, -12.2], weight: 3, family: 'anglic' },
  { id: 'faroe', name: 'Faroe Bank', ocean: OCEANS.ATLANTIC, lat: [61.3, 62.4], lon: [-7.7, -6.2], weight: 5, family: 'norse' },
  { id: 'lofoten', name: 'Lofoten Wall', ocean: OCEANS.ATLANTIC, lat: [67.7, 68.5], lon: [12.0, 15.7], weight: 6, family: 'norse' },
  { id: 'hebrides', name: 'Outer Hebrides', ocean: OCEANS.ATLANTIC, lat: [56.5, 58.5], lon: [-7.7, -6.1], weight: 5, family: 'gaelic' },

  // ── Mediterranean ──────────────────────────────────────────────────────
  { id: 'aegean', name: 'Aegean Scatter', ocean: OCEANS.MEDITERRANEAN, lat: [35.9, 39.5], lon: [24.0, 27.2], weight: 8, family: 'hellenic' },
  { id: 'balearic', name: 'Balearic Sea', ocean: OCEANS.MEDITERRANEAN, lat: [38.6, 40.1], lon: [1.2, 4.4], weight: 5, family: 'iberian' },

  // ── Polar ──────────────────────────────────────────────────────────────
  { id: 'svalbard', name: 'Svalbard Bank', ocean: OCEANS.ARCTIC, lat: [76.5, 80.0], lon: [11.0, 25.0], weight: 5, family: 'norse' },
  { id: 'ammassalik', name: 'Greenland Sea', ocean: OCEANS.ARCTIC, lat: [65.0, 70.0], lon: [-38.0, -22.0], weight: 4, family: 'norse' },
  { id: 'southgeorgia', name: 'South Georgia Ridge', ocean: OCEANS.SOUTHERN, lat: [-55.0, -53.9], lon: [-38.3, -35.8], weight: 4, family: 'anglic' },
  { id: 'kerguelen', name: 'Kerguelen Plateau', ocean: OCEANS.SOUTHERN, lat: [-49.8, -48.4], lon: [68.7, 70.6], weight: 4, family: 'gallic' },
];

export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

/** Every ocean present in the atlas, in a stable display order. */
export const OCEAN_ORDER = [
  OCEANS.PACIFIC,
  OCEANS.ATLANTIC,
  OCEANS.INDIAN,
  OCEANS.MEDITERRANEAN,
  OCEANS.ARCTIC,
  OCEANS.SOUTHERN,
];

/**
 * Wrap a longitude into (-180, 180].
 *
 * Values already in range are returned untouched: the obvious modular
 * expression introduces a rounding error of about 3e-14 degrees, which is
 * nothing on a chart but is enough to make a coordinate fail to equal itself.
 */
export function normalizeLon(lon) {
  if (lon > -180 && lon <= 180) return lon;
  let l = ((lon + 180) % 360 + 360) % 360 - 180;
  if (l === -180) l = 180;
  return l;
}

/** Format a coordinate the way a chart would: 17° 32.4′ S, 149° 34.1′ W. */
export function formatCoord(lat, lon) {
  const fmt = (v, pos, neg) => {
    const hemi = v >= 0 ? pos : neg;
    const a = Math.abs(v);
    const deg = Math.floor(a);
    const min = (a - deg) * 60;
    return `${deg}° ${min.toFixed(1)}′ ${hemi}`;
  };
  return `${fmt(lat, 'N', 'S')}, ${fmt(normalizeLon(lon), 'E', 'W')}`;
}

/** Great-circle distance in kilometres. */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Köppen-flavoured climate band from latitude alone. Used for copy and for
 * the offline fallback; the live feed always wins when it is available.
 */
export function climateBand(lat) {
  const a = Math.abs(lat);
  if (a < 10) return 'Equatorial';
  if (a < 23.5) return 'Tropical';
  if (a < 35) return 'Subtropical';
  if (a < 55) return 'Temperate';
  if (a < 66.5) return 'Subpolar';
  return 'Polar';
}
