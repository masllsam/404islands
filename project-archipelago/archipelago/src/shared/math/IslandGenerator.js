// IslandGenerator.js - Manager for 404 islands with pre-initialization
// Optimized for <1ms generation time and <32MB memory usage

import { FractionalBrownianMotion } from './FractionalBrownianMotion.js';

const ISLAND_COUNT = 404;
const GRIDSIZE = 128; // Power of 2 for optimization
const MAX_RADIUS = GRIDSIZE / 3; // Natural island size

export class IslandGenerator {
  constructor() {
    this.islands = new Map(); // Pre-generated island data
    this.initializeIslands();
  }

  generateIsland(id, seed) {
    const fbm = new FractionalBrownianMotion(seed, 4, 1.0, 0.01);
    const heightmap = new Float32Array(GRIDSIZE * GRIDSIZE); // Memory efficient

    const centerX = GRIDSIZE / 2;
    const centerY = GRIDSIZE / 2;

    // Generate terrain heightmap with performance optimization
    for (let x = 0; x < GRIDSIZE; x++) {
      for (let y = 0; y < GRIDSIZE; y++) {
        const height = fbm.generateTerrainHeight(x, y, centerX, centerY, MAX_RADIUS);
        heightmap[x * GRIDSIZE + y] = height;
      }
    }

    // Apply radial falloff smoothing for natural edges
    const dx = centerX;
    const dy = centerY;
    // Simple erosion-like smoothing (optional performance optimization)
    // For now, return the heightmap directly

    return {
      id,
      seed,
      heightmap,
      gridSize: GRIDSIZE,
      maxRadius: MAX_RADIUS,
      metadata: {
        generated: Date.now(),
        memorySize: heightmap.byteLength // Track memory usage
      }
    };
  }

  initializeIslands() {
    console.time('Island generation');
    const startTime = performance.now();

    for (let i = 0; i < ISLAND_COUNT; i++) {
      const seed = i * 255; // Unique seed per island
      this.islands.set(i, this.generateIsland(i, seed));
    }

    const endTime = performance.now();
    console.timeEnd('Island generation');
    console.log(`Generated ${ISLAND_COUNT} islands in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`Average time per island: ${(endTime - startTime) / ISLAND_COUNT}ms`);
  }

  getIsland(id) {
    if (!this.islands.has(id)) {
      throw new Error(`Island ${id} not found`);
    }
    return this.islands.get(id);
  }

  getIslandHeight(x, y, islandId) {
    const island = this.getIsland(islandId);
    const index = Math.floor(x) * GRIDSIZE + Math.floor(y);
    if (index < 0 || index >= island.heightmap.length) {
      return 0; // Out of bounds
    }
    return island.heightmap[index];
  }

  // Batch generation for multiple islands (useful for large requests)
  getIslandsBatch(ids) {
    return ids.map(id => this.getIsland(id));
  }

  // Memory usage monitoring
  getTotalMemoryUsage() {
    let totalBytes = 0;
    for (const island of this.islands.values()) {
      totalBytes += island.metadata.memorySize;
    }
    return totalBytes; // In bytes
  }

  // Export island data for React component consumption
  exportIslandData(islandId) {
    const island = this.getIsland(islandId);
    return {
      id: island.id,
      heightmap: Array.from(island.heightmap), // Convert to regular array
      gridSize: island.gridSize,
      metadata: island.metadata
    };
  }

  // Validate performance (should be <1ms per island)
  benchmarkIslandGeneration() {
    const testIsland = this.generateIsland(-1, 999); // Test with different seed
    const startTime = performance.now();
    for (let i = 0; i < 10; i++) {
      this.generateIsland(-2, i * 100);
    }
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 10;
    console.log(`Benchmark: ${avgTime.toFixed(3)}ms per island`);
    return avgTime < 1; // Should be <1ms for compliance
  }
}

// Export singleton instance for global usage
export const islandGenerator = new IslandGenerator();