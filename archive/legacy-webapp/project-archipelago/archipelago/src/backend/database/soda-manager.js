//=============================================
// ARCHIPELAGO SODA COLLECTIONS MANAGER
//=============================================
// SODA (Simple Oracle Document Access) for JSON collections
// Optimized for autonomous JSON database operations

const { connectionManager } = require('./oracle-config');

class SODACollectionsManager {
  constructor() {
    this.collections = new Map();
    this.initializedCollections = new Set();
  }

  // Initialize collection with metadata
  async createCollection(collectionName, options = {}) {
    try {
      const connection = await connectionManager.getConnection();

      try {
        // Drop existing collection if recreating
        if (options.recreateIfExists) {
          await this.dropCollection(collectionName);
        }

        // Create SODA collection
        const collection = await connection.createSodaCollection(collectionName, {
          version: '1.0',
          // Enable full text search for performance
          sqlType: 'JSON_DOCUMENT',
          versionColumn: {
            name: '_version',
            method: 'SEQUENTIAL'
          },
          timestampColumn: {
            name: '_lastModified',
            method: 'USER'
          },
          // Key generation
          keyColumn: {
            name: '_id',
            assignmentMethod: 'GUID'
          },
          // Schema validation (optional)
          schemaURI: options.schemaURI || null,
          readOnly: false,
          ...options
        });

        this.collections.set(collectionName, collection);
        this.initializedCollections.add(collectionName);

        console.log(`📋 SODA Collection '${collectionName}' created successfully`);
        return collection;

      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to create collection '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Get collection reference
  async getCollection(collectionName) {
    if (!this.collections.has(collectionName)) {
      const connection = await connectionManager.getConnection();
      try {
        const collection = await connection.getSodaCollection(collectionName);
        if (!collection) {
          throw new Error(`Collection '${collectionName}' does not exist`);
        }
        this.collections.set(collectionName, collection);
      } finally {
        await connection.close();
      }
    }

    return this.collections.get(collectionName);
  }

  // Drop collection
  async dropCollection(collectionName) {
    try {
      const connection = await connectionManager.getConnection();
      try {
        const collection = await connection.getSodaCollection(collectionName);
        if (collection) {
          await collection.drop();
          this.collections.delete(collectionName);
          this.initializedCollections.delete(collectionName);
          console.log(`🗑️ SODA Collection '${collectionName}' dropped`);
        }
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to drop collection '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Insert document
  async insertDocument(collectionName, document) {
    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection.insertOne(document);
      console.log(`📄 Document inserted into '${collectionName}' with ID: ${result.document._id || 'auto-generated'}`);
      return result.document;
    } catch (error) {
      console.error(`❌ Failed to insert document into '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Bulk insert documents
  async insertMany(collectionName, documents) {
    try {
      const collection = await this.getCollection(collectionName);
      const results = {};

      for (const [index, document] of documents.entries()) {
        const result = await collection.insertOne(document);
        results[index] = result.document;
      }

      console.log(`📄 Bulk insert: ${documents.length} documents added to '${collectionName}'`);
      return results;
    } catch (error) {
      console.error(`❌ Bulk insert failed for '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Query documents with flexible filtering
  async find(collectionName, query = {}, options = {}) {
    try {
      const collection = await this.getCollection(collectionName);

      // Build SodaDocumentCursor
      let cursor = collection.find();
      cursor = cursor.filter(query);

      // Apply pagination
      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }

      if (options.skip) {
        cursor = cursor.skip(options.skip);
      }

      // Apply sorting
      if (options.sort) {
        cursor = cursor.sort(options.sort);
      }

      const documents = [];
      while (true) {
        const doc = await cursor.getNext();
        if (!doc) break;
        documents.push(await doc.getContent());
      }

      await cursor.close();
      return documents;
    } catch (error) {
      console.error(`❌ Query failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Find single document by ID
  async findById(collectionName, id) {
    try {
      const collection = await this.getCollection(collectionName);
      const document = await collection.find().key(id).getNext();
      return document ? await document.getContent() : null;
    } catch (error) {
      console.error(`❌ Find by ID failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Update document by ID
  async updateById(collectionName, id, updateDocument) {
    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection.find().key(id).updateOne(updateDocument);
      console.log(`🔄 Document ${id} updated in '${collectionName}'`);
      return result;
    } catch (error) {
      console.error(`❌ Update by ID failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Delete document by ID
  async deleteById(collectionName, id) {
    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection.find().key(id).remove();
      console.log(`🗑️ Document ${id} deleted from '${collectionName}'`);
      return result;
    } catch (error) {
      console.error(`❌ Delete by ID failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Count documents
  async count(collectionName, query = {}) {
    try {
      const collection = await this.getCollection(collectionName);
      return await collection.find().filter(query).count();
    } catch (error) {
      console.error(`❌ Count failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Advanced search with full-text capability
  async search(collectionName, searchQuery, options = {}) {
    try {
      const collection = await this.getCollection(collectionName);

      let cursor = collection.find();

      // Full text search using Oracle's search capabilities
      if (searchQuery.$text) {
        cursor = cursor.search(searchQuery.$text.query, {
          caseSensitive: false,
          fuzzy: options.fuzzy || false
        });
      }

      // Apply additional filters
      if (searchQuery.filter) {
        cursor = cursor.filter(searchQuery.filter);
      }

      // Pagination and sorting
      if (options.limit) cursor = cursor.limit(options.limit);
      if (options.skip) cursor = cursor.skip(options.skip);
      if (options.sort) cursor = cursor.sort(options.sort);

      const results = [];
      while (true) {
        const doc = await cursor.getNext();
        if (!doc) break;
        results.push(await doc.getContent());
      }

      await cursor.close();
      return results;
    } catch (error) {
      console.error(`❌ Search failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Replace entire document
  async replaceById(collectionName, id, newDocument) {
    try {
      const collection = await this.getCollection(collectionName);
      const result = await collection.find().key(id).replaceOne(newDocument);
      console.log(`🔄 Document ${id} replaced in '${collectionName}'`);
      return result;
    } catch (error) {
      console.error(`❌ Replace by ID failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Aggregate operations
  async aggregate(collectionName, pipeline, options = {}) {
    try {
      const collection = await this.getCollection(collectionName);

      // Use Oracle's SQL for complex aggregations if available
      // For now, simulate with multiple queries
      let results = [];

      for (const stage of pipeline) {
        if (stage.$match) {
          results = await this.find(collectionName, stage.$match, options);
        } else if (stage.$group) {
          // Implement grouping logic
          results = this.groupDocuments(results, stage.$group);
        } else if (stage.$sort) {
          results.sort((a, b) => {
            for (const [key, order] of Object.entries(stage.$sort)) {
              const aVal = this.getNestedValue(a, key);
              const bVal = this.getNestedValue(b, key);
              if (aVal !== bVal) {
                return order === 1 ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
              }
            }
            return 0;
          });
        } else if (stage.$limit) {
          results = results.slice(0, stage.$limit);
        }
      }

      return results;
    } catch (error) {
      console.error(`❌ Aggregation failed on '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Get collection statistics
  async getCollectionStats(collectionName) {
    try {
      const connection = await connectionManager.getConnection();
      try {
        const collection = await connection.getSodaCollection(collectionName);
        if (!collection) return null;

        // Get collection metadata
        const metadata = await collection.getMetadata();

        // Count documents
        const count = await collection.find().count();

        return {
          name: collectionName,
          documentCount: count,
          metadata,
          initialized: this.initializedCollections.has(collectionName)
        };
      } finally {
        await connection.close();
      }
    } catch (error) {
      console.error(`❌ Failed to get stats for '${collectionName}':`, error.message);
      throw error;
    }
  }

  // Initialize all required collections
  async initializeCollections() {
    const collections = [
      {
        name: 'users',
        options: {
          schemaURI: 'archipelago/users/1.0',
          recreateIfExists: process.env.RECREATE_COLLECTIONS === 'true'
        }
      },
      {
        name: 'islands',
        options: {
          schemaURI: 'archipelago/islands/1.0',
          recreateIfExists: process.env.RECREATE_COLLECTIONS === 'true'
        }
      },
      {
        name: 'purchases',
        options: {
          schemaURI: 'archipelago/purchases/1.0',
          recreateIfExists: process.env.RECREATE_COLLECTIONS === 'true'
        }
      },
      {
        name: 'system_metrics',
        options: {
          schemaURI: 'archipelago/metrics/1.0',
          recreateIfExists: process.env.RECREATE_COLLECTIONS === 'true'
        }
      },
      {
        name: 'purchase_history',
        options: {
          schemaURI: 'archipelago/history/1.0',
          recreateIfExists: process.env.RECREATE_COLLECTIONS === 'true'
        }
      }
    ];

    console.log('🏗️ Initializing Archipelago SODA collections...');

    const results = {};
    for (const { name, options } of collections) {
      try {
        const collection = await this.createCollection(name, options);
        results[name] = { success: true, message: `Collection '${name}' initialized` };
      } catch (error) {
        results[name] = { success: false, error: error.message };
      }
    }

    const successCount = Object.values(results).filter(r => r.success).length;
    console.log(`✅ ${successCount}/${collections.length} collections initialized`);

    return results;
  }

  // Cleanup helper methods
  groupDocuments(documents, groupSpec) {
    const groups = new Map();

    for (const doc of documents) {
      const key = this.getNestedValue(doc, groupSpec._id);
      const keyStr = JSON.stringify(key);

      if (!groups.has(keyStr)) {
        groups.set(keyStr, { _id: key, ...this.initializeGroupResult(groupSpec) });
      }

      const group = groups.get(keyStr);
      this.aggregateGroup(group, doc, groupSpec);
    }

    return Array.from(groups.values());
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  initializeGroupResult(groupSpec) {
    const result = {};
    for (const [key, value] of Object.entries(groupSpec)) {
      if (key !== '_id') {
        if (typeof value === 'object' && value.$sum) result[key] = 0;
        if (typeof value === 'object' && value.$avg) result[key] = { sum: 0, count: 0 };
        if (typeof value === 'object' && value.$min) result[key] = Infinity;
        if (typeof value === 'object' && value.$max) result[key] = -Infinity;
        if (typeof value === 'object' && value.$first) result[key] = null;
        if (typeof value === 'object' && value.$last) result[key] = null;
        if (typeof value === 'object' && value.$addToSet) result[key] = new Set();
        if (typeof value === 'object' && value.$push) result[key] = [];
      }
    }
    return result;
  }

  aggregateGroup(group, doc, groupSpec) {
    for (const [key, spec] of Object.entries(groupSpec)) {
      if (key === '_id') continue;

      const value = this.getNestedValue(doc, key);

      if (typeof spec === 'object') {
        if (spec.$sum && typeof value === 'number') group[key] += value;
        if (spec.$avg && typeof value === 'number') {
          group[key].sum += value;
          group[key].count++;
        }
        if (spec.$min && typeof value === 'number') group[key] = Math.min(group[key], value);
        if (spec.$max && typeof value === 'number') group[key] = Math.max(group[key], value);
        if (spec.$first && value !== undefined && group[key] === null) group[key] = value;
        if (spec.$last) group[key] = value;
        if (spec.$addToSet && value !== undefined) group[key].add(value);
        if (spec.$push && value !== undefined) group[key].push(value);
      }
    }
  }
}

//=============================================
// GLOBAL SODA MANAGER INSTANCE
//=============================================
const sodaManager = new SODACollectionsManager();

//=============================================
// MODULE EXPORTS
//=============================================
module.exports = {
  SODACollectionsManager,
  sodaManager
};