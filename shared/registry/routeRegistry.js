'use strict';

const db = require('../services/db');

/**
 * RouteRegistry — Tracks HTTP routes and their handler bindings.
 */
class RouteRegistry {
  constructor() {
    this._routes = new Map(); // fullPath -> route metadata
  }

  /**
   * Register a route.
   * @param {Object} route - { path, method, handler, auth, moduleName }
   */
  register(route) {
    const fullPath = `${route.method.toUpperCase()} ${route.path}`;

    if (this._routes.has(fullPath)) {
      throw new Error(`Route conflict: ${fullPath} already registered`);
    }

    this._routes.set(fullPath, {
      ...route,
      registeredAt: Date.now(),
    });

    db.query(
      `INSERT INTO route_registry (method, path, handler, auth_required, module_name)
       VALUES (?, ?, ?, ?, ?)`,
      [route.method, route.path, route.handler, route.auth ? 1 : 0, route.moduleName]
    );
  }

  /**
   * Unregister a route.
   * @param {string} path
   * @param {string} method
   */
  unregister(path, method) {
    const fullPath = `${method.toUpperCase()} ${path}`;
    this._routes.delete(fullPath);
    db.query(`DELETE FROM route_registry WHERE method = ? AND path = ?`, [method, path]);
  }

  /**
   * Get route by path and method.
   * @param {string} path
   * @param {string} method
   * @returns {Object|null}
   */
  get(path, method) {
    const fullPath = `${method.toUpperCase()} ${path}`;
    return this._routes.get(fullPath) || null;
  }

  /**
   * Find routes matching a path pattern.
   * @param {string} pathPattern - e.g. "/api/users/:id"
   * @returns {Array<Object>}
   */
  findByPathPrefix(pathPrefix) {
    return Array.from(this._routes.values()).filter((route) =>
      route.path.startsWith(pathPrefix)
    );
  }

  /**
   * Get all routes for a module.
   * @param {string} moduleName
   * @returns {Array<Object>}
   */
  getRoutesByModule(moduleName) {
    return Array.from(this._routes.values()).filter(
      (route) => route.moduleName === moduleName
    );
  }

  /**
   * Check if route exists.
   * @param {string} path
   * @param {string} method
   * @returns {boolean}
   */
  exists(path, method) {
    const fullPath = `${method.toUpperCase()} ${path}`;
    return this._routes.has(fullPath);
  }

  /**
   * Get all registered routes.
   * @returns {Array<Object>}
   */
  getAll() {
    return Array.from(this._routes.values());
  }

  /**
   * Count total routes.
   * @returns {number}
   */
  count() {
    return this._routes.size;
  }

  /**
   * Clear registry (for testing).
   */
  clear() {
    this._routes.clear();
  }
}

const routeRegistry = new RouteRegistry();

module.exports = routeRegistry;