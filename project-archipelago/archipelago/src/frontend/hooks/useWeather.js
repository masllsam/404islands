//================================================
// REACT WEATHER INTEGRATION HOOK
//================================================
// Integrates WeatherController with React state management
// Provides seamless weather system integration for React components

import { useState, useEffect, useRef, useCallback } from 'react';
import { WeatherController } from './WeatherController.js';

export function useWeather(islandId, options = {}) {
  const [weatherState, setWeatherState] = useState({
    cloudDensity: 0.7,
    windStrength: 1.2,
    weatherState: 'clear',
    temperature: 20,
    humidity: 0.6,
    lighting: { intensity: 1.0, color: [1.0, 1.0, 1.0] },
    atmosphereLayers: [],
    windVector: { x: 0, y: 0, magnitude: 0 },
    isInitialized: false,
    error: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const weatherControllerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Initialize weather controller
  useEffect(() => {
    if (!islandId) return;

    console.log(`🌦️ Initializing weather system for Island ${islandId}...`);

    try {
      const controller = new WeatherController(islandId, options);
      weatherControllerRef.current = controller;

      // Set initial state
      const initialState = controller.getAtmosphericState();
      setWeatherState(prev => ({
        ...prev,
        ...initialState,
        isInitialized: true,
        error: null
      }));

      setIsLoading(false);
    } catch (error) {
      console.error('🌦️ Failed to initialize weather system:', error);
      setWeatherState(prev => ({
        ...prev,
        error: error.message,
        isInitialized: false
      }));
      setIsLoading(false);
    }

    return () => {
      if (weatherControllerRef.current) {
        weatherControllerRef.current.cleanup();
        weatherControllerRef.current = null;
      }
    };
  }, [islandId]);

  // Update physics on each frame
  useEffect(() => {
    if (!weatherControllerRef.current || isLoading) return;

    const updatePhysics = (now) => {
      const deltaTime = Math.min((now - lastUpdateRef.current) / 1000, 1/60); // Cap at 60fps
      lastUpdateRef.current = now;

      try {
        weatherControllerRef.current.update(deltaTime);
        const state = weatherControllerRef.current.getAtmosphericState();

        setWeatherState(prev => ({
          ...prev,
          ...state
        }));
      } catch (error) {
        console.warn('🌦️ Weather update error:', error);
      }

      animationFrameRef.current = requestAnimationFrame(updatePhysics);
    };

    // Start physics updates at 60fps
    lastUpdateRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(updatePhysics);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isLoading]);

  // Control functions
  const setAtmosphere = useCallback((params) => {
    if (weatherControllerRef.current && weatherState.isInitialized) {
      weatherControllerRef.current.setAtmosphere(params);
    }
  }, [weatherState.isInitialized]);

  const setWeatherType = useCallback((weatherType) => {
    if (weatherControllerRef.current && weatherState.isInitialized) {
      weatherControllerRef.current.setWeatherState(weatherType);
    }
  }, [weatherState.isInitialized]);

  const setCloudDensity = useCallback((density) => {
    setAtmosphere({ cloudDensity: density });
  }, [setAtmosphere]);

  const setWindStrength = useCallback((strength) => {
    setAtmosphere({ windStrength: strength });
  }, [setAtmosphere]);

  const getWindAt = useCallback((x, y) => {
    if (weatherControllerRef.current) {
      return weatherControllerRef.current.getWindVector(x, y);
    }
    return { x: 0, y: 0, magnitude: 0 };
  }, []);

  const getTemperatureAt = useCallback((x, y, altitude = 0) => {
    if (weatherControllerRef.current) {
      return weatherControllerRef.current.getTemperatureAt(x, y, altitude);
    }
    return weatherState.temperature || 20;
  }, [weatherState.temperature]);

  // Performance monitoring
  const getPerformanceStats = useCallback(() => {
    if (weatherControllerRef.current) {
      return {
        lastUpdateTime: weatherControllerRef.current.frameTime || 0,
        updateCount: weatherControllerRef.current.updateCount || 0,
        memoryUsage: weatherControllerRef.current.getMemoryUsage()
      };
    }
    return { lastUpdateTime: 0, updateCount: 0, memoryUsage: 0 };
  }, []);

  return {
    // Current state
    ...weatherState,
    isLoading,

    // Control functions
    setAtmosphere,
    setWeatherType,
    setCloudDensity,
    setWindStrength,

    // Utilities
    getWindAt,
    getTemperatureAt,

    // Performance
    getPerformanceStats,

    // Direct access (for advanced usage)
    controller: weatherControllerRef.current
  };
}

//================================================
// WEATHER PRESETS HOOK
//================================================

// Common weather preset configurations
export const weatherPresets = {
  clearDay: { cloudDensity: 0.2, windStrength: 0.3, lightingConditions: 'clear' },
  sunny: { cloudDensity: 0.1, windStrength: 0.2, lightingConditions: 'clear' },
  cloudy: { cloudDensity: 0.6, windStrength: 0.8, lightingConditions: 'cloudy' },
  overcast: { cloudDensity: 0.75, windStrength: 1.0, lightingConditions: 'overcast' },
  stormy: { cloudDensity: 0.9, windStrength: 2.5, lightingConditions: 'stormy' },
  windy: { cloudDensity: 0.4, windStrength: 3.0, lightingConditions: 'cloudy' }
};

export function useWeatherPresets(weatherControl) {
  const setPreset = useCallback((presetName) => {
    const preset = weatherPresets[presetName];
    if (preset && weatherControl.setAtmosphere) {
      weatherControl.setAtmosphere(preset);
    }
  }, [weatherControl]);

  return { SetPreset: setPreset, presets: weatherPresets };
}

console.log('🌦️ Weather React Integration loaded - Seamless atmospheric control ready');