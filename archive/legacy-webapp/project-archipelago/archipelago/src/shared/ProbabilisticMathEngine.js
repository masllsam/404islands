//================================================
// PROBABILISTIC MATH ENGINE
//================================================
// Advanced mathematical distributions for stochastic event generation
// Supports Gaussian, Poisson, exponential, and custom probability functions

class ProbabilisticMathEngine {
  constructor(islandId = 1) {
    this.islandId = islandId;

    // Seeded random number generator for deterministic islands
    this.seed = islandId * 0xDEADBEEF + 0xCAFEBABE;
    this.randomGenerator = this.createSeededRandom();

    // Distribution caches for performance
    this.gaussianCache = new Map();
    this.poissonCache = new Map();

    console.log(`🧮 Probabilistic Math Engine initialized for Island ${islandId}`);
  }

  //================================================
  // CORE RANDOM NUMBER GENERATION
  //================================================

  createSeededRandom() {
    let seed = this.seed;

    return function() {
      // Linear Congruential Generator (LCG) algorithm
      seed = (seed * 1103515245 + 12345) >>> 0;
      return (seed >>> 16) & 0x7FFF;
    };
  }

  // Basic uniform random from 0 to 1
  random() {
    return this.randomGenerator() / 32767.0;
  }

  // Seeded random in range [min, max)
  randomRange(min, max) {
    return min + this.random() * (max - min);
  }

  // Random integer in range [min, max)
  randomInt(min, max) {
    return Math.floor(this.random() * (max - min)) + min;
  }

  //================================================
  // PROBABILITY DISTRIBUTIONS
  //================================================

  // Gaussian/Normal distribution using Box-Muller transform
  gaussian(mean = 0, stdDev = 1) {
    const cacheKey = `${mean}_${stdDev}`;
    if (this.gaussianCache.has(cacheKey)) {
      const cached = this.gaussianCache.get(cacheKey);
      if (cached.length > 0) {
        return cached.shift();
      }
    }

    // Generate pairs using Box-Muller
    const u1 = this.random();
    const u2 = this.random();

    // Standard Box-Muller transformation
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

    // Cache the second value for next call
    if (!this.gaussianCache.has(cacheKey)) {
      this.gaussianCache.set(cacheKey, []);
    }
    this.gaussianCache.get(cacheKey).push(mean + z1 * stdDev);

    // Maintain cache size limit
    if (this.gaussianCache.get(cacheKey).length > 10) {
      this.gaussianCache.get(cacheKey).pop();
    }

    return mean + z0 * stdDev;
  }

  // Poisson distribution using inverse transform sampling
  poisson(lambda) {
    const cacheKey = `${lambda}`;
    if (this.poissonCache.has(cacheKey)) {
      const cached = this.poissonCache.get(cacheKey);
      if (cached.length > 0) {
        return cached.shift();
      }
    }

    // Knuth's algorithm for Poisson distribution
    if (lambda < 30) {
      // Small lambda - use direct algorithm
      let L = Math.exp(-lambda);
      let k = 0;
      let p = 1;

      do {
        k++;
        p *= this.random();
      } while (p > L);

      return k - 1;
    } else {
      // Large lambda - use Gaussian approximation
      return Math.max(0, Math.round(this.gaussian(lambda, Math.sqrt(lambda))));
    }
  }

  // Exponential distribution
  exponential(lambda) {
    return -Math.log(1.0 - this.random()) / lambda;
  }

  // Weibull distribution
  weibull(scale, shape) {
    const u = this.random();
    return scale * Math.pow(-Math.log(1 - u), 1 / shape);
  }

  // Beta distribution using acceptance-rejection sampling
  beta(alpha, beta) {
    const x = this.gamma(alpha);
    const y = this.gamma(beta);
    return x / (x + y);
  }

  // Gamma distribution using Ahrens-Dieter acceptance-rejection
  gamma(shape, scale = 1) {
    if (shape >= 1) {
      // Use Ahrens-Dieter algorithm
      const c = shape - 1;
      const b = Math.sqrt(2 * shape - 1);

      while (true) {
        const x = Math.sqrt(this.gaussian(0, 1) * this.gaussian(0, 1));
        const u = this.random();

        if (u <= 1 - 0.0331 * x * x) {
          return scale * (x + c);
        }

        const y = Math.sqrt(x * x + c);
        if (u <= Math.exp(-y + c)) {
          return scale * (-y + c);
        }
      }
    } else {
      // Use acceptance-rejection method for shape < 1
      return this.acceptanceRejection(shape, scale);
    }
  }

  // Acceptance-Rejection method for Gamma(shape < 1)
  acceptanceRejection(shape, scale) {
    const b = 1 + shape * Math.E;

    while (true) {
      const p = b * this.random();
      if (p <= 1) {
        const x = Math.pow(p, 1 / shape);
        const u = this.random();
        if (u <= Math.exp(-x)) {
          return scale * x;
        }
      } else {
        const x = -Math.log((b - p) / shape);
        const u = this.random();
        if (u <= Math.pow(x, shape - 1)) {
          return scale * x;
        }
      }
    }
  }

  //================================================
  // CUSTOM PROBABILITY FUNCTIONS
  //================================================

  // Custom distribution for event rarity (heavy-tail)
  rarityDistribution(rarityFactor = 1.0) {
    // Heavy-tailed distribution where rare events are much rarer
    // rarityFactor controls how rare rare events are (higher = rarer)
    const u = this.random();
    const v = this.random();

    // Combination of exponential and uniform
    const exponential = -Math.log(u);
    const uniform = v;

    // Mix them based on rarity factor
    return (1 - rarityFactor) * uniform + rarityFactor * exponential * 0.1;
  }

  // Age-weighted distribution (younger islands more volatile)
  ageWeightedDistribution(age, maxAge) {
    // Younger islands have higher volatility
    const ageFactor = Math.max(0, 1 - (age / maxAge));
    const baseValue = this.gaussian(0, 1);

    // Add age-dependent variance
    const variance = 1 + ageFactor * 2;
    return baseValue * Math.sqrt(variance);
  }

  // Seasonal distribution (time-of-day effects)
  seasonalDistribution(timeOfDay, peakTime = 'morning') {
    const timeFactors = {
      morning: 1.2,
      afternoon: 1.0,
      evening: 0.8,
      night: 0.6
    };

    const factor = timeFactors[timeOfDay] || 1.0;
    return this.random() * factor;
  }

  // Geographic distribution (altitude/terrain based)
  geographicDistribution(altitude, coastalProximity) {
    // Higher altitudes favor certain events (mountain thunderstorms)
    const altitudeFactor = altitude * 0.1;
    const coastalFactor = 1 - (coastalProximity * 0.5);

    const baseProb = this.random();
    return baseProb * altitudeFactor * coastalFactor;
  }

  //================================================
  // STABLE PROBABILITY FUNCTIONS
  //================================================

  // Stable random walk - persistent trends
  stableRandomWalk(steps = 100, persistence = 0.7) {
    const walk = [0];
    let current = 0;

    for (let i = 0; i < steps; i++) {
      current += this.gaussian(0, 1) * persistence + this.gaussian(0, 0.1);
      walk.push(current);
    }

    return walk;
  }

  // Brownian motion for natural variation
  brownianMotion(timePoints) {
    const motion = [0];

    for (let i = 1; i < timePoints; i++) {
      const increment = this.gaussian(0, Math.sqrt(1 / timePoints));
      motion.push(motion[i - 1] + increment);
    }

    return motion;
  }

  // Fractional Gaussian noise (fGn) for self-similar processes
  fractionalGaussianNoise(length, hurst = 0.5) {
    // Autocorrelated noise generation using Fourier synthesis
    const noise = new Array(length);

    // Generate white noise
    for (let i = 0; i < length; i++) {
      noise[i] = this.gaussian(0, 1);
    }

    // Apply frequency filtering for Hurst parameter
    return this.applyHurstFilter(noise, hurst);
  }

  applyHurstFilter(noise, hurst) {
    // Simple approximation for Hurst exponent
    // In practice, this would use more sophisticated FFT-based methods
    const filtered = [...noise];

    for (let i = 1; i < filtered.length; i++) {
      const correlation = Math.pow(i, 2 * hurst - 1);
      filtered[i] = (1 - correlation) * filtered[i] + correlation * filtered[i - 1];
    }

    return filtered;
  }

  //================================================
  // EVENT-SPECIFIC DISTRIBUTIONS
  //================================================

  // Catastrophic event timing (clustered)
  catastrophicTiming(clusterProbability = 0.1) {
    if (this.random() < clusterProbability) {
      // Event cluster - multiple events close together
      return this.exponential(0.5);
    } else {
      // Normal spacing
      return this.exponential(0.1);
    }
  }

  // Mythical event distribution (extremely rare)
  mythicalProbability(age, belief = 0.1) {
    // Requires both age and belief factors
    const ageFactor = Math.max(0, age - 1000) / 9000; // Only after 1000 years
    const beliefFactor = belief; // User belief system
    const baseRarity = 1e-6; // Extremely rare baseline

    return baseRarity * ageFactor * beliefFactor * this.random();
  }

  // Volcanic activity distribution (spontaneous)
  volcanicActivity(baselineActivity) {
    // Mixture of Poisson and exponential for spontaneous outbreaks
    const isActive = this.random() < baselineActivity;
    if (isActive) {
      return this.negativeBinomial(2, 0.3); // Duration of activity
    }
    return 0;
  }

  // Negative binomial distribution for over-dispersion
  negativeBinomial(successes, probability) {
    let failures = 0;
    let trials = 0;

    while (failures < successes) {
      trials++;
      if (this.random() > probability) {
        failures++;
      }
    }

    return trials;
  }

  //================================================
  // STATISTICAL UTILITIES
  //================================================

  // Calculate probability density function (PDF)
  pdf(distribution, x, params = {}) {
    switch (distribution) {
      case 'normal':
      case 'gaussian':
        const { mean = 0, stdDev = 1 } = params;
        return this.gaussianPDF(x, mean, stdDev);
      case 'poisson':
        const { lambda } = params;
        return this.poissonPDF(x, lambda);
      case 'exponential':
        const { rate = 1 } = params;
        return this.exponentialPDF(x, rate);
      default:
        return 0;
    }
  }

  gaussianPDF(x, mean, stdDev) {
    const variance = stdDev * stdDev;
    return (1 / Math.sqrt(2 * Math.PI * variance)) *
           Math.exp(-Math.pow(x - mean, 2) / (2 * variance));
  }

  poissonPDF(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  exponentialPDF(x, rate) {
    return rate * Math.exp(-rate * x);
  }

  factorial(n) {
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
      result *= i;
    }
    return result;
  }

  //================================================
  // RANDOM SAMPLING UTILITIES
  //================================================

  // Sample from arbitrary discrete distribution
  sampleFromDistribution(values, probabilities) {
    if (values.length !== probabilities.length) {
      throw new Error('Values and probabilities arrays must have same length');
    }

    const totalProb = probabilities.reduce((sum, p) => sum + p, 0);
    let random = this.random() * totalProb;

    for (let i = 0; i < values.length; i++) {
      random -= probabilities[i];
      if (random <= 0) {
        return values[i];
      }
    }

    // Fallback
    return values[values.length - 1];
  }

  // Bootstrap sampling for statistics estimation
  bootstrapSample(data, count) {
    const sample = [];
    for (let i = 0; i < count; i++) {
      const index = this.randomInt(0, data.length);
      sample.push(data[index]);
    }
    return sample;
  }

  // Reservoir sampling for large datasets
  reservoirSample(dataStream, sampleSize) {
    const reservoir = [];

    // Fill reservoir initially
    for (let i = 0; i < sampleSize && dataStream.length > i; i++) {
      reservoir.push(dataStream[i]);
    }

    // Replace with decreasing probability
    for (let i = sampleSize; i < dataStream.length; i++) {
      const j = this.randomInt(0, i + 1);
      if (j < sampleSize) {
        reservoir[j] = dataStream[i];
      }
    }

    return reservoir;
  }

  //================================================
  // PERFORMANCE & DEBUGGING
  //================================================

  getPerformanceMetrics() {
    return {
      gaussianCacheSize: this.gaussianCache.size,
      poissonCacheSize: this.poissonCache.size,
      gaussianCacheUtilization: Array.from(this.gaussianCache.values())
        .reduce((sum, arr) => sum + arr.length, 0),
      poissonCacheUtilization: Array.from(this.poissonCache.values())
        .reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  clearCaches() {
    this.gaussianCache.clear();
    this.poissonCache.clear();
    console.log('🧮 Math engine caches cleared');
  }

  getDebugInfo() {
    return {
      islandId: this.islandId,
      seed: this.seed,
      performance: this.getPerformanceMetrics(),
      supportedDistributions: [
        'uniform', 'gaussian', 'poisson', 'exponential',
        'weibull', 'beta', 'gamma', 'rarity',
        'ageWeighted', 'seasonal', 'geographic'
      ]
    };
  }

  // Test function to validate distributions
  validateDistributions(iterations = 10000) {
    const results = {
      gaussian: { mean: 0, stdDev: 0 },
      poisson: { samples: [] },
      exponential: { samples: [] }
    };

    // Generate samples
    for (let i = 0; i < iterations; i++) {
      results.gaussian.samples = results.gaussian.samples || [];
      results.gaussian.samples.push(this.gaussian());

      results.poisson.samples = results.poisson.samples || [];
      results.poisson.samples.push(this.poisson(2));

      results.exponential.samples = results.exponential.samples || [];
      results.exponential.samples.push(this.exponential(0.5));
    }

    // Calculate statistics
    results.gaussian.mean = this.mean(results.gaussian.samples);
    results.gaussian.stdDev = this.stdDev(results.gaussian.samples);
    results.poisson.mean = this.mean(results.poisson.samples);
    results.exponential.mean = this.mean(results.exponential.samples);

    return results;
  }

  mean(array) {
    return array.reduce((sum, val) => sum + val, 0) / array.length;
  }

  stdDev(array) {
    const mean = this.mean(array);
    const squaredDiffs = array.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.mean(squaredDiffs));
  }
}

//================================================
// EXPORTS FOR BROWSER/COMMONJS
//================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ProbabilisticMathEngine };
}

console.log('🧮 Probabilistic Math Engine loaded - Advanced stochastic distributions ready');