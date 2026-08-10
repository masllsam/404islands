//=============================================
// ARCHIPELAGO POSTGRESQL DATABASE CONFIGURATION
//=============================================
// Production-ready configuration for PostgreSQL
// Optimized for high availability and performance

const { Sequelize } = require('sequelize');

// Environment variables with fallbacks
const POSTGRES_CONFIG = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB || 'archipelago',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5432,

  // Connection pool settings for scalability
  pool: {
    max: parseInt(process.env.POSTGRES_POOL_MAX) || 20,
    min: parseInt(process.env.POSTGRES_POOL_MIN) || 2,
    acquire: parseInt(process.env.POSTGRES_POOL_ACQUIRE) || 30000,
    idle: parseInt(process.env.POSTGRES_POOL_IDLE) || 10000,
  },

  // SSL/TLS configuration for secure connections
  ssl: process.env.POSTGRES_SSL === 'true' ? {
    rejectUnauthorized: false,
  } : false,
};

//=============================================
// DATABASE CONNECTION MANAGER
//=============================================
class PostgresConnectionManager {
  constructor() {
    this.sequelize = null;
    this.isInitialized = false;
  }

  async initialize(initConfig = {}) {
    try {
      // Override default config if provided
      const config = { ...POSTGRES_CONFIG, ...initConfig };

      // Validate required configuration
      if (!config.password) {
        throw new Error('PostgreSQL password is required. Set POSTGRES_PASSWORD environment variable.');
      }

      // Create Sequelize instance
      this.sequelize = new Sequelize(config.database, config.user, config.password, {
        host: config.host,
        port: config.port,
        dialect: 'postgres',
        pool: config.pool,
        ssl: config.ssl,
      });

      // Test the connection
      await this.sequelize.authenticate();

      this.isInitialized = true;
      console.log(`
🏝️  POSTGRESQL DATABASE INITIALIZED
══════════════════════════════════════════════════════
📊 Pool Size: ${config.pool.min} - ${config.pool.max} connections
📍 Host: ${config.host}:${config.port}
══════════════════════════════════════════════════════
      `);

      return { success: true };

    } catch (error) {
      console.error('❌ PostgreSQL database initialization failed:', error.message);
      throw new Error(`Failed to initialize PostgreSQL database: ${error.message}`);
    }
  }

  // Get Sequelize instance
  getSequelize() {
    if (!this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.sequelize;
  }

  // Health check
  async healthCheck() {
    try {
      await this.sequelize.authenticate();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  // Graceful shutdown
  async close() {
    if (this.sequelize) {
      try {
        await this.sequelize.close();
        console.log('🛑 PostgreSQL connection closed successfully');
      } catch (error) {
        console.error('❌ Error closing PostgreSQL connection:', error.message);
        throw error;
      }
    }
  }
}

//=============================================
// GLOBAL CONNECTION INSTANCE
//=============================================
const connectionManager = new PostgresConnectionManager();

//=============================================
// MODULE EXPORTS
//=============================================
module.exports = {
  POSTGRES_CONFIG,
  PostgresConnectionManager,
  connectionManager,
};

//=============================================
// ENVIRONMENT VALIDATION
//=============================================
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing PostgreSQL connection...');
  await connectionManager.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing PostgreSQL connection...');
  await connectionManager.close();
  process.exit(0);
});