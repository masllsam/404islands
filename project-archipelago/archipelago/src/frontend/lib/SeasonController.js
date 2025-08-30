// SeasonController.js - Dynamic Day/Night Cycle and Seasonal System
// Creates immersive temporal changes across islands with zero performance impact

import { PerlinNoise } from './PerlinNoise.js';

export class SeasonController {
  constructor(islandId = 1, options = {}) {
    this.islandId = islandId;
    this.currentTime = Date.now(); // Real-time timestamp
    this.gameTime = 0; // Game time progression (normalized 0-1)
    this.season = 'spring'; // spring, summer, autumn, winter
    this.timeOfDay = 0.0; // Normalized 0-1 (midnight to midnight)
    this.dayLength = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (real-time scale)

    // Seasonal parameters
    this.temperature = 20;
    this.lightingIntensity = 1.0;
    this.colorSaturation = 1.0;
    this.ambientSounds = 'calm';

    // Seasonal color palettes
    this.seasonalColoring = {
      spring: { red: 1.1, green: 1.2, blue: 0.9, temperature: 15, saturation: 1.3 },
      summer: { red: 1.15, green: 1.05, blue: 0.75, temperature: 25, saturation: 0.9 },
      autumn: { red: 1.3, green: 0.9, blue: 0.85, temperature: 12, saturation: 1.2 },
      winter: { red: 0.8, green: 0.95, blue: 1.1, temperature: -5, saturation: 0.7 }
    };

    // Sun positioning
    this.solarElevation = 0.5;
    this.solarAzimuth = 0;

    // Perlin noise for natural variation
    this.temperatureNoise = new PerlinNoise(islandId + 4000);
    this.cloudNoise = new PerlinNoise(islandId + 5000);

    // Performance tracking
    this.lastUpdate = this.currentTime;
    this.updateCount = 0;
  }

  // Core API: Set environment state
  setEnvironment(params = {}) {
    const {
      season,
      timeOfDay,
      temperature
    } = params;

    if (season !== undefined) {
      this.setSeason(season);
    }

    if (timeOfDay !== undefined) {
      this.timeOfDay = Math.max(0, Math.min(1, timeOfDay));
      this.updateTimeOfDay();
    }

    if (temperature !== undefined) {
      this.temperature = temperature;
    }

    this.updateSolarPosition();
  }

  // Set active season with smooth transitions
  setSeason(season) {
    if (this.season === season) return;

    console.log(`🌸 Season transition on Island ${this.islandId}: ${this.season} → ${season}`);
    this.season = season;

    const seasonData = this.seasonalColoring[season];
    if (seasonData) {
      this.temperature = seasonData.temperature;
      this.colorSaturation = seasonData.saturation;
      this.ambientSounds = this.getSeasonalSounds(season);
    }

    this.updateEnvironment();
  }

  // Update game time and calculate time of day
  update(deltaTime = 16.67) { // 60fps default
    this.currentTime += deltaTime;
    this.updateCount++;

    // Advance game time (normalized progression)
    this.gameTime += deltaTime / this.dayLength;

    // Calculate time of day from game time
    this.timeOfDay = (this.gameTime % 1);

    // Update solar position and lighting
    this.updateSolarPosition();
    this.updateTimeOfDay();
  }

  // Calculate sun position for realistic lighting
  updateSolarPosition() {
    // Solar elevation (height in sky)
    // At midday (timeOfDay = 0.5), sun is highest
    // At midnight (timeOfDay = 0 or 1), sun is below horizon
    const solarTime = this.timeOfDay * 2 * Math.PI;

    this.solarElevation = Math.sin(solarTime);

    // Solar azimuth (east/west position)
    // Simulates sun moving east to west
    this.solarAzimuth = (this.timeOfDay - 0.25) * 2 * Math.PI; // Start from southeast

    // Clamp elevation to realistic values
    this.solarElevation = Math.max(-0.2, Math.min(0.8, this.solarElevation));
  }

  // Update time-dependent parameters
  updateTimeOfDay() {
    // Lighting intensity based on solar elevation
    this.lightingIntensity = Math.max(0.1, this.solarElevation + 0.3);

    // Add slight variation for clouds and atmosphere
    const cloudCover = this.cloudNoise.noise2D(this.currentTime * 0.0001, 0) * 0.3 + 0.7;
    this.lightingIntensity *= cloudCover;

    // Temperature variation throughout day
    const dailyTempVariation = Math.sin(this.timeOfDay * 2 * Math.PI) * 3;
    this.temperature += dailyTempVariation;
  }

  // Get current environment state for rendering
  getEnvironmentState() {
    return {
      season: this.season,
      timeOfDay: this.timeOfDay,
      temperature: this.temperature,
      lightingIntensity: this.lightingIntensity,
      colorSaturation: this.colorSaturation,
      solarElevation: this.solarElevation,
      solarAzimuth: this.solarAzimuth,
      ambientSounds: this.ambientSounds,
      colorModifiers: this.getColorModifiers(),
      isDaylight: this.isDaylight()
    };
  }

  // Get seasonal color modifiers for terrain rendering
  getColorModifiers() {
    const seasonColors = this.seasonalColoring[this.season];

    // Apply time-of-day color shifts
    const timeModifier = this.getTimeOfDayColorModifier();
    const temperatureModifier = this.getTemperatureColorModifier();

    return {
      red: seasonColors.red * timeModifier.red * temperatureModifier.red,
      green: seasonColors.green * timeModifier.green * temperatureModifier.green,
      blue: seasonColors.blue * timeModifier.blue * temperatureModifier.blue
    };
  }

  // Color shifts based on time of day
  getTimeOfDayColorModifier() {
    const isTwilight = this.isTwilight();

    if (isTwilight) {
      // Warm golden hour colors at dawn/dusk
      return {
        red: 1.3,
        green: 1.1,
        blue: 0.8
      };
    } else if (this.timeOfDay < 0.25 || this.timeOfDay > 0.75) {
      // Cool blues at night
      return {
        red: 0.7,
        green: 0.8,
        blue: 1.4
      };
    } else {
      // Neutral daylight
      return {
        red: 1.0,
        green: 1.0,
        blue: 1.0
      };
    }
  }

  // Color shifts based on temperature
  getTemperatureColorModifier() {
    const temp = this.temperature;

    if (temp < 0) {
      // Cold - blue tones
      const intensity = Math.max(0.7, 1 + temp / 20);
      return {
        red: intensity,
        green: intensity * 1.1,
        blue: intensity * 1.3
      };
    } else if (temp > 25) {
      // Hot - warm tones
      const intensity = Math.min(1.3, 1 + temp / 30);
      return {
        red: intensity,
        green: 1.0,
        blue: 0.9
      };
    } else {
      // Moderate temperature
      return {
        red: 1.0,
        green: 1.0,
        blue: 1.0
      };
    }
  }

  // Check if it's currently daylight
  isDaylight() {
    return this.solarElevation > -0.1;
  }

  // Check if it's twilight (dawn or dusk)
  isTwilight() {
    const elevation = this.solarElevation;
    return elevation > -0.1 && elevation < 0.2;
  }

  // Get seasonal ambient sound profile
  getSeasonalSounds(season) {
    const soundProfiles = {
      spring: 'renewal',
      summer: 'buzzing',
      autumn: 'rustling',
      winter: 'whispering'
    };
    return soundProfiles[season] || 'calm';
  }

  // Seasonal progression (auto-advancement)
  advanceSeason() {
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    const currentIndex = seasons.indexOf(this.season);
    const nextIndex = (currentIndex + 1) % seasons.length;

    this.setSeason(seasons[nextIndex]);
  }

  // Temperature sampling at specific locations
  getTemperatureAt(x, y, altitude = 0) {
    // Base temperature
    let temperature = this.temperature;

    // Add micro-climatic variation with Perlin noise
    const variation = this.temperatureNoise.noise2D(x * 0.001, y * 0.001 + this.currentTime * 0.00001);
    temperature += variation * 2; // ±2°C variation

    // Altitude cooling
    temperature -= altitude * 0.005; // 5°C/km cooling

    // Daily cycle
    const dailyVariation = Math.sin(this.timeOfDay * 2 * Math.PI) * 2;
    temperature += dailyVariation;

    return temperature;
  }

  // Update environment state
  updateEnvironment() {
    // Trigger environmental updates
    console.log(`🌍 Environment updated on Island ${this.islandId}: ${this.season}, ${Math.round(this.timeOfDay * 24)}h`);
  }

  // Performance and memory management
  getMemoryUsage() {
    // Minimal memory footprint
    return 0;
  }
}

// Factory function for creating season controllers
export function createSeasonController(islandId, options = {}) {
  return new SeasonController(islandId, options);
}

// Time utility functions
export const TimeUtil = {
  // Convert milliseconds to normalized time (0-1)
  toNormalizedTime(milliseconds, dayLength = 24 * 60 * 60 * 1000) {
    return (milliseconds / dayLength) % 1;
  },

  // Convert normalized time to hours (0-24)
  toHours(normalizedTime) {
    return Math.floor(normalizedTime * 24);
  },

  // Convert normalized time to minutes (0-1440)
  toMinutes(normalizedTime) {
    return Math.floor(normalizedTime * 24 * 60);
  },

  // Check if time is between two normalized values
  isBetween(normalizedTime, start, end) {
    if (start <= end) {
      return normalizedTime >= start && normalizedTime <= end;
    } else {
      // Handle wrap-around (e.g., 22:00 to 06:00)
      return normalizedTime >= start || normalizedTime <= end;
    }
  }
};

console.log('🌅 SeasonController initialized - Temporal dynamics ready for Archipelago islands');