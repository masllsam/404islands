/**
 * Deterministic pseudo-random utilities.
 *
 * Every island in the atlas is derived from a single 32-bit seed. The same
 * seed must produce the same island on every device, forever — the artwork is
 * a promise, not a lottery. Everything here is therefore integer-exact and
 * free of `Math.random`.
 */

const U32 = 0x100000000;

/** 32-bit integer hash. Mirrors `hashU()` in the GLSL prelude bit for bit. */
export function hashU32(x, y, seed) {
  let h = seed >>> 0;
  h = (h ^ Math.imul(x | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = (h ^ Math.imul(y | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h, 0x27d4eb2f) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

/** Hash an arbitrary string into a 32-bit seed (FNV-1a). */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Mulberry32 — small, fast, statistically decent. Returns a generator object
 * rather than a bare function so call sites read as intent, not arithmetic.
 */
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / U32;
  };

  return {
    /** Uniform in [0, 1). */
    float: next,
    /** Uniform in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, max] inclusive. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    /** True with probability `p`. */
    chance: (p) => next() < p,
    /** Uniform element of `arr`. */
    pick: (arr) => arr[Math.floor(next() * arr.length) % arr.length],
    /**
     * Element of `arr` chosen by `weights` (same length, non-negative).
     * Falls back to uniform if the weights sum to zero.
     */
    weighted: (arr, weights) => {
      let total = 0;
      for (const w of weights) total += w;
      if (total <= 0) return arr[Math.floor(next() * arr.length) % arr.length];
      let r = next() * total;
      for (let i = 0; i < arr.length; i++) {
        r -= weights[i];
        if (r <= 0) return arr[i];
      }
      return arr[arr.length - 1];
    },
    /** Fisher–Yates, in place, deterministic. */
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    /** Roughly normal via the sum of four uniforms (Bates), mean 0, sd ~0.29. */
    normal: () => (next() + next() + next() + next()) / 2 - 1,
  };
}
