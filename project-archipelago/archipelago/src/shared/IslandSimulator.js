//================================================
// ISLAND SIMULATOR - MAIN REACT COMPONENT
//================================================
// Complete Archipelago Island Explorer with React Integration
// Integrates all systems for production-ready island experience

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { IslandStateProvider, useIslandState } from './IslandStateProvider.js';
import { useWeather } from './useWeather.js';
import { useSeason } from './useSeason.js';
import { useAudio, useAudioCapabilities } from './useAudio.js';
import { IslandGenerator } from './IslandGenerator.js';
import { IslandCanvasRenderer } from './IslandCanvasRenderer.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { ZoomPanController } from './ZoomPanController.js';

//================================================
// MAIN ISLAND SIMULATION COMPONENT
//================================================

function IslandSimulation({
  islandId = 1,
  width = 800,
  height = 600,
  showControls = true,
  showPerformance = false,
  touchEnabled = true,
  audioEnabled = true,
  onIslandChange = () => {},
  onError = () => {}
}) {
  // Island state management
  const {
    currentIsland,
    setCurrentIsland,
    initializeRenderer,
    initializeZoomPan,
    setSystemError,
    initializeWeather: stateInitializeWeather,
    initializeSeason: stateInitializeSeason,
    initializeAudio: stateInitializeAudio,
  } = useIslandState();

  // System hooks
  const weather = useWeather(islandId);
  const season = useSeason(islandId);
  const audioCapabilities = useAudioCapabilities();
  const audio = useAudio(islandId);

  // Component refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const zoomControllerRef = useRef(null);
  const performanceMonitorRef = useRef(null);

  // Local state
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState(0);
  const [terrain, setTerrain] = useState(null);
  const [lastRenderTime, setLastRenderTime] = useState(0);

  // Island generator (shared instance)
  const islandGenerator = useMemo(() => new IslandGenerator(), []);

  //================================================
  // INITIALIZATION SEQUENCE
  //================================================

  const initializeIsland = useCallback(async (id) => {
    console.log(`🏝️ Initializing Island ${id} simulation...`);
    setIsInitializing(true);
    setInitProgress(0);

    try {
      // Step 1: Generate terrain
      updateProgress(10);
      const startTime = Date.now();

      // Ensure islandId is valid
      if (id < 1 || id > 404) {
        throw new Error(`Island ${id} not found in Archipelago (1-404 only)`);
      }

      // Generate island terrain with performance monitoring
      const terrainData = islandGenerator.generateTerrain(id);
      setTerrain(terrainData);
      setCurrentIsland(id, { id, seed: terrainData.seed });

      updateProgress(30);
      console.log(`🌊 Island ${id} generated in ${(Date.now() - startTime)}ms`);

      // Step 2: Initialize weather system
      if (weather.isInitialized) {
        stateInitializeWeather(weather, weather.controller);
        updateProgress(45);
        console.log(`🌦️ Weather system integrated`);
      }

      // Step 3: Initialize seasonal system
      if (season.isInitialized) {
        stateInitializeSeason(season, season.controller);
        updateProgress(60);
        console.log(`🌅 Seasonal system integrated`);
      }

      // Step 4: Initialize audio if capable and enabled
      if (audioEnabled && audioCapabilities.hasWebAudio && audio.isInitialized) {
        stateInitializeAudio(audio, audio.controller);
        updateProgress(75);
        console.log(`🎵 Audio system integrated`);
      }

      // Step 5: Initialize renderer
      if (canvasRef.current) {
        await initializeRendererSystem(terrainData);
        updateProgress(100);
        console.log(`🎨 Rendering system initialized`);
      }

      setIsInitializing(false);
      console.log(`✅ Island ${id} simulation ready`);
      onIslandChange(id);

    } catch (error) {
      console.error('🏝️ Island initialization failed:', error);
      setSystemError('renderer', error.message);
      onError(error);
      setIsInitializing(false);
    }
  }, [
    islandGenerator,
    setCurrentIsland,
    weather,
    season,
    audio,
    stateInitializeWeather,
    stateInitializeSeason,
    stateInitializeAudio,
    audioEnabled,
    audioCapabilities,
    initializeRenderer,
    onIslandChange,
    onError
  ]);

  const updateProgress = (progress) => {
    setInitProgress(progress);
  };

  //================================================
  // RENDERER SYSTEM INITIALIZATION
  //================================================

  const initializeRendererSystem = useCallback(async (terrainData) => {
    if (!canvasRef.current) return;

    try {
      // Create performance monitor
      const monitor = new PerformanceMonitor({
        targetFPS: 60,
        budgetMS: 16,
        memoryBudgetMB: 32,
        onPerformanceWarning: (warning) => {
          console.warn('⚡ Performance warning:', warning.message);
        }
      });
      performanceMonitorRef.current = monitor;

      // Create island renderer with terrain
      const renderer = new IslandCanvasRenderer({
        canvas: canvasRef.current,
        islandGenerator
      });

      // Set canvas size
      renderer.setCanvasSize(width, height);

      // Create zoom/pan controller if enabled
      if (touchEnabled) {
        const zoomController = new ZoomPanController(renderer, canvasRef.current, {
          touchControls: true,
          keyboardControls: true,
          enableMomentum: true
        });
        zoomControllerRef.current = zoomController;
        initializeZoomPan(zoomController);
      }

      rendererRef.current = renderer;
      initializeRenderer(canvasRef.current, renderer);

    } catch (error) {
      console.error('🎨 Renderer initialization failed:', error);
      throw error;
    }
  }, [width, height, touchEnabled, initializeRenderer, initializeZoomPan, islandGenerator]);

  //================================================
  // RENDER LOOP
  //================================================

  const renderIsland = useCallback(() => {
    if (!rendererRef.current || !terrain || !currentIsland) return;

    const startTime = performance.now();

    try {
      // Render terrain with environmental effects
      rendererRef.current.renderIsland(currentIsland, {
        weatherSettings: weather,
        seasonalSettings: season,
        performanceBudget: lastRenderTime || 16,
        environmentalEffects: {
          timeOfDay: season.timeOfDay,
          lighting: weather.lighting
        }
      });

      // Performance monitoring
      if (performanceMonitorRef.current) {
        performanceMonitorRef.current.recordRenderTime(performance.now() - startTime);
      }

      setLastRenderTime(performance.now() - startTime);

    } catch (error) {
      console.error('🎨 Render error:', error);
    }
  }, [terrain, currentIsland, weather, season, lastRenderTime]);

  // Update render on state changes
  useEffect(() => {
    if (!isInitializing) {
      renderIsland();
    }
  }, [isInitializing, weather.weatherState, season.season, season.timeOfDay, renderIsland]);

  //================================================
  // SYSTEM INTEGRATION
  //================================================

  // Weather to audio synchronization
  useEffect(() => {
    if (audio.onWeatherUpdate && weather.isInitialized) {
      audio.onWeatherUpdate({
        weatherState: weather.weatherState,
        cloudDensity: weather.cloudDensity,
        windStrength: weather.windStrength
      });
    }
  }, [weather.weatherState, weather.cloudDensity, weather.windStrength, audio.onWeatherUpdate]);

  // Touch detection
  const detectTouchDevice = useCallback(() => {
    return ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0);
  }, []);

  //================================================
  // INITIALIZATION EFFECTS
  //================================================

  useEffect(() => {
    initializeIsland(islandId);
  }, [initializeIsland, islandId]);

  useEffect(() => {
    // Emit loading progress
    const loadingData = {
      isLoading: isInitializing,
      progress: initProgress,
      message: isInitializing ? 'Initializing island simulation...' : 'Ready'
    };

    // Could emit to parent component if needed
    console.log(`📊 Initialization: ${loadingData.progress}% - ${loadingData.message}`);
  }, [isInitializing, initProgress]);

  //================================================
  // CLEANUP
  //================================================

  useEffect(() => {
    return () => {
      // Clean up systems
      if (rendererRef.current) {
        rendererRef.current.cleanup?.();
      }
      if (zoomControllerRef.current) {
        zoomControllerRef.current.destroy();
      }
      if (performanceMonitorRef.current) {
        performanceMonitorRef.current.stop();
      }
    };
  }, []);

  //================================================
  // RENDER
  //================================================

  if (isInitializing) {
    return (
      <div
        ref={containerRef}
        className="island-simulator-loading"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: 'white',
          border: '2px solid #16213e'
        }}
      >
        <div className="loading-icon">🏝️</div>
        <div className="loading-text">Loading Island {islandId}</div>
        <div
          className="loading-bar"
          style={{
            width: '200px',
            height: '4px',
            backgroundColor: '#16213e',
            marginTop: '10px'
          }}
        >
          <div
            className="loading-bar-fill"
            style={{
              width: `${initProgress}%`,
              height: '100%',
              backgroundColor: '#0f3460',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
        <div className="loading-percentage">{initProgress}%</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="island-simulator"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        backgroundColor: season.isDaylight ? '#87CEEB' : '#0f0f23',
        overflow: 'hidden',
        borderRadius: '8px'
      }}
    >
      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />

      {/* Touch Gesture Area (for mobile) */}
      {touchEnabled && detectTouchDevice() && (
        <div
          className="touch-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          {/* Optional touch indicators */}
        </div>
      )}

      {/* Performance Overlay */}
      {showPerformance && (
        <div
          className="performance-overlay"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        >
          FPS: {Math.round(1000 / (lastRenderTime || 16))}
          <br />
          Island: {currentIsland}
          <br />
          Weather: {weather.weatherState}
        </div>
      )}

      {/* Controls Overlay */}
      {showControls && (
        <div
          className="controls-overlay"
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            display: 'flex',
            gap: '10px'
          }}
        >
          <button
            onClick={() => weather.setWeatherType(weather.weatherState === 'stormy' ? 'clear' : 'stormy')}
            style={{
              padding: '5px 10px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {weather.weatherState === 'stormy' ? '☀️' : '⛈️'}
          </button>

          <button
            onClick={() => season.advanceSeason()}
            style={{
              padding: '5px 10px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🌸
          </button>
        </div>
      )}
    </div>
  );
}

//================================================
// MAIN ISLAND SIMULATOR COMPONENT WITH PROVIDER
//================================================

export default function IslandSimulator(props) {
  return (
    <IslandStateProvider>
      <IslandSimulation {...props} />
    </IslandStateProvider>
  );
}

//================================================
// STYLESHEET (can be extracted)
//================================================

const styles = `
  .island-simulator {
    transition: background-color 0.5s ease;
  }

  .island-simulator canvas {
    image-rendering: -webkit-crisp-edges;
    image-rendering: -moz-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  @media (max-width: 768px) {
    .controls-overlay {
      bottom: 20px !important;
      right: 20px !important;
    }

    .performance-overlay {
      font-size: 10px !important;
    }
  }
`;

// Inject styles if needed
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

console.log('🖥️ IslandSimulator React Component loaded - Complete island exploration system ready');