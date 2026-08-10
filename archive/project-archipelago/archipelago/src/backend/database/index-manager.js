//=============================================
// ARCHIPELAGO DATABASE INDEX MANAGER
//=============================================
// Indexes for performance optimization across all collections
// Optimized for Oracle Autonomous JSON Database queries

const { connectionManager } = require('./oracle-config');
const { sodaManager } = require('./soda-manager');

class IndexManager {
  constructor() {
    this.indexes = new Map();
    this.pendingIndexes = new Set();
  }

  // Create JSON search index for collection
  async createJsonSearchIndex(collectionName, indexName, properties) {
    try {
      const connection = await connectionManager.getConnection();
      const collection = await sodaManager.getCollection(collectionName);

      if (!collection) {
        throw new Error(`Collection '${collectionName}' does not exist`);
      }

      try {
        // Oracle's JSON_TEXTCONTAINS index for full-text search
        const sql = `
          CREATE SEARCH INDEX IF NOT EXISTS ${indexName}_search_idx
          ON ${collection.name} (JSON_DOCUMENT)
          FOR JSON
        `;
        await connection.execute(sql, {}, { autoCommit: true });

        // Create additional property indexes
        for (const property of properties) {
          const propertyIndexName = `${indexName}_${property}_idx`;
          const propertySql = `
            CREATE INDEX IF NOT EXISTS ${propertyIndexName}
            ON ${collection.name} (
              JSON_VALUE(JSON_DOCUMENT, '$.${property}' RETURNING NUMBER DEFAULT NULL ON ERROR)
            )
          `;
          await connection.execute(propertySql, {}, { autoCommit: true });
        }

        const indexInfo = {
          collection: collectionName,
          name: indexName,
          type: 'JSON_SEARCH',
          properties,
          created: new Date().toISOString()
        };

        this.indexes.set(indexName, indexInfo);
        console.log(`🔍 Created JSON search index '${indexName}' for '${collectionName}'`);

        return indexInfo;
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to create index '${indexName}':`, error.message);
      throw error;
    }
  }

  // Create functional indexes for common queries
  async createFunctionalIndexes(collectionName) {
    try {
      const connection = await connectionManager.getConnection();
      const collection = await sodaManager.getCollection(collectionName);

      if (!collection) {
        throw new Error(`Collection '${collectionName}' does not exist`);
      }

      const indexes = [];

      if (collectionName === 'users') {
        const sqls = [
          {
            sql: `
              CREATE INDEX IF NOT EXISTS users_email_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.email' RETURNING VARCHAR2(256) DEFAULT NULL ON ERROR))
            `,
            name: 'users_email_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS users_wallet_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.wallet_address' RETURNING VARCHAR2(512) DEFAULT NULL ON ERROR))
            `,
            name: 'users_wallet_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS users_created_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.created_at' RETURNING DATE DEFAULT NULL ON ERROR))
            `,
            name: 'users_created_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS users_tier_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.subscription_tier' RETURNING VARCHAR2(50) DEFAULT NULL ON ERROR))
            `,
            name: 'users_tier_idx'
          }
        ];

        for (const { sql, name } of sqls) {
          try {
            await connection.execute(sql, {}, { autoCommit: true });
            indexes.push({
              collection: collectionName,
              name,
              type: 'FUNCTIONAL',
              property: name.split('_')[1] || name,
              created: new Date().toISOString()
            });
            console.log(`📊 Created functional index '${name}'`);
          } catch (indexError) {
            console.warn(`⚠️ Index '${name}' may already exist or failed:`, indexError.message);
          }
        }
      }

      if (collectionName === 'islands') {
        const sqls = [
          {
            sql: `
              CREATE INDEX IF NOT EXISTS islands_id_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$._id' RETURNING NUMBER DEFAULT NULL ON ERROR))
            `,
            name: 'islands_id_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS islands_owner_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.current_owner' RETURNING VARCHAR2(512) DEFAULT NULL ON ERROR))
            `,
            name: 'islands_owner_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS islands_created_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.creation_date' RETURNING DATE DEFAULT NULL ON ERROR))
            `,
            name: 'islands_created_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS islands_age_idx
              IN ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.current_age' RETURNING NUMBER DEFAULT NULL ON ERROR))
            `,
            name: 'islands_age_idx'
          }
        ];

        for (const { sql, name } of sqls) {
          try {
            await connection.execute(sql, {}, { autoCommit: true });
            indexes.push({
              collection: collectionName,
              name,
              type: 'FUNCTIONAL',
              property: name.split('_')[1] || name,
              created: new Date().toISOString()
            });
            console.log(`📊 Created functional index '${name}'`);
          } catch (indexError) {
            console.warn(`⚠️ Index '${name}' may already exist or failed:`, indexError.message);
          }
        }
      }

      if (collectionName === 'purchases') {
        const sqls = [
          {
            sql: `
              CREATE INDEX IF NOT EXISTS purchases_user_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.user_id' RETURNING VARCHAR2(512) DEFAULT NULL ON ERROR))
            `,
            name: 'purchases_user_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS purchases_island_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.island_id' RETURNING NUMBER DEFAULT NULL ON ERROR))
            `,
            name: 'purchases_island_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS purchases_status_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.status' RETURNING VARCHAR2(50) DEFAULT NULL ON ERROR))
            `,
            name: 'purchases_status_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS purchases_created_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.created_at' RETURNING DATE DEFAULT NULL ON ERROR))
            `,
            name: 'purchases_created_idx'
          },
          {
            sql: `
              CREATE INDEX IF NOT EXISTS purchases_amount_idx
              ON ${collection.name} (JSON_VALUE(JSON_DOCUMENT, '$.price_paid' RETURNING NUMBER DEFAULT NULL ON ERROR))
            `,
            name: 'purchases_amount_idx'
          }
        ];

        for (const { sql, name } of sqls) {
          try {
            await connection.execute(sql, {}, { autoCommit: true });
            indexes.push({
              collection: collectionName,
              name,
              type: 'FUNCTIONAL',
              property: name.split('_')[1] || name,
              created: new Date().toISOString()
            });
            console.log(`📊 Created functional index '${name}'`);
          } catch (indexError) {
            console.warn(`⚠️ Index '${name}' may already exist or failed:`, indexError.message);
          }
        }
      }

      await connection.close();
      return indexes;
    } catch (error) {
      console.error(`❌ Failed to create functional indexes for '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Create composite indexes for complex queries
  async createCompositeIndexes(collectionName) {
    try {
      const connection = await connectionManager.getConnection();
      const collection = await sodaManager.getCollection(collectionName);

      if (!collection) {
        throw new Error(`Collection '${collectionName}' does not exist`);
      }

      const indexes = [];

      if (collectionName === 'purchases') {
        // User + Status for dashboard queries
        const userStatusComposite = `
          CREATE INDEX IF NOT EXISTS purchases_user_status_idx (
            JSON_VALUE(JSON_DOCUMENT, '$.user_id' RETURNING VARCHAR2(512) DEFAULT NULL ON ERROR),
            JSON_VALUE(JSON_DOCUMENT, '$.status' RETURNING VARCHAR2(50) DEFAULT NULL ON ERROR)
          )
        `;
        try {
          await connection.execute(userStatusComposite, {}, { autoCommit: true });
          indexes.push({
            collection: collectionName,
            name: 'purchases_user_status_idx',
            type: 'COMPOSITE',
            properties: ['user_id', 'status'],
            created: new Date().toISOString()
          });
          console.log(`📊 Created composite index 'purchases_user_status_idx'`);
        } catch (error) {
          console.warn(`⚠️ Composite index may already exist:`, error.message);
        }

        // Island + Created for purchase history
        const islandCreatedComposite = `
          CREATE INDEX IF NOT EXISTS purchases_island_created_idx (
            JSON_VALUE(JSON_DOCUMENT, '$.island_id' RETURNING NUMBER DEFAULT NULL ON ERROR),
            JSON_VALUE(JSON_DOCUMENT, '$.created_at' RETURNING DATE DEFAULT NULL ON ERROR)
          )
        `;
        try {
          await connection.execute(islandCreatedComposite, {}, { autoCommit: true });
          indexes.push({
            collection: collectionName,
            name: 'purchases_island_created_idx',
            type: 'COMPOSITE',
            properties: ['island_id', 'created_at'],
            created: new Date().toISOString()
          });
          console.log(`📊 Created composite index 'purchases_island_created_idx'`);
        } catch (error) {
          console.warn(`⚠️ Composite index may already exist:`, error.message);
        }
      }

      if (collectionName === 'islands') {
        // Owner + Age for user dashboard queries
        const ownerAgeComposite = `
          CREATE INDEX IF NOT EXISTS islands_owner_age_idx (
            JSON_VALUE(JSON_DOCUMENT, '$.current_owner' RETURNING VARCHAR2(512) DEFAULT NULL ON ERROR),
            JSON_VALUE(JSON_DOCUMENT, '$.current_age' RETURNING NUMBER DEFAULT NULL ON ERROR)
          )
        `;
        try {
          await connection.execute(ownerAgeComposite, {}, { autoCommit: true });
          indexes.push({
            collection: collectionName,
            name: 'islands_owner_age_idx',
            type: 'COMPOSITE',
            properties: ['current_owner', 'current_age'],
            created: new Date().toISOString()
          });
          console.log(`📊 Created composite index 'islands_owner_age_idx'`);
        } catch (error) {
          console.warn(`⚠️ Composite index may already exist:`, error.message);
        }
      }

      await connection.close();
      return indexes;
    } catch (error) {
      console.error(`❌ Failed to create composite indexes for '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Create geospatial index for location-based queries
  async createGeospatialIndexes(collectionName) {
    try {
      // For purchases with shipping addresses or other geo data
      const connection = await connectionManager.getConnection();
      const collection = await sodaManager.getCollection(collectionName);

      if (!collection) {
        return [];
      }

      const geoIndexes = [];

      if (collectionName === 'purchases') {
        const shippingAddressGeo = `
          CREATE INDEX IF NOT EXISTS purchases_shipping_geo_idx (
            JSON_VALUE(JSON_DOCUMENT, '$.shipping_data.carrier' RETURNING VARCHAR2(50) DEFAULT NULL ON ERROR),
            JSON_VALUE(JSON_DOCUMENT, '$.shipping_data.tracking_number' RETURNING VARCHAR2(100) DEFAULT NULL ON ERROR)
          )
        `;
        try {
          await connection.execute(shippingAddressGeo, {}, { autoCommit: true });
          geoIndexes.push({
            collection: collectionName,
            name: 'purchases_shipping_geo_idx',
            type: 'GEO_FUNCTIONAL',
            properties: ['shipping_data.carrier', 'shipping_data.tracking_number'],
            created: new Date().toISOString()
          });
          console.log(`📊 Created geospatial functional index 'purchases_shipping_geo_idx'`);
        } catch (error) {
          console.warn(`⚠️ Geospatial index may already exist:`, error.message);
        }
      }

      await connection.close();
      return geoIndexes;
    } catch (error) {
      console.error(`❌ Failed to create geospatial indexes for '${collectionName}':`, error.message);
      return [];
    }
  }

  // Async index creation for background processing
  async createAllIndexes(collections = ['users', 'islands', 'purchases', 'system_metrics']) {
    console.log('🛠️ Creating database indexes asynchronously...');

    const results = {};
    const promises = [];

    for (const collectionName of collections) {
      this.pendingIndexes.add(collectionName);

      // Create indexes for each collection
      const promise = Promise.all([
        this.createFunctionalIndexes(collectionName),
        this.createCompositeIndexes(collectionName),
        this.createGeospatialIndexes(collectionName),
        this.createJsonSearchIndex(collectionName, `${collectionName}_fulltext`, this.getSearchProperties(collectionName))
      ]).then(results => {
        this.pendingIndexes.delete(collectionName);
        return results.flat();
      }).catch(error => {
        console.error(`❌ Failed to create indexes for '${collectionName}':`, error.message);
        this.pendingIndexes.delete(collectionName);
        return [];
      });

      promises.push(promise);
    }

    const indexResults = await Promise.all(promises);
    for (let i = 0; i < collections.length; i++) {
      results[collections[i]] = indexResults[i];
    }

    const totalIndexes = indexResults.flat().length;
    console.log(`✅ Created ${totalIndexes} database indexes across ${collections.length} collections`);

    return results;
  }

  // Get collection statistics including index usage
  async getIndexStats(collectionName) {
    try {
      const connection = await connectionManager.getConnection();
      try {
        // Query system views for index statistics
        const sql = `
          SELECT INDEX_NAME, TABLE_NAME, BLEVEL, LEAF_BLOCKS, DISTINCT_KEYS,
                 AVG_LEAF_BLOCKS_PER_KEY, AVG_DATA_BLOCKS_PER_KEY, CLUSTERING_FACTOR,
                 NUM_ROWS, SAMPLE_SIZE
          FROM ALL_INDEXES ai
          LEFT JOIN ALL_INDEXES_USAGE au ON ai.INDEX_NAME = au.INDEX_NAME
          WHERE ai.TABLE_NAME LIKE '%' || UPPER(:collectionName) || '%'
          AND ai.TABLE_NAME LIKE '%JSON_COLLECTION'
        `;

        const result = await connection.execute(sql, {
          collectionName
        }, {
          outFormat: require('oracledb').OUT_FORMAT_OBJECT
        });

        return result.rows || [];
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to get index stats for '${collectionName}':`, error.message);
      return [];
    }
  }

  // Analyze index effectiveness
  async analyzeIndexUsage() {
    try {
      const connection = await connectionManager.getConnection();
      try {
        const sql = `
          SELECT * FROM (
            SELECT INDEX_NAME, TABLE_NAME, NAME, VALUE
            FROM V$SYSSTAT
            WHERE NAME LIKE '%index%'
            ORDER BY VALUE DESC
          ) WHERE ROWNUM <= 20
        `;

        const result = await connection.execute(sql, {}, {
          outFormat: require('oracledb').OUT_FORMAT_OBJECT
        });

        return result.rows || [];
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to analyze index usage:`, error.message);
      return [];
    }
  }

  // Get search properties for full-text indexes
  getSearchProperties(collectionName) {
    switch (collectionName) {
      case 'users':
        return ['email', 'subscription_tier'];
      case 'islands':
        return ['event_history.description', 'event_history.event_type'];
      case 'purchases':
        return ['status', 'island_id', 'user_id'];
      case 'system_metrics':
        return ['timestamp', 'active_users'];
      default:
        return [];
    }
  }

  // Drop specific index
  async dropIndex(collectionName, indexName) {
    try {
      const connection = await connectionManager.getConnection();
      try {
        const sql = `DROP INDEX IF EXISTS ${indexName}`;
        await connection.execute(sql, {}, { autoCommit: true });

        this.indexes.delete(indexName);
        console.log(`🗑️ Dropped index '${indexName}' from '${collectionName}'`);
        return true;
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to drop index '${indexName}':`, error.message);
      throw error;
    }
  }

  // Get all indexes for a collection
  getCollectionIndexes(collectionName) {
    const collectionIndexes = [];
    for (const [indexName, indexInfo] of this.indexes) {
      if (indexInfo.collection === collectionName) {
        collectionIndexes.push(indexInfo);
      }
    }
    return collectionIndexes;
  }

  // Rebuild indexes for optimization
  async rebuildIndexes(collectionName) {
    try {
      const connection = await connectionManager.getConnection();
      try {
        const indexes = this.getCollectionIndexes(collectionName);

        for (const index of indexes) {
          if (index.type === 'FUNCTIONAL') {
            const sql = `ALTER INDEX ${index.name} REBUILD ONLINE`;
            await connection.execute(sql, {}, { autoCommit: true });
            console.log(`🔧 Rebuilt index '${index.name}'`);
          }
        }

        return { success: true, rebuitIndexes: indexes.length };
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to rebuild indexes for '${collectionName}':`, error.message);
      throw error;
    }
  }
}

//=============================================
// GLOBAL INDEX MANAGER INSTANCE
//=============================================
const indexManager = new IndexManager();

//=============================================
// MODULE EXPORTS
//=============================================
module.exports = {
  IndexManager,
  indexManager
};