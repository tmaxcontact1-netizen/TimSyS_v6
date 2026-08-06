'use strict';

const db = require('../services/db');

/**
 * DependencyGraph — Tracks module dependencies and computes boot order.
 * Detects circular dependencies.
 */
class DependencyGraph {
  constructor() {
    this._nodes = new Map(); // moduleId -> { dependencies: Set, dependents: Set }
  }

  /**
   * Add a module to the graph.
   * @param {string} moduleId
   * @param {Array<string>} dependencies
   */
  addModule(moduleId, dependencies = []) {
    this._nodes.set(moduleId, {
      dependencies: new Set(dependencies),
      dependents: new Set(),
    });

    // Link to dependent modules
    for (const dep of dependencies) {
      if (!this._nodes.has(dep)) {
        continue; // Will be validated separately
      }
      this._nodes.get(dep).dependents.add(moduleId);
    }
  }

  /**
   * Remove a module from the graph.
   * @param {string} moduleId
   */
  removeModule(moduleId) {
    const node = this._nodes.get(moduleId);
    if (!node) return;

    // Remove from dependents of its dependencies
    for (const dep of node.dependencies) {
      const depNode = this._nodes.get(dep);
      if (depNode) {
        depNode.dependents.delete(moduleId);
      }
    }

    this._nodes.delete(moduleId);
  }

  /**
   * Compute boot order via topological sort.
   * @returns {Array<string>} Module IDs in boot order
   * @throws {Error} If circular dependency detected
   */
  computeBootOrder() {
    const visited = new Set();
    const visiting = new Set(); // For cycle detection
    const order = [];

    const visit = (moduleId) => {
      if (visited.has(moduleId)) return;
      if (visiting.has(moduleId)) {
        throw new Error(`Circular dependency detected: ${Array.from(visiting).join(' -> ')} -> ${moduleId}`);
      }

      visiting.add(moduleId);

      const node = this._nodes.get(moduleId);
      if (node) {
        for (const dep of node.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(moduleId);
      visited.add(moduleId);
      order.push(moduleId);
    };

    for (const [moduleId] of this._nodes) {
      visit(moduleId);
    }

    return order;
  }

  /**
   * Detect cycles in the graph.
   * @returns {Array<Array<string>>} Cycles found (array of paths)
   */
  detectCycles() {
    const cycles = [];
    const pathStack = [];

    const dfs = (moduleId, visited) => {
      if (pathStack.includes(moduleId)) {
        const cycleStart = pathStack.indexOf(moduleId);
        cycles.push([...pathStack.slice(cycleStart), moduleId]);
        return;
      }

      if (visited.has(moduleId)) return;

      visited.add(moduleId);
      pathStack.push(moduleId);

      const node = this._nodes.get(moduleId);
      if (node) {
        for (const dep of node.dependencies) {
          dfs(dep, visited);
        }
      }

      pathStack.pop();
    };

    for (const [moduleId] of this._nodes) {
      dfs(moduleId, new Set());
    }

    return cycles;
  }

  /**
   * Check if all dependencies are satisfied.
   * @param {string} moduleId
   * @returns {Array<string>} Missing dependency IDs
   */
  getMissingDependencies(moduleId) {
    const node = this._nodes.get(moduleId);
    if (!node) return [];

    const allIds = new Set(this._nodes.keys());
    return Array.from(node.dependencies).filter((dep) => !allIds.has(dep));
  }

  /**
   * Get direct dependencies of a module.
   * @param {string} moduleId
   * @returns {Array<string>}
   */
  getDependencies(moduleId) {
    const node = this._nodes.get(moduleId);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Get modules that depend on this one.
   * @param {string} moduleId
   * @returns {Array<string>}
   */
  getDependents(moduleId) {
    const node = this._nodes.get(moduleId);
    return node ? Array.from(node.dependents) : [];
  }

  /**
   * Get all nodes in the graph.
   * @returns {Array<string>} Module IDs
   */
  getAllNodes() {
    return Array.from(this._nodes.keys());
  }

  /**
   * Clear graph (for testing).
   */
  clear() {
    this._nodes.clear();
  }

  /**
   * Export adjacency list (for introspection).
   * @returns {Object<string, string[]>}
   */
  toJSON() {
    const result = {};
    for (const [moduleId, node] of this._nodes) {
      result[moduleId] = Array.from(node.dependencies);
    }
    return result;
  }
}

const dependencyGraph = new DependencyGraph();

module.exports = dependencyGraph;