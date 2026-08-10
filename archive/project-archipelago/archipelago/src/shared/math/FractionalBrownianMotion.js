// FractionalBrownianMotion.js - fBm implementation for natural terrain generation
// Built on top of PerlinNoise.js for multi-octave noise

import { PerlinNoise } from './PerlinNoise.js';

export class FractionalBrownianMotion {
  constructor(seed = 0, octaves = 4, amplitude = 1.0, frequency = 1.0) {
    this.seed = seed;
    this.octaves = octaves;
    this.baseAmplitude = amplitude;
    this.baseFrequency = frequency;
    this.perlinNoise = new PerlinNoise(seed);
  }

  // 1D fBm
  noise1D(x) {
    let value = 0.0;
    let amplitude = this.baseAmplitude;
    let frequency = this.baseFrequency;

    for (let i = 0; i < this.octaves; i++) {
      value += amplitude * this.perlinNoise.noise1D(x * frequency);
      amplitude *= 0.5; // Reduce amplitude by half each octave
      frequency *= 2.0; // Double frequency each octave
    }

    return value;
  }

  // 2D fBm with turbulence option for terrain height
  noise2D(x, y, turbulence = false) {
    let value = 0.0;
    let amplitude = this.baseAmplitude;
    let frequency = this.baseFrequency;

    for (let i = 0; i < this.octaves; i++) {
      const noise = this.perlinNoise.noise2D(x * frequency, y * frequency);
      if (turbulence) {
        value += amplitude * Math.abs(noise);
      } else {
        value += amplitude * noise;
      }
      amplitude *= 0.5;
      frequency *= 2.0;
    }

    return value;
  }

  // Normalized 2D fBm (output between 0 and 1)
  normalizedNoise2D(x, y, turbulence = false) {
    // Scale the result to a reasonable height range for terrain
    const raw = this.noise2D(x, y, turbulence);
    // Adjust normalization based on turbulence
    const maxHeight = turbulence ? 0.0 : 1.0;
    const minHeight = turbulence ? -1.0 : 0.0;
    // Simple normalization for terrain heights
    return Math.max(0, Math.min(1, (raw - minHeight) / (maxHeight - minHeight)));
  }

  // Terrain height function with radial falloff for natural island edges
  generateTerrainHeight(x, y, centerX, centerY, maxRadius) {
    // Distance from center for radial falloff
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const falloff = Math.max(0, 1 - (distance / maxRadius));

    // Combine fBm noise with falloff
    const noise = this.normalizedNoise2D(x, y);
    return noise * falloff * falloff; // Square falloff for sharper edges
  }
}