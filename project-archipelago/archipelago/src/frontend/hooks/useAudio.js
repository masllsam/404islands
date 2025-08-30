//================================================
// REACT AUDIO INTEGRATION HOOK
//================================================
// Seamless Web Audio API integration with React state management
// Procedural environmental audio with zero performance overhead

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioSystem } from './AudioSystem.js';

export function useAudio(islandId, options = {}) {
  const [audioState, setAudioState] = useState({
    isMuted: false,
    masterVolume: 0.5,
    weatherSounds: {
      rain: 0.0,
      wind: 0.0,
      storm: 0.0,
      thunder: false
    },
    environmentalSounds: {
      ocean: 0.5,
      ambient: 0.2
    },
    isInitialized: false,
    isLoading: true,
    error: null,
    deviceCapabilities: {
      hasWebAudio: false,
      hasUserGesture: false
    }
  });

  const [isPlaying, setIsPlaying] = useState({});
  const audioSystemRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Initialize audio system
  useEffect(() => {
    if (!islandId) return;

    console.log(`🎵 Initializing audio system for Island ${islandId}...`);

    try {
      const audioSystem = new AudioSystem(islandId, options);
      audioSystemRef.current = audioSystem;

      // Check capabilities
      const hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);
      setAudioState(prev => ({
        ...prev,
        deviceCapabilities: {
          hasWebAudio,
          hasUserGesture: document.readyState === 'complete'
        }
      }));

      if (hasWebAudio) {
        setAudioState(prev => ({
          ...prev,
          isInitialized: true,
          error: null
        }));
      } else {
        setAudioState(prev => ({
          ...prev,
          error: 'Web Audio API not supported',
          isInitialized: false
        }));
      }
    } catch (error) {
      console.error('🎵 Failed to initialize audio system:', error);
      setAudioState(prev => ({
        ...prev,
        error: error.message,
        isInitialized: false
      }));
    }

    setAudioState(prev => ({ ...prev, isLoading: false }));

    return () => {
      if (audioSystemRef.current) {
        audioSystemRef.current.cleanup();
        audioSystemRef.current = null;
      }
    };
  }, [islandId]);

  // Auto-resume on user interaction if needed
  useEffect(() => {
    if (audioState.isInitialized && audioSystemRef.current) {
      const resumeAudio = async () => {
        try {
          await audioSystemRef.current.resume();
          setAudioState(prev => ({
            ...prev,
            deviceCapabilities: {
              ...prev.deviceCapabilities,
              hasUserGesture: true
            }
          }));
        } catch (error) {
          console.warn('🎵 Audio resume failed:', error);
        }
      };

      const handleUserInteraction = () => {
        resumeAudio();
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      };

      if (audioSystemRef.current.audioContext?.state === 'suspended') {
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('touchstart', handleUserInteraction);
      } else {
        setAudioState(prev => ({
          ...prev,
          deviceCapabilities: {
            ...prev.deviceCapabilities,
            hasUserGesture: true
          }
        }));
      }

      return () => {
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
      };
    }
  }, [audioState.isInitialized]);

  // Play environmental sounds
  const playEnvironment = useCallback((params = {}) => {
    if (!audioState.isInitialized || !audioSystemRef.current) return;

    const {
      rain = audioState.weatherSounds.rain,
      wind = audioState.weatherSounds.wind,
      ocean = audioState.environmentalSounds.ocean,
      storm = audioState.weatherSounds.storm
    } = params;

    // Update local state
    setAudioState(prev => ({
      ...prev,
      weatherSounds: { ...prev.weatherSounds, rain, wind, storm },
      environmentalSounds: { ...prev.environmentalSounds, ocean }
    }));

    setIsPlaying(prev => ({
      ...prev,
      rain: rain > 0.01,
      wind: wind > 0.01,
      ocean: ocean > 0.01,
      storm: storm > 0.01
    }));

    // Play sounds
    audioSystemRef.current.playEnvironment({ rain, wind, ocean, storm });
  }, [audioState.isInitialized]);

  // Weather sound controls
  const setRainIntensity = useCallback((intensity) => {
    setAudioState(prev => ({
      ...prev,
      weatherSounds: { ...prev.weatherSounds, rain: intensity }
    }));
    playEnvironment({ rain: intensity });
  }, [playEnvironment]);

  const setWindIntensity = useCallback((intensity) => {
    setAudioState(prev => ({
      ...prev,
      weatherSounds: { ...prev.weatherSounds, wind: intensity }
    }));
    playEnvironment({ wind: intensity });
  }, [playEnvironment]);

  const setStormIntensity = useCallback((intensity) => {
    setAudioState(prev => ({
      ...prev,
      weatherSounds: { ...prev.weatherSounds, storm: intensity }
    }));
    playEnvironment({ storm: intensity });
  }, [playEnvironment]);

  // Ambient sound controls
  const setOceanVolume = useCallback((volume) => {
    setAudioState(prev => ({
      ...prev,
      environmentalSounds: { ...prev.environmentalSounds, ocean: volume }
    }));
    playEnvironment({ ocean: volume });
  }, [playEnvironment]);

  const setAmbientVolume = useCallback((volume) => {
    setAudioState(prev => ({
      ...prev,
      environmentalSounds: { ...prev.environmentalSounds, ambient: volume }
    }));
    // Ambient sounds not implemented in current system
  }, []);

  // Global audio controls
  const setMuted = useCallback((muted) => {
    if (!audioState.isInitialized || !audioSystemRef.current) return;

    setAudioState(prev => ({ ...prev, isMuted: muted }));
    audioSystemRef.current.setMuted(muted);
  }, [audioState.isInitialized]);

  const setMasterVolume = useCallback((volume) => {
    if (!audioState.isInitialized || !audioSystemRef.current) return;

    const clampedVolume = Math.max(0, Math.min(1, volume));
    setAudioState(prev => ({ ...prev, masterVolume: clampedVolume }));
    audioSystemRef.current.setMasterVolume(clampedVolume);
  }, [audioState.isInitialized]);

  const setSoundVolumes = useCallback((volumes) => {
    if (!audioState.isInitialized || !audioSystemRef.current) return;

    audioSystemRef.current.setSoundVolumes(volumes);
  }, [audioState.isInitialized]);

  // Weather-driven audio updates (called by weather system)
  const onWeatherUpdate = useCallback((weatherState) => {
    if (!audioState.isInitialized) return;

    // Map weather intensity to audio parameters
    const weatherMappings = {
      clear: { rain: 0.0, wind: 0.1, storm: 0.0 },
      cloudy: { rain: 0.0, wind: 0.3, storm: 0.0 },
      stormy: { rain: 0.8, wind: 0.6, storm: 0.9 },
      overcast: { rain: 0.0, wind: 0.4, storm: 0.0 }
    };

    const mapping = weatherMappings[weatherState.weatherState] || weatherMappings.clear;

    // Scale by weather density
    const scale = weatherState.cloudDensity / 0.6; // Normalize to typical density
    const rainIntensity = mapping.rain * scale;
    const windIntensity = mapping.wind * (1 + weatherState.windStrength * 0.5);
    const stormIntensity = mapping.storm * scale;

    setAudioState(prev => ({
      ...prev,
      weatherSounds: {
        rain: rainIntensity,
        wind: windIntensity,
        storm: stormIntensity,
        thunder: stormIntensity > 0.7
      }
    }));

    setIsPlaying(prev => ({
      ...prev,
      rain: rainIntensity > 0.01,
      wind: windIntensity > 0.01,
      storm: stormIntensity > 0.01
    }));

    // Update audio system
    playEnvironment({
      rain: rainIntensity,
      wind: windIntensity,
      storm: stormIntensity
    });
  }, [audioState.isInitialized, playEnvironment]);

  // Performance monitoring
  const getAudioStats = useCallback(() => {
    if (!audioState.isInitialized || !audioSystemRef.current) return null;

    const status = audioSystemRef.current.getStatus();
    return {
      ...status,
      isInGoodState: status.isInitialized && !status.error,
      performance: status.performance || {}
    };
  }, [audioState.isInitialized]);

  return {
    // Current state
    ...audioState,
    isPlaying,

    // Controls
    playEnvironment,
    setRainIntensity,
    setWindIntensity,
    setStormIntensity,
    setOceanVolume,
    setAmbientVolume,
    setMuted,
    setMasterVolume,
    setSoundVolumes,

    // Integration
    onWeatherUpdate,

    // Monitoring
    getAudioStats,

    // Direct access
    controller: audioSystemRef.current
  };
}

//================================================
// AUDIO PRESETS HOOK
//================================================

// Predefined audio configurations for different environments
export const audioPresets = {
  serene: { ocean: 0.7, rainy: 0.0, windy: 0.1, stormy: 0.0, ambient: 0.3 },
  stormy: { ocean: 0.3, rainy: 0.8, windy: 0.9, stormy: 0.9, ambient: 0.2 },
  windy: { ocean: 0.5, rainy: 0.0, windy: 1.0, stormy: 0.2, ambient: 0.3 },
  calm: { ocean: 0.2, rainy: 0.0, windy: 0.0, stormy: 0.0, ambient: 0.4 },
  rainforest: { ocean: 0.0, rainy: 0.4, windy: 0.1, stormy: 0.0, ambient: 1.0 }
};

export function useAudioPresets(audioControl) {
  const setPreset = useCallback((presetName) => {
    if (!audioControl || !audioControl.setSoundVolumes) return;

    const preset = audioPresets[presetName];
    if (preset) {
      audioControl.setMasterVolume(0.6); // Moderate master volume
      audioControl.setSoundVolumes({
        ocean: preset.ocean,
        wind: preset.windy,
        weather: preset.rainy + preset.stormy * 0.5,
        ambient: preset.ambient
      });

      // Update intensity values
      audioControl.setRainIntensity(preset.rainy);
      audioControl.setWindIntensity(preset.windy);
      audioControl.setStormIntensity(preset.stormy);
      audioControl.setOceanVolume(preset.ocean);
      audioControl.setAmbientVolume(preset.ambient);
    }
  }, [audioControl]);

  return { setPreset, presets: audioPresets };
}

//================================================
// AUDIO CAPABILITIES HOOK
//================================================

// Detect audio capabilities and provide recommendations
export function useAudioCapabilities() {
  const [capabilities, setCapabilities] = useState({
    hasWebAudio: false,
    isUserGestureRequired: false,
    recommendedStrategy: 'none',
    audioConfig: {}
  });

  useEffect(() => {
    const detectCapabilities = () => {
      const hasWebAudio = !!(window.AudioContext || window.webkitAudioContext);
      const isUserGestureRequired = !hasWebAudio ||
        (document.readyState !== 'complete' && 'ontouchstart' in window);

      let recommendedStrategy = 'full';
      let audioConfig = {
        enableProcedural: true,
        enableSpatial: true,
        maxConcurrentSources: 10
      };

      if (!hasWebAudio) {
        recommendedStrategy = 'fallback';
        audioConfig = {
          enableProcedural: false,
          enableSpatial: false,
          maxConcurrentSources: 0
        };
      } else if ('ontouchstart' in window && document.readyState === 'loading') {
        // Mobile devices may require user gesture
        recommendedStrategy = 'deferred';
      }

      // Detect device performance capabilities
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        audioConfig.maxConcurrentSources = 5;
        audioConfig.enableSpatial = false;
      }

      setCapabilities({
        hasWebAudio,
        isUserGestureRequired,
        recommendedStrategy,
        audioConfig
      });
    };

    detectCapabilities();
  }, []);

  return capabilities;
}

console.log('🎵 Audio React Integration loaded - Procedural environmental audio ready');