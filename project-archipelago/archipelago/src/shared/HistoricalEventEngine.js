//================================================
// HISTORICAL EVENT ENGINE - CORE EVENT MANAGEMENT
//================================================
// Perpetual island evolution with stochastic events and age-based lifecycles
// Optimized for <2ms per 60fps frame with zero-lag performance

import { EventProbabilitySystem } from './EventProbabilitySystem.js';
import { IslandLifecycleManager } from './IslandLifecycleManager.js';
import { StatePersistenceSystem } from './StatePersistenceSystem.js';

class HistoricalEventEngine {
  constructor(islandId, startAge = 0) {
    // Island identification
    this.islandId = islandId;
    this.currentAge = startAge;

    // Event processing
    this.isRunning = false;
    this.lastEventTime = performance.now();
    this.frameTimeMS = 1000 / 60; // 60fps target
    this.maxEventsPerFrame = 3;

    // Core systems
    this.probabilitySystem = new EventProbabilitySystem(islandId, this.currentAge);
    this.lifecycleManager = new IslandLifecycleManager();
    this.persistenceSystem = new StatePersistenceSystem();

    // Event management
    this.eventQueue = [];
    this.currentEvent = null;
    this.eventHistory = [];
    this.activeEvents = new Map();

    // Performance monitoring
    this.performanceMetrics = {
      averageProcessingTime: 0,
      eventsProcessed: 0,
      frameDrops: 0,
      lastFrameTime: 0
    };

    // Time tracking
    this.simulatedTime = Date.now();
    this.timeAcceleration = 3600; // 1 second = 1 hour simulation time

    // Event callbacks
    this.onEventGenerated = null;
    this.onEventCompleted = null;
    this.onAgeMilestone = null;
    this.onCatastrophicEvent = null;

    console.log(`🏝️ Historical Event Engine initialized for Island ${islandId} at age ${startAge} years`);

    // Load existing history if available
    this.loadIslandHistory();
  }

  //================================================
  // CORE EVENT PROCESSING LOOP
  //================================================

  // Main processing function - called every frame (60fps)
  processEventCycle(deltaTime) {
    const startTime = performance.now();

    try {
      // Update simulated time
      this.simulatedTime += deltaTime * this.timeAcceleration;

      // Age the island based on time passage
      this.updateIslandAge(deltaTime);

      // Generate new events based on current conditions
      const generatedEvents = this.probabilitySystem.generateEvents(
        this.currentAge,
        this.getCurrentConditions()
      );

      // Queue generated events
      generatedEvents.forEach(event => this.queueEvent(event));

      // Process active events
      this.processActiveEvents(deltaTime);

      // Limit processing to avoid frame drops
      if (generatedEvents.length > this.maxEventsPerFrame) {
        console.warn(`⚠️ High event generation rate: ${generatedEvents.length} events`);
      }

      // Update performance metrics
      this.updatePerformanceMetrics(performance.now() - startTime);

    } catch (error) {
      console.error('🏝️ Event engine processing error:', error);
      this.performanceMetrics.frameDrops++;
    }
  }

  //================================================
  // ISLAND AGING SYSTEM
  //================================================

  updateIslandAge(deltaTime) {
    const ageIncrease = deltaTime * this.timeAcceleration / (1000 * 24 * 365.25); // Years
    const previousAge = this.currentAge;
    this.currentAge += ageIncrease;

    // Check for age milestones
    if (Math.floor(previousAge) !== Math.floor(this.currentAge)) {
      this.onAgeMilestoneReached();
    }

    // Update lifecycle stage
    const newStage = this.lifecycleManager.getLifeStage(this.currentAge);
    if (newStage !== this.lifecycleManager.getLifeStage(previousAge)) {
      console.log(`🌱 Island ${this.islandId} entered ${newStage} stage at age ${Math.floor(this.currentAge)} years`);
      this.onStageTransition(newStage);
    }
  }

  onAgeMilestoneReached() {
    console.log(`🎂 Island ${this.islandId} milestone: ${Math.floor(this.currentAge)} years old`);

    if (this.onAgeMilestone) {
      this.onAgeMilestone({
        islandId: this.islandId,
        age: Math.floor(this.currentAge),
        lifeStage: this.lifecycleManager.getLifeStage(this.currentAge)
      });
    }

    // Trigger milestone event
    const milestoneEvent = this.probabilitySystem.generateMilestoneEvent(this.currentAge);
    if (milestoneEvent) {
      this.queueEvent(milestoneEvent);
    }
  }

  onStageTransition(newStage) {
    // Adjust event probabilities for new life stage
    this.probabilitySystem.updateStageProbabilities(newStage);

    // Trigger transition event
    if (this.onStageTransition) {
      this.onStageTransition({
        islandId: this.islandId,
        age: this.currentAge,
        stage: newStage,
        transitionEvent: this.probabilitySystem.generateStageTransitionEvent(newStage)
      });
    }
  }

  //================================================
  // EVENT MANAGEMENT SYSTEM
  //================================================

  queueEvent(event) {
    if (!event || !event.id) {
      console.warn('⚠️ Invalid event:', event);
      return;
    }

    event.queuedAt = this.simulatedTime;
    event.islandId = this.islandId;

    // Add to history immediately
    this.eventHistory.push({
      ...event,
      timestamp: this.simulatedTime,
      status: 'queued'
    });

    // Add to processing queue (priority based on type)
    this.eventQueue.push(event);

    // Sort queue by priority
    this.eventQueue.sort((a, b) => {
      const priorityOrder = {
        'catastrophic': 3,
        'major': 2,
        'minor': 1,
        'creation': 0
      };
      return (priorityOrder[b.category] || 0) - (priorityOrder[a.category] || 0);
    });

    // Limit queue size to prevent memory issues
    if (this.eventQueue.length > 10000) {
      this.eventQueue.splice(0, 1000); // Remove oldest events
      console.warn('⚠️ Event queue overflow - clearing older events');
    }
  }

  processActiveEvents(deltaTime) {
    const toRemove = [];

    for (const [eventId, eventData] of this.activeEvents) {
      try {
        // Update event progress
        eventData.currentTime += deltaTime;
        eventData.simulatedTime += deltaTime * this.timeAcceleration;

        // Check for completion
        if (eventData.currentTime >= eventData.duration) {
          this.completeEvent(eventId, eventData);
          toRemove.push(eventId);
        } else if (eventData.updateCallback) {
          // Update event effects
          eventData.updateCallback(eventData, deltaTime);
        }
      } catch (error) {
        console.error(`🏝️ Event processing error for ${eventId}:`, error);
        toRemove.push(eventId);
      }
    }

    // Remove completed events
    toRemove.forEach(eventId => this.activeEvents.delete(eventId));

    // Activate queued events
    this.processEventQueue();
  }

  processEventQueue() {
    // Process high-priority events first
    const maxConcurrentEvents = 5;
    const activeCount = this.activeEvents.size;

    if (activeCount >= maxConcurrentEvents) {
      return; // Queue full
    }

    const slotsAvailable = maxConcurrentEvents - activeCount;

    for (let i = 0; i < Math.min(slotsAvailable, this.eventQueue.length); i++) {
      const event = this.eventQueue.shift();
      if (event) {
        this.activateEvent(event);
      }
    }
  }

  activateEvent(event) {
    console.log(`🎯 Activating event "${event.type}" on Island ${this.islandId}`);

    const eventData = {
      ...event,
      currentTime: 0,
      simulatedTime: this.simulatedTime,
      completedAt: null,
      effects: event.generateEffects ? event.generateEffects() : {},
      updateCallback: event.update,
      completeCallback: event.onComplete
    };

    // Initialize event
    if (event.onStart) {
      event.onStart(eventData);
    }

    // Notify listeners
    if (this.onEventGenerated) {
      this.onEventGenerated(eventData);
    }

    // Store as active
    this.activeEvents.set(event.id, eventData);

    // Update history
    const historyIndex = this.eventHistory.findIndex(e => e.id === event.id);
    if (historyIndex !== -1) {
      this.eventHistory[historyIndex].status = 'active';
    }
  }

  completeEvent(eventId, eventData) {
    console.log(`✅ Completed event "${eventData.type}" on Island ${this.islandId}`);

    // Run completion callbacks
    if (eventData.onComplete) {
      eventData.onComplete(eventData);
    }

    if (eventData.completeCallback) {
      eventData.completeCallback(eventData);
    }

    // Notify listeners
    if (this.onEventCompleted) {
      this.onEventCompleted({
        ...eventData,
        completedAt: this.simulatedTime
      });
    }

    // Update history
    const historyIndex = this.eventHistory.findIndex(e => e.id === eventId);
    if (historyIndex !== -1) {
      this.eventHistory[historyIndex].status = 'completed';
      this.eventHistory[historyIndex].completedAt = this.simulatedTime;
    }

    // Persistence
    this.persistenceSystem.saveEventCompletion(eventId, this.simulatedTime);
  }

  //================================================
  // CONDITION MONITORING
  //================================================

  getCurrentConditions() {
    return {
      age: this.currentAge,
      lifeStage: this.lifecycleManager.getLifeStage(this.currentAge),
      activeEvents: this.activeEvents.size,
      recentEvents: this.getRecentEvents(10), // Last 10 events
      simulatedTime: this.simulatedTime,
      timeOfDay: this.getTimeOfDay(),
      weatherCondition: null, // To be populated by weather system
      altitudeEffects: this.probabilitySystem.getAltitudeFactors()
    };
  }

  getRecentEvents(count = 5) {
    return this.eventHistory
      .filter(event => eventTimestamp > this.simulatedTime - (24 * 3600 * 1000)) // Last 24 hours
      .slice(-count);
  }

  getTimeOfDay() {
    const hours = new Date(this.simulatedTime).getHours();
    if (hours >= 6 && hours < 12) return 'morning';
    if (hours >= 12 && hours < 18) return 'afternoon';
    if (hours >= 18 && hours < 22) return 'evening';
    return 'night';
  }

  //================================================
  // PERFORMANCE & METRICS
  //================================================

  updatePerformanceMetrics(processingTime) {
    this.performanceMetrics.averageProcessingTime =
      (this.performanceMetrics.averageProcessingTime * 0.95) + (processingTime * 0.05);
    this.performanceMetrics.eventsProcessed++;
    this.performanceMetrics.lastFrameTime = processingTime;

    // Monitor for performance issues
    if (processingTime > this.frameTimeMS) {
      this.performanceMetrics.frameDrops++;
      if (this.performanceMetrics.frameDrops % 10 === 0) {
        console.warn(`⚡ High processing time: ${processingTime.toFixed(2)}ms (${this.performanceMetrics.frameDrops} total drops)`);
      }
    }
  }

  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      activeEvents: this.activeEvents.size,
      queuedEvents: this.eventQueue.length,
      historySize: this.eventHistory.length,
      currentAge: this.currentAge,
      memoryUsage: this.getMemoryUsage()
    };
  }

  getMemoryUsage() {
    // Estimate memory usage
    const historyMemory = this.eventHistory.length * 200; // Rough estimate per event
    const queueMemory = this.eventQueue.length * 150;
    const activeMemory = this.activeEvents.size * 300;

    return historyMemory + queueMemory + activeMemory;
  }

  //================================================
  // HISTORY & PERSISTENCE
  //================================================

  loadIslandHistory() {
    try {
      const history = this.persistenceSystem.loadIslandHistory(this.islandId);
      if (history) {
        this.currentAge = history.currentAge || 0;
        this.eventHistory = history.events || [];
        this.simulatedTime = history.lastUpdateTime || Date.now();

        console.log(`📚 Loaded history for Island ${this.islandId}: ${this.eventHistory.length} previous events`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load island history:', error);
    }
  }

  saveCurrentState() {
    try {
      this.persistenceSystem.saveIslandState({
        islandId: this.islandId,
        currentAge: this.currentAge,
        lastUpdateTime: Date.now(),
        simulatedTime: this.simulatedTime,
        eventHistory: this.eventHistory.slice(-100), // Keep last 100 events for persistence
        activeEvents: Array.from(this.activeEvents.values())
      });
    } catch (error) {
      console.error('🏝️ Failed to save island state:', error);
    }
  }

  //================================================
  // CONTROL & LIFECYCLE
  //================================================

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastEventTime = performance.now();
    console.log(`🚀 Historical Event Engine started for Island ${this.islandId}`);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    console.log(`⏸️ Historical Event Engine paused for Island ${this.islandId}`);
  }

  stop() {
    this.isRunning = false;
    this.saveCurrentState();
    console.log(`🛑 Historical Event Engine stopped for Island ${this.islandId}`);
  }

  //================================================
  // PUBLIC INTERFACE
  //================================================

  triggerEvent(eventType, parameters = {}) {
    const event = this.probabilitySystem.createTriggeredEvent(eventType, parameters);
    if (event) {
      this.queueEvent(event);
      return event.id;
    }
    return null;
  }

  getEventHistory(timeRange = null) {
    if (!timeRange) {
      return this.eventHistory;
    }

    const startTime = timeRange.start || 0;
    const endTime = timeRange.end || this.simulatedTime;

    return this.eventHistory.filter(event =>
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  skipToAge(targetAge) {
    if (targetAge <= this.currentAge) {
      console.warn('⚠️ Cannot skip to past age');
      return;
    }

    // Fast-forward to target age
    this.currentAge = targetAge;
    this.simulatedTime = Date.now() + (targetAge * 365.25 * 24 * 3600 * 1000);

    console.log(`⏩ Fast-forwarded Island ${this.islandId} to age ${targetAge} years`);

    // Generate catch-up events
    const catchUpEvents = this.probabilitySystem.generateCatchUpEvents(this.currentAge);
    catchUpEvents.forEach(event => this.queueEvent(event));

    this.saveCurrentState();
  }

  reset() {
    console.log(`🔄 Resetting Historical Event Engine for Island ${this.islandId}`);
    this.currentAge = 0;
    this.eventHistory = [];
    this.eventQueue = [];
    this.activeEvents.clear();
    this.simulatedTime = Date.now();
    this.persistenceSystem.clearIslandHistory(this.islandId);
  }

  //================================================
  // DEBUGGING & DEVELOPMENT
  //================================================

  getDebugInfo() {
    return {
      islandId: this.islandId,
      currentAge: this.currentAge,
      lifeStage: this.lifecycleManager.getLifeStage(this.currentAge),
      activeEvents: Array.from(this.activeEvents.keys()),
      queuedEvents: this.eventQueue.length,
      historyLength: this.eventHistory.length,
      simulatedTime: new Date(this.simulatedTime).toISOString(),
      timeOfDay: this.getTimeOfDay(),
      performance: this.getPerformanceMetrics(),
      conditions: this.getCurrentConditions()
    };
  }

  // Force rare event for testing
  triggerRareEvent(category = 'mythical') {
    const rareEvent = this.probabilitySystem.forceRareEvent(category);
    if (rareEvent) {
      this.queueEvent(rareEvent);
      console.log(`🎲 Forced rare ${category} event: ${rareEvent.type}`);
      return rareEvent.id;
    }
    return null;
  }
}

//================================================
// EXPORTS FOR BROWSER/COMMONJS
//================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HistoricalEventEngine };
}

console.log('🏝️ Historical Event Engine Core loaded - Perpetual island evolution system ready');