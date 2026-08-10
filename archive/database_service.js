const { connectionManager } = require('./oracle-config');

class DatabaseService {
  constructor() {
    this.connectionManager = connectionManager;
    this.sodaDB = null;
    this.collection = null;
    this.cache = new Map(); // In-memory cache for faster access
    this.cache.setMaxSize = function(maxSize) {
      this.maxSize = maxSize;
    }.bind(this.cache);
    this.cache.setMaxSize(100); // Cache up to 100 islands
    this.islandGenerator = null;
    this.isInOfflineMode = false;
  }

  // Initialize database connection and collections
  async initialize() {
    try {
      console.log('🔌 Connecting to Oracle Database...');
      await this.connectionManager.initialize();
      const connection = await this.connectionManager.getConnection();
      this.sodaDB = connection.getSodaDatabase();
      console.log('✅ SODA database initialized');

      // Open or create islands collection
      try {
        this.collection = await this.sodaDB.openCollection('islands');
        console.log('✅ Opened existing islands collection');
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.sodaDB.createCollection('islands');
        console.log('🆕 Created new islands collection');
      }

      // Initialize island generator
      this.initializeIslandGenerator();

    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      console.log('🔄 Falling back to offline mode...');
      return this.initializeOfflineMode();
    }
  }

  // Offline mode initialization (no database)
  initializeOfflineMode() {
    console.log('🚀 Initializing offline mode for zero-lag generation');
    this.isInOfflineMode = true;
    this.initializeIslandGenerator();
    console.log('✅ Offline mode ready - islands will be generated on demand');
  }

  // Initialize the Perlin noise island generator
  initializeIslandGenerator() {
    console.log('🏝️ Initializing Perlin noise generators...');

    // Import Perlin classes
    let PerlinNoise, FractionalBrownianMotion, IslandGenerator;
    try {
      const perlin = require('./perlin');
      PerlinNoise = perlin.PerlinNoise;
      FractionalBrownianMotion = perlin.FractionalBrownianMotion;
      IslandGenerator = perlin.IslandGenerator;

      this.islandGenerator = new IslandGenerator();
      console.log('✅ Perlin noise generators initialized');

    } catch (error) {
      console.error('❌ Failed to initialize Perlin noise generators:', error);
      console.log('⚠️ Running without terrain generation capabilities');
    }
  }

  // Get server health status
  async getHealth() {
    const health = {
      status: this.isInOfflineMode ? 'offline-mode' : 'healthy',
      timestamp: new Date().toISOString(),
      server: 'Oracle Always Free Tier',
      platform: 'AMD Ampere A1',
      node_version: process.version
    };

    if (!this.isInOfflineMode) {
      try {
        // Test database connection
        await this.connection.ping();
        health.database = {
          connected: true,
          soda_enabled: this.sodaDB !== null,
          collections: {
            islands: this.collection !== null
          }
        };
      } catch (error) {
        health.database = {
          connected: false,
          error: error.message
        };
      }
    } else {
      health.database = {
        status: 'offline mode',
        collections: {
          islands: false
        }
      };
    }

    health.generator = {
      perlin_noise: this.islandGenerator !== null,
      cache_size: this.cache.size,
      max_cache_size: this.cache.maxSize
    };

    return health;
  }

  // Generate island terrain with caching
  async generateIsland(islandId) {
    // Check cache first
    if (this.cache.has(islandId)) {
      console.log(`💾 Island ${islandId} served from cache`);
      return this.cache.get(islandId);
    }

    // Validate island ID
    if (islandId < 1 || islandId > 404) {
      throw new Error(`Island ${islandId} not found in Archipelago`);
    }

    // Generate new island
    console.log(`🎨 Generating terrain for island ${islandId}`);
    const startTime = performance.now();

    let terrainData;
    if (this.islandGenerator) {
      terrainData = this.islandGenerator.generateTerrain(islandId, 800, 600);
    } else {
      // Fallback dummy data if generator fails
      terrainData = {
        islandId,
        width: 800,
        height: 600,
        terrain: Array(800 * 600).fill(0),
        generationTime: 0,
        seed: islandId
      };
    }

    terrainData.generationTime = performance.now() - startTime;

    // Store in database if connected
    if (!this.isInOfflineMode && this.collection) {
      try {
        await this.saveIslandToDatabase(terrainData);
      } catch (error) {
        console.log(`⚠️ Failed to save island ${islandId} to database:`, error);
      }
    }

    // Store in cache
    this.cache.set(islandId, terrainData);

    // Implement simple cache eviction (LRU-like)
    if (this.cache.size > (this.cache.maxSize || 100)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    console.log(`🏔️ Island ${islandId} generated in ${terrainData.generationTime.toFixed(2)}ms`);

    return terrainData;
  }

  // Save island data to Oracle SODA collection
  async saveIslandToDatabase(terrainData) {
    if (this.isInOfflineMode || !this.collection) {
      return;
    }

    try {
      // Check if island already exists
      const existingDoc = await this.collection.find()
        .filter({ '_id': { '$eq': terrainData.islandId.toString() } })
        .getOneSodaDocument();

      if (existingDoc) {
        console.log(`📝 Updating existing island ${terrainData.islandId}`);
        // Update existing document
        const doc = existingDoc.doc;
        doc.terrain = terrainData.terrain;
        doc.last_generated = new Date().toISOString();
        doc.generation_time = terrainData.generationTime;
        await existingDoc.replaceOne(doc);
      } else {
        console.log(`💾 Saving new island ${terrainData.islandId}`);
        // Create new document
        const islandDoc = {
          _id: terrainData.islandId.toString(),
          islandId: terrainData.islandId,
          width: terrainData.width,
          height: terrainData.height,
          terrain: terrainData.terrain,
          seed: terrainData.seed,
          generation_time: terrainData.generationTime,
          created: new Date().toISOString(),
          last_generated: new Date().toISOString()
        };
        await this.collection.insertOne(islandDoc);
      }
    } catch (error) {
      console.error(`❌ Failed to save island ${terrainData.islandId}:`, error);
      throw error;
    }
  }

  // Load island data from database
  async loadIslandFromDatabase(islandId) {
    if (this.isInOfflineMode || !this.collection) {
      return null;
    }

    try {
      const document = await this.collection.find()
        .filter({ '_id': { '$eq': islandId.toString() } })
        .getOneSodaDocument();

      if (document) {
        const data = document.doc;
        console.log(`📖 Loaded island ${islandId} from database`);
        return {
          islandId: data.islandId,
          width: data.width,
          height: data.height,
          terrain: data.terrain,
          generationTime: data.generation_time || 0,
          seed: data.seed
        };
      }
    } catch (error) {
      console.error(`❌ Failed to load island ${islandId} from database:`, error);
    }

    return null;
  }

  // Cleanup database connections
  async cleanup() {
    console.log('🧹 Cleaning up database connections...');
    try {
      if (this.connection) {
        await this.connection.close();
        console.log('✅ Database connection closed');
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  // Get collection statistics
  async getCollectionStats() {
    if (this.isInOfflineMode || !this.collection) {
      return {
        collections: [],
        cache: {
          size: this.cache.size,
          maxSize: this.cache.maxSize
        }
      };
    }

    try {
      const count = await this.collection.find().count();
      return {
        collections: {
          islands: {
            name: 'islands',
            document_count: count
          }
        },
        cache: {
          size: this.cache.size,
          maxSize: this.cache.maxSize
        }
      };
    } catch (error) {
      console.error('❌ Failed to get collection stats:', error);
      return {
        collections: [],
        cache: {
          size: this.cache.size,
          maxSize: this.cache.maxSize
        },
        error: error.message
      };
    }
  }
}

module.exports = DatabaseService;