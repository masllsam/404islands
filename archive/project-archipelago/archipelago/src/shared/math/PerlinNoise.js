// PerlinNoise.js - Optimized Perlin noise implementation for browser environments
// Supports 1D and 2D noise with deterministic seeding

export class PerlinNoise {
  constructor(seed = 0) {
    this.seed = seed;
    this.permutation = new Array(512);
    this.gradients = [
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [0.707, 0.707], [-0.707, 0.707],
      [0.707, -0.707], [-0.707, -0.707]
    ];
    this.initialize(seed);
  }

  initialize(seed) {
    // Seed-based permutation table initialization
    const p = new Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Simple seeded shuffle
    let seededRandom = seed;
    for (let i = 255; i > 0; i--) {
      seededRandom = (seededRandom * 16807) % 2147483647;
      const j = Math.floor((seededRandom / 2147483647) * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate the permutation array to avoid overflow
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = p[i];
      this.permutation[i + 256] = p[i];
    }
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  lerp(a, b, t) {
    return a + t * (b - a);
  }

  grad(hash, x, y = 0) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h == 12 || h == 14) ? x : 0;
    return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
  }

  // 1D Perlin noise
  noise1D(x) {
    const xi = Math.floor(x) & 255;
    const xf = x - Math.floor(x);

    const a = this.permutation[xi];
    const b = this.permutation[xi + 1];

    const u = this.fade(xf);

    return this.lerp(
      this.grad(a, xf),
      this.grad(b, xf - 1),
      u
    );
  }

  // 2D Perlin noise
  noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const aa = this.permutation[xi] + yi;
    const ab = this.permutation[xi] + yi + 1;
    const ba = this.permutation[xi + 1] + yi;
    const bb = this.permutation[xi + 1] + yi + 1;

    const a = this.permutation[aa];
    const b = this.permutation[ab];
    const c = this.permutation[ba];
    const d = this.permutation[bb];

    const u = this.fade(xf);
    const v = this.fade(yf);

    const x1 = this.lerp(this.grad(a, xf, yf), this.grad(b, xf, yf - 1), v);
    const x2 = this.lerp(this.grad(c, xf - 1, yf), this.grad(d, xf - 1, yf - 1), v);

    return this.lerp(x1, x2, u);
  }

  // Normalized 2D noise (output between 0 and 1)
  normalizedNoise2D(x, y) {
    return (this.noise2D(x, y) + 0.5) * 0.5;
  }
}