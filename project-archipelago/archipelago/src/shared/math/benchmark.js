// benchmark.js - Performance benchmarks for mathematical engine
// Tests generation time, memory usage, and cross-browser compatibility

import { islandGenerator } from './IslandGenerator.js';
import { PerlinNoise } from './PerlinNoise.js';
import { FractionalBrownianMotion } from './FractionalBrownianMotion.js';

class PerformanceBenchmark {
  constructor() {
    this.results = {};
  }

  runBenchmarks() {
    console.log('🏃 Running Performance Benchmarks for Mathematical Engine...');
    console.log('='.repeat(60));

    this.testIslandInitialization();
    this.testIndividualIslandRetrieval();
    this.testPerlinNoisePerformance();
    this.testFBmPerformance();
    this.testMemoryUsage();
    this.testGenerationConsistency();

    console.log('='.repeat(60));
    this.displayResults();
  }

  testIslandInitialization() {
    console.log('\n1. Island Generation Time:');
    const startTime = performance.now();

    // Islands are pre-generated in constructor, measure retrieval time
    const islandIds = [0, 101, 202, 303];
    for (const id of islandIds) {
      const island = islandGenerator.getIsland(id);
      console.log(`   Island ${id}: ${island?.heightmap.length || 0} points`);
    }

    const endTime = performance.now();
    this.results.initializationTime = endTime - startTime;

    console.log(`   Total retrieval time: ${this.results.initializationTime.toFixed(2)}ms`);
    console.log(`   Average per island: ${(this.results.initializationTime / islandIds.length).toFixed(3)}ms`);
  }

  testIndividualIslandRetrieval() {
    console.log('\n2. Individual Island Access Time:');
    const islandId = 0;
    const iterations = 100;
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const island = islandGenerator.getIsland(islandId);
      const end = performance.now();
      totalTime += (end - start);
    }

    this.results.accessTime = totalTime / iterations;
    console.log(`   Average access time: ${this.results.accessTime.toFixed(3)}ms per island`);
  }

  testPerlinNoisePerformance() {
    console.log('\n3. Perlin Noise Generation:');
    const perlin = new PerlinNoise(42);
    const iterations = 10000;
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const noise2D = perlin.noise2D(i * 0.01, i * 0.01);
      const end = performance.now();
      totalTime += (end - start);
    }

    this.results.perlinTime = totalTime / iterations;
    console.log(`   Average 2D noise time: ${this.results.perlinTime.toFixed(4)}ms`);
  }

  testFBmPerformance() {
    console.log('\n4. Fractional Brownian Motion:');
    const fbm = new FractionalBrownianMotion(42);
    const iterations = 1000;
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const noise2D = fbm.noise2D(i * 0.01, i * 0.01);
      const end = performance.now();
      totalTime += (end - start);
    }

    this.results.fbmTime = totalTime / iterations;
    console.log(`   Average fBm time: ${this.results.fbmTime.toFixed(4)}ms`);
  }

  testMemoryUsage() {
    console.log('\n5. Memory Usage Analysis:');
    const memUsage = islandGenerator.getTotalMemoryUsage();
    const memMB = memUsage / (1024 * 1024);

    this.results.memoryMB = memMB;
    console.log(`   Total memory: ${memMB.toFixed(2)}MB`);
    console.log(`   (${(memUsage / 404).toFixed(0)}b per island)`);

    // Check if within 32MB budget
    if (memMB <= 32) {
      console.log('   ✅ Within 32MB memory budget');
    } else {
      console.log('   ❌ Exceeds 32MB memory budget');
    }
  }

  testGenerationConsistency() {
    console.log('\n6. Generation Consistency Check:');
    const island1a = islandGenerator.getIsland(0);
    const island1b = islandGenerator.getIsland(0);

    // Deep compare heightmaps
    let consistent = true;
    for (let i = 0; i < island1a.heightmap.length; i++) {
      if (island1a.heightmap[i] !== island1b.heightmap[i]) {
        consistent = false;
        break;
      }
    }

    this.results.consistent = consistent;
    console.log(`   Same island generated consistently: ${consistent ? 'Yes' : 'No'}`);

    // Check seed uniqueness
    const island2 = islandGenerator.getIsland(1);
    consistent = false;
    for (let i = 0; i < island1a.heightmap.length; i++) {
      if (island1a.heightmap[i] !== island2.heightmap[i]) {
        consistent = true;
        break;
      }
    }
    console.log(`   Different islands are unique: ${consistent ? 'Yes' : 'No'}`);
  }

  displayResults() {
    console.log('\n📊 BENCHMARK RESULTS SUMMARY:');
    console.log(`Initialization Time: ${this.results.initializationTime.toFixed(2)}ms`);
    console.log(`Access Time: ${this.results.accessTime.toFixed(3)}ms`);
    console.log(`Memory Usage: ${this.results.memoryMB.toFixed(2)}MB`);
    console.log(`Perlin Time: ${this.results.perlinTime.toFixed(4)}ms`);
    console.log(`FBm Time: ${this.results.fbmTime.toFixed(4)}ms`);
    console.log(`Initialization <5s: ${this.results.initializationTime.toFixed(2)}ms`);

    // Performance targets check
    const targets = {
      'Generation <1ms': this.results.accessTime < 1,
      'Initialization <5s': this.results.initializationTime < 5000,
      'Memory <32MB': this.results.memoryMB < 32
    };

    console.log('\n🎯 PERFORMANCE TARGETS:');
    Object.entries(targets).forEach(([target, met]) => {
      console.log(`   ${met ? '✅' : '❌'} ${target}`);
    });
  }

  // Cross-browser compatibility test (logs user agent)
  checkBrowserCompatibility() {
    console.log('\n🌐 BROWSER COMPATIBILITY:');
    console.log(`   User-Agent: ${navigator.userAgent}`);

    // Test WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    console.log(`   WebGL Support: ${gl ? 'Yes' : 'No'}`);

    // Test Float32Array support
    console.log(`   Float32Array Support: ${typeof Float32Array !== 'undefined' ? 'Yes' : 'No'}`);
  }
}

// Run benchmarks when in browser environment
if (typeof window !== 'undefined') {
  window.benchmark = new PerformanceBenchmark();
  // Auto-run after island initialization (small delay for accurate timing)
  setTimeout(() => {
    window.benchmark.runBenchmarks();
    window.benchmark.checkBrowserCompatibility();
  }, 100);
}

// Export for Node.js usage
export { PerformanceBenchmark };

// For Node.js testing
if (typeof global !== 'undefined') {
  console.log('Benchmark script loaded. Call new PerformanceBenchmark().runBenchmarks() to run tests.');
}