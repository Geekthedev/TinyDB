# TinyDB

A lightweight, zero-dependency JavaScript database implementation for client-side applications.

## Overview

TinyDB is a simple yet powerful in-memory database system built with pure JavaScript. It requires no external libraries or packages, making it perfect for lightweight applications or educational purposes. The database supports persistent storage through the browser's localStorage API.

## Features

- **Pure JavaScript**: No dependencies, frameworks, or libraries required
- **Table Management**: Create, drop, and list tables with schema validation
- **CRUD Operations**: Full support for Create, Read, Update, and Delete operations
- **Advanced Querying**: Filter data with comparison operators, regex matching, and more
- **Indexing**: Improve query performance with field indexing
- **Transactions**: Support for atomic operations with commit and rollback capabilities
- **Persistence**: Automatic saving to localStorage
- **Import/Export**: Easily save and restore database state
- **Testing Framework**: Built-in testing utilities for verification and examples

## Installation

Simply include the TinyDB script in your HTML file:

```html
<script src="tinydb.js"></script>
```

## Basic Usage

### Creating a Database

```javascript
// Create a new database
const db = new TinyDB("myDatabase");
```

### Creating Tables

```javascript
// Create a table with schema validation
db.createTable("users", {
  name: { type: "string", required: true },
  age: { type: "number" },
  email: { type: "string", required: true },
  active: { type: "boolean" },
  tags: { type: "array" }
});

// Create a table without schema (schemaless)
db.createTable("notes");
```

### Inserting Records

```javascript
// Insert a record
const result = db.insert("users", {
  name: "John Doe",
  age: 30,
  email: "john@example.com",
  active: true,
  tags: ["admin", "user"]
});

// Get the generated ID
const userId = result.id;
```

### Querying Records

```javascript
// Find all records in a table
const allUsers = db.find("users", {}).results;

// Find records with simple equality
const activeUsers = db.find("users", { active: true }).results;

// Find records with comparison operators
const olderUsers = db.find("users", { age: { $gt: 25 } }).results;

// Find a specific record by ID
const user = db.findById("users", userId).result;
```

### Updating Records

```javascript
// Update a record
db.update("users", userId, {
  age: 31,
  tags: ["admin", "user", "moderator"]
});
```

### Deleting Records

```javascript
// Delete a record
db.delete("users", userId);
```

## Advanced Features

### Indexing

```javascript
// Create an index for faster queries
db.createIndex("users", "email");

// Now queries on the email field will be faster
const user = db.find("users", { email: "john@example.com" }).results[0];
```

### Transactions

```javascript
// Begin a transaction
db.beginTransaction();

// Perform multiple operations
db.insert("users", { name: "Jane", email: "jane@example.com", active: true });
db.update("users", userId, { active: false });

// Commit the transaction (all changes applied atomically)
db.commitTransaction();

// Or rollback if needed
// db.rollbackTransaction();
```

### Complex Queries

```javascript
// Complex query with multiple conditions
const results = db.find("users", {
  age: { $gte: 18, $lt: 65 },
  active: true,
  tags: { $in: ["admin"] }
}).results;

// Query with sorting and pagination
const paginatedResults = db.find("users", 
  { active: true },
  { 
    sort: { age: 1 },  // 1 for ascending, -1 for descending
    skip: 10,
    limit: 10
  }
).results;
```

### Export/Import

```javascript
// Export database to JSON string
const exportData = db.export();

// Save to file or localStorage
localStorage.setItem("dbBackup", exportData);

// Import from JSON string
const importedData = localStorage.getItem("dbBackup");
db.import(importedData);
```

## Testing

TinyDB includes a built-in testing framework for verification:

```javascript
// Run the predefined test suite
const testResults = runTests();
console.log(`${testResults.passed} tests passed, ${testResults.failed} tests failed`);

// Create custom tests
const tester = new TinyDBTester();

tester.addTest("My custom test", function() {
  const db = new TinyDB("test_db");
  // Test logic here
  return true; // Return true for pass, false or string message for fail
});

tester.runTests();
```

## Query Operators

TinyDB supports the following query operators:

| Operator | Description                            | Example                            |
|----------|----------------------------------------|------------------------------------|
| $gt      | Greater than                           | `{ age: { $gt: 21 } }`             |
| $gte     | Greater than or equal to               | `{ age: { $gte: 21 } }`            |
| $lt      | Less than                              | `{ age: { $lt: 65 } }`             |
| $lte     | Less than or equal to                  | `{ age: { $lte: 65 } }`            |
| $ne      | Not equal to                           | `{ status: { $ne: "inactive" } }`  |
| $in      | In array                               | `{ tag: { $in: ["admin", "mod"] } }`|
| $nin     | Not in array                           | `{ tag: { $nin: ["banned"] } }`    |
| $regex   | Regular expression                     | `{ name: { $regex: "^J" } }`       |

## Limitations

- Designed for client-side use with moderate data volumes
- Performance may degrade with very large datasets
- localStorage has size limitations (typically 5-10MB)
- No built-in support for remote synchronization

## Use Cases

- Prototyping applications
- Educational projects
- Offline-first web applications
- Single-page applications with state management needs
- Data caching

## License

MIT License

## Contributing

Contributions are welcome! Feel free to submit pull requests or open issues for bugs and feature requests.

## Example Application

Here's a complete example of a simple contact management application:

```javascript
// Initialize database
const contactsDB = new TinyDB("contactsApp");

// Create contacts table
contactsDB.createTable("contacts", {
  firstName: { type: "string", required: true },
  lastName: { type: "string", required: true },
  email: { type: "string" },
  phone: { type: "string" },
  category: { type: "string" }
});

// Create index for faster lookups
contactsDB.createIndex("contacts", "email");

// Add some initial contacts
contactsDB.insert("contacts", {
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  phone: "555-1234",
  category: "work"
});

contactsDB.insert("contacts", {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  phone: "555-5678",
  category: "personal"
});

// Search function
function searchContacts(query) {
  if (!query) {
    return contactsDB.find("contacts", {}).results;
  }
  
  // Search by name (first or last)
  return contactsDB.find("contacts", {
    $or: [
      { firstName: { $regex: query, $options: "i" } },
      { lastName: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } }
    ]
  }).results;
}

// Function to add a new contact
function addContact(contactData) {
  return contactsDB.insert("contacts", contactData);
}

// Function to update a contact
function updateContact(id, contactData) {
  return contactsDB.update("contacts", id, contactData);
}

// Function to delete a contact
function deleteContact(id) {
  return contactsDB.delete("contacts", id);
}

// Get contacts by category
function getContactsByCategory(category) {
  return contactsDB.find("contacts", { category: category }).results;
}
```
