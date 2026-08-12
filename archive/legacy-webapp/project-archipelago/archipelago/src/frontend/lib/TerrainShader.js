// TerrainShader.js - GPU-style terrain color mapping for IslandCanvasRenderer
// Uses mathematical functions for natural gradients, Perlin noise for water effects

import { PerlinNoise } from './PerlinNoise.js';

export class TerrainShader {
  constructor(options = {}) {
    const {
      perlinSeed = 42,
      perlinOctaves = 4,
      perlinPersistence = 0.5,
      waterAnimationSpeed = 0.001,
      atmosphereStrength = 0.3
    } = options;

    this.perlinNoise = new PerlinNoise(perlinSeed);
    this.perlinOctaves = perlinOctaves;
    this.perlinPersistence = perlinPersistence;
    this.waterAnimationSpeed = waterAnimationSpeed;
    this.atmosphereStrength = atmosphereStrength;
    this.time = 0; // For animation effects
  }

  // Main terrain coloring function - returns {r, g, b} for given height
  colorAtHeight(height, x, y, time = 0) {
    const color = { r: 0, g: 0, b: 0 };

    if (height <= 0.3) {
      // Water zone - deep blue with Perlin wave animation
      return this.makeWaterColor(height, x, y, time);
    } else if (height <= 0.6) {
      // Beach and shore zone - sand to shallow water
      return this.makeBeachColor(height, x, y);
    } else {
      // Land zone - grass to mountain peaks
      return this.makeLandColor(height, x, y);
    }
  }

  makeWaterColor(height, x, y, time) {
    // Deep blue base with animated surface ripples
    const baseBlue = this.deepBlueMapping(height);

    // Add chromatic dispersion effect
    const waveNoise = this.perlinNoise.noise2D(
      x * this.waterAnimationSpeed + time * 0.01,
      y * this.waterAnimationSpeed + time * 0.01
    );

    const dispersion = (waveNoise + 1) * 0.5; // 0 to 1

    const r = Math.floor(baseBlue * (0.8 + dispersion * 0.2));
    const g = Math.floor(baseBlue * 0.9);
    const b = Math.floor(baseBlue * (1.0 + dispersion * 0.1));

    return { r, g, b };
  }

  deepBlueMapping(height) {
    // Arctan mapping for natural deep/ shallow water transition
    const normalized = height / 0.3; // Map to 0-1 range for water
    const mapped = Math.atan(normalized * 3) / (Math.PI / 2); // Arctan gradient
    return 20 + mapped * 100; // 20 is deep blue, 120 is shallower
  }

  makeBeachColor(height, x, y) {
    // Sand to water transition
    const transition = (height - 0.3) / 0.3; // 0 to 1

    const sandR = Math.floor(194 + transition * 30);
    const sandG = Math.floor(178 + transition * 30);
    const sandB = Math.floor(128 + transition * 50);

    // Mix with water at edges
    const waterBlend = Math.pow(transition, 2) * 0.3;
    const waterR = 0;
    const waterG = 80;
    const waterB = 150;

    return {
      r: Math.floor(sandR * (1 - waterBlend) + waterR * waterBlend),
      g: Math.floor(sandG * (1 - waterBlend) + waterG * waterBlend),
      b: Math.floor(sandB * (1 - waterBlend) + waterB * waterBlend)
    };
  }

  makeLandColor(height, x, y) {
    // Grass to mountain peaks
    const transition = (height - 0.6) / 0.4; // 0 to 1

    // Arctan for natural land gradient
    const mapped = Math.atan(transition * 3) / (Math.PI / 2);

    const baseR = 34 + mapped * 50;
    const baseG = 139 + mapped * 60;
    const baseB = 34 + mapped * 80;

    // Add slight variation with Perlin for texture
    const textureNoise = this.perlinNoise.noise2D(x * 0.05, y * 0.05) * 0.1;
    const variation = 1 + textureNoise;

    return {
      r: Math.floor(baseR * variation),
      g: Math.floor(baseG * variation),
      b: Math.floor(baseB * variation)
    };
  }

  // Advanced effects
  applyAtmosphericPerspective(color, distance, maxDistance) {
    if (this.atmosphereStrength <= 0) return color;

    const fogAmount = Math.min(distance / maxDistance, 1);
    const fogStrength = fogAmount * this.atmosphereStrength;

    const fogR = 135, fogG = 206, fogB = 235; // Sky blue fog

    return {
      r: Math.floor(color.r * (1 - fogStrength) + fogR * fogStrength),
      g: Math.floor(color.g * (1 - fogStrength) + fogG * fogStrength),
      b: Math.floor(color.b * (1 - fogStrength) + fogB * fogStrength)
    };
  }

  // Sun lighting effect
  applySunLighting(color, height, normalX, normalY, normalZ) {
    // Simplified Phong lighting
    const lightDir = [0.6, 0.6, 0.5]; // Normalized sun direction
    const normal = [normalX, normalY, normalZ];

    let dot = 0;
    for (let i = 0; i < 3; i++) {
      dot += lightDir[i] * normal[i];
    }

    const intensity = Math.max(0, dot) * 0.5 + 0.5; // Ambient + diffuse

    return {
      r: Math.min(255, Math.floor(color.r * intensity)),
      g: Math.min(255, Math.floor(color.g * intensity)),
      b: Math.min(255, Math.floor(color.b * intensity))
    };
  // Enhanced seasonal and weather integration
  initializeSeasonalColoring() {
    return {
      spring: { red: 1.1, green: 1.2, blue: 0.9, temperature: 15, saturation: 1.3 },
      summer: { red: 1.15, green: 1.05, blue: 0.75, temperature: 25, saturation: 0.9 },
      autumn: { red: 1.3, green: 0.9, blue: 0.85, temperature: 12, saturation: 1.2 },
      winter: { red: 0.8, green: 0.95, blue: 1.1, temperature: -5, saturation: 0.7 }
    };
  }

  // Update seasonal color parameters
  setSeasonalModifiers(season, temperature, colorModifiers) {
    this.seasonalModifiers = colorModifiers;
    this.weatherLighting.color = [1.0, 1.0, 1.0]; // Reset to neutral
  }

  // Update weather lighting conditions
  setWeatherLighting(lighting) {
    this.weatherLighting = lighting;
  }

  // Apply seasonal color transformation to base color
  applySeasonalColor(color) {
    return {
      r: Math.max(0, Math.min(255, Math.floor(color.r * this.seasonalModifiers.red))),
      g: Math.max(0, Math.min(255, Math.floor(color.g * this.seasonalModifiers.green))),
      b: Math.max(0, Math.min(255, Math.floor(color.b * this.seasonalModifiers.blue)))
    };
  }

  // Apply weather lighting effects
  applyWeatherLighting(color) {
    const lighting = this.weatherLighting.lighting || { intensity: 1.0, color: [1.0, 1.0, 1.0] };
    const intensity = lighting.intensity;

    return {
      r: Math.max(0, Math.min(255, Math.floor(color.r * intensity * lighting.color[0]))),
      g: Math.max(0, Math.min(255, Math.floor(color.g * intensity * lighting.color[1]))),
      b: Math.max(0, Math.min(255, Math.floor(color.b * intensity * lighting.color[2])))
    };
  }

  // Enhanced color method with full weather and seasonal integration
  colorAtHeightEnhanced(height, x, y, time, environmentState = {}) {
    const baseColor = this.colorAtHeight(height, x, y, time);

    // Apply seasonal color modification
    let enhancedColor = baseColor;
    if (environmentState.colorModifiers) {
      enhancedColor = {
        r: Math.max(0, Math.min(255, Math.floor(baseColor.r * environmentState.colorModifiers.red))),
        g: Math.max(0, Math.min(255, Math.floor(baseColor.g * environmentState.colorModifiers.green))),
        b: Math.max(0, Math.min(255, Math.floor(baseColor.b * environmentState.colorModifiers.blue)))
      };
    }

    // Apply weather lighting effects
    if (environmentState.lighting) {
      enhancedColor = this.applyWeatherLighting({ color: enhancedColor, lighting: environmentState.lighting });
    }

    return enhancedColor;
  }
  }

  // Update animation time
  update(deltaTime) {
    this.time += deltaTime;
  }
}

// Create singleton shader instance
export const terrainShader = new TerrainShader();