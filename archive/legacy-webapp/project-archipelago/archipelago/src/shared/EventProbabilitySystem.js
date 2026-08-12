//================================================
// EVENT PROBABILITY SYSTEM - STOCHASTIC EVENT GENERATION
//================================================
// Markov chain modeling for realistic island evolution patterns
// Generates events with age-based, seasonal, and probabilistic factoring

import { ProbabilisticMathEngine } from './ProbabilisticMathEngine.js';

class EventProbabilitySystem {
  constructor(islandId, islandAge = 0) {
    this.islandId = islandId;
    this.islandAge = islandAge;

    // Probability matrix (Markov chains)
    this.probabilityMatrix = this.initializeProbabilityMatrix();
    this.markovTransitions = this.initializeMarkovChains();

    // Current state
    this.currentState = 'youthful'; // Will be updated by lifecycle manager
    this.lastEventTime = performance.now();
    this.eventFrequencyMultiplier = 1.0;

    // Category probabilities (adjusted by age and conditions)
    this.categoryWeights = {
      creation: this.getCreationWeight(),
      maintenance: this.getMaintenanceWeight(),
      evolutionary: this.getEvolutionaryWeight(),
      catastrophic: this.getCatastrophicWeight(),
      mythical: this.getMythicalWeight()
    };

    // Event templates
    this.eventTemplates = this.initializeEventTemplates();

    // Math engine for distributions
    this.mathEngine = new ProbabilisticMathEngine(islandId);

    // Performance tracking
    this.generationTimes = [];
    this.eventsGenerated = 0;

    console.log(`🎲 Event Probability System initialized for Island ${islandId}`);
  }

  //================================================
  // PROBABILITY MATRIX INITIALIZATION
  //================================================

  initializeProbabilityMatrix() {
    // Age-based probability matrix (Markov transitions)
    const matrix = {
      // State: [From Age, To Age, Probabilities...]
      birth: {
        minAge: 0,
        maxAge: 1,
        transitions: {
          volcanic_birth: 0.001,    // Rare volcanic creation event
          sea_lifting: 0.00099,     // Oceanic uplift
          magical_emergence: 0.00001 // Truly rare magical event
        }
      },
      youthful: {
        minAge: 1,
        maxAge: 50,
        transitions: {
          rainfall_season: 0.75,    // Common weather
          vegetation_growth: 0.15,  // Plant events
          minor_erosion: 0.08,      // Land evolution
          storm_approaching: 0.015, // Weather extremes
          fire_start: 0.005         // Accidental fires
        }
      },
      mature: {
        minAge: 50,
        maxAge: 500,
        transitions: {
          seasonal_change: 0.6,     // Regular season shifts
          river_formation: 0.2,     // Water system events
          vegetation_spread: 0.1,   // Ecosystem growth
          earthquake_minor: 0.05,   // Tectonic activity
          storm_approaching: 0.04,  // Weather patterns
          forest_fire: 0.01         // Periodic fires
        }
      },
      ancient: {
        minAge: 500,
        maxAge: 5000,
        transitions: {
          mountain_rise: 0.4,       // Geological uplift
          wisdom_flood: 0.15,       // Large water events
          desert_formation: 0.1,    // Climate shifts
          volcano_awaken: 0.08,     // Volcanic activity
          tsunami: 0.05,            // Ocean disasters
          reality_crack: 0.02,      // Mythical events
          perfect_storm: 0.001      // Extremely rare
        }
      },
      eternal: {
        minAge: 5000,
        maxAge: Infinity,
        transitions: {
          continental_shift: 0.3,   // Massive changes
          ice_age: 0.1,             // Climate extremes
          cosmic_influence: 0.05,   // Outside forces
          reality_shift: 0.03,      // Paradigm change
          dimensional_rift: 0.01,   // Impossible events
          apocalypse: 0.001,        // End events
          rebirth: 0.002            // Cyclical rebirth
        }
      }
    };

    return matrix;
  }

  initializeMarkovChains() {
    // Define age transition probabilities
    return {
      'birth_to_youth': 0.95,      // Natural progression
      'youth_to_mature': 0.75,     // Growth transition
      'mature_to_ancient': 0.50,   // Wisdom accumulation
      'ancient_to_eternal': 0.25   // Perfect stability
    };
  }

  initializeEventTemplates() {
    return {
      // Creation Events (Year 0-1)
      volcanic_birth: {
        type: 'volcanic_birth',
        category: 'creation',
        duration: 60000,
        probabilities: {
          minAge: 0,
          maxAge: 1,
          baseChance: 0.001
        },
        visualEffects: {
          particles: 'lava_flow',
          sound: 'rumbling_earth',
          screenShake: true,
          colorShift: 'red/orange'
        },
        terrainImpact: 'create_volcano_crater',
        consequences: ['island_stabilization', 'fertile_soil']
      },

      sea_lifting: {
        type: 'sea_lifting',
        category: 'creation',
        duration: 120000,
        probabilities: {
          minAge: 0.01,
          maxAge: 0.5,
          baseChance: 0.00099
        },
        visualEffects: {
          particles: 'ocean_vapor',
          sound: 'rising_water',
          cameraPan: true,
          elevationRise: true
        },
        terrainImpact: 'increase_elevation',
        consequences: ['coastal_erosion']
      },

      // Maintenance Events (Years 1-50)
      rainfall_season: {
        type: 'rainfall_season',
        category: 'maintenance',
        duration: 300000,
        probabilities: {
          minAge: 1,
          maxAge: 100,
          baseChance: 0.75
        },
        visualEffects: {
          particles: 'rain_drops',
          sound: 'gentle_rain',
          moodLighting: 'cool_blue'
        },
        terrainImpact: 'water_collection',
        seasonalBonus: 1.5
      },

      vegetation_growth: {
        type: 'vegetation_growth',
        category: 'maintenance',
        duration: 450000,
        probabilities: {
          minAge: 2,
          maxAge: 200,
          baseChance: 0.15
        },
        visualEffects: {
          particles: 'leaf_sprites',
          sound: 'growing_sounds',
          colorShift: 'green/bright'
        },
        terrainImpact: 'vegetation_increase',
        consequences: ['animal_attraction', 'carbon_sequester']
      },

      // Evolutionary Events (Years 50-500)
      river_formation: {
        type: 'river_formation',
        category: 'evolutionary',
        duration: 900000,
        probabilities: {
          minAge: 50,
          maxAge: 1000,
          baseChance: 0.2
        },
        visualEffects: {
          particles: 'water_flow',
          sound: 'rushing_water',
          terrainDeformation: true
        },
        terrainImpact: 'create_river_system',
        consequences: ['fertile_valleys', 'migration_paths']
      },

      desert_formation: {
        type: 'desert_formation',
        category: 'evolutionary',
        duration: 1800000,
        probabilities: {
          minAge: 200,
          maxAge: 2000,
          baseChance: 0.1
        },
        visualEffects: {
          particles: 'sand_particles',
          sound: 'drought_wind',
          colorShift: 'yellow/brown'
        },
        terrainImpact: 'soil_dessication',
        consequences: ['drought_resistance', 'sand_dunes']
      },

      // Catastrophic Events (Rare)
      perfect_storm: {
        type: 'perfect_storm',
        category: 'catastrophic',
        duration: 1800000,
        probabilities: {
          minAge: 50,
          maxAge: 10000,
          baseChance: 0.001
        },
        visualEffects: {
          particles: 'lightning_strikes,toxic_rain,hurricane_winds',
          sound: 'thunder_booming',
          screenShake: true,
          colorFilter: 'chaotic_grayscale'
        },
        terrainImpact: 'erosion_smoothing',
        consequences: ['flood_damage', 'vegetation_destroyed', 'legendary_event']
      },

      forest_fire: {
        type: 'forest_fire',
        category: 'catastrophic',
        duration: 600000,
        probabilities: {
          minAge: 10,
          maxAge: 5000,
          baseChance: 0.01
        },
        visualEffects: {
          particles: 'fire_particles',
          sound: 'crackling_fire',
          colorShift: 'red/orange',
          heatDistortion: true
        },
        terrainImpact: 'vegetation_removal',
        consequences: ['renewed_growth', 'charred_land']
      },

      // Mythical Events (Extremely Rare)
      reality_shift: {
        type: 'reality_shift',
        category: 'mythical',
        duration: 129600000,
        probabilities: {
          minAge: 1000,
          maxAge: Infinity,
          baseChance: 0.00001
        },
        visualEffects: {
          particles: 'dimensional_rift',
          sound: 'reality_crackling',
          distort: 'spatial_warping',
          impossibleColors: true
        },
        terrainImpact: 'paradigm_change',
        consequences: ['mythical_transformation', 'legend_birth', 'belief_system']
      }
    };
  }

  //================================================
  // AGE-BASED WEIGHT CALCULATION
  //================================================

  getCreationWeight() {
    // Creation events only possible in first year
    if (this.islandAge >= 1) return 0;

    // Exponential decay from birth
    return Math.max(0, Math.exp(-this.islandAge * 10));
  }

  getMaintenanceWeight() {
    // Maintenance events dominant in youth
    if (this.islandAge <= 100) {
      return Math.max(0.3, 1 - (this.islandAge / 100) * 0.5);
    }
    // Minimal maintenance frequency in old age
    return 0.2;
  }

  getEvolutionaryWeight() {
    // Evolutionary events peak in middle age
    const ageFactor = (this.islandAge - 50) / 950; // 50-1000 year range
    const bellCurve = Math.exp(-Math.pow(ageFactor * 2, 2));
    return bellCurve * 0.4;
  }

  getCatastrophicWeight() {
    // Catastrophic events become more likely with age and size
    if (this.islandAge < 10) return 0.01; // Very rare in youth
    if (this.islandAge < 100) return 0.05;

    // Gradual increase with age
    return Math.min(0.15, 0.05 + (this.islandAge / 1000) * 0.1);
  }

  getMythicalWeight() {
    // Mythical events require age and "enlightenment"
    if (this.islandAge < 500) return 0; // Impossible when young
    if (this.islandAge < 1000) return 0.00001; // Very rare in middle age

    // Increase with age but always very unlikely
    const ageWeight = (this.islandAge - 1000) / 9000; // 1000+ year range
    return Math.min(0.0001, 0.00001 + ageWeight * 0.00009);
  }

  //================================================
  // EVENT GENERATION
  //================================================

  generateEvents(currentAge, conditions) {
    const startTime = performance.now();
    const events = [];

    // Update current age
    this.islandAge = currentAge;

    // Get current state from lifecycle
    this.currentState = conditions.lifeStage || 'youthful';

    // Update category weights based on age
    this.updateCategoryWeights();

    // Base event generation frequency (events per second)
    const baseFrequency = this.getEventFrequency();

    // Apply conditions and multipliers
    const adjustedFrequency = this.adjustFrequencyForConditions(baseFrequency, conditions);

    // Check if we should generate events this cycle
    const shouldGenerate = this.mathEngine.random() < adjustedFrequency;

    if (shouldGenerate) {
      const numEvents = this.determineEventCount(conditions);

      for (let i = 0; i < numEvents; i++) {
        const event = this.generateSingleEvent(conditions);
        if (event) {
          events.push(event);
          this.eventsGenerated++;

          // Limit simultaneous events to prevent overwhelm
          if (events.length >= 3) break;
        }
      }
    }

    // Track performance
    const generationTime = performance.now() - startTime;
    this.generationTimes.push(generationTime);
    if (this.generationTimes.length > 100) {
      this.generationTimes.shift(); // Keep last 100 times
    }

    return events;
  }

  generateSingleEvent(conditions) {
    // Select event category based on current weights
    const category = this.selectEventCategory();

    // Get available events for this category and age
    const availableEvents = Object.values(this.eventTemplates)
      .filter(template =>
        template.category === category &&
        this.islandAge >= (template.probabilities?.minAge || 0) &&
        this.islandAge <= (template.probabilities?.maxAge || Infinity)
      );

    if (availableEvents.length === 0) {
      return null;
    }

    // Select event based on probabilities within category
    const eventTemplate = this.selectEventFromCategory(availableEvents, conditions);

    // Create actual event instance
    return this.instantiateEvent(eventTemplate, conditions);
  }

  selectEventCategory() {
    const totalWeight = Object.values(this.categoryWeights).reduce((sum, w) => sum + w, 0);

    let random = this.mathEngine.random() * totalWeight;

    for (const [category, weight] of Object.entries(this.categoryWeights)) {
      random -= weight;
      if (random <= 0) {
        return category;
      }
    }

    return 'maintenance'; // Fallback
  }

  selectEventFromCategory(availableEvents, conditions) {
    // Apply condition modifiers
    const weights = availableEvents.map(event => {
      let baseProb = event.probabilities?.baseChance || 0.1;

      // Apply seasonal bonuses
      if (event.seasonalBonus && conditions.timeOfDay === 'morning') {
        baseProb *= event.seasonalBonus;
      }

      // Apply activity level bonuses
      if (event.category === 'evolutionary' && conditions.activeEvents > 5) {
        baseProb *= 0.5; // Less likely when other events happening
      }

      return baseProb;
    });

    // Normalize weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = this.mathEngine.random() * totalWeight;

    for (let i = 0; i < availableEvents.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return availableEvents[i];
      }
    }

    // Fallback
    return availableEvents[0];
  }

  instantiateEvent(template, conditions) {
    const eventId = `event_${this.eventsGenerated}_${performance.now()}`;

    const event = {
      id: eventId,
      type: template.type,
      category: template.category,
      duration: template.duration,

      // Event callbacks
      onStart: this.createEventStartCallback(template),
      update: this.createEventUpdateCallback(template),
      onComplete: this.createEventCompleteCallback(template),

      // Visual and audio effects
      visualEffects: { ...template.visualEffects },
      audioEffects: template.audioEffects,

      // Terrain modifications
      terrainImpact: template.terrainImpact,

      // Event-specific data
      timestamp: Date.now(),
      islandId: this.islandId,
      islandAge: this.islandAge,
      conditions: { ...conditions },

      // Consequences for future events
      consequences: [...(template.consequences || [])]
    };

    return event;
  }

  //================================================
  // FREQUENCY CONTROL & ADJUSTMENT
  //================================================

  getEventFrequency() {
    // Base events per second
    const ageBasedFrequency = 0.1 + (this.islandAge / 1000) * 0.05;

    return Math.min(1.0, ageBasedFrequency); // Max 1 event per second
  }

  adjustFrequencyForConditions(baseFrequency, conditions) {
    let multiplier = 1.0;

    // Time of day adjustments
    if (conditions.timeOfDay === 'night') {
      multiplier *= 0.5; // Fewer events at night
    }

    // Activity level adjustments
    const activeEvents = conditions.activeEvents || 0;
    if (activeEvents > 3) {
      multiplier *= 0.3; // Much less likely when busy
    } else if (activeEvents === 0) {
      multiplier *= 1.2; // Slightly increased when quiet
    }

    // Recent events adjustment (prevent event spam)
    const recentEvents = conditions.recentEvents?.length || 0;
    if (recentEvents > 5) {
      multiplier *= 0.5;
    }

    return Math.min(1.0, baseFrequency * multiplier);
  }

  determineEventCount(conditions) {
    // Most cycles generate 0-1 events
    const baseCount = this.mathEngine.randomPoisson(0.2);

    // Increase slightly during high activity periods
    if (conditions.weatherCondition === 'stormy') {
      return Math.min(3, baseCount + 1);
    }

    return Math.min(2, baseCount);
  }

  updateCategoryWeights() {
    this.categoryWeights = {
      creation: Math.max(0, this.getCreationWeight()),
      maintenance: Math.max(0.1, this.getMaintenanceWeight()),
      evolutionary: Math.max(0, this.getEvolutionaryWeight()),
      catastrophic: Math.max(0, this.getCatastrophicWeight()),
      mythical: Math.max(0, this.getMythicalWeight())
    };
  }

  //================================================
  // SPECIAL EVENT GENERATION
  //================================================

  generateMilestoneEvent(newAge) {
    // Generate age milestone events
    if (newAge % 100 === 0) {
      return this.instantiateEvent(this.eventTemplates.ancient_rite, { milestone: newAge });
    }

    return null;
  }

  generateStageTransitionEvent(newStage) {
    // Generate life stage transition events
    const transitionEvents = {
      'youthful': 'growth_acceleration',
      'mature': 'stability_achievement',
      'ancient': 'wisdom_crystallization',
      'eternal': 'ascension_event'
    };

    const eventType = transitionEvents[newStage];
    if (eventType && this.eventTemplates[eventType]) {
      return this.instantiateEvent(this.eventTemplates[eventType], { transition: newStage });
    }

    return null;
  }

  generateCatchUpEvents(targetAge) {
    const events = [];
    const ageGap = targetAge - this.islandAge;

    // Generate proportional events for skipped time
    const eventCount = Math.min(50, Math.floor(ageGap / 10));

    for (let i = 0; i < eventCount; i++) {
      const interpolatedAge = this.islandAge + (ageGap * (i / eventCount));
      const event = this.generateSingleEvent({
        lifeStage: this.getAgeStage(interpolatedAge),
        activeEvents: 0,
        timeOfDay: this.mathEngine.random() < 0.5 ? 'day' : 'night'
      });

      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  forceRareEvent(category) {
    const rareEvents = Object.values(this.eventTemplates)
      .filter(template => template.category === category);

    if (rareEvents.length > 0) {
      // Find the rarest event
      rareEvents.sort((a, b) =>
        (a.probabilities?.baseChance || 0) - (b.probabilities?.baseChance || 0)
      );

      return this.instantiateEvent(rareEvents[0], {
        forceGenerated: true,
        category: category
      });
    }

    return null;
  }

  //================================================
  // EVENT CALLBACK CREATION
  //================================================

  createEventStartCallback(template) {
    return (eventData) => {
      console.log(`🎯 ${template.type} event started on Island ${this.islandId}`);

      // Initialize visual effects
      if (template.visualEffects) {
        this.initializeVisualEffects(eventData, template.visualEffects);
      }

      // Apply immediate terrain changes
      if (template.terrainImpact) {
        this.applyImmediateTerrainImpact(eventData, template.terrainImpact);
      }
    };
  }

  createEventUpdateCallback(template) {
    return (eventData, deltaTime) => {
      // Update visual effects over time
      if (template.visualEffects) {
        this.updateVisualEffects(eventData, template.visualEffects, deltaTime);
      }

      // Ongoing terrain modifications
      if (template.terrainImpact) {
        this.continueTerrainImpact(eventData, template.terrainImpact, deltaTime);
      }
    };
  }

  createEventCompleteCallback(template) {
    return (eventData) => {
      console.log(`✅ ${template.type} event completed on Island ${this.islandId}`);

      // Final visual effects cleanup
      if (template.visualEffects) {
        this.finalizeVisualEffects(eventData, template.visualEffects);
      }

      // Final terrain modifications
      if (template.terrainImpact) {
        this.finalizeTerrainImpact(eventData, template.terrainImpact);
      }

      // Apply consequences
      if (template.consequences) {
        this.applyEventConsequences(eventData, template.consequences);
      }
    };
  }

  //================================================
  // VISUAL & TERRAIN EFFECT PLACEHOLDERS
  //================================================
  // These would integrate with the renderer and terrain systems

  initializeVisualEffects(eventData, effects) {
    // Placeholder - would connect to particle system
    // console.log('Visual effects initialized:', effects);
  }

  updateVisualEffects(eventData, effects, deltaTime) {
    // Placeholder - would update particle animations
  }

  finalizeVisualEffects(eventData, effects) {
    // Placeholder - cleanup particle effects
  }

  applyImmediateTerrainImpact(eventData, impact) {
    // Placeholder - immediate terrain changes
  }

  continueTerrainImpact(eventData, impact, deltaTime) {
    // Placeholder - gradual terrain changes
  }

  finalizeTerrainImpact(eventData, impact) {
    // Placeholder - final terrain state
  }

  applyEventConsequences(eventData, consequences) {
    // Placeholder - apply future event modifiers
    // console.log('Event consequences applied:', consequences);
  }

  //================================================
  // UTILITY FUNCTIONS
  //================================================

  getAgeStage(age) {
    if (age < 1) return 'birth';
    if (age < 50) return 'youthful';
    if (age < 500) return 'mature';
    if (age < 5000) return 'ancient';
    return 'eternal';
  }

  getAltitudeFactors() {
    // Return factors based on island topography (simulated)
    return {
      highAltitudeEvents: this.mathEngine.random(),
      coastalEvents: this.mathEngine.random(),
      mountainEvents: this.mathEngine.random()
    };
  }

  updateStageProbabilities(newStage) {
    // Update probabilities when transitioning between life stages
    this.currentState = newStage;
    this.updateCategoryWeights();
    console.log(`🎲 Updated probabilities for stage: ${newStage}`);
  }

  //================================================
  // PERFORMANCE & DEBUGGING
  //================================================

  getPerformanceMetrics() {
    const avgTime = this.generationTimes.reduce((sum, t) => sum + t, 0) / Math.max(1, this.generationTimes.length);

    return {
      eventsGenerated: this.eventsGenerated,
      averageGenerationTime: avgTime,
      totalGenerationTime: this.generationTimes.reduce((sum, t) => sum + t, 0),
      categoryWeights: { ...this.categoryWeights },
      currentState: this.currentState,
      islandAge: this.islandAge
    };
  }

  getDebugInfo() {
    return {
      islandId: this.islandId,
      currentState: this.currentState,
      islandAge: this.islandAge,
      categoryWeights: { ...this.categoryWeights },
      performance: this.getPerformanceMetrics(),
      availableEvents: Object.keys(this.eventTemplates),
      probabilityMatrix: this.probabilityMatrix,
      markovTransitions: this.markovTransitions
    };
  }
}

//================================================
// EXPORTS
//================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EventProbabilitySystem };
}

console.log('🎲 Event Probability System loaded - Stochastic island evolution');