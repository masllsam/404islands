//================================================
// ISLAND STATE PROVIDER - REACT CONTEXT API
//================================================
// Global state management for Archipelago island systems
// Provides seamless integration between React and existing class-based systems

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

//================================================
// ISLAND STATE MANAGEMENT
//================================================

const IslandStateContext = createContext(null);
const IslandDispatchContext = createContext(null);

// Initial island state structure
const initialIslandState = {
  // Basic island information
  currentIsland: null,
  islandData: {
    id: null,
    terrain: null,
    seed: null,
    backgroundColor: '#87CEEB'
  },

  // System states
  systems: {
    renderer: {
      isInitialized: false,
      canvas: null,
      controller: null,
      error: null
    },
    weather: {
      isInitialized: false,
      state: null,
      error: null
    },
    season: {
      isInitialized: false,
      state: null,
      error: null
    },
    audio: {
      isInitialized: false,
      muted: false,
      volume: 0.5,
      state: null,
      error: null
    },
    zoomPan: {
      isInitialized: false,
      controller: null,
      error: null
    },
    performance: {
      monitor: null,
      metrics: null
    }
  },

  // UI and interaction state
  interaction: {
    isTouchDevice: false,
    gestureInProgress: false,
    lastGestureTime: 0,
    touchCount: 0
  },

  // Event system
  events: {
    eventHistory: [],
    currentEvent: null,
    eventCount: 0
  },

  // Simulation control
  simulation: {
    isRunning: true,
    speed: 1.0,
    paused: false,
    timeMultiplier: 3600 // Real time to simulation time (1 hour per second)
  },

  // Loading and error states
  loading: {
    isLoading: false,
    progress: 0,
    message: '',
    totalSteps: 0,
    completedSteps: 0
  },

  error: {
    hasError: false,
    type: '',
    message: '',
    recoverable: true
  }
};

//================================================
// STATE REDUCER
//================================================

function islandStateReducer(state, action) {
  switch (action.type) {
    case 'RESET_STATE':
      return { ...initialIslandState };

    case 'SET_CURRENT_ISLAND':
      return {
        ...state,
        currentIsland: action.payload.islandId,
        islandData: { ...initialIslandState.islandData, ...action.payload }
      };

    case 'UPDATE_ISLAND_DATA':
      return {
        ...state,
        islandData: { ...state.islandData, ...action.payload }
      };

    // System state updates
    case 'INITIALIZE_RENDERER':
      return {
        ...state,
        systems: {
          ...state.systems,
          renderer: { ...state.systems.renderer, ...action.payload, isInitialized: true }
        }
      };

    case 'INITIALIZE_WEATHER':
      return {
        ...state,
        systems: {
          ...state.systems,
          weather: { ...state.systems.weather, ...action.payload, isInitialized: true }
        }
      };

    case 'INITIALIZE_SEASON':
      return {
        ...state,
        systems: {
          ...state.systems,
          season: { ...state.systems.season, ...action.payload, isInitialized: true }
        }
      };

    case 'INITIALIZE_AUDIO':
      return {
        ...state,
        systems: {
          ...state.systems,
          audio: { ...state.systems.audio, ...action.payload, isInitialized: true }
        }
      };

    case 'INITIALIZE_ZOOM_PAN':
      return {
        ...state,
        systems: {
          ...state.systems,
          zoomPan: { ...state.systems.zoomPan, ...action.payload, isInitialized: true }
        }
      };

    case 'SET_SYSTEM_ERROR':
      return {
        ...state,
        systems: {
          ...state.systems,
          [action.payload.system]: {
            ...state.systems[action.payload.system],
            error: action.payload.error,
            isInitialized: false
          }
        }
      };

    // Weather state updates
    case 'UPDATE_WEATHER_STATE':
      return {
        ...state,
        systems: {
          ...state.systems,
          weather: {
            ...state.systems.weather,
            state: action.payload
          }
        }
      };

    // Seasonal state updates
    case 'UPDATE_SEASONAL_STATE':
      return {
        ...state,
        systems: {
          ...state.systems,
          season: {
            ...state.systems.season,
            state: action.payload
          }
        }
      };

    // Art interaction updates
    case 'SET_INTERACTION_STATE':
      return {
        ...state,
        interaction: { ...state.interaction, ...action.payload }
      };

    // Event system updates
    case 'ADD_EVENT_TO_HISTORY':
      return {
        ...state,
        events: {
          ...state.events,
          eventHistory: [...state.events.eventHistory, action.payload],
          eventCount: state.events.eventCount + 1
        }
      };

    case 'SET_CURRENT_EVENT':
      return {
        ...state,
        events: {
          ...state.events,
          currentEvent: action.payload
        }
      };

    // Simulation updates
    case 'SET_SIMULATION_STATE':
      return {
        ...state,
        simulation: { ...state.simulation, ...action.payload }
      };

    case 'PAUSE_SIMULATION':
      return {
        ...state,
        simulation: { ...state.simulation, paused: true }
      };

    case 'RESUME_SIMULATION':
      return {
        ...state,
        simulation: { ...state.simulation, paused: false }
      };

    case 'SET_TIME_MULTIPLIER':
      return {
        ...state,
        simulation: { ...state.simulation, timeMultiplier: action.payload }
      };

    // Loading state
    case 'SET_LOADING_STATE':
      return {
        ...state,
        loading: { ...state.loading, ...action.payload }
      };

    case 'UPDATE_LOADING_PROGRESS':
      return {
        ...state,
        loading: {
          ...state.loading,
          completedSteps: state.loading.completedSteps + (action.payload.increment || 1)
        }
      };

    // Error handling
    case 'SET_ERROR':
      return {
        ...state,
        error: { ...state.error, ...action.payload, hasError: true }
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: { ...initialIslandState.error }
      };

    default:
      return state;
  }
}

//================================================
// PROVIDER COMPONENT
//================================================

export function IslandStateProvider({ children }) {
  const [state, dispatch] = useReducer(islandStateReducer, initialIslandState);

  // System initialization actions
  const initializeRenderer = useCallback((canvas, controller) => {
    dispatch({
      type: 'INITIALIZE_RENDERER',
      payload: { canvas, controller }
    });
  }, []);

  const initializeWeather = useCallback((state, controller) => {
    dispatch({
      type: 'INITIALIZE_WEATHER',
      payload: { state, controller }
    });
  }, []);

  const initializeSeason = useCallback((state, controller) => {
    dispatch({
      type: 'INITIALIZE_SEASON',
      payload: { state, controller }
    });
  }, []);

  const initializeAudio = useCallback((state, controller) => {
    dispatch({
      type: 'INITIALIZE_AUDIO',
      payload: { state, controller }
    });
  }, []);

  const initializeZoomPan = useCallback((controller) => {
    dispatch({
      type: 'INITIALIZE_ZOOM_PAN',
      payload: { controller }
    });
  }, []);

  // System error handling
  const setSystemError = useCallback((system, error) => {
    dispatch({
      type: 'SET_SYSTEM_ERROR',
      payload: { system, error }
    });
  }, []);

  // Island management
  const setCurrentIsland = useCallback((islandId, islandData) => {
    dispatch({
      type: 'SET_CURRENT_ISLAND',
      payload: { islandId, ...islandData }
    });
  }, []);

  const updateIslandData = useCallback((updates) => {
    dispatch({
      type: 'UPDATE_ISLAND_DATA',
      payload: updates
    });
  }, []);

  // State update actions for hooks
  const updateWeatherState = useCallback((newState) => {
    dispatch({
      type: 'UPDATE_WEATHER_STATE',
      payload: newState
    });
  }, []);

  const updateSeasonalState = useCallback((newState) => {
    dispatch({
      type: 'UPDATE_SEASONAL_STATE',
      payload: newState
    });
  }, []);

  // Interaction state
  const setInteractionState = useCallback((updates) => {
    dispatch({
      type: 'SET_INTERACTION_STATE',
      payload: updates
    });
  }, []);

  // Event system
  const addEventToHistory = useCallback((event) => {
    dispatch({
      type: 'ADD_EVENT_TO_HISTORY',
      payload: event
    });
  }, []);

  const setCurrentEvent = useCallback((event) => {
    dispatch({
      type: 'SET_CURRENT_EVENT',
      payload: event
    });
  }, []);

  // Simulation control
  const setSimulationState = useCallback((updates) => {
    dispatch({
      type: 'SET_SIMULATION_STATE',
      payload: updates
    });
  }, []);

  const pauseSimulation = useCallback(() => {
    dispatch({ type: 'PAUSE_SIMULATION' });
  }, []);

  const resumeSimulation = useCallback(() => {
    dispatch({ type: 'RESUME_SIMULATION' });
  }, []);

  const setTimeMultiplier = useCallback((multiplier) => {
    dispatch({
      type: 'SET_TIME_MULTIPLIER',
      payload: multiplier
    });
  }, []);

  // Loading state
  const setLoadingState = useCallback((updates) => {
    dispatch({
      type: 'SET_LOADING_STATE',
      payload: updates
    });
  }, []);

  const updateLoadingProgress = useCallback((increment = 1) => {
    dispatch({
      type: 'UPDATE_LOADING_PROGRESS',
      payload: { increment }
    });
  }, []);

  // Error handling
  const setError = useCallback((updates) => {
    dispatch({
      type: 'SET_ERROR',
      payload: updates
    });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    // State
    ...state,

    // Actions
    initializeRenderer,
    initializeWeather,
    initializeSeason,
    initializeAudio,
    initializeZoomPan,
    setSystemError,
    setCurrentIsland,
    updateIslandData,
    updateWeatherState,
    updateSeasonalState,
    setInteractionState,
    addEventToHistory,
    setCurrentEvent,
    setSimulationState,
    pauseSimulation,
    resumeSimulation,
    setTimeMultiplier,
    setLoadingState,
    updateLoadingProgress,
    setError,
    clearError,
    resetState
  }), [state]);

  return (
    <IslandStateContext.Provider value={contextValue}>
      <IslandDispatchContext.Provider value={dispatch}>
        {children}
      </IslandDispatchContext.Provider>
    </IslandStateContext.Provider>
  );
}

//================================================
// CUSTOM HOOKS FOR STATE ACCESS
//================================================

// Main state hook
export function useIslandState() {
  const context = useContext(IslandStateContext);
  if (context === null) {
    throw new Error('useIslandState must be used within an IslandStateProvider');
  }
  return context;
}

// Direct dispatch hook for advanced use cases
export function useIslandDispatch() {
  const context = useContext(IslandDispatchContext);
  if (context === null) {
    throw new Error('useIslandDispatch must be used within an IslandStateProvider');
  }
  return context;
}

// Specific system state hooks
export function useRendererState() {
  const { systems } = useIslandState();
  return systems.renderer;
}

export function useWeatherState() {
  const { systems } = useIslandState();
  return systems.weather;
}

export function useSeasonState() {
  const { systems } = useIslandState();
  return systems.season;
}

export function useAudioState() {
  const { systems } = useIslandState();
  return systems.audio;
}

export function useZoomPanState() {
  const { systems } = useIslandState();
  return systems.zoomPan;
}

// Island data hook
export function useIslandData() {
  const { islandData } = useIslandState();
  return islandData;
}

// Event system hook
export function useEventState() {
  const { events } = useIslandState();
  return events;
}

// Simulation control hook
export function useSimulationState() {
  const { simulation } = useIslandState();
  return simulation;
}

// Error state hook
export function useErrorState() {
  const { error, setError, clearError } = useIslandState();
  return { error, setError, clearError };
}

console.log('🏝️ IslandStateProvider initialized - Global state management ready');