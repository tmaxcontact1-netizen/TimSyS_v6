'use strict';

const db = require('../services/db');

/**
 * FunctionRegistry — Tracks callable functions exported by modules.
 * Maps function names to their implementation references.
 */
class FunctionRegistry {
  constructor() {
    this._functions = new Map(); // functionName -> { module, implementation, metadata }
  }

  /**
   * Register a function.
   * @param {string} name - Function name (e.g., "user_getById")
   * @param {string} moduleName
   * @param {Function} implementation
   * @param {Object} metadata - params, returns, etc.
   */
  register(name, moduleName, implementation, metadata = {}) {
    this._functions.set(name, {
      name,
      moduleName,
      implementation,
      metadata,
      registeredAt: Date.now(),
    });

    db.query(
      `INSERT INTO function_registry (name, module_name, metadata)
       VALUES (?, ?, ?)`,
      [name, moduleName, JSON.stringify(metadata)]
    );
  }

  /**
   * Unregister a function.
   * @param {string} name
   */
  unregister(name) {
    this._functions.delete(name);
    db.query(`DELETE FROM function_registry WHERE name = ?`, [name]);
  }

  /**
   * Get a function by name.
   * @param {string} name
   * @returns {{implementation: Function, module: string}|null}
   */
  get(name) {
    const fn = this._functions.get(name);
    if (!fn) return null;
    return {
      implementation: fn.implementation,
      module: fn.moduleName,
    };
  }

  /**
   * Check if function exists.
   * @param {string} name
   * @returns {boolean}
   */
  exists(name) {
    return this._functions.has(name);
  }

  /**
   * List functions by module.
   * @param {string} moduleName
   * @returns {Array<string>} Function names
   */
  listByModule(moduleName) {
    return Array.from(this._functions.values())
      .filter((fn) => fn.moduleName === moduleName)
      .map((fn) => fn.name);
  }

  /**
   * Search functions by pattern.
   * @param {string} pattern
   * @returns {Array<Object>}
   */
  search(pattern) {
    const regex = new RegExp(pattern, 'i');
    return Array.from(this._functions.values()).filter((fn) =>
      regex.test(fn.name)
    );
  }

  /**
   * Get all registered functions.
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this._functions.values());
  }

  /**
   * Count total functions.
   * @returns {number}
   */
  count() {
    return this._functions.size;
  }

  /**
   * Clear registry (for testing).
   */
  clear() {
    this._functions.clear();
  }
}

const functionRegistry = new FunctionRegistry();

module.exports = functionRegistry;