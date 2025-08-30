//=============================================
// ARCHIPELAGO ISLAND DATA MANAGEMENT SYSTEM
//=============================================
// Complete island lifecycle management with ownership, events, and analytics
// Based on Oracle Autonomous JSON Database

const { sodaManager } = require('./soda-manager');
const { userManager } = require('./user-manager');
const crypto = require('crypto');

class IslandManager {
  constructor() {
    // Island metadata
    this.totalIslands = 404;
    this.activeSeasons = ['spring', 'summer', 'autumn', 'winter'];

    // Event probabilities (stochastic system)
    this.eventProbabilities = {
      volcanic_birth: 0.05,    // 5% chance quarterly
      storm: 0.15,             // 15% chance monthly
      season_change: 0.12,     // 12% chance monthly
      volcanic_eruption: 0.08, // 8% chance quarterly
      tsunami: 0.03,           // 3% chance yearly
      weather_anomaly: 0.10    // 10% chance monthly
    };
  }

  // Initialize island with detailed metadata
  async initializeIsland(islandId) {
    try {
      console.log(`🏝️ Initializing island ${islandId}/404`);

      const islandDocument = {
        _id: islandId,
        generation_seed: crypto.randomInt(1000000, 9999999),
        creation_date: new Date('2024-08-30').toISOString(),
        current_age: Math.floor(Math.random() * 100),
        current_owner: null,
        ownership_history: [],
        event_history: [{
          event_type: 'volcanic_birth',
          timestamp: new Date('2022-08-30').toISOString(),
          description: `Island ${islandId} emerged from the Pacific Ocean`,
          visual_impact: 'formation'
        }],
        performance_metrics: {
          total_views: crypto.randomInt(1000, 100000),
          generation_time: crypto.randomInt(10, 100),
          user_favorites: crypto.randomInt(10, 1000),
          social_shares: crypto.randomInt(5, 500),
          generation_success: true,
          last_generated: new Date().toISOString()
        },
        state_persistence: {
          last_temperature: 25 + Math.random() * 10,
          current_season: this.activeSeasons[Math.floor(Math.random() * 4)],
          event_counter: 1,
          interaction_count: crypto.randomInt(10, 10000),
          last_activity: new Date().toISOString(),
          maturity_level: Math.floor(Math.random() * 100)
        },
        geographic_data: {
          latitude: -20 + Math.random() * 30, // Pacific region
          longitude: 160 + Math.random() * 60,
          area_km2: 1000 + Math.random() * 10000,
          elevation_m: 500 + Math.random() * 2000
        }
      };

      await sodaManager.insertDocument('islands', islandDocument);

      console.log(`✅ Island ${islandId} initialized with seed: ${islandDocument.generation_seed}`);
      return islandDocument;
    } catch (error) {
      console.error(`❌ Failed to initialize island ${islandId}:`, error.message);
      throw error;
    }
  }

  // Bulk initialize all 404 islands
  async initializeAllIslands() {
    console.log('🌊 Initializing complete Archipelago of 404 islands...');

    const islandPromises = [];
    for (let i = 1; i <= this.totalIslands; i++) {
      islandPromises.push(this.initializeIsland(i));
    }

    const results = await Promise.allSettled(islandPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ ${successful}/${this.totalIslands} islands initialized (${failed} failed)`);

    if (failed > 0) {
      console.error(`❌ Failed to initialize ${failed} islands`);
      results.filter(r => r.status === 'rejected').forEach((error, index) => {
        console.error(`  Island ${index + 1}: ${error.reason.message}`);
      });
    }

    return { successful, failed };
  }

  // Get island by ID with full metadata
  async getIsland(islandId) {
    try {
      const island = await sodaManager.findById('islands', islandId);

      if (!island) {
        throw new Error(`Island ${islandId} not found in Archipelago`);
      }

      return island;
    } catch (error) {
      console.error(`❌ Failed to get island ${islandId}:`, error.message);
      throw error;
    }
  }

  // Transfer ownership of an island
  async transferOwnership(islandId, fromUserId, toUserId, purchaseData) {
    try {
      console.log(`🔄 Transferring ownership of island ${islandId} from ${fromUserId} to ${toUserId}`);

      // Validate island exists
      const island = await this.getIsland(islandId);

      // Validate current ownership
      if (island.current_owner !== fromUserId && island.current_owner !== null) {
        throw new Error(`Island ${islandId} is not owned by user ${fromUserId}`);
      }

      // Update ownership history
      const ownershipEntry = {
        from_user: fromUserId,
        to_user: toUserId,
        transfer_date: new Date().toISOString(),
        purchase_price: purchaseData.price || 0,
        transaction_id: purchaseData.transactionId,
        tier: purchaseData.tier || 'discovery'
      };

      // Update island document
      await sodaManager.updateById('islands', islandId, {
        current_owner: toUserId,
        ownership_history: [...(island.ownership_history || []), ownershipEntry],
        last_transaction: ownershipEntry.transfer_date,
        total_owners: (island.total_owners || 0) + 1
      });

      // Update user collections
      if (fromUserId) {
        await userManager.removeIslandFromUser(fromUserId, islandId);
      }
      await userManager.addIslandToUser(toUserId, islandId);

      console.log(`✅ Island ${islandId} ownership transferred to ${toUserId}`);
      return { success: true, ownershipEntry };
    } catch (error) {
      console.error(`❌ Failed to transfer ownership:`, error.message);
      throw error;
    }
  }

  // Record event in island's history
  async recordEvent(islandId, eventType, eventData) {
    try {
      console.log(`🌋 Recording event '${eventType}' for island ${islandId}`);

      const island = await this.getIsland(islandId);

      const eventEntry = {
        event_type: eventType,
        timestamp: new Date().toISOString(),
        description: eventData.description,
        visual_impact: eventData.visualImpact || eventType,
        numerical_value: eventData.value || 0,
        weather_conditions: eventData.weather || island.state_persistence.current_season,
        metadata: eventData.metadata || {}
      };

      await sodaManager.updateById('islands', islandId, {
        event_history: [...(island.event_history || []), eventEntry],
        'state_persistence.event_counter': (island.state_persistence.event_counter || 0) + 1,
        'state_persistence.last_activity': eventEntry.timestamp,
        'state_persistence.last_event_type': eventType
      });

      console.log(`✅ Event '${eventType}' recorded for island ${islandId}`);
      return eventEntry;
    } catch (error) {
      console.error(`❌ Failed to record event for island ${islandId}:`, error.message);
      throw error;
    }
  }

  // Trigger stochastic events based on probabilities
  async triggerProbabilisticEvent(islandId) {
    try {
      const island = await this.getIsland(islandId);
      const activeSeason = island.state_persistence.current_season;

      // Calculate event weights based on season and island maturity
      const seasonMultiplier = this.getSeasonEventMultiplier(activeSeason);
      const maturityMultiplier = this.getMaturityEventMultiplier(island.state_persistence.maturity_level);

      // Roll for event
      const events = Object.keys(this.eventProbabilities);
      const roll = Math.random();
      let cumulativeProbability = 0;
      let selectedEvent = null;

      for (const event of events) {
        const baseProb = this.eventProbabilities[event];
        const weightedProb = baseProb * seasonMultiplier * maturityMultiplier;
        cumulativeProbability += weightedProb;

        if (roll < cumulativeProbability) {
          selectedEvent = event;
          break;
        }
      }

      if (selectedEvent) {
        const eventData = await this.generateEventData(selectedEvent, island);
        await this.recordEvent(islandId, selectedEvent, eventData);
        return { triggered: true, event: selectedEvent, data: eventData };
      }

      return { triggered: false };
    } catch (error) {
      console.error(`❌ Failed to trigger probabilistic event for island ${islandId}:`, error.message);
      return { triggered: false, error: error.message };
    }
  }

  // Generate event data for stochastic events
  async generateEventData(eventType, island) {
    const eventTemplates = {
      volcanic_birth: {
        description: `New volcanic activity emerged on island ${island._id}`,
        visualImpact: 'formation',
        value: crypto.randomInt(1, 10)
      },
      storm: {
        description: `Intense storm impacted island ${island._id}, shaping new coastlines`,
        visualImpact: 'erosion',
        value: crypto.randomInt(5, 20),
        weather: 'stormy',
        metadata: { rainfall: crypto.randomInt(100, 500) }
      },
      season_change: {
        description: `Seasonal change brought new vegetation patterns to island ${island._id}`,
        visualImpact: 'vegetation',
        value: crypto.randomInt(2, 8),
        weather: 'transitional'
      },
      volcanic_eruption: {
        description: `Volcanic eruption dramatically reshaped island ${island._id}`,
        visualImpact: 'terrain_change',
        value: crypto.randomInt(15, 50),
        metadata: { lava_flow: crypto.randomInt(10, 1000) }
      },
      tsunami: {
        description: `Tsunami waves dramatically altered island ${island._id}'s coastline`,
        visualImpact: 'coastal_erosion',
        value: crypto.randomInt(25, 75),
        weather: 'extreme_weather'
      },
      weather_anomaly: {
        description: `Unexpected weather anomaly affected island ${island._id}'s development`,
        visualImpact: 'weather_impact',
        value: crypto.randomInt(3, 15)
      }
    };

    return eventTemplates[eventType] || {
      description: `Unknown event occurred on island ${island._id}`,
      visualImpact: 'unknown',
      value: 0
    };
  }

  // Update island performance metrics
  async updatePerformanceMetrics(islandId, metricsUpdate) {
    try {
      const island = await this.getIsland(islandId);

      const updatedMetrics = {
        ...island.performance_metrics,
        ...metricsUpdate,
        last_updated: new Date().toISOString()
      };

      await sodaManager.updateById('islands', islandId, {
        performance_metrics: updatedMetrics
      });

      console.log(`📊 Performance metrics updated for island ${islandId}`);
      return updatedMetrics;
    } catch (error) {
      console.error(`❌ Failed to update performance metrics for island ${islandId}:`, error.message);
      throw error;
    }
  }

  // Increment view count and user interaction
  async recordIslandView(islandId, userId = null) {
    try {
      const island = await this.getIsland(islandId);

      await sodaManager.updateById('islands', islandId, {
        'performance_metrics.total_views': (island.performance_metrics.total_views || 0) + 1,
        'state_persistence.interaction_count': (island.state_persistence.interaction_count || 0) + 1,
        'state_persistence.last_activity': new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to record view for island ${islandId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Get islands owned by a user
  async getIslandsByOwner(userId) {
    try {
      const islands = await sodaManager.find('islands', { current_owner: userId });
      return islands;
    } catch (error) {
      console.error(`❌ Failed to get islands for user ${userId}:`, error.message);
      throw error;
    }
  }

  // Get available islands for purchase
  async getAvailableIslands(offSet = 0, limit = 50) {
    try {
      const islands = await sodaManager.find('islands', {
        current_owner: { $exists: false },
        _id: { $gte: offSet + 1, $lt: offSet + limit + 1 }
      });

      return islands;
    } catch (error) {
      console.error(`❌ Failed to get available islands:`, error.message);
      throw error;
    }
  }

  // Get most popular islands by performance metrics
  async getPopularIslands(limit = 10) {
    try {
      const islands = await sodaManager.find('islands', {}, {
        sort: { 'performance_metrics.total_views': -1 },
        limit
      });

      return islands;
    } catch (error) {
      console.error(`❌ Failed to get popular islands:`, error.message);
      throw error;
    }
  }

  // Bulk event processing for multiple islands
  async processIslandEvents() {
    console.log(`🌊 Processing probabilistic events across Archipelago...`);

    const results = [];
    let totalEvents = 0;

    for (let islandId = 1; islandId <= Math.min(100, this.totalIslands); islandId++) { // Sample first 100 for demo
      try {
        const eventResult = await this.triggerProbabilisticEvent(islandId);
        if (eventResult.triggered) {
          results.push({
            islandId,
            event: eventResult.event,
            triggered: true
          });
          totalEvents++;
        }
      } catch (error) {
        results.push({
          islandId,
          error: error.message,
          triggered: false
        });
      }
    }

    console.log(`✅ Processed events on ${totalEvents} islands`);
    return { processed: results.length, eventsTriggered: totalEvents, results };
  }

  // Get island statistics for analytics
  async getIslandStatistics() {
    try {
      const totalIslands = await sodaManager.count('islands');
      const ownedIslands = await sodaManager.count('islands', { current_owner: { $ne: null } });
      const availableIslands = totalIslands - ownedIslands;

      // Island ownership distribution
      const ownershipDistribution = {};
      for (const tier of ['discovery', 'stewardship', 'legacy']) {
        ownershipDistribution[tier] = await sodaManager.count('purchases', { tier });

      // Performance metrics
      const topIsland = await this.getPopularIslands(1);
      const totalViews = await this.getTotalIslandViews();

      return {
        totalIslands,
        ownedIslands,
        availableIslands,
        ownershipDistribution,
        topIsland: topIsland[0] || null,
        totalViews,
        averageViewsPerIsland: totalViews / totalIslands,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Failed to get island statistics:`, error.message);
      throw error;
    }
  }

  // Helper methods for event system
  getSeasonEventMultiplier(season) {
    const seasonMultipliers = {
      spring: 1.2,  // High vegetation growth
      summer: 0.8,  // Stable weather
      autumn: 1.5,  // Weather changes
      winter: 1.0   // Regular activity
    };
    return seasonMultipliers[season] || 1.0;
  }

  getMaturityEventMultiplier(maturityLevel) {
    if (maturityLevel < 25) return 1.5;    // Young islands - more events
    if (maturityLevel < 50) return 1.2;    // Mature islands - regular events
    if (maturityLevel < 75) return 0.8;    // Established islands - fewer events
    return 0.5;                           // Ancient islands - minimal events
  }

  // Get total island views across the archipelago
  async getTotalIslandViews() {
    try {
      // This would ideally use aggregation but using simple iteration for demo
      let total = 0;
      const islands = await sodaManager.find('islands', {});

      for (const island of islands.slice(0, 100)) { // Sample for performance
        total += island.performance_metrics?.total_views || 0;
      }

      return total;
    } catch (error) {
      console.error(`❌ Failed to get total island views:`, error.message);
      return 0;
    }
  }

  // Update season for an island
  async updateIslandSeason(islandId) {
    try {
      const newSeason = this.activeSeasons[Math.floor(Math.random() * this.activeSeasons.length)];

      await sodaManager.updateById('islands', islandId, {
        'state_persistence.current_season': newSeason,
        'state_persistence.last_season_change': new Date().toISOString()
      });

      await this.recordEvent(islandId, 'season_change', {
        description: `Island ${islandId} transitioned to ${newSeason} season`,
        visualImpact: 'vegetation',
        value: 5,
        weather: 'transitional'
      });

      return { success: true, newSeason };
    } catch (error) {
      console.error(`❌ Failed to update season for island ${islandId}:`, error.message);
      throw error;
    }
  }
}

//=============================================
// GLOBAL ISLAND MANAGER INSTANCE
//=============================================
const islandManager = new IslandManager();

//=============================================
// MODULE EXPORTS
//=============================================
module.exports = {
  IslandManager,
  islandManager
};