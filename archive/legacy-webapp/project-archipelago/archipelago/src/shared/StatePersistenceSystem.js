//================================================
// STATE PERSISTENCE SYSTEM
//================================================
// Efficient local storage management for perpetual island histories
// Optimized for <100ms serialization with <5MB memory usage

class StatePersistenceSystem {
  constructor(compressionLevel = 3) {
    this.storage = window.localStorage;
    this.compressionLevel = compressionLevel; // 1-6 (higher = smaller but slower)
    this.maxStorageSize = 50 * 1024 * 1024; // 50MB max
    this.clearingThreshold = 45 * 1024 * 1024; // Clear when >45MB

    // Storage keys
    this.storageKeys = {
      islandState: 'archipelago_island_',
      eventHistory: 'archipelago_events_',
      performanceMetrics: 'archipelago_perf_',
      systemMetadata: 'archipelago_meta_'
    };

    // Caching for performance
    this.memoryCache = new Map();
    this.cacheExpiration = 30000; // 30 seconds

    console.log('💾 State Persistence System initialized');
  }

  //================================================
  // ISLAND STATE PERSISTENCE
  //================================================

  saveIslandState(islandId, state) {
    const startTime = performance.now();
    const key = `${this.storageKeys.islandState}${islandId}`;

    try {
      // Prepare the state for storage
      const persistedState = this.prepareIslandStateForStorage(islandId, state);

      // Compress and store
      const compressed = this.compressData(persistedState);
      const serialized = JSON.stringify(compressed);

      // Check storage limits
      if (this.wouldExceedStorageLimit(serialized.length)) {
        console.log(`🧹 Space low - cleaning up storage for Island ${islandId}`);
        this.cleanupOldData(islandId);
      }

      // Store
      this.storage.setItem(key, serialized);

      // Update cache
      this.memoryCache.set(key, {
        data: persistedState,
        timestamp: Date.now()
      });

      const saveTime = performance.now() - startTime;
      console.log(`💾 Saved state for Island ${islandId} (${serialized.length} bytes, ${saveTime.toFixed(2)}ms)`);

    } catch (error) {
      console.error('💾 Failed to save island state:', error);
      this.handleStorageError(error);
    }
  }

  loadIslandState(islandId) {
    const startTime = performance.now();
    const key = `${this.storageKeys.islandState}${islandId}`;

    try {
      // Check cache first
      if (this.memoryCache.has(key)) {
        const cached = this.memoryCache.get(key);
        if (Date.now() - cached.timestamp < this.cacheExpiration) {
          return cached.data;
        }
      }

      // Load from storage
      const stored = this.storage.getItem(key);
      if (!stored) return null;

      const compressed = JSON.parse(stored);
      const state = this.decompressData(compressed);

      // Cache the loaded data
      this.memoryCache.set(key, {
        data: state,
        timestamp: Date.now()
      });

      const loadTime = performance.now() - startTime;
      console.log(`📚 Loaded state for Island ${islandId} (${stored.length} bytes, ${loadTime.toFixed(2)}ms)`);

      return state;

    } catch (error) {
      console.error('💾 Failed to load island state:', error);
      return null;
    }
  }

  prepareIslandStateForStorage(islandId, state) {
    // Only persist essential data for state restoration
    return {
      islandId: islandId,
      currentAge: state.currentAge,
      lastSimulationTime: state.simulatedTime,
      eventCount: state.eventHistory.length,
      activeEventCount: state.activeEvents ? Object.keys(state.activeEvents).length : 0,
      stage: state.currentStage,
      consciousnessLevel: state.consciousnessLevel,
      evolutionMetrics: state.evolutionMetrics,
      lastSaveTime: Date.now(),
      version: '2.0.0' // For future compatibility
    };
  }

  //================================================
  // EVENT HISTORY PERSISTENCE
  //================================================

  saveEventHistory(islandId, eventHistory, keepRecentCount = 100) {
    const startTime = performance.now();
    const key = `${this.storageKeys.eventHistory}${islandId}`;

    try {
      // Keep only recent events to save space
      const recentEvents = eventHistory.slice(-keepRecentCount);

      // Compress event data
      const preparedEvents = this.compressEventHistory(recentEvents);
      const serialized = JSON.stringify(preparedEvents);

      if (this.wouldExceedStorageLimit(serialized.length)) {
        this.cleanupEventHistory(islandId, Math.floor(keepRecentCount * 0.8));
        return this.saveEventHistory(islandId, eventHistory, Math.floor(keepRecentCount * 0.8));
      }

      this.storage.setItem(key, serialized);

      const saveTime = performance.now() - startTime;
      console.log(`📝 Saved ${recentEvents.length} events for Island ${islandId} (${serialized.length} bytes, ${saveTime.toFixed(2)}ms)`);

    } catch (error) {
      console.error('💾 Failed to save event history:', error);
    }
  }

  loadEventHistory(islandId) {
    const startTime = performance.now();
    const key = `${this.storageKeys.eventHistory}${islandId}`;

    try {
      const stored = this.storage.getItem(key);
      if (!stored) return [];

      const compressed = JSON.parse(stored);
      const events = this.decompressEventHistory(compressed);

      const loadTime = performance.now() - startTime;
      console.log(`📚 Loaded ${events.length} events for Island ${islandId} (${stored.length} bytes, ${loadTime.toFixed(2)}ms)`);

      return events;

    } catch (error) {
      console.error('💾 Failed to load event history:', error);
      return [];
    }
  }

  compressEventHistory(events) {
    // Compress by removing redundant fields and using shorter keys
    return events.map(event => ({
      i: event.id,
      t: event.type,
      c: event.category,
      a: event.islandAge,
      s: event.status,
      ts: event.timestamp,
      d: event.duration
    }));
  }

  decompressEventHistory(compressed) {
    // Restore full event structure
    return compressed.map(event => ({
      id: event.i,
      type: event.t,
      category: event.c,
      islandAge: event.a,
      status: event.s,
      timestamp: event.ts,
      duration: event.d || 0
    }));
  }

  //================================================
  // EVENT COMPLETION PERSISTENCE
  //================================================

  saveEventCompletion(eventId, completionTime) {
    const key = `${this.storageKeys.performanceMetrics}completions`;

    try {
      const completions = this.loadEventCompletions();
      completions.push({
        eventId: eventId,
        completedAt: completionTime,
        timestamp: Date.now()
      });

      // Keep only recent 1000 completions
      if (completions.length > 1000) {
        completions.splice(0, completions.length - 1000);
      }

      this.storage.setItem(key, JSON.stringify(completions));

    } catch (error) {
      console.error('💾 Failed to save event completion:', error);
    }
  }

  loadEventCompletions() {
    const key = `${this.storageKeys.performanceMetrics}completions`;

    try {
      const stored = this.storage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('💾 Failed to load event completions:', error);
      return [];
    }
  }

  //================================================
  // SYSTEM METADATA PERSISTENCE
  //================================================

  saveSystemMetadata(metadata) {
    const key = this.storageKeys.systemMetadata;
    const data = {
      ...metadata,
      lastUpdated: Date.now()
    };

    try {
      this.storage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('💾 Failed to save system metadata:', error);
    }
  }

  loadSystemMetadata() {
    const key = this.storageKeys.systemMetadata;

    try {
      const stored = this.storage.getItem(key);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('💾 Failed to load system metadata:', error);
      return {};
    }
  }

  //================================================
  // STORAGE MANAGEMENT
  //================================================

  getStorageUsage() {
    let total = 0;
    const islandKeys = Object.values(this.storageKeys);

    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        const isArchipelagoKey = islandKeys.some(prefix => key.startsWith(prefix));
        if (isArchipelagoKey) {
          total += key.length + this.storage.getItem(key).length;
        }
      }
    } catch (error) {
      console.error('💾 Error calculating storage usage:', error);
    }

    return total;
  }

  wouldExceedStorageLimit(dataSize) {
    const currentUsage = this.getStorageUsage();
    return (currentUsage + dataSize) > this.maxStorageSize;
  }

  cleanupOldData(islandId) {
    const startTime = performance.now();

    try {
      // Strategy 1: Clean up old event histories (keep only 50 recent events)
      const eventKey = `${this.storageKeys.eventHistory}${islandId}`;
      if (this.storage.getItem(eventKey)) {
        const events = this.loadEventHistory(islandId);
        if (events.length > 50) {
          this.saveEventHistory(islandId, events.slice(-50), 50);
        }
      }

      // Strategy 2: Compress existing data
      const stateKey = `${this.storageKeys.islandState}${islandId}`;
      if (this.storage.getItem(stateKey)) {
        const state = this.loadIslandState(islandId);
        if (state) {
          this.saveIslandState(islandId, state);
        }
      }

      // Strategy 3: If still low on space, clear oldest islands
      if (this.getStorageUsage() > this.clearingThreshold) {
        this.cleanupLeastRecentIslands();
      }

      const cleanupTime = performance.now() - startTime;
      console.log(`🧹 Storage cleanup completed for Island ${islandId} (${cleanupTime.toFixed(2)}ms)`);

    } catch (error) {
      console.error('💾 Storage cleanup failed:', error);
    }
  }

  cleanupLeastRecentIslands() {
    try {
      const islandStates = [];

      // Find all island states
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key.startsWith(this.storageKeys.islandState)) {
          const state = this.loadIslandState(key.replace(this.storageKeys.islandState, ''));
          if (state && state.lastSaveTime) {
            islandStates.push({ id: state.islandId, lastSave: state.lastSaveTime });
          }
        }
      }

      // Sort by last save time (oldest first)
      islandStates.sort((a, b) => a.lastSave - b.lastSave);

      // Remove oldest 20%
      const toRemove = Math.floor(islandStates.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        const islandId = islandStates[i].id;
        this.deleteIslandData(islandId);
        console.log(`🗑️ Removed old data for Island ${islandId}`);
      }

    } catch (error) {
      console.error('💾 Failed to cleanup least recent islands:', error);
    }
  }

  deleteIslandData(islandId) {
    try {
      const keys = [
        `${this.storageKeys.islandState}${islandId}`,
        `${this.storageKeys.eventHistory}${islandId}`
      ];

      keys.forEach(key => {
        this.storage.removeItem(key);
      });

      // Clear from cache
      keys.forEach(key => this.memoryCache.delete(key));

      console.log(`🗑️ Deleted all data for Island ${islandId}`);
    } catch (error) {
      console.error('💾 Failed to delete island data:', error);
    }
  }

  //================================================
  // COMPRESSION UTILITIES
  //================================================

  compressData(data) {
    // Simple compression using run-length encoding for repetitive data
    if (this.compressionLevel === 0) return data;

    const compressed = { ...data };

    // Compress evolution metrics (lots of numbers)
    if (compressed.evolutionMetrics) {
      compressed.evolutionMetrics = this.compressNumericObject(compressed.evolutionMetrics);
    }

    // Compress arrays
    if (compressed.stageTransitionPoints) {
      compressed.stageTransitionPoints = this.runLengthEncodeArray(compressed.stageTransitionPoints);
    }

    return compressed;
  }

  decompressData(compressed) {
    if (!compressed || this.compressionLevel === 0) return compressed;

    const decompressed = { ...compressed };

    // Decompress metrics
    if (decompressed.evolutionMetrics) {
      decompressed.evolutionMetrics = this.decompressNumericObject(decompressed.evolutionMetrics);
    }

    // Decompress arrays
    if (decompressed.stageTransitionPoints) {
      decompressed.stageTransitionPoints = this.runLengthDecodeArray(decompressed.stageTransitionPoints);
    }

    return decompressed;
  }

  compressNumericObject(obj) {
    // Convert numbers to smaller representations
    const compressed = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'number') {
        compressed[key] = Math.round(value * 1000) / 1000; // Limit precision
      } else {
        compressed[key] = value;
      }
    }

    return compressed;
  }

  decompressNumericObject(compressed) {
    return compressed; // Numbers are already correct
  }

  runLengthEncodeArray(arr) {
    // Simple RLE for repetitive transition points
    const encoded = [];
    let currentValue = arr[0];
    let count = 1;

    for (let i = 1; i <= arr.length; i++) {
      if (i < arr.length && JSON.stringify(arr[i]) === JSON.stringify(currentValue)) {
        count++;
      } else {
        if (count > 1) {
          encoded.push([currentValue, count]);
        } else {
          encoded.push(currentValue);
        }
        currentValue = arr[i];
        count = 1;
      }
    }

    return encoded;
  }

  runLengthDecodeArray(encoded) {
    const decoded = [];

    encoded.forEach(item => {
      if (Array.isArray(item)) {
        const [value, count] = item;
        for (let i = 0; i < count; i++) {
          decoded.push(value);
        }
      } else {
        decoded.push(item);
      }
    });

    return decoded;
  }

  //================================================
  // ERROR HANDLING
  //================================================

  handleStorageError(error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('💾 Storage quota exceeded - attempting emergency cleanup');
      this.emergencyCleanup();
    } else {
      console.error('💾 Storage error:', error.name);
    }
  }

  emergencyCleanup() {
    try {
      // Remove all but essential data
      const keysToKeep = [this.storageKeys.systemMetadata];
      const keysToRemove = [];

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        const isEssential = keysToKeep.some(essential => key.startsWith(essential));
        if (!isEssential) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => this.storage.removeItem(key));
      console.log(`🚨 Emergency cleanup: removed ${keysToRemove.length} items`);

    } catch (error) {
      console.error('💾 Emergency cleanup failed:', error);
    }
  }

  //================================================
  // UTILITY METHODS
  //================================================

  clearAllData() {
    try {
      const keysToRemove = [];

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith('archipelago_')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => this.storage.removeItem(key));
      this.memoryCache.clear();

      console.log(`🗑️ Cleared all ${keysToRemove.length} Archipelago data items`);
    } catch (error) {
      console.error('💾 Failed to clear all data:', error);
    }
  }

  getStoredIslands() {
    const islands = [];

    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.storageKeys.islandState)) {
          const islandId = parseInt(key.replace(this.storageKeys.islandState, ''));
          if (islandId) {
            islands.push(islandId);
          }
        }
      }
    } catch (error) {
      console.error('💾 Failed to scan stored islands:', error);
    }

    return islands.sort();
  }

  getDebugInfo() {
    const usage = this.getStorageUsage();
    const islandCount = this.getStoredIslands().length;

    return {
      totalStorageUsage: usage,
      storageUsageMB: (usage / 1024 / 1024).toFixed(2),
      storageLimitMB: (this.maxStorageSize / 1024 / 1024).toFixed(2),
      clearingThresholdMB: (this.clearingThreshold / 1024 / 1024).toFixed(2),
      islandCount: islandCount,
      compressionLevel: this.compressionLevel,
      cacheSize: this.memoryCache.size,
      storedItems: this.storage.length
    };
  }

  //================================================
  // BATCH OPERATIONS
  //================================================

  saveBatchIslandData(islandsData) {
    console.log(`💾 Saving batch data for ${islandsData.length} islands...`);
    const startTime = performance.now();

    islandsData.forEach(({ islandId, state }) => {
      this.saveIslandState(islandId, state);
    });

    const saveTime = performance.now() - startTime;
    console.log(`✅ Batch save completed (${saveTime.toFixed(2)}ms total)`);
  }

  loadBatchIslandData(islandIds) {
    console.log(`📚 Loading batch data for ${islandIds.length} islands...`);
    const startTime = performance.now();
    const results = {};

    islandIds.forEach(islandId => {
      results[islandId] = this.loadIslandState(islandId);
    });

    const loadTime = performance.now() - startTime;
    console.log(`✅ Batch load completed (${loadTime.toFixed(2)}ms total)`);

    return results;
  }
}

//================================================
// EXPORTS FOR BROWSER/COMMONJS
//================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StatePersistenceSystem };
}

console.log('💾 State Persistence System loaded - Efficient data storage ready');