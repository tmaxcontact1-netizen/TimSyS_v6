'use strict';

const db = require('../services/db');

class RouteRegistry {
  constructor() {
    this._routes = new Map();
  }

  register(route) {
    const fullPath = `${route.method.toUpperCase()} ${route.path}`;

    if (this._routes.has(fullPath)) {
      throw new Error(`Route conflict: ${fullPath} already registered`);
    }

    const routeObj = {
      path: route.path,
      method: route.method.toUpperCase(),
      handler: route.handler,
      auth_required: route.auth_required !== undefined ? route.auth_required : (route.auth || false),
      moduleName: route.moduleName,
      permissions: route.permissions || null,
      registeredAt: Date.now(),
    };

    this._routes.set(fullPath, routeObj);

    const permissionsJson = route.permissions ? JSON.stringify(route.permissions) : null;
    db.query(
      `INSERT INTO route_registry (method, path, handler, auth_required, module_name, permissions)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [route.method.toUpperCase(), route.path, route.handler, route.auth_required ? 1 : 0, route.moduleName, permissionsJson]
    );

    return routeObj;
  }

  unregister(path, method) {
    const fullPath = `${method.toUpperCase()} ${path}`;
    this._routes.delete(fullPath);
    db.query(`DELETE FROM route_registry WHERE method = ? AND path = ?`, [method.toUpperCase(), path]);
  }

  get(path, method) {
    const fullPath = `${method.toUpperCase()} ${path}`;
    return this._routes.get(fullPath) || null;
  }

  findByPathPrefix(pathPrefix) {
    return Array.from(this._routes.values()).filter((route) =>
      route.path.startsWith(pathPrefix)
    );
  }

  getRoutesByModule(moduleName) {
    return Array.from(this._routes.values()).filter(
      (route) => route.moduleName === moduleName
    );
  }

  exists(path, method) {
    const fullPath = `${method.toUpperCase()} ${path}`;
    return this._routes.has(fullPath);
  }

  getAll() {
    return Array.from(this._routes.values());
  }

  count() {
    return this._routes.size;
  }

  clear() {
    this._routes.clear();
  }
}

const routeRegistry = new RouteRegistry();

module.exports = routeRegistry;