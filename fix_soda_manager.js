const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '404islands/404islands-app/src/backend/database/soda-manager.js');

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  let modifiedData = data;

  // Fix the require statement
  modifiedData = modifiedData.replace(
    /const { connectionManager } = require\('\.\/oracle-config'\);/,
    `const { connectionManager } = require('./postgres-config');`
  );

  // Fix console.log statements that were corrupted
  modifiedData = modifiedData.replace(/console\.log\(📋 SODA Collection '' cre\neated successfully\);/g, "console.log(`SODA Collection '${collectionName}' created successfully`);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Failed to create collection '':, error\.m\nmessage\);/g, "console.error(`Failed to create collection '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/throw new Error\(Collection '' does\n not exist\);/g, "throw new Error(`Collection '${collectionName}' does not exist`);");
  modifiedData = modifiedData.replace(/console\.log\(🗑️ SODA Collection '' d\ndropped\);/g, "console.log(`SODA Collection '${collectionName}' dropped`);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Failed to drop collection '':, error\.mes\nssage\);/g, "console.error(`Failed to drop collection '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.log\(📄 Document inserted into '\n}' with ID: \);/g, "console.log(`Document inserted into '${collectionName}' with ID: ${result.document._id || 'auto-generated'}`);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Failed to insert document into '':, erro\nor\.message\);/g, "console.error(`Failed to insert document into '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.log\(📄 Bulk insert:  document\nts added to ''\);/g, "console.log(`Bulk insert: ${documents.length} documents added to '${collectionName}'`);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Bulk insert failed for '':, error\.messag\nge\);/g, "console.error(`Bulk insert failed for '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Query failed on '':,\n error\.message\);/g, "console.error(`Query failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Find by ID failed on '\n}':, error\.message\);/g, "console.error(`Find by ID failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.log\(🔄 Document  updated in ''\);/g, "console.log(`Document ${id} updated in '${collectionName}'`);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Update by ID failed on '':, error\.messag\nge\);/g, "console.error(`Update by ID failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.log\(🗑️ Document  deleted from ''\);/g, "console.log(`Document ${id} deleted from '${collectionName}'`);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Delete by ID failed on '':, error\.messag\nge\);/g, "console.error(`Delete by ID failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Count failed on '':,\n error\.message\);/g, "console.error(`Count failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/if \(searchQuery\.\\\$text\) {/g, "if (searchQuery.\\$text) {");
  modifiedData = modifiedData.replace(/cursor = cursor\.search\(searchQuery\.\\\$text\.query, {/g, "cursor = cursor.search(searchQuery.\\$text.query, {");
  modifiedData = modifiedData.replace(/console\.error\(❌ Search failed on '':,\n, error\.message\);/g, "console.error(`Search failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/console\.log\(🔄 Document \${id} replaced in '\${collectionN\nName}'\);/g, "console.log(`Document ${id} replaced in '${collectionName}'`);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Replace by ID failed on '\${collectionNa\name}':, error\.mess\nsage\);/g, "console.error(`Replace by ID failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/if \(stage\.\\\$match\) {/g, "if (stage.\\$match) {");
  modifiedData = modifiedData.replace(/results = await this\.find\(collectionName, stage\.\\\$match, options\);/g, "results = await this.find(collectionName, stage.\\$match, options);");
  modifiedData = modifiedData.replace(/} else if \(stage\.\\\$group\) {/g, "} else if (stage.\\$group) {");
  modifiedData = modifiedData.replace(/results = this\.groupDocuments\(results, stage\.\\\$group\);/g, "results = this.groupDocuments(results, stage.\\$group);");
  modifiedData = modifiedData.replace(/} else if \(stage\.\\\$sort\) {/g, "} else if (stage.\\$sort) {");
  modifiedData = modifiedData.replace(/for \(const \[key, order\] of Object\.entries\(stage\.\\\$sort\)\) {/g, "for (const [key, order] of Object.entries(stage.\\$sort)) {");
  modifiedData = modifiedData.replace(/} else if \(stage\.\\\$limit\) {/g, "} else if (stage.\\$limit) {");
  modifiedData = modifiedData.replace(/results = results\.slice\(0, stage\.\\\$limit\);/g, "results = results.slice(0, stage.\\$limit);");
  modifiedData = modifiedData.replace(/console\.error\(❌ Aggregation failed on '\${collectionName\ne}':, error\.message\);/g, "console.error(`Aggregation failed on '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/initialized: this\.initializedCollections\.has\(collectionName\)/g, "initialized: this.initializedCollections.has(collectionName)");
  modifiedData = modifiedData.replace(/console\.error\(❌ Failed to get stats for '\${collectionNa\name}':, error\.message\);/g, "console.error(`Failed to get stats for '${collectionName}':`, error.message);");
  modifiedData = modifiedData.replace(/results\[name\] = { success: true, message: `Collection '\n'\${name}' initialized` };/g, "results[name] = { success: true, message: `Collection '${name}' initialized` };");
  modifiedData = modifiedData.replace(/console\.log\(✅ \${successCount}\/\${collections\.length} collections initialized\);/g, "console.log(`${successCount}/${collections.length} collections initialized`);");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$sum\) result\[key\] = 0;/g, "if (typeof value === 'object' && value.\\$sum) result[key] = 0;");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$avg\) result\[key\] = { sum: 0, count: 0 };/g, "if (typeof value === 'object' && value.\\$avg) result[key] = { sum: 0, count: 0 };");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$min\) result\[key\] = Infinity;/g, "if (typeof value === 'object' && value.\\$min) result[key] = Infinity;");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$max\) result\[key\] = -Infinity;/g, "if (typeof value === 'object' && value.\\$max) result[key] = -Infinity;");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$first\) result\[key\] = null;/g, "if (typeof value === 'object' && value.\\$first) result[key] = null;");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$last\) result\[key\] = null;/g, "if (typeof value === 'object' && value.\\$last) result[key] = null;");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$addToSet\) result\[key\] = new Set\(\);/g, "if (typeof value === 'object' && value.\\$addToSet) result[key] = new Set();");
  modifiedData = modifiedData.replace(/if \(typeof value === 'object' && value\.\$push\) result\[key\] = [];/g, "if (typeof value === 'object' && value.\\$push) result[key] = [];");
  modifiedData = modifiedData.replace(/if \(spec\.\$sum && typeof value === 'number'\) group\[key\] \+= value;/g, "if (spec.\\$sum && typeof value === 'number') group[key] += value;");
  modifiedData = modifiedData.replace(/if \(spec\.\$avg && typeof value === 'number'\) {/g, "if (spec.\\$avg && typeof value === 'number') {");
  modifiedData = modifiedData.replace(/if \(spec\.\$min && typeof value === 'number'\) group\[key\] = Math\.min\(group\[key\], value\);/g, "if (spec.\\$min && typeof value === 'number') group[key] = Math.min(group[key], value);");
  modifiedData = modifiedData.replace(/if \(spec\.\$max && typeof value === 'number'\) group\[key\] = Math\.max\(group\[key\], value\);/g, "if (spec.\\$max && typeof value === 'number') group[key] = Math.max(group[key], value);");
  modifiedData = modifiedData.replace(/if \(spec\.\$first && value !== undefined && group\[key\] === null\) group\[key\] = value;/g, "if (spec.\\$first && value !== undefined && group[key] === null) group[key] = value;");
  modifiedData = modifiedData.replace(/if \(spec\.\$last\) group\[key\] = value;/g, "if (spec.\\$last) group[key] = value;");
  modifiedData = modifiedData.replace(/if \(spec\.\$addToSet && value !== undefined\) group\[key\]\.add\(value\);/g, "if (spec.\\$addToSet && value !== undefined) group[key].add(value);");
  modifiedData = modifiedData.replace(/if \(spec\.\\\$push && value !== undefined\) group\[key\]\.push\(value\);/g, "if (spec.\\$push && value !== undefined) group[key].push(value);");


  fs.writeFile(filePath, modifiedData, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing file: ${err.message}`);
      process.exit(1);
    }
    console.log('soda-manager.js updated successfully!');
  });
});