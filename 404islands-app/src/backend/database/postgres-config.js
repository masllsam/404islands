const path = require('path');
const { Sequelize } = require('sequelize');

// Resolve relative to this file rather than the working directory, so the
// config loads the same way whether it is run via npm scripts or from Docker.
// Missing file is fine: in Docker the values come from the container env.
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

class ConnectionManager {
  constructor() {
    this.sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: false, // Disable logging for cleaner output
      }
    );
  }

  async initialize() {
    try {
      await this.sequelize.authenticate();
      console.log('Connection to PostgreSQL has been established successfully.');
      return { success: true };
    } catch (error) {
      console.error('Unable to connect to the database:', error);
      return { success: false, error: error.message };
    }
  }

  async healthCheck() {
    try {
      await this.sequelize.query('SELECT 1+1 as result');
      console.log('Database health check passed.');
      return { success: true };
    } catch (error) {
      console.error('Database health check failed:', error);
      return { success: false, error: error.message };
    }
  }

  async close() {
    try {
      await this.sequelize.close();
      console.log('Database connection closed.');
      return { success: true };
    } catch (error) {
      console.error('Error closing database connection:', error);
      return { success: false, error: error.message };
    }
  }

  getConnection() {
    return this.sequelize;
  }
}

const connectionManager = new ConnectionManager();

module.exports = {
  connectionManager,
};