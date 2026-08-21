'use strict';

const db = require('../services/db');

/**
 * ModuleRegistry — Tracks staged modules.
 * Populated during register stage of pipeline.
 */
class ModuleRegistry {
  constructor() {
    this._modules = new Map(); // moduleId -> module metadata
  }

  /**
   * Register a module after validation.
   * @param {Object} manifest - Parsed module.json
   */
  register(manifest) {
    this._modules.set(manifest.name, {
      name: manifest.name,
      version: manifest.version,
      author: manifest.author,
      status: 'registered',
      capabilitiesProvided: manifest.provides || [],
      capabilitiesRequired: manifest.requires || [],
      routes: manifest.routes || [],
      functions: manifest.functions || [],
      schema: manifest.schema || {},
      events: manifest.events || {},
      dependencies: manifest.dependencies || [],
      insights: manifest.insights || {
        classification: 'inherited_from_components',
        platform: { heartbeat:true, health:true, usage:true, performance:true, dependencies:true },
        operational: { enabled:false, inherited:true },
        visibility: { principal:'summary', superuser:'detailed', developer:'diagnostic' }
      },
      registeredAt: Date.now(),
    });

    // Persist to DB
    db.query(
      `INSERT INTO module_registry (name, version, author, status, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        manifest.name,
        manifest.version,
        manifest.author,
        'registered',
        JSON.stringify(manifest),
      ]
    );
  }

  /**
   * Deregister a module during unstage.
   * @param {string} moduleId
   */
  deregister(moduleId) {
    this._modules.delete(moduleId);

    db.query(
      `UPDATE module_registry SET status = 'unstaged' WHERE name = ?`,
      [moduleId]
    );
  }

  /**
   * Mark module as booted.
   * @param {string} moduleId
   */
  markBooted(moduleId) {
    const mod = this._modules.get(moduleId);
    if (mod) {
      mod.status = 'booted';
    }

    db.query(
      `UPDATE module_registry SET status = 'booted' WHERE name = ?`,
      [moduleId]
    );
  }

  /**
   * Get all staged modules.
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this._modules.values());
  }

  /**
   * Get module by ID.
   * @param {string} moduleId
   * @returns {Object|null}
   */
  get(moduleId) {
    return this._modules.get(moduleId) || null;
  }

  /**
   * Query modules by capability they provide.
   * @param {string} capability
   * @returns {Array<Object>}
   */
  getByCapability(capability) {
    return Array.from(this._modules.values()).filter((mod) =>
      mod.capabilitiesProvided.includes(capability)
    );
  }

  /**
   * Check if module is booted.
   * @param {string} moduleId
   * @returns {boolean}
   */
  isBooted(moduleId) {
    const mod = this._modules.get(moduleId);
    return mod && mod.status === 'booted';
  }

  /**
   * Count total staged modules.
   * @returns {number}
   */
  count() {
    return this._modules.size;
  }

  /**
   * Clear registry (for testing).
   */
  clear() {
    this._modules.clear();
  }
}

const moduleRegistry = new ModuleRegistry();

module.exports = moduleRegistry;
