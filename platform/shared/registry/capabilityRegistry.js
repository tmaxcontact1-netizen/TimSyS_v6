'use strict';

const db = require('../services/db');

/**
 * CapabilityRegistry — Tracks capabilities provided by modules.
 * Enables capability-based dependency resolution.
 */
class CapabilityRegistry {
  constructor() {
    this._capabilities = new Map(); // capabilityName -> { module, metadata }
  }

  /**
   * Register a capability.
   * @param {string} name - Capability name (e.g., "user_management.get_user")
   * @param {string} moduleName - Owning module
   * @param {Object} metadata
   */
  register(name, moduleName, metadata = {}) {
    if (this._capabilities.has(name)) {
      throw new Error(`Capability conflict: ${name} already registered by ${this._capabilities.get(name).module}`);
    }

    this._capabilities.set(name, {
      name,
      module: moduleName,
      metadata,
      registeredAt: Date.now(),
    });

    db.query(
      `INSERT INTO capability_registry (name, module_name, metadata)
       VALUES (?, ?, ?)`,
      [name, moduleName, JSON.stringify(metadata)]
    );
  }

  /**
   * Unregister a capability.
   * @param {string} name
   */
  unregister(name) {
    this._capabilities.delete(name);
    db.query(`DELETE FROM capability_registry WHERE name = ?`, [name]);
  }

  /**
   * Get capability by name.
   * @param {string} name
   * @returns {{module: string, metadata: Object}|null}
   */
  get(name) {
    return this._capabilities.get(name) || null;
  }

  /**
   * Check if capability exists.
   * @param {string} name
   * @returns {boolean}
   */
  exists(name) {
    return this._capabilities.has(name);
  }

  /**
   * Query capabilities by prefix.
   * @param {string} prefix - e.g., "user_management."
   * @returns {Array<Object>}
   */
  query(prefix) {
    return Array.from(this._capabilities.values()).filter((cap) =>
      cap.name.startsWith(prefix)
    );
  }

  /**
   * List capabilities provided by a module.
   * @param {string} moduleName
   * @returns {Array<string>} Capability names
   */
  getByModule(moduleName) {
    return Array.from(this._capabilities.values())
      .filter((cap) => cap.module === moduleName)
      .map((cap) => cap.name);
  }

  /**
   * Check if module provides a capability.
   * @param {string} moduleName
   * @param {string} capability
   * @returns {boolean}
   */
  provides(moduleName, capability) {
    const cap = this._capabilities.get(capability);
    return cap ? cap.module === moduleName : false;
  }

  /**
   * Get all registered capabilities.
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this._capabilities.values());
  }

  /**
   * Count total capabilities.
   * @returns {number}
   */
  count() {
    return this._capabilities.size;
  }

  /**
   * Clear registry (for testing).
   */
  clear() {
    this._capabilities.clear();
  }
}

const capabilityRegistry = new CapabilityRegistry();

module.exports = capabilityRegistry;