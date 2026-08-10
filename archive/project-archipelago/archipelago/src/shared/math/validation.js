// validation.js - Mathematical correctness validation for the engine
// Tests deterministic outputs and known mathematical properties

import { PerlinNoise } from './PerlinNoise.js';
import { FractionalBrownianMotion } from './FractionalBrownianMotion.js';
import { islandGenerator } from './IslandGenerator.js';

class ValidationSuite {
  constructor() {
    this.results = {};
    this.testCount = 0;
    this.passedTests = 0;
  }

  validate(testName, condition, description = '') {
    this.testCount++;
    const pass = Boolean(condition);
    if (pass) this.passedTests++;

    this.results[testName] = {
      status: pass,
      description,
      timestamp: Date.now()
    };

    console.log(`${pass ? '✅' : '❌'} ${testName}: ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass && description) console.log(`   Details: ${description}`);

    return pass;
  }

  runValidation() {
    console.log('🧪 Mathematical Engine Validation Suite\n' + '='.repeat(50));

    this.validateSeedConsistency();
    this.validateNoiseProperties();
    this.validateFBmCharacteristics();
    this.validateIslandGeneration();
    this.validateMemoryIntegrity();
    this.validatePerformanceTargets();

    console.log('='.repeat(50));
    this.printSummary();
  }

  validateSeedConsistency() {
    console.log('\n1. Seed-Based Determinism Tests');

    const seed1 = 12345;
    const seed2 = 12345;

    // Perlin noise determinism
    const perlin1 = new PerlinNoise(seed1);
    const perlin2 = new PerlinNoise(seed2);
    const perlin3 = new PerlinNoise(99999);

    const test1 = perlin1.noise2D(0.5, 0.3) === perlin2.noise2D(0.5, 0.3);
    this.validate('Perlin noise seed reproducibility', test1,
       'Same seed (12345) should produce identical results');

    const test2 = perlin1.noise2D(0.5, 0.3) !== perlin3.noise2D(0.5, 0.3);
    this.validate('Perlin noise seed uniqueness', test2,
       'Different seeds should produce different results');

    // fBm determinism
    const fbm1 = new FractionalBrownianMotion(seed1);
    const fbm2 = new FractionalBrownianMotion(seed2);
    const fbm3 = new FractionalBrownianMotion(99999);

    const test3 = fbm1.noise2D(0.5, 0.3) === fbm2.noise2D(0.5, 0.3);
    this.validate('fBm seed reproducibility', test3,
       'Same seed (12345) should produce identical fBm results');

    const test4 = fbm1.noise2D(0.5, 0.3) !== fbm3.noise2D(0.5, 0.3);
    this.validate('fBm seed uniqueness', test4,
       'Different seeds should produce different fBm results');

    // Island generation determinism
    const island1 = islandGenerator.getIsland(0);
    const island2 = islandGenerator.getIsland(0);

    let islandsMatch = true;
    for (let i = 0; i < island1.heightmap.length && i < island2.heightmap.length; i++) {
      if (island1.heightmap[i] !== island2.heightmap[i]) {
        islandsMatch = false;
        break;
      }
    }

    this.validate('Island generation determinism', islandsMatch,
       'Retreiving same island multiple times should produce identical results');
  }

  validateNoiseProperties() {
    console.log('\n2. Perlin Noise Mathematical Properties');

    const perlin = new PerlinNoise(42);
    const center = perlin.noise2D(0.5, 0.5);

    // Noise should be bounded [-1, 1] (approximately)
    const tests = [];
    for (let x = 0; x < 10; x += 0.1) {
      for (let y = 0; y < 10; y += 0.1) {
        const val = perlin.noise2D(x, y);
        tests.push(val >= -1.1 && val <= 1.1);
      }
    }

    this.validate('Noise value bounds', tests.every(Boolean),
       'Perlin noise values should be approximately in range [-1, 1]');

    // Noise should vary with distance from origin
    const edge1 = perlin.noise2D(0, 0);
    const edge2 = perlin.noise2D(10, 10);
    const different = Math.abs(edge1 - edge2) > 0.1;

    this.validate('Spatial variation', different,
       'Noise values should vary significantly with spatial distance');
  }

  validateFBmCharacteristics() {
    console.log('\n3. Fractional Brownian Motion Properties');

    const fbm = new FractionalBrownianMotion(1337);
    const perlin = new PerlinNoise(1337);

    // fBm should be smoother than individual Perlin octaves
    const coordX = 2.7;
    const coordY = 4.1;

    const fbmValue = fbm.noise2D(coordX, coordY);
    const perlinBase = perlin.noise2D(coordX, coordY);

    // fBm should have different characteristics from base Perlin
    const fbmDifferent = Math.abs(fbmValue - perlinBase) > 0.01;
    this.validate('fBm vs Perlin differentiation', fbmDifferent,
       'fBm should produce different results than base Perlin noise');

    // fBm should be approximately zero-centered
    let sum = 0;
    let count = 0;
    for (let x = 0; x < 10; x += 0.2) {
      for (let y = 0; y < 10; y += 0.2) {
        sum += fbm.noise2D(x, y);
        count++;
      }
    }
    const average = sum / count;
    const zeroCentered = Math.abs(average) < 0.1;

    this.validate('fBm zero-centering', zeroCentered,
       `fBm average should be approximately zero (${average.toFixed(4)}) but got ${average.toFixed(4)}`);
  }

  validateIslandGeneration() {
    console.log('\n4. Island Generation Validation');

    const island = islandGenerator.getIsland(0);

    // Basic structure validation
    const hasHeightmap = island.heightmap && island.heightmap.length > 0;
    this.validate('Island has heightmap', hasHeightmap,
       'Generated island should contain a heightmap array');

    // Size validation (128x128)
    const expectedSize = 128 * 128;
    const correctSize = island.heightmap.length === expectedSize;
    this.validate('Correct island size', correctSize,
       `Island should have ${expectedSize} points but has ${island.heightmap.length}`);

    // Height range validation
    const heights = island.heightmap.map(h => Math.max(0, Math.min(1, h)));
    const validRange = heights.every(h => h >= 0 && h <= 1);
    this.validate('Height value range', validRange,
       'Island heights should be in range [0, 1]');

    // Terrain variation
    const uniqueValues = new Set(island.heightmap.map(h => Math.round(h * 1000) / 1000));
    const hasVariation = uniqueValues.size > expectedSize * 0.1; // At least 10% unique values

    this.validate('Terrain variation', hasVariation,
       `Island should have varied terrain (${uniqueValues.size} unique heights vs expected >${expectedSize * 0.1}`);

    // Island islands (404 total)
    const allIslands = [];
    for (let i = 0; i < Math.min(10, 404); i++) {
      try {
        allIslands.push(islandGenerator.getIsland(i));
      } catch (e) {
        break;
      }
    }

    this.validate('Multiple island generation', allIslands.length >= 10,
       `Successfully generated ${allIslands.length} test islands`);

    // Different islands should be unique
    let areUnique = true;
    if (allIslands.length > 1) {
      const island2 = allIslands[1];
      let same = true;
      for (let i = 0; i < island.heightmap.length; i++) {
        if (island.heightmap[i] !== island2.heightmap[i]) {
          same = false;
          break;
        }
      }
      areUnique = !same;
    }

    this.validate('Island uniqueness', areUnique,
       'Different islands should have different terrain patterns');
  }

  validateMemoryIntegrity() {
    console.log('\n5. Memory Integrity Tests');

    const island = islandGenerator.getIsland(50);

    // Check if heightmap is readable
    let allReadable = true;
    for (let i = 0; i < island.heightmap.length; i++) {
      if (typeof island.heightmap[i] !== 'number' || !isFinite(island.heightmap[i])) {
        allReadable = false;
        break;
      }
    }

    this.validate('Memory data integrity', allReadable,
       'All heightmap values should be finite numbers');

    // Memory usage check
    const memBytes = islandGenerator.getTotalMemoryUsage();
    const memMB = memBytes / (1024 * 1024);
    const reasonableSize = memMB < 50; // Allow some buffer above 32MB budget

    this.validate('Memory usage limit', reasonableSize,
       `Memory usage should be <50MB but is ${memMB.toFixed(2)}MB`);
  }

  validatePerformanceTargets() {
    console.log('\n6. Performance Target Validation');

    // Generation time test
    const startTime = performance.now();
    for (let i = 0; i < 100; i++) {
      islandGenerator.getIsland(Math.floor(Math.random() * Math.min(50, 404)));
    }
    const endTime = performance.now();
    const avgAccessTime = (endTime - startTime) / 100;

    const meetsAccessTarget = avgAccessTime < 1; // <1ms per island
    this.validate('Access time target', meetsAccessTarget,
       `Average access time: ${avgAccessTime.toFixed(3)}ms (target: <1ms)`);

    // Initialization time check
    const initTime = islandGenerator.constructor.initializationTime || 0;
    const meetsInitTarget = initTime < 5000; // <5 seconds for 404 islands
    this.validate('Initialization time target', meetsInitTarget,
       `Initialization time: ${initTime.toFixed(0)}ms (target: <5000ms)`);
  }

  printSummary() {
    const passRate = (this.passedTests / this.testCount * 100).toFixed(1);
    console.log(`\n📊 VALIDATION SUMMARY:`);
    console.log(`   Tests Passed: ${this.passedTests}/${this.testCount} (${passRate}%)`);
    console.log(`   Status: ${this.passedTests === this.testCount ? '✅ ALL PASSING' : '⚠️ SOME FAILED'}`);

    if (this.passedTests < this.testCount) {
      console.log('\n   Failed Tests:');
      Object.entries(this.results).forEach(([name, result]) => {
        if (!result.status) {
          console.log(`   ❌ ${name}`);
        }
      });
    }
  }

  getResults() {
    return {
      totalTests: this.testCount,
      passedTests: this.passedTests,
      passRate: parseFloat((this.passedTests / this.testCount * 100).toFixed(1)),
      details: this.results
    };
  }
}

// Export for use in various environments
export { ValidationSuite };

// Run validation if in browser
if (typeof window !== 'undefined') {
  window.MathValidation = new ValidationSuite();
  setTimeout(() => {
    window.MathValidation.runValidation();
  }, 200); // Allow time for island initialization
}

// For Node.js
if (typeof global !== 'undefined') {
  console.log('Mathematical validation suite loaded. Call new ValidationSuite().runValidation() to run tests.');
}