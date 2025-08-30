//================================================
// ISLAND LIFECYCLE MANAGER
//================================================
// Manages island evolution from birth to eternity with life stage transitions
// Determines behavioral patterns and event probabilities based on age

const LIFE_STAGES = {
  // Birth (Years 0-1)
  FIRE_START: {
    name: 'fire_start',
    minAge: 0,
    maxAge: 1,
    description: 'Initial spark - volcanic activity and land emergence',
    volatility: 1.0,      // High uncertainty and change
    stability: 0.0,       // No stability yet
    consciousness: 0.01,  // Barely awakening
    eventMultiplier: 0.5, // Higher event frequency
    metamorphicRate: 10,   // Rapid changes per year
    memoryCapacity: 100,   // Limited history storage
    probabilities: {
      volcanic_birth: 0.001,
      sea_lifting: 0.00099,
      magical_emergence: 0.00001
    }
  },

  // Youth (Years 1-50)
  EMERGENCE: {
    name: 'emergence',
    minAge: 1,
    maxAge: 10,
    description: 'Islands rising from sea with wild energy',
    volatility: 0.8,
    stability: 0.2,
    consciousness: 0.1,
    eventMultiplier: 1.0,
    metamorphicRate: 5,
    memoryCapacity: 1000,
    probabilities: {
      rainfall_season: 0.75,
      vegetation_growth: 0.15,
      storm_approaching: 0.05,
      fire_start: 0.03,
      minor_erosion: 0.02
    }
  },

  MATURATION: {
    name: 'maturation',
    minAge: 10,
    maxAge: 50,
    description: 'Peak beauty and rapid ecosystem development',
    volatility: 0.6,
    stability: 0.4,
    consciousness: 0.3,
    eventMultiplier: 1.2,
    metamorphicRate: 3,
    memoryCapacity: 5000,
    probabilities: {
      rainfall_season: 0.6,
      vegetation_growth: 0.2,
      river_formation: 0.1,
      earthquake_minor: 0.05,
      forest_fire: 0.03,
      storm_approaching: 0.02
    }
  },

  // Maturity (Years 50-500)
  EQUILIBRIUM: {
    name: 'equilibrium',
    minAge: 50,
    maxAge: 200,
    description: 'Balanced ecosystem with steady growth',
    volatility: 0.3,
    stability: 0.7,
    consciousness: 0.6,
    eventMultiplier: 0.8,
    metamorphicRate: 1.5,
    memoryCapacity: 10000,
    probabilities: {
      seasonal_change: 0.6,
      river_formation: 0.2,
      vegetation_spread: 0.1,
      earthquake_minor: 0.05,
      storm_approaching: 0.04,
      forest_fire: 0.01
    }
  },

  EVOLUTION: {
    name: 'evolution',
    minAge: 200,
    maxAge: 1000,
    description: 'Adaptive changes and deeper transformation',
    volatility: 0.4,
    stability: 0.6,
    consciousness: 0.8,
    eventMultiplier: 1.0,
    metamorphicRate: 1,
    memoryCapacity: 25000,
    probabilities: {
      mountain_rise: 0.4,
      river_formation: 0.15,
      desert_formation: 0.1,
      volcano_awaken: 0.08,
      tsunami: 0.05,
      reality_crack: 0.02
    }
  },

  // Ancient (Years 1000-5000)
  ANTIQUITY: {
    name: 'antiquity',
    minAge: 1000,
    maxAge: 5000,
    description: 'Ancient patterns and accumulating wisdom',
    volatility: 0.2,
    stability: 0.8,
    consciousness: 0.9,
    eventMultiplier: 0.6,
    metamorphicRate: 0.5,
    memoryCapacity: 50000,
    probabilities: {
      wisdom_flood: 0.15,
      desert_formation: 0.1,
      tsunami: 0.08,
      volcano_awaken: 0.05,
      mountainous_growth: 0.04,
      reality_crack: 0.03,
      ice_age: 0.01
    }
  },

  VENERATION: {
    name: 'veneration',
    minAge: 5000,
    maxAge: 10000,
    description: 'Mythical existence requiring belief to maintain',
    volatility: 0.1,
    stability: 0.9,
    consciousness: 0.95,
    eventMultiplier: 0.3,
    metamorphicRate: 0.2,
    memoryCapacity: 100000,
    probabilities: {
      reality_shift: 0.03,
      dimensional_rift: 0.02,
      cosmic_influence: 0.01,
      ice_age: 0.005,
      apocalypse: 0.001,
      rebirth: 0.002
    }
  },

  // Eternal (Years 10000+)
  ETERNITY: {
    name: 'eternity',
    minAge: 10000,
    maxAge: Infinity,
    description: 'Beyond mortal comprehension - eternal consciousness',
    volatility: 0.05,
    stability: 0.95,
    consciousness: 1.0,
    eventMultiplier: 0.1,
    metamorphicRate: 0.1,
    memoryCapacity: 200000,
    probabilities: {
      reality_shift: 0.01,
      dimensional_rift: 0.005,
      cosmic_influence: 0.003,
      ice_age: 0.001,
      continental_shift: 0.005,
      rebirth: 0.001,
      apocalypse: 0.0005
    }
  }
};

class IslandLifecycleManager {
  constructor(islandId = 1) {
    this.islandId = islandId;
    this.currentAge = 0;
    this.currentStage = LIFE_STAGES.FIRE_START;
    this.lifeHistory = [];
    this.stageTransitionPoints = [];
    this.consciousnessLevel = 0.01;

    // Evolution tracking
    this.evolutionMetrics = {
      totalEvents: 0,
      catastrophicEvents: 0,
      mysticalEvents: 0,
      transformativeEvents: 0,
      memoryCapacityUsed: 0,
      stabilityIndex: 0,
      consciousnessGrowthRate: 0
    };

    // Evolution modifiers (affects event generation)
    this.evolutionModifiers = {
      environmentalAdaptation: 1.0,
      catastrophicResilience: 1.0,
      mysticalSensitivity: 1.0,
      naturalGrowthRate: 1.0
    };

    console.log(`🌱 Island Lifecycle Manager initialized for Island ${islandId}`);
  }

  //================================================
  // LIFE STAGE MANAGEMENT
  //================================================

  updateAge(newAge) {
    const oldAge = this.currentAge;
    const oldStage = this.currentStage;
    this.currentAge = newAge;

    // Check for stage transition
    const newStage = this.getLifeStage(newAge);
    if (newStage !== oldStage) {
      this.transitionToStage(newStage, oldStage);
    }

    // Update consciousness based on age and experiences
    this.updateConsciousness();
  }

  getLifeStage(age) {
    for (const stageKey of Object.keys(LIFE_STAGES)) {
      const stage = LIFE_STAGES[stageKey];
      if (age >= stage.minAge && age <= stage.maxAge) {
        return stage;
      }
    }
    // Fallback to eternity
    return LIFE_STAGES.ETERNITY;
  }

  getStageName(stage) {
    return stage.name;
  }

  getStageDescription(stage) {
    return stage.description;
  }

  transitionToStage(newStage, oldStage) {
    console.log(`🌱 Island ${this.islandId} transitioning from ${oldStage.name} to ${newStage.name}`);

    // Record transition point
    this.stageTransitionPoints.push({
      from: oldStage.name,
      to: newStage.name,
      transitionAge: this.currentAge,
      timestamp: Date.now(),
      conditions: this.getCurrentConditions()
    });

    // Update current stage
    this.currentStage = newStage;

    // Apply transition effects
    this.applyStageTransitionEffects(newStage, oldStage);

    // Trigger stage-specific initialization
    this.initializeStage(newStage);
  }

  applyStageTransitionEffects(newStage, oldStage) {
    // Reset or modify evolution modifiers based on transition
    if (newStage.volatility > oldStage.volatility) {
      // Increased volatility - reset some stability
      this.evolutionModifiers.catastrophicResilience = Math.max(0.5, this.evolutionModifiers.catastrophicResilience * 0.9);
    }

    if (newStage.consciousness > oldStage.consciousness) {
      // Consciousness growth - enhance mystical sensitivity
      this.evolutionModifiers.mysticalSensitivity *= 1.1;
    }

    // Stability evolution
    const stabilityChange = newStage.stability - oldStage.stability;
    this.evolutionMetrics.stabilityIndex += stabilityChange * 0.1;
  }

  initializeStage(stage) {
    // Stage-specific initialization
    switch (stage.name) {
      case 'emergence':
        this.initializeYouthStage();
        break;
      case 'maturation':
        this.initializeMaturityStage();
        break;
      case 'antiquity':
        this.initializeAncientStage();
        break;
      case 'veneration':
        this.initializeMythicalStage();
        break;
      case 'eternity':
        this.initializeEternalStage();
        break;
    }
  }

  //================================================
  // STAGE-SPECIFIC INITIALIZATION
  //================================================

  initializeYouthStage() {
    // Youth: High learning rate, rapid adaptation
    this.evolutionModifiers.environmentalAdaptation = 1.5;
    this.evolutionModifiers.naturalGrowthRate = 1.3;

    // Reset catastrophic resilience (young systems more vulnerable)
    this.evolutionModifiers.catastrophicResilience = 1.0;

    console.log(`🌱 Youth stage: High learning, rapid adaptation`);
  }

  initializeMaturityStage() {
    // Maturity: Balancing all systems, peak beauty
    this.evolutionModifiers.environmentalAdaptation = 1.0;
    this.evolutionModifiers.naturalGrowthRate = 1.0;
    this.evolutionModifiers.catastrophicResilience = 1.2;

    // Ecosystem stabilization
    this.evolutionMetrics.stabilityIndex += 0.3;

    console.log(`🌸 Maturity stage: Peak beauty and stability`);
  }

  initializeAncientStage() {
    // Ancient: Wisdom accumulation, slow change
    this.evolutionModifiers.environmentalAdaptation = 0.8;
    this.evolutionModifiers.mysticalSensitivity = 1.5;
    this.evolutionModifiers.catastrophicResilience = 1.5;

    // Experience-based growth
    this.evolutionMetrics.totalEvents *= 1.1; // Cumulative experience

    console.log(`🏛️ Ancient stage: Wisdom and resilience`);
  }

  initializeMythicalStage() {
    // Mythical: Beyond physical existence
    this.evolutionModifiers.mysticalSensitivity = 2.0;
    this.evolutionModifiers.catastrophicResilience = 0.8; // More vulnerable in belief

    console.log(`🎭 Mythical stage: Existence through belief`);
  }

  initializeEternalStage() {
    // Eternal: Transcendental existence
    this.evolutionModifiers.mysticalSensitivity = 3.0;
    this.consciousnessLevel = 1.0; // Perfect consciousness

    console.log(`✨ Eternal stage: Beyond comprehension`);
  }

  //================================================
  // CONSCIOUSNESS AND EVOLUTION
  //================================================

  updateConsciousness() {
    const stage = this.currentStage;
    const experiences = this.evolutionMetrics.totalEvents;

    // Base consciousness from age and stage
    let consciousness = stage.consciousness;

    // Experience-based growth
    const experienceFactor = Math.min(experiences / 10000, 1.0);
    consciousness += experienceFactor * 0.2;

    // Stability-based growth
    const stabilityFactor = this.evolutionMetrics.stabilityIndex;
    consciousness += stabilityFactor * 0.1;

    // Mystical sensitivity bonus
    const mysticalFactor = this.evolutionModifiers.mysticalSensitivity - 1.0;
    consciousness += mysticalFactor * 0.05;

    // Cap consciousness
    this.consciousnessLevel = Math.min(consciousness, 1.0);

    // Calculate growth rate
    this.evolutionMetrics.consciousnessGrowthRate =
      this.consciousnessLevel - (stage.consciousness || 0);
  }

  getConsciousnessLevel() {
    return this.consciousnessLevel;
  }

  //================================================
  // EVOLUTION METRICS AND MODIFIERS
  //================================================

  recordEvent(event) {
    this.evolutionMetrics.totalEvents++;

    if (event.category === 'catastrophic') {
      this.evolutionMetrics.catastrophicEvents++;
    }

    if (event.category === 'mythical') {
      this.evolutionMetrics.mysticalEvents++;
    }

    if (event.type && event.type.includes('transform') || event.type.includes('shift')) {
      this.evolutionMetrics.transformativeEvents++;
    }

    // Update memory usage
    this.evolutionMetrics.memoryCapacityUsed += event.memorySize || 200; // bytes

    // Clean up old history if memory is tight
    this.manageMemoryUsage();
  }

  manageMemoryUsage() {
    const maxCapacity = this.currentStage.memoryCapacity || 50000;

    if (this.evolutionMetrics.memoryCapacityUsed > maxCapacity) {
      console.log(`🧠 Memory cleanup for Island ${this.islandId} (${this.currentStage.name} stage)`);

      // Remove oldest history events
      const cleanupAmount = Math.floor(this.evolutionMetrics.memoryCapacityUsed * 0.1);
      this.evolutionMetrics.memoryCapacityUsed -= cleanupAmount;

      // In practice, would clean up this.lifeHistory here
    }
  }

  getEvolutionModifiers() {
    return { ...this.evolutionModifiers };
  }

  getEvolutionMetrics() {
    return {
      ...this.evolutionMetrics,
      stage: this.currentStage.name,
      consciousness: this.consciousnessLevel,
      age: this.currentAge
    };
  }

  //================================================
  // PROBABILITY ADJUSTMENT SYSTEM
  //================================================

  getStageProbabilities() {
    return { ...this.currentStage.probabilities };
  }

  getAdjustedProbabilities(baseProbabilities) {
    const adjusted = {};

    for (const [eventType, baseProb] of Object.entries(baseProbabilities)) {
      let probability = baseProb;

      // Apply evolution modifiers
      probability *= this.evolutionModifiers.environmentalAdaptation;

      if (eventType.includes('catastrophic')) {
        probability *= this.evolutionModifiers.catastrophicResilience;
      }

      if (eventType.includes('mythical') || eventType.includes('reality')) {
        probability *= this.evolutionModifiers.mysticalSensitivity;
      }

      if (eventType.includes('growth') || eventType.includes('vegetation')) {
        probability *= this.evolutionModifiers.naturalGrowthRate;
      }

      // Apply consciousness factor (higher consciousness = rarer extreme events)
      if (this.consciousnessLevel > 0.8) {
        if (eventType.includes('catastrophic')) {
          probability *= 0.5; // Consciousness reduces destructive events
        }
      }

      adjusted[eventType] = probability;
    }

    return adjusted;
  }

  //================================================
  // CONDITION MONITORING
  //================================================

  getCurrentConditions() {
    return {
      age: this.currentAge,
      stage: this.currentStage.name,
      consciousness: this.consciousnessLevel,
      stability: this.currentStage.stability,
      volatility: this.currentStage.volatility,
      metamorphicRate: this.currentStage.metamorphicRate,
      memoryCapacity: this.currentStage.memoryCapacity,
      totalEvents: this.evolutionMetrics.totalEvents,
      catastrophicEvents: this.evolutionMetrics.catastrophicEvents,
      mysticalEvents: this.evolutionMetrics.mysticalEvents,
      stabilityIndex: this.evolutionMetrics.stabilityIndex,
      modifiers: this.getEvolutionModifiers(),
      memoryUsage: (this.evolutionMetrics.memoryCapacityUsed / this.currentStage.memoryCapacity) * 100
    };
  }

  getLifeExpectancy() {
    // Estimated continuing existence based on consciousness and stability
    const baseExpectancy = 10000; // Base 10,000 years

    const consciousnessBonus = this.consciousnessLevel * 5000;
    const stabilityBonus = this.evolutionMetrics.stabilityIndex * 2000;
    const catastrophicPenalty = this.evolutionMetrics.catastrophicEvents * 100;

    return Math.max(1000, baseExpectancy + consciousnessBonus + stabilityBonus - catastrophicPenalty);
  }

  //================================================
  // PREDICTION AND FORECASTING
  //================================================

  predictNextStage(currentAge) {
    const age = currentAge || this.currentAge;

    // Find the next stage
    for (const [key, stage] of Object.entries(LIFE_STAGES)) {
      if (age >= stage.minAge && age < stage.maxAge) {
        const yearsToNext = stage.maxAge - age;
        const nextKey = Object.keys(LIFE_STAGES)[Object.keys(LIFE_STAGES).indexOf(key) + 1];

        if (nextKey && LIFE_STAGES[nextKey]) {
          return {
            nextStage: LIFE_STAGES[nextKey],
            yearsToTransition: yearsToNext,
            expectedTransitions: this.predictTransitions(age, LIFE_STAGES[nextKey])
          };
        }
      }
    }

    return null; // Eternal stage
  }

  predictTransitions(currentAge, targetStage) {
    // Predict expected number of events in this stage
    const yearsInStage = targetStage.maxAge - currentAge;
    const eventRate = this.currentStage.eventMultiplier;
    const expectedEvents = yearsInStage * eventRate * 100; // Approximate

    return {
      expectedTotalEvents: expectedEvents,
      expectedCatastrophic: expectedEvents * 0.02,
      expectedMystical: targetStage.name === 'veneration' || targetStage.name === 'eternity' ?
        expectedEvents * 0.001 : 0,
      metamorphosisRate: targetStage.metamorphicRate
    };
  }

  //================================================
  // HISTORY AND ANCESTRY
  //================================================

  getLifeHistory() {
    return {
      birthAge: 0,
      currentAge: this.currentAge,
      transitions: this.stageTransitionPoints,
      metrics: this.getEvolutionMetrics(),
      finalStage: this.currentStage.name,
      consciousnessAscent: this.consciousnessLevel,
      eventCount: this.evolutionMetrics.totalEvents
    };
  }

  getAncestryLine() {
    // Build ancestry from transitions
    const ancestry = ['fire_start'];

    for (const transition of this.stageTransitionPoints) {
      ancestry.push(transition.to);
    }

    return ancestry;
  }

  //================================================
  // DEBUGGING AND MONITORING
  //================================================

  getDebugInfo() {
    return {
      islandId: this.islandId,
      currentAge: this.currentAge,
      currentStage: this.currentStage.name,
      consciousness: this.consciousnessLevel,
      lifeHistory: this.lifeHistory,
      transitionPoints: this.stageTransitionPoints,
      evolutionMetrics: this.getEvolutionMetrics(),
      evolutionModifiers: this.getEvolutionModifiers(),
      conditions: this.getCurrentConditions(),
      nextStage: this.predictNextStage()
    };
  }

  toString() {
    return `Island ${this.islandId}: Age ${this.currentAge.toFixed(1)} years, ` +
           `Stage "${this.currentStage.name}", ` +
           `Consciousness ${(this.consciousnessLevel * 100).toFixed(1)}%`;
  }

  //================================================
  // SERIALIZATION FOR PERSISTENCE
  //================================================

  toSerializable() {
    return {
      islandId: this.islandId,
      currentAge: this.currentAge,
      currentStage: this.getStageName(this.currentStage),
      consciousnessLevel: this.consciousnessLevel,
      lifeHistory: this.lifeHistory,
      stageTransitionPoints: this.stageTransitionPoints,
      evolutionMetrics: this.evolutionMetrics,
      evolutionModifiers: this.evolutionModifiers
    };
  }

  static fromSerializable(data) {
    const manager = new IslandLifecycleManager(data.islandId);

    manager.currentAge = data.currentAge;
    manager.currentStage = LIFE_STAGES[data.currentStage.toUpperCase()] || LIFE_STAGES.FIRE_START;
    manager.consciousnessLevel = data.consciousnessLevel;
    manager.lifeHistory = data.lifeHistory || [];
    manager.stageTransitionPoints = data.stageTransitionPoints || [];
    manager.evolutionMetrics = data.evolutionMetrics || { ...manager.evolutionMetrics };
    manager.evolutionModifiers = data.evolutionModifiers || { ...manager.evolutionModifiers };

    return manager;
  }
}

//================================================
// EXPORTS FOR BROWSER/COMMONJS
//================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IslandLifecycleManager, LIFE_STAGES };
}

console.log('🌱 Island Lifecycle Manager loaded - Evolutionary life stage system ready');