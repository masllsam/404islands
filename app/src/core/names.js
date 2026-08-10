/**
 * Island naming.
 *
 * Names are invented, not borrowed. Each region carries a phonetic family so
 * that a name sounds like it belongs to the water it floats in, without ever
 * claiming a real place's name. A name is the first thing a person falls for,
 * so it gets the same care as the terrain.
 */

const FAMILIES = {
  polynesian: {
    onsets: ['', '', 'h', 'k', 'm', 'n', 'p', 'r', 't', 'v', 'f', 'ng'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ai', 'au', 'oa', 'ei'],
    prefixes: ['Motu', 'Vai', 'Te', 'Ana'],
    suffixes: ['nui', 'iti', 'roa', 'tea', 'rangi', 'moana'],
    articles: [''],
  },
  melanesian: {
    onsets: ['', 'b', 'g', 'k', 'l', 'm', 'n', 'r', 's', 't', 'v', 'mb', 'nd'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'au', 'ou'],
    prefixes: ['Nusa', 'Tau', 'Rara'],
    suffixes: ['va', 'ndo', 'lau', 'bua', 'kiki'],
    articles: [''],
  },
  micronesian: {
    onsets: ['', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'w'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'oa'],
    prefixes: ['Pei', 'Ulu', 'Kap'],
    suffixes: ['lap', 'rik', 'mwot', 'nen'],
    articles: [''],
  },
  malay: {
    onsets: ['', 'b', 'c', 'd', 'g', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ua', 'ia'],
    prefixes: ['Pulau', 'Nusa', 'Batu'],
    suffixes: ['ang', 'ung', 'ing', 'ari', 'awa'],
    articles: [''],
  },
  nihon: {
    onsets: ['', 'k', 's', 't', 'n', 'h', 'm', 'y', 'r', 'w', 'sh', 'ch'],
    nuclei: ['a', 'e', 'i', 'o', 'u'],
    prefixes: ['Ko', 'Oku', 'Mina'],
    suffixes: ['shima', 'jima', 'saki', 'ura', 'dai'],
    articles: [''],
  },
  norse: {
    onsets: ['', 'b', 'd', 'f', 'g', 'h', 'k', 'n', 's', 'st', 'sk', 'tr', 'v'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'y', 'ø', 'á', 'ei', 'au'],
    prefixes: ['Nord', 'Stor', 'Ytre', 'Hav'],
    suffixes: ['øy', 'holm', 'vik', 'skjær', 'fjell', 'nes'],
    articles: [''],
  },
  gaelic: {
    onsets: ['', 'b', 'c', 'd', 'g', 'l', 'm', 'n', 'r', 's', 't', 'bh', 'ch'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ea', 'ai', 'io'],
    prefixes: ['Eilean', 'Dun', 'Cill'],
    suffixes: ['aigh', 'more', 'beag', 'nish', 'ray'],
    articles: [''],
  },
  hellenic: {
    onsets: ['', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'th', 'ch', 'ps'],
    nuclei: ['a', 'e', 'i', 'o', 'y', 'ia', 'ou'],
    prefixes: ['Ano', 'Kato', 'Mikro'],
    suffixes: ['nisos', 'os', 'ia', 'aki', 'thra'],
    articles: [''],
  },
  iberian: {
    onsets: ['', 'b', 'c', 'd', 'f', 'g', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ie', 'ue', 'ia'],
    prefixes: ['Isla', 'Ilha', 'Punta', 'Roca'],
    suffixes: ['ada', 'osa', 'ero', 'inha', 'anza'],
    articles: [''],
  },
  gallic: {
    onsets: ['', 'b', 'ch', 'd', 'f', 'g', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ai', 'ou', 'eu'],
    prefixes: ['Île', 'Petit', 'Grand'],
    suffixes: ['ance', 'ette', 'euse', 'ille', 'oir'],
    articles: [''],
  },
  anglic: {
    onsets: ['', 'b', 'br', 'c', 'cl', 'd', 'f', 'g', 'h', 'l', 'm', 'n', 'r', 's', 'st', 'th', 'w'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ea', 'oo', 'ai'],
    prefixes: ['North', 'Little', 'Long', 'Salt'],
    suffixes: ['cay', 'holm', 'stone', 'reach', 'wick', 'shoal'],
    articles: [''],
  },
  creole: {
    onsets: ['', 'b', 'd', 'f', 'g', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'z'],
    nuclei: ['a', 'e', 'i', 'o', 'ou', 'ai'],
    prefixes: ['Anse', 'Petite', 'Grande', 'Morne'],
    suffixes: ['ette', 'ine', 'ombe', 'ance', 'ère'],
    articles: [''],
  },
  swahili: {
    onsets: ['', 'b', 'ch', 'd', 'j', 'k', 'm', 'n', 'p', 's', 't', 'w', 'mw', 'nd'],
    nuclei: ['a', 'e', 'i', 'o', 'u'],
    prefixes: ['Kisiwa', 'Mji', 'Bahari'],
    suffixes: ['ani', 'eni', 'ini', 'wa', 'zi'],
    articles: [''],
  },
  dhivehi: {
    onsets: ['', 'b', 'd', 'f', 'g', 'h', 'k', 'l', 'm', 'n', 'r', 's', 'th', 'v'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'aa', 'ee', 'oo'],
    prefixes: ['Fun', 'Dhi', 'Vil'],
    suffixes: ['dhoo', 'fushi', 'faru', 'giri', 'kandu'],
    articles: [''],
  },
  boreal: {
    onsets: ['', 'ch', 'k', 'kh', 'm', 'n', 'p', 's', 'sh', 't', 'v', 'z'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'ya', 'yu'],
    prefixes: ['Maly', 'Bolshoy', 'Sever'],
    suffixes: ['tan', 'sk', 'ov', 'ka', 'chan'],
    articles: [''],
  },
  austral: {
    onsets: ['', 'k', 'm', 'n', 'p', 'r', 't', 'w', 'wh', 'ng'],
    nuclei: ['a', 'e', 'i', 'o', 'u', 'au', 'ao', 'ea'],
    prefixes: ['Te', 'Wai', 'Rangi'],
    suffixes: ['nui', 'roa', 'moana', 'tahi', 'kura'],
    articles: [''],
  },
};

/** Titles the atlas hands out when an island earns a nickname. */
const EPITHETS = [
  'the Quiet', 'the Drowned', 'the Patient', 'the Late', 'the Bright',
  'the Sleeping', 'the Unmapped', 'the Ninth', 'the Returning', 'the Lost Hour',
  'the Long Rain', 'the Thin Season', 'the First Light', 'the Cold Mouth',
  'the Old Wind', 'the Salt Year',
];

const VOWELS = 'aeiouyáøæ';

/**
 * One syllable. `open` says the previous syllable ended on a vowel — in that
 * case we refuse an empty onset, because three vowels in a row stops reading
 * as a language and starts reading as a bug.
 */
function syllable(rng, fam, open) {
  const onsets = open ? fam.onsets.filter(Boolean) : fam.onsets;
  return rng.pick(onsets.length ? onsets : fam.onsets) + rng.pick(fam.nuclei);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build a name for an island. `rng` must be a generator seeded from the
 * island's own seed so the name is as permanent as the terrain.
 */
export function generateName(rng, familyKey) {
  const fam = FAMILIES[familyKey] || FAMILIES.anglic;
  const shape = rng.float();

  let stem = '';
  const sylCount = shape < 0.4 ? 2 : shape < 0.85 ? 3 : 4;
  for (let i = 0; i < sylCount; i++) {
    const open = i > 0 && VOWELS.includes(stem[stem.length - 1]);
    stem += syllable(rng, fam, open);
  }

  // Collapse doubled vowels that the syllable joins can still produce.
  stem = stem.replace(/([aeiouáøy])\1{1,}/g, '$1');
  if (stem.length < 3) stem += rng.pick(fam.nuclei);

  let name = capitalize(stem);

  const roll = rng.float();
  if (roll < 0.3) {
    name = `${rng.pick(fam.prefixes)} ${name}`;
  } else if (roll < 0.62) {
    name = capitalize(stem + rng.pick(fam.suffixes));
  }

  return name.replace(/\s+/g, ' ').trim();
}

/** A rarely-granted second name, used to mark unusual islands in the atlas. */
export function generateEpithet(rng) {
  return rng.pick(EPITHETS);
}

export { FAMILIES, EPITHETS };
