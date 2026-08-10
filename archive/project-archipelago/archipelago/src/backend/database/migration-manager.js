//=============================================
// ARCHIPELAGO DATABASE MIGRATION MANAGER
//=============================================
// Handles schema migrations, data seeding, and version management
// Ensures consistent database state across environments

const { connectionManager } = require('./postgres-config');
const { DataTypes } = require('sequelize');
const crypto = require('crypto');

class MigrationManager {
  constructor() {
    this.sequelize = connectionManager.getSequelize();
  }

  // Initialize migration system
  async initialize() {
    try {
      console.log('🚀 Initializing migration system...');
      await this.createInitialSchema();
      console.log('✅ Migration system initialized');
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to initialize migration system:', error.message);
      throw error;
    }
  }

  // Create initial database schema
  async createInitialSchema() {
    console.log('🏗️ Creating initial database schema...');
    await this.createUsersSchema();
    await this.createIslandsSchema();
    await this.createPurchasesSchema();
    await this.createEventsSchema();
    await this.createSystemMetricsSchema();
    await this.seedInitialData();
    console.log('✅ Initial schema creation completed');
  }

  // Users table schema
  async createUsersSchema() {
    console.log('👤 Creating users table schema...');
    const User = this.sequelize.define('User', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      encrypted_password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      wallet_address: {
        type: DataTypes.STRING,
        unique: true,
      },
      subscription_tier: {
        type: DataTypes.STRING,
        defaultValue: 'discovery',
      },
      islands_owned: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        defaultValue: [],
      },
      total_spent: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0,
      },
      preferences: {
        type: DataTypes.JSONB,
        defaultValue: {
          email_notifications: true,
          event_alerts: true,
          social_sharing": true,
        },
      },
      payment_methods: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
    });
    await User.sync({ force: true });
    console.log('✅ Users schema created');
  }

  // Islands table schema
  async createIslandsSchema() {
    console.log('🏝️ Creating islands table schema...');
    const Island = this.sequelize.define('Island', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
      },
      generation_seed: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      current_age: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      current_owner: {
        type: DataTypes.STRING,
      },
      ownership_history: {
        type: DataTypes.JSONB,
        defaultValue: [],
      },
      performance_metrics: {
        type: DataTypes.JSONB,
        defaultValue: {
          total_views: 0,
          generation_time: 0,
          user_favorites: 0,
          social_shares: 0,
        },
      },
      state_persistence: {
        type: DataTypes.JSONB,
        defaultValue: {
          last_temperature: 25,
          current_season": "spring",
          event_counter: 0,
          interaction_count: 0,
        },
      },
    });
    await Island.sync({ force: true });
    console.log('✅ Islands schema created');
  }

  // Purchases table schema
  async createPurchasesSchema() {
    console.log('🛒 Creating purchases table schema...');
    const Purchase = this.sequelize.define('Purchase', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      island_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tier: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      price_paid: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      discount_applied: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      payment_method: {
        type: DataTypes.STRING,
        defaultValue: 'stripe',
      },
      transaction_id: {
        type: DataTypes.STRING,
      },
      transaction_hash: {
        type: DataTypes.STRING,
      },
      status: {
        type: DataTypes.STRING,
        defaultValue: 'pending',
      },
      platform_fees: {
        type: DataTypes.JSONB,
      },
      fulfillment_request: {
        type: DataTypes.JSONB,
      },
      shipping_data: {
        type: DataTypes.JSONB,
      },
      invoice_data: {
        type: DataTypes.JSONB,
      },
    });
    await Purchase.sync({ force: true });
    console.log('✅ Purchases schema created');
  }

  // Events table schema
  async createEventsSchema() {
    console.log('📅 Creating events table schema...');
    const Event = this.sequelize.define('Event', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      island_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      event_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
      },
      visual_impact: {
        type: DataTypes.STRING,
      },
    });
    await Event.sync({ force: true });
    console.log('✅ Events schema created');
  }

  // System metrics table schema
  async createSystemMetricsSchema() {
    console.log('📊 Creating system metrics table schema...');
    const SystemMetric = this.sequelize.define('SystemMetric', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      active_users: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      islands_generated: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      total_transactions: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      performance_data: {
        type: DataTypes.JSONB,
      },
      geographic_data: {
        type: DataTypes.JSONB,
      },
    });
    await SystemMetric.sync({ force: true });
    console.log('✅ System metrics schema created');
  }

  // Seed initial data
  async seedInitialData() {
    console.log('🌱 Seeding initial data...');
    // Seed admin user
    const User = this.sequelize.model('User');
    await User.create({
      id: 'admin-user',
      email: 'admin@404islands.com',
      encrypted_password: 'admin-password', // Replace with a real hash
    });
    console.log('👔 Admin user created');

    // Seed islands
    const Island = this.sequelize.model('Island');
    const islandPromises = [];
    for (let i = 1; i <= 404; i++) {
      islandPromises.push(
        Island.create({
          id: i,
          name: `Island #${i}`,
          generation_seed: i * 404 * i,
        })
      );
    }
    await Promise.all(islandPromises);
    console.log('✅ 404 island records seeded');
  }
}

module.exports = {
  MigrationManager,
};