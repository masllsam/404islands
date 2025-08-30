//================================================
// REACT SEASONAL INTEGRATION HOOK
//================================================
// Seamless React integration for SeasonController
// Enables immersive day/night cycle and seasonal progression

import { useState, useEffect, useRef, useCallback } from 'react';
import { SeasonController } from './SeasonController.js';

export function useSeason(islandId, options = {}) {
  const [seasonalState, setSeasonalState] = useState({
    season: 'spring',
    timeOfDay: 0.0,
    temperature: 20,
    lightingIntensity: 1.0,
    colorSaturation: 1.0,
    solarElevation: 0.5,
    solarAzimuth: 0,
    ambientSounds: 'calm',
    colorModifiers: { red: 1, green: 1, blue: 1 },
    isDaylight: true,
    isTwilight: false,
    isInitialized: false,
    error: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const seasonControllerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Initialize season controller
  useEffect(() => {
    if (!islandId) return;

    console.log(`🌸 Initializing seasonal system for Island ${islandId}...`);

    try {
      const controller = new SeasonController(islandId, options);
      seasonControllerRef.current = controller;

      // Set initial state
      const initialState = controller.getEnvironmentState();
      setSeasonalState(prev => ({
        ...prev,
        ...initialState,
        isInitialized: true,
        error: null
      }));

      setIsLoading(false);
    } catch (error) {
      console.error('🌸 Failed to initialize seasonal system:', error);
      setSeasonalState(prev => ({
        ...prev,
        error: error.message,
        isInitialized: false
      }));
      setIsLoading(false);
    }

    return () => {
      if (seasonControllerRef.current) {
        seasonControllerRef.current.cleanup();
        seasonControllerRef.current = null;
      }
    };
  }, [islandId]);

  // Update seasonal physics on each frame
  useEffect(() => {
    if (!seasonControllerRef.current || isLoading) return;

    const updateSeasonalPhysics = (now) => {
      const deltaTime = Math.min((now - lastUpdateRef.current) / 1000, 1/60); // Cap at 60fps
      lastUpdateRef.current = now;

      try {
        seasonControllerRef.current.update(deltaTime);
        const state = seasonControllerRef.current.getEnvironmentState();

        setSeasonalState(prev => ({
          ...prev,
          ...state
        }));
      } catch (error) {
        console.warn('🌸 Seasonal update error:', error);
      }

      animationFrameRef.current = requestAnimationFrame(updateSeasonalPhysics);
    };

    // Start seasonal updates at 60fps
    lastUpdateRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(updateSeasonalPhysics);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading]);

  // Control functions
  const setEnvironmentalState = useCallback((params) => {
    if (seasonControllerRef.current && seasonalState.isInitialized) {
      seasonControllerRef.current.setEnvironment(params);
    }
  }, [seasonalState.isInitialized]);

  const setSeason = useCallback((season) => {
    setEnvironmentalState({ season });
  }, [setEnvironmentalState]);

  const setTimeOfDay = useCallback((timeOfDay) => {
    setEnvironmentalState({ timeOfDay });
  }, [setEnvironmentalState]);

  const setTemperature = useCallback((temperature) => {
    setEnvironmentalState({ temperature });
  }, [setEnvironmentalState]);

  const advanceSeason = useCallback(() => {
    if (seasonControllerRef.current && seasonalState.isInitialized) {
      seasonControllerRef.current.advanceSeason();
    }
  }, [seasonalState.isInitialized]);

  const getTemperatureAt = useCallback((x, y, altitude = 0) => {
    if (seasonControllerRef.current) {
      return seasonControllerRef.current.getTemperatureAt(x, y, altitude);
    }
    return seasonalState.temperature || 20;
  }, [seasonalState.temperature]);

  // Utilities
  const getClockTime = useCallback(() => {
    if (!seasonalState.isInitialized) return { hours: 6, minutes: 0, period: 'AM' };

    const normalizedTime = seasonalState.timeOfDay;
    const hours = Math.floor(normalizedTime * 24);
    const minutes = Math.floor((normalizedTime * 24 - hours) * 60);
    const period = hours < 12 ? 'AM' : 'PM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

    return {
      hours: displayHours,
      minutes,
      period,
      totalHours: hours,
      totalMinutes: hours * 60 + minutes,
      timeString: `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    };
  }, [seasonalState.timeOfDay, seasonalState.isInitialized]);

  const isGoldenHour = useCallback(() => {
    if (!seasonalState.isDaylight || !seasonalState.isTwilight) return false;

    // Golden hour is typically sunrise/set ± 1 hour
    const time = seasonalState.timeOfDay;
    return (time < 0.25 || time > 0.75); // Rough approximation
  }, [seasonalState.isDaylight, seasonalState.isTwilight, seasonalState.timeOfDay]);

  const getSeasonInfo = useCallback(() => {
    const seasonInfo = {
      spring: { name: 'Spring', color: '#90EE90', description: 'New life and gentle warmth', floraStage: 'budding' },
      summer: { name: 'Summer', color: '#FFD700', description: 'Peak life and abundance', floraStage: 'lush' },
      autumn: { name: 'Autumn', color: '#FFA500', description: 'Colors of harvest', floraStage: 'fruiting' },
      winter: { name: 'Winter', color: '#87CEEB', description: 'Rest and renewal', floraStage: 'dormant' }
    };

    return seasonInfo[seasonalState.season] || seasonInfo.spring;
  }, [seasonalState.season]);

  // Performance monitoring
  const getPerformanceStats = useCallback(() => {
    if (seasonControllerRef.current) {
      return {
        lastUpdateTime: seasonControllerRef.current.lastUpdate || 0,
        updateCount: seasonControllerRef.current.updateCount || 0,
        memoryUsage: seasonControllerRef.current.getMemoryUsage()
      };
    }
    return { lastUpdateTime: 0, updateCount: 0, memoryUsage: 0 };
  }, []);

  return {
    // Current state
    ...seasonalState,
    isLoading,

    // Control functions
    setEnvironment: setEnvironmentalState,
    setSeason,
    setTimeOfDay,
    setTemperature,
    advanceSeason,

    // Utilities
    getTemperatureAt,
    getClockTime,
    isGoldenHour,
    getSeasonInfo,

    // Performance
    getPerformanceStats,

    // Direct access
    controller: seasonControllerRef.current
  };
}

//================================================
// SEASON PRESETS HOOK
//================================================

// Seasonal preset configurations for natural cycles
export const seasonPresets = {
  dawn: { season: 'spring', timeOfDay: 0.20, temperature: 15 }, // Spring dawn
  noon: { season: 'summer', timeOfDay: 0.50, temperature: 25 }, // Summer noon
  dusk: { season: 'autumn', timeOfDay: 0.75, temperature: 12 }, // Autumn dusk
  midnight: { season: 'winter', timeOfDay: 0.00, temperature: -5 }, // Winter midnight
  sunset: { season: 'autumn', timeOfDay: 0.78, temperature: 8 }, // Dramatic sunset
  sunrise: { season: 'spring', timeOfDay: 0.25, temperature: 12 } // Golden sunrise
};

export function useSeasonPresets(seasonControl) {
  const setPreset = useCallback((presetName) => {
    const preset = seasonPresets[presetName];
    if (preset && seasonControl.setEnvironment) {
      seasonControl.setEnvironment(preset);
    }
  }, [seasonControl]);

  return { setPreset, presets: seasonPresets };
}

//================================================
// SEASON TRANSITIONS HOOK
//================================================

// Smooth seasonal transitions with custom easing
export function useSeasonTransitions(seasonControl, transitionDuration = 3000) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);

  const transitionToSeason = useCallback((newSeason, customDuration) => {
    if (!seasonControl || !seasonControl.setEnvironment) return;

    setIsTransitioning(true);
    setTransitionProgress(0);

    const startTime = performance.now();
    const duration = customDuration || transitionDuration;

    const animateTransition = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease transition: smooth start, smooth end
      const easedProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      setTransitionProgress(easedProgress);

      // Optional: Could smoothly interpolate temperature/color here

      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        // Complete transition
        seasonControl.setEnvironment({ season: newSeason });
        setIsTransitioning(false);
        setTransitionProgress(1);
      }
    };

    // Start transition
    seasonControl.setEnvironment({ season: newSeason });
    requestAnimationFrame(animateTransition);
  }, [seasonControl, transitionDuration]);

  return {
    isTransitioning,
    transitionProgress,
    transitionToSeason
  };
}

console.log('🌅 Season React Integration loaded - Natural temporal cycles ready');