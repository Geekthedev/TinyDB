/**
 * TinyDB - A simple in-memory database implementation using pure JavaScript
 * Features:
 * - Table creation and management
 * - CRUD operations
 * - Basic querying with filters
 * - Indexing for performance
 * - Simple transactions
 * - Data persistence using localStorage
 */

// Main Database Class
function TinyDB(name) {
  // Private properties
  var _name = name || 'tinyDB';
  var _tables = {};
  var _transactionLog = [];
  var _inTransaction = false;
  var _transactionChanges = {};
  
  // Initialize from localStorage if available
  function _init() {
    if (typeof window !== 'undefined' && window.localStorage) {
      var storedDB = window.localStorage.getItem(_name);
      if (storedDB) {
        try {
          var parsedDB = JSON.parse(storedDB);
          _tables = parsedDB.tables || {};
          _transactionLog = parsedDB.transactionLog || [];
        } catch (e) {
          console.error("Failed to load database from localStorage:", e);
        }
      }
    }
  }
  
  // Save current state to localStorage
  function _persist() {
    if (typeof window !== 'undefined' && window.localStorage) {
      var dbState = {
        tables: _tables,
        transactionLog: _transactionLog
      };
      window.localStorage.setItem(_name, JSON.stringify(dbState));
    }
  }
  
  // Generate a unique ID (simple implementation)
  function _generateId() {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  
  // Table Class
  function Table(name, schema) {
    this.name = name;
    this.schema = schema || null;
    this.records = [];
    this.indices = {};
    this.lastId = 0;
    
    // Create index on a field
    this.createIndex = function(fieldName) {
      if (!this.indices[fieldName]) {
        this.indices[fieldName] = {};
        
        // Build index for existing records
        for (var i = 0; i < this.records.length; i++) {
          var record = this.records[i];
          var value = record[fieldName];
          
          if (value !== undefined) {
            if (!this.indices[fieldName][value]) {
              this.indices[fieldName][value] = [];
            }
            this.indices[fieldName][value].push(record._id);
          }
        }
        return true;
      }
      return false;
    };
    
    // Update index when record changes
    this._updateIndices = function(record) {
      for (var field in this.indices) {
        var value = record[field];
        
        // Remove old index entries
        for (var indexValue in this.indices[field]) {
          this.indices[field][indexValue] = this.indices[field][indexValue].filter(function(id) {
            return id !== record._id;
          });
        }
        
        // Add new index entry
        if (value !== undefined) {
          if (!this.indices[field][value]) {
            this.indices[field][value] = [];
          }
          this.indices[field][value].push(record._id);
        }
      }
    };
    
    // Validate record against schema
    this._validateRecord = function(record) {
      if (!this.schema) return true;
      
      for (var field in this.schema) {
        var fieldType = this.schema[field].type;
        var required = this.schema[field].required || false;
        
        if (required && (record[field] === undefined || record[field] === null)) {
          return { valid: false, error: "Required field '" + field + "' is missing" };
        }
        
        if (record[field] !== undefined && record[field] !== null) {
          var actualType = typeof record[field];
          if (fieldType === 'array' && !Array.isArray(record[field])) {
            return { valid: false, error: "Field '" + field + "' should be an array" };
          } else if (fieldType !== 'array' && actualType !== fieldType) {
            return { valid: false, error: "Field '" + field + "' should be of type '" + fieldType + "', got '" + actualType + "'" };
          }
        }
      }
      
      return { valid: true };
    };
  }
  
  // Public API
  return {
    // Get database name
    getName: function() {
      return _name;
    },
    
    // Create a new table
    createTable: function(tableName, schema) {
      if (!_tables[tableName]) {
        _tables[tableName] = new Table(tableName, schema);
        _persist();
        return true;
      }
      return false;
    },
    
    // Drop a table
    dropTable: function(tableName) {
      if (_tables[tableName]) {
        delete _tables[tableName];
        _persist();
        return true;
      }
      return false;
    },
    
    // List all tables
    listTables: function() {
      return Object.keys(_tables);
    },
    
    // Get a table object
    getTable: function(tableName) {
      return _tables[tableName];
    },
    
    // Insert a record into a table
    insert: function(tableName, record) {
      var table = _tables[tableName];
      if (!table) return { success: false, error: "Table does not exist" };
      
      // Validate against schema
      var validation = table._validateRecord(record);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      // Create a copy of the record to avoid external modifications
      var newRecord = JSON.parse(JSON.stringify(record));
      
      // Add metadata
      newRecord._id = _generateId();
      newRecord._createdAt = new Date().toISOString();
      newRecord._updatedAt = new Date().toISOString();
      
      // Store the record
      if (_inTransaction) {
        if (!_transactionChanges[tableName]) {
          _transactionChanges[tableName] = { inserts: [], updates: [], deletes: [] };
        }
        _transactionChanges[tableName].inserts.push(newRecord);
      } else {
        table.records.push(newRecord);
        table._updateIndices(newRecord);
        _persist();
      }
      
      return { success: true, id: newRecord._id };
    },
    
    // Update a record in a table
    update: function(tableName, id, updates) {
      var table = _tables[tableName];
      if (!table) return { success: false, error: "Table does not exist" };
      
      var recordIndex = -1;
      var oldRecord = null;
      
      // Find the record
      for (var i = 0; i < table.records.length; i++) {
        if (table.records[i]._id === id) {
          recordIndex = i;
          oldRecord = table.records[i];
          break;
        }
      }
      
      if (recordIndex === -1) {
        return { success: false, error: "Record not found" };
      }
      
      // Create updated record
      var updatedRecord = JSON.parse(JSON.stringify(oldRecord));
      for (var key in updates) {
        // Skip metadata fields
        if (key !== '_id' && key !== '_createdAt') {
          updatedRecord[key] = updates[key];
        }
      }
      updatedRecord._updatedAt = new Date().toISOString();
      
      // Validate updated record
      var validation = table._validateRecord(updatedRecord);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      
      if (_inTransaction) {
        if (!_transactionChanges[tableName]) {
          _transactionChanges[tableName] = { inserts: [], updates: [], deletes: [] };
        }
        _transactionChanges[tableName].updates.push({ index: recordIndex, record: updatedRecord });
      } else {
        // Update the record
        table.records[recordIndex] = updatedRecord;
        table._updateIndices(updatedRecord);
        _persist();
      }
      
      return { success: true };
    },
    
    // Delete a record from a table
    delete: function(tableName, id) {
      var table = _tables[tableName];
      if (!table) return { success: false, error: "Table does not exist" };
      
      var recordIndex = -1;
      
      // Find the record
      for (var i = 0; i < table.records.length; i++) {
        if (table.records[i]._id === id) {
          recordIndex = i;
          break;
        }
      }
      
      if (recordIndex === -1) {
        return { success: false, error: "Record not found" };
      }
      
      if (_inTransaction) {
        if (!_transactionChanges[tableName]) {
          _transactionChanges[tableName] = { inserts: [], updates: [], deletes: [] };
        }
        _transactionChanges[tableName].deletes.push(recordIndex);
      } else {
        // Remove record from indices
        var record = table.records[recordIndex];
        for (var field in table.indices) {
          var value = record[field];
          if (value !== undefined && table.indices[field][value]) {
            table.indices[field][value] = table.indices[field][value].filter(function(recId) {
              return recId !== id;
            });
          }
        }
        
        // Remove the record
        table.records.splice(recordIndex, 1);
        _persist();
      }
      
      return { success: true };
    },
    
    // Query records from a table
    find: function(tableName, query, options) {
      var table = _tables[tableName];
      if (!table) return { success: false, error: "Table does not exist" };
      
      options = options || {};
      var limit = options.limit || null;
      var skip = options.skip || 0;
      var sort = options.sort || null;
      
      var results = [];
      var useIndex = false;
      var candidateIds = null;
      
      // Check if we can use an index for the main equality condition
      if (query && typeof query === 'object') {
        for (var field in query) {
          if (typeof query[field] !== 'object' && table.indices[field]) {
            var value = query[field];
            var indexedIds = table.indices[field][value] || [];
            
            if (candidateIds === null) {
              candidateIds = indexedIds.slice();
              useIndex = true;
            } else {
              // Intersection with previous conditions
              candidateIds = candidateIds.filter(function(id) {
                return indexedIds.includes(id);
              });
            }
          }
        }
      }
      
      // If we can use an index, filter candidates, otherwise scan all records
      if (useIndex && candidateIds) {
        for (var i = 0; i < candidateIds.length; i++) {
          var id = candidateIds[i];
          var record = null;
          
          // Find the record with this id
          for (var j = 0; j < table.records.length; j++) {
            if (table.records[j]._id === id) {
              record = table.records[j];
              break;
            }
          }
          
          if (record && _matchesQuery(record, query)) {
            results.push(record);
          }
        }
      } else {
        // Full table scan
        for (var i = 0; i < table.records.length; i++) {
          if (_matchesQuery(table.records[i], query)) {
            results.push(table.records[i]);
          }
        }
      }
      
      // Apply sorting
      if (sort) {
        results.sort(function(a, b) {
          for (var field in sort) {
            var direction = sort[field];
            var valueA = a[field];
            var valueB = b[field];
            
            if (valueA < valueB) return direction === 1 ? -1 : 1;
            if (valueA > valueB) return direction === 1 ? 1 : -1;
          }
          return 0;
        });
      }
      
      // Apply pagination
      if (skip > 0) {
        results = results.slice(skip);
      }
      
      if (limit !== null) {
        results = results.slice(0, limit);
      }
      
      return { success: true, results: results };
    },
    
    // Find a single record by id
    findById: function(tableName, id) {
      var table = _tables[tableName];
      if (!table) return { success: false, error: "Table does not exist" };
      
      for (var i = 0; i < table.records.length; i++) {
        if (table.records[i]._id === id) {
          return { success: true, result: table.records[i] };
        }
      }
      
      return { success: false, error: "Record not found" };
    },
    
    // Count records matching a query
    count: function(tableName, query) {
      var result = this.find(tableName, query);
      if (result.success) {
        return { success: true, count: result.results.length };
      }
      return result;
    },
    
    // Create an index on a field
    createIndex: function(tableName, fieldName) {
      var table = _tables[tableName];
      if (!table) return { success: false, error: "Table does not exist" };
      
      var result = table.createIndex(fieldName);
      if (result) {
        _persist();
        return { success: true };
      }
      return { success: false, error: "Index already exists" };
    },
    
    // Transaction support
    beginTransaction: function() {
      if (_inTransaction) {
        return { success: false, error: "Transaction already in progress" };
      }
      
      _inTransaction = true;
      _transactionChanges = {};
      return { success: true };
    },
    
    commitTransaction: function() {
      if (!_inTransaction) {
        return { success: false, error: "No transaction in progress" };
      }
      
      // Apply all changes
      for (var tableName in _transactionChanges) {
        var table = _tables[tableName];
        var changes = _transactionChanges[tableName];
        
        // Apply deletes (in reverse order to preserve indices)
        changes.deletes.sort(function(a, b) { return b - a; });
        for (var i = 0; i < changes.deletes.length; i++) {
          var index = changes.deletes[i];
          
          // Remove from indices
          var record = table.records[index];
          for (var field in table.indices) {
            var value = record[field];
            if (value !== undefined && table.indices[field][value]) {
              table.indices[field][value] = table.indices[field][value].filter(function(id) {
                return id !== record._id;
              });
            }
          }
          
          table.records.splice(index, 1);
        }
        
        // Apply updates
        for (var i = 0; i < changes.updates.length; i++) {
          var update = changes.updates[i];
          table.records[update.index] = update.record;
          table._updateIndices(update.record);
        }
        
        // Apply inserts
        for (var i = 0; i < changes.inserts.length; i++) {
          table.records.push(changes.inserts[i]);
          table._updateIndices(changes.inserts[i]);
        }
      }
      
      // Log transaction
      _transactionLog.push({
        timestamp: new Date().toISOString(),
        changes: _transactionChanges
      });
      
      _inTransaction = false;
      _transactionChanges = {};
      _persist();
      
      return { success: true };
    },
    
    rollbackTransaction: function() {
      if (!_inTransaction) {
        return { success: false, error: "No transaction in progress" };
      }
      
      _inTransaction = false;
      _transactionChanges = {};
      
      return { success: true };
    },
    
    // Export database to JSON
    export: function() {
      return JSON.stringify({
        name: _name,
        tables: _tables,
        transactionLog: _transactionLog
      });
    },
    
    // Import database from JSON
    import: function(jsonData) {
      try {
        var data = JSON.parse(jsonData);
        _name = data.name || _name;
        _tables = data.tables || {};
        _transactionLog = data.transactionLog || [];
        _persist();
        return { success: true };
      } catch (e) {
        return { success: false, error: "Invalid JSON data: " + e.message };
      }
    },
    
    // Clear the entire database
    clear: function() {
      _tables = {};
      _transactionLog = [];
      _persist();
      return { success: true };
    }
  };
  
  // Helper function to check if a record matches a query
  function _matchesQuery(record, query) {
    if (!query) return true;
    
    for (var field in query) {
      var queryValue = query[field];
      
      // Handle special query operators
      if (typeof queryValue === 'object' && queryValue !== null) {
        if (queryValue.$gt !== undefined && !(record[field] > queryValue.$gt)) return false;
        if (queryValue.$gte !== undefined && !(record[field] >= queryValue.$gte)) return false;
        if (queryValue.$lt !== undefined && !(record[field] < queryValue.$lt)) return false;
        if (queryValue.$lte !== undefined && !(record[field] <= queryValue.$lte)) return false;
        if (queryValue.$ne !== undefined && record[field] === queryValue.$ne) return false;
        if (queryValue.$in !== undefined && !queryValue.$in.includes(record[field])) return false;
        if (queryValue.$nin !== undefined && queryValue.$nin.includes(record[field])) return false;
        
        // Regex matching
        if (queryValue.$regex) {
          var regex = new RegExp(queryValue.$regex, queryValue.$options || '');
          if (!regex.test(record[field])) return false;
        }
      } else {
        // Simple equality match
        if (record[field] !== queryValue) return false;
      }
    }
    
    return true;
  }
  
  // Initialize the database
  _init();
}

// Usage example
function runExample() {
  var db = new TinyDB("myExampleDB");
  
  // Create a table with schema
  db.createTable("users", {
    name: { type: "string", required: true },
    age: { type: "number" },
    email: { type: "string", required: true },
    active: { type: "boolean", required: true },
    tags: { type: "array" }
  });
  
  // Create an index for faster querying
  db.createIndex("users", "email");
  
  // Insert some records
  db.insert("users", {
    name: "John Doe",
    age: 30,
    email: "john@example.com",
    active: true,
    tags: ["admin", "user"]
  });
  
  db.insert("users", {
    name: "Jane Smith",
    age: 25,
    email: "jane@example.com",
    active: true,
    tags: ["user"]
  });
  
  // Use a transaction for batch operations
  db.beginTransaction();
  
  db.insert("users", {
    name: "Bob Johnson",
    age: 40,
    email: "bob@example.com",
    active: false,
    tags: ["user"]
  });
  
  db.update("users", db.find("users", { name: "John Doe" }).results[0]._id, {
    age: 31,
    tags: ["admin", "user", "moderator"]
  });
  
  db.commitTransaction();
  
  // Query the data
  console.log("All users:", db.find("users", {}).results);
  console.log("Active users:", db.find("users", { active: true }).results);
  console.log("Users over 30:", db.find("users", { age: { $gt: 30 } }).results);
  
  // Count records
  console.log("Total users:", db.count("users", {}).count);
  
  // Export the database
  var exportedData = db.export();
  console.log("Exported database:", exportedData);
  
  return "Example completed successfully";
}

// Simple test framework
function TinyDBTester() {
  let tests = [];
  let passedTests = 0;
  let failedTests = 0;
  
  // Add a test
  this.addTest = function(name, testFn) {
    tests.push({ name: name, fn: testFn });
  };
  
  // Run all tests
  this.runTests = function() {
    console.log("Running TinyDB tests...");
    console.log("======================");
    
    for (let i = 0; i < tests.length; i++) {
      let test = tests[i];
      try {
        let result = test.fn();
        if (result === true) {
          console.log(`✓ PASS: ${test.name}`);
          passedTests++;
        } else {
          console.log(`✗ FAIL: ${test.name} - ${result || "Test returned false"}`);
          failedTests++;
        }
      } catch (e) {
        console.log(`✗ ERROR: ${test.name} - ${e.message}`);
        failedTests++;
      }
    }
    
    console.log("======================");
    console.log(`Tests complete: ${passedTests} passed, ${failedTests} failed`);
    return { passed: passedTests, failed: failedTests };
  };
}

// Example test suite
function runTests() {
  const tester = new TinyDBTester();
  
  // Basic functionality tests
  tester.addTest("Create database", function() {
    const db = new TinyDB("test_db");
    return db && typeof db === 'object';
  });
  
  tester.addTest("Create table", function() {
    const db = new TinyDB("test_db");
    const result = db.createTable("test_table", {
      name: { type: "string", required: true },
      age: { type: "number" }
    });
    return result === true;
  });
  
  tester.addTest("Insert record", function() {
    const db = new TinyDB("test_db");
    db.createTable("test_table", {
      name: { type: "string", required: true },
      age: { type: "number" }
    });
    
    const result = db.insert("test_table", {
      name: "Test User",
      age: 30
    });
    
    return result.success === true && result.id !== undefined;
  });
  
  tester.addTest("Schema validation", function() {
    const db = new TinyDB("test_db");
    db.createTable("test_table", {
      name: { type: "string", required: true },
      age: { type: "number" }
    });
    
    // Missing required field
    const result = db.insert("test_table", {
      age: 30
    });
    
    return result.success === false && result.error.includes("Required field");
  });
  
  tester.addTest("Find records", function() {
    const db = new TinyDB("test_db");
    db.clear();
    db.createTable("test_table");
    
    db.insert("test_table", { name: "User 1", age: 20 });
    db.insert("test_table", { name: "User 2", age: 30 });
    db.insert("test_table", { name: "User 3", age: 40 });
    
    const result = db.find("test_table", { age: { $gt: 25 } });
    return result.success === true && result.results.length === 2;
  });
  
  tester.addTest("Update record", function() {
    const db = new TinyDB("test_db");
    db.clear();
    db.createTable("test_table");
    
    const insertResult = db.insert("test_table", { name: "Test User", age: 30 });
    const id = insertResult.id;
    
    db.update("test_table", id, { age: 31 });
    
    const findResult = db.findById("test_table", id);
    return findResult.success === true && findResult.result.age === 31;
  });
  
  tester.addTest("Delete record", function() {
    const db = new TinyDB("test_db");
    db.clear();
    db.createTable("test_table");
    
    const insertResult = db.insert("test_table", { name: "Test User", age: 30 });
    const id = insertResult.id;
    
    db.delete("test_table", id);
    
    const findResult = db.findById("test_table", id);
    return findResult.success === false;
  });
  
  tester.addTest("Index creation and usage", function() {
    const db = new TinyDB("test_db");
    db.clear();
    db.createTable("test_table");
    
    db.insert("test_table", { name: "User 1", email: "user1@example.com" });
    db.insert("test_table", { name: "User 2", email: "user2@example.com" });
    
    db.createIndex("test_table", "email");
    
    const result = db.find("test_table", { email: "user2@example.com" });
    return result.success === true && result.results.length === 1 && result.results[0].name === "User 2";
  });
  
  tester.addTest("Transaction commit", function() {
    const db = new TinyDB("test_db");
    db.clear();
    db.createTable("test_table");
    
    db.beginTransaction();
    db.insert("test_table", { name: "Transaction User 1" });
    db.insert("test_table", { name: "Transaction User 2" });
    db.commitTransaction();
    
    const result = db.find("test_table", {});
    return result.success === true && result.results.length === 2;
  });
  
  tester.addTest("Transaction rollback", function() {
    const db = new TinyDB("test_db");
    db.clear();
    db.createTable("test_table");
    
    db.insert("test_table", { name: "Permanent User" });
    
    db.beginTransaction();
    db.insert("test_table", { name: "Temporary User" });
    db.rollbackTransaction();
    
    const result = db.find("test_table", {});
    return result.success === true && result.results.length === 1 && result.results[0].name === "Permanent User";
  });
  
  tester.addTest("Export and import", function() {
    const db1 = new TinyDB("test_db");
    db1.clear();
    db1.createTable("test_table");
    db1.insert("test_table", { name: "Export Test User" });
    
    const exportData = db1.export();
    
    const db2 = new TinyDB("test_db2");
    db2.import(exportData);
    
    const result = db2.find("test_table", {});
    return result.success === true && result.results.length === 1 && result.results[0].name === "Export Test User";
  });
  
  // Run all tests
  return tester.runTests();
}

// Run the example and tests if in a browser environment
if (typeof window !== 'undefined') {
  console.log("Running example:");
  console.log(runExample());
  
  console.log("\n==============================\n");
  
  console.log("Running tests:");
  runTests();
}