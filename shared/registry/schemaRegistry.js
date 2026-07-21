'use strict';

const db = require('../services/db');

/**
 * SchemaRegistry — Tracks database schemas owned by each module.
 * Ensures modules don't access tables they don't own.
 */
class SchemaRegistry {
  constructor() {
    this._schemas = new Map(); // tableName -> { ownerModule, migrations }
  }

  /**
   * Register a schema table.
   * @param {string} tableName
   * @param {string} ownerModule
   * @param {Array<string>} migrationFiles
   */
  register(tableName, ownerModule, migrationFiles = []) {
    this._schemas.set(tableName, {
      tableName,
      ownerModule,
      migrationFiles,
      registeredAt: Date.now(),
    });

    db.query(
      `INSERT INTO schema_registry (table_name, owner_module, migrations)
       VALUES (?, ?, ?)`,
      [tableName, ownerModule, JSON.stringify(migrationFiles)]
    );
  }

  /**
   * Check if a module owns a table.
   * @param {string} tableName
   * @returns {string|null} Owner module name or null
   */
  getOwner(tableName) {
    const schema = this._schemas.get(tableName);
    return schema ? schema.ownerModule : null;
  }

  /**
   * Check if module owns a table.
   * @param {string} moduleName
   * @param {string} tableName
   * @returns {boolean}
   */
  ownsTable(moduleName, tableName) {
    const owner = this.getOwner(tableName);
    return owner === moduleName;
  }

  /**
   * List all tables owned by a module.
   * @param {string} moduleName
   * @returns {Array<string>}
   */
  getTablesByOwner(moduleName) {
    return Array.from(this._schemas.values())
      .filter((schema) => schema.ownerModule === moduleName)
      .map((schema) => schema.tableName);
  }

  /**
   * Check if table exists in registry.
   * @param {string} tableName
   * @returns {boolean}
   */
  hasTable(tableName) {
    return this._schemas.has(tableName);
  }

  /**
   * Unregister a schema.
   * @param {string} tableName
   */
  unregister(tableName) {
    this._schemas.delete(tableName);
    db.query(`DELETE FROM schema_registry WHERE table_name = ?`, [tableName]);
  }

  /**
   * Get all registered schemas.
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this._schemas.values());
  }

  /**
   * Clear registry (for testing).
   */
  clear() {
    this._schemas.clear();
  }
}

const schemaRegistry = new SchemaRegistry();

module.exports = schemaRegistry;