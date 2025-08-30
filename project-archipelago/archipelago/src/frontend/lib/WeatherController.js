// WeatherController.js - Advanced Atmospheric Engine for Archipelago
// Zero-lag weather system with cloud dynamics, weather patterns, and lighting

import { PerlinNoise } from './PerlinNoise.js';

export class WeatherController {
  constructor(islandId = 1, options = {}) {
    this.islandId = islandId;
    this.time = Date.now() * 0.001; // Global animation time
    this.lastUpdate = this.time;

    // Weather state parameters
    this.cloudDensity = 0.7;
    this.windStrength = 1.2;
    this.weatherState = 'clear'; // clear, cloudy, stormy
    this.temp = 20; // Celsius
    this.humidity = 0.6; // 0-1

    // Weather pattern system
    this.patterns = this.initializeWeatherPatterns();
    this.currentPattern = this.patterns.clear;

    // Atmospheric layers
    this.atmosphereLayers = this.initializeAtmosphereLayers();

    // Perlin noise instances for natural variation
    this.cloudNoise = new PerlinNoise(islandId + 1000);
    this.windNoise = new PerlinNoise(islandId + 2000);
    this.temperatureNoise = new PerlinNoise(islandId + 3000);

    // Performance monitoring
    this.frameTime = 0;
    this.updateCount = 0;
  }

  // Core API: Set atmosphere parameters
  setAtmosphere(params = {}) {
    const {
      cloudDensity,
      windStrength,
      lightingConditions = 'clear'
    } = params;

    if (cloudDensity !== undefined) {
      this.cloudDensity = Math.max(0, Math.min(1, cloudDensity));
    }

    if (windStrength !== undefined) {
      this.windStrength = Math.max(0, Math.min(5, windStrength));
    }

    if (lightingConditions !== undefined) {
      this.setWeatherState(lightingConditions);
    }

    this.updateAtmosphereModel();
  }

  // Set weather state and transition smoothly
  setWeatherState(state) {
    if (this.weatherState === state) return;

    const oldState = this.weatherState;
    this.weatherState = state;

    // Transition parameters over time
    const transition = this.patterns[state];
    if (transition) {
      this.transitionToWeather(transition);
    }

    console.log(`🌀 Weather transition: ${oldState} → ${state} on Island ${this.islandId}`);
  }

  // Initialize core weather patterns
  initializeWeatherPatterns() {
    return {
      clear: {
        cloudDensity: 0.2,
        windStrength: 0.5,
        lightingIntensity: 1.0,
        humidity: 0.4,
        particleIntensity: 0.0,
        duration: 1800000, // 30 minutes
        soundProfile: 'calm'
      },
      cloudy: {
        cloudDensity: 0.6,
        windStrength: 1.2,
        lightingIntensity: 0.7,
        humidity: 0.7,
        particleIntensity: 0.0,
        duration: 1200000, // 20 minutes
        soundProfile: 'windy'
      },
      stormy: {
        cloudDensity: 0.9,
        windStrength: 2.5,
        lightingIntensity: 0.3,
        humidity: 0.9,
        particleIntensity: 0.8,
        duration: 900000, // 15 minutes
        soundProfile: 'storm'
      },
      overcast: {
        cloudDensity: 0.75,
        windStrength: 1.0,
        lightingIntensity: 0.5,
        humidity: 0.8,
        particleIntensity: 0.0,
        duration: 1500000, // 25 minutes
        soundProfile: 'dull'
      }
    };
  }

  // Atmospheric layers for depth and realism
  initializeAtmosphereLayers() {
    return [
      {
        name: 'nearGround',
        height: 100,
        density: 0.1,
        parallax: 0.95,
        color: [0.2, 0.3, 0.5],
        opacity: 0.05
      },
      {
        name: 'lowCloud',
        height: 2000,
        density: 0.3,
        parallax: 0.8,
        color: [0.9, 0.95, 1.0],
        opacity: 0.3
      },
      {
        name: 'highCloud',
        height: 6000,
        density: 0.4,
        parallax: 0.6,
        color: [0.7, 0.8, 0.95],
        opacity: 0.2
      },
      {
        name: 'cirrus',
        height: 10000,
        density: 0.1,
        parallax: 0.4,
        color: [1.0, 1.0, 1.0],
        opacity: 0.1
      }
    ];
  }

  // Get current atmospheric state for rendering
  getAtmosphericState() {
    return {
      time: this.time,
      cloudDensity: this.cloudDensity,
      windStrength: this.windStrength,
      weatherState: this.weatherState,
      lighting: this.getCurrentLighting(),
      atmosphereLayers: this.atmosphereLayers,
      humidity: this.humidity,
      temperature: this.temp,
      windVector: this.getWindVector()
    };
  }

  // Calculate current lighting conditions
  getCurrentLighting() {
    const pattern = this.patterns[this.weatherState];
    const baseIntensity = pattern ? pattern.lightingIntensity : 1.0;

    // Add time-of-day variation
    const solarAltitude = Math.sin(this.time * 0.0005) * 0.6 + 0.4; // 0-1 range
    const lightingIntensity = baseIntensity * Math.max(0.1, solarAltitude);

    return {
      intensity: lightingIntensity,
      color: [lightingIntensity, lightingIntensity * 0.95, lightingIntensity * 0.9],
      shadows: lightingIntensity < 0.5,
      specular: lightingIntensity > 0.7
    };
  }

  // Wind physics system
  getWindVector(x = 0, y = 0, time = this.time) {
    // Use Perlin noise for natural wind variation
    const noiseX = this.windNoise.noise2D(x * 0.01 + time * 0.001, y * 0.01) * this.windStrength;
    const noiseY = this.windNoise.noise2D(x * 0.01 + 100, y * 0.01 + time * 0.001) * this.windStrength;

    return {
      x: noiseX,
      y: noiseY,
      magnitude: Math.sqrt(noiseX * noiseX + noiseY * noiseY)
    };
  }

  // Cloud formation using metaball algorithms
  generateCloudField(width = 800, height = 600, scale = 0.001) {
    const cloudData = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        const worldX = x * scale + this.time * 0.0002 * this.windStrength;
        const worldY = y * scale;

        // Multi-octave cloud sampling
        let density = this.cloudNoise.noise2D(worldX, worldY) * 0.5 +
                     this.cloudNoise.noise2D(worldX * 2, worldY * 2) * 0.25 +
                     this.cloudNoise.noise2D(worldX * 4, worldY * 4) * 0.125 +
                     this.cloudNoise.noise2D(worldX * 8, worldY * 8) * 0.0625;

        // Apply weather density
        density *= this.cloudDensity;

        // Add some randomness for organic look
        const detail = this.cloudNoise.noise2D(worldX * 16, worldY * 16) * 0.1;
        density = Math.max(0, Math.min(1, density + detail));

        cloudData[index] = density;
      }
    }

    return cloudData;
  }

  // Weather transition system
  transitionToWeather(targetPattern) {
    // Smooth transition over 30 seconds
    this.targetPattern = targetPattern;
    this.transitionStartTime = this.time;
    this.transitionDuration = 30; // seconds
    this.transitionComplete = false;
  }

  // Update weather physics and animations
  update(deltaTime = 1/60) {
    this.time += deltaTime;
    this.updateCount++;

    // Handle weather transitions
    if (this.targetPattern && !this.transitionComplete) {
      const elapsed = this.time - this.transitionStartTime;
      const progress = Math.min(1, elapsed / this.transitionDuration);

      // Smooth interpolation
      this.cloudDensity = this.lerp(this.cloudDensity, this.targetPattern.cloudDensity, progress * deltaTime * 2);
      this.windStrength = this.lerp(this.windStrength, this.targetPattern.windStrength, progress * deltaTime * 2);

      if (progress >= 1) {
        this.transitionComplete = true;
        this.targetPattern = null;
      }
    }

    // Update atmosphere layers with weather
    this.updateAtmosphereLayers();

    // Performance monitoring
    this.frameTime = performance.now();
  }

  // Update atmospheric layer properties based on weather
  updateAtmosphereLayers() {
    // Adjust layer density based on humidity and weather
    this.atmosphereLayers[0].density = Math.max(0.05, this.humidity * 0.3); // Near ground fog
    this.atmosphereLayers[1].density = Math.max(0.1, this.cloudDensity * 0.6);  // Low clouds
    this.atmosphereLayers[2].density = Math.max(0.1, (this.windStrength * 0.2)); // Wind effects
    this.atmosphereLayers[3].density = Math.max(0.05, this.cloudDensity * 0.2); // High cirrus
  }

  // Temperature modeling
  getTemperatureAt(x, y, altitude = 0) {
    // Base temperature with seasonal variation
    let temperature = this.temp;

    // Add micro-variation with Perlin noise
    const noise = this.temperatureNoise.noise2D(x * 0.001, y * 0.001 + this.time * 0.0001);
    temperature += noise * 5; // ±5 degree variation

    // Altitude cooling
    temperature -= altitude * 0.006; // 6°C per 1000m

    return temperature;
  }

  // Memory and performance management
  getMemoryUsage() {
    // Estimate memory usage (rough calculation)
    return 0; // Will be calculated by renderer
  }

  // Utility function
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  updateAtmosphereModel() {
    // Stub for atmosphere model updates
  }
}

// Factory function for creating weather controllers
export function createWeatherController(islandId, options = {}) {
  return new WeatherController(islandId, options);
}

console.log('🌀 WeatherController initialized - Atmospheric engine ready for Archipelago islands');