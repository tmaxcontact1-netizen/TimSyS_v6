'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../../../shared/services/db');
const { runMigrations } = require('../../../shared/migration-runner');

const moduleRegistry = require('../../../shared/registry/moduleRegistry');
const routeRegistry = require('../../../shared/registry/routeRegistry');
const functionRegistry = require('../../../shared/registry/functionRegistry');
const capabilityRegistry = require('../../../shared/registry/capabilityRegistry');
const dependencyGraph = require('../../../shared/registry/dependencyGraph');
const schemaRegistry = require('../../../shared/registry/schemaRegistry');

describe('Registries', function() {

  beforeAll(function() {
    var dbPath = path.resolve('./data/test.sqlite');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

    return runMigrations();
  });

  afterAll(function() {
    var dbPath = path.resolve('./data/test.sqlite');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  });

  beforeEach(function() {
    moduleRegistry.clear();
    routeRegistry.clear();
    functionRegistry.clear();
    capabilityRegistry.clear();
    dependencyGraph.clear();
    schemaRegistry.clear();

    db.query('DELETE FROM module_registry');
    db.query('DELETE FROM route_registry');
    db.query('DELETE FROM function_registry');
    db.query('DELETE FROM capability_registry');
    db.query('DELETE FROM schema_registry');
  });

  // ====================
  // ModuleRegistry
  // ====================
  describe('ModuleRegistry', function() {
    var sampleManifest = {
      name: 'test_module',
      version: '1.0.0',
      author: 'test',
      provides: ['capability:test.read'],
      requires: [],
      routes: [{ path: '/api/test', method: 'GET', handler: 'test_handler' }],
      functions: [{ name: 'test_handler', exports: 'test', params: [], returns: 'any' }],
      schema: { tables: ['test_table'], migrations: ['001_test.sql'] },
      events: { publishes: ['test.event'], subscribes: [] },
      dependencies: ['db'],
    };

    test('should register a module', function() {
      moduleRegistry.register(sampleManifest);
      var mod = moduleRegistry.get('test_module');
      expect(mod).not.toBeNull();
      expect(mod.name).toBe('test_module');
      expect(mod.version).toBe('1.0.0');
      expect(mod.status).toBe('registered');
    });

    test('should list all modules', function() {
      moduleRegistry.register(sampleManifest);
      var all = moduleRegistry.getAll();
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('test_module');
    });

    test('should find modules by capability', function() {
      moduleRegistry.register(sampleManifest);
      var mods = moduleRegistry.getByCapability('capability:test.read');
      expect(mods.length).toBe(1);
      expect(mods[0].name).toBe('test_module');
    });

    test('should mark module as booted', function() {
      moduleRegistry.register(sampleManifest);
      moduleRegistry.markBooted('test_module');
      expect(moduleRegistry.isBooted('test_module')).toBe(true);
    });

    test('should deregister a module', function() {
      moduleRegistry.register(sampleManifest);
      moduleRegistry.deregister('test_module');
      expect(moduleRegistry.get('test_module')).toBeNull();
    });

    test('should count modules', function() {
      expect(moduleRegistry.count()).toBe(0);
      moduleRegistry.register(sampleManifest);
      expect(moduleRegistry.count()).toBe(1);
    });
  });

  // ====================
  // RouteRegistry
  // ====================
  describe('RouteRegistry', function() {
    test('should register a route', function() {
      routeRegistry.register({
        path: '/api/test',
        method: 'GET',
        handler: 'test_handler',
        auth_required: true,
        moduleName: 'test_module',
      });

      var route = routeRegistry.get('/api/test', 'GET');
      expect(route).not.toBeNull();
      expect(route.handler).toBe('test_handler');
      expect(route.moduleName).toBe('test_module');
    });

    test('should detect route conflicts', function() {
      routeRegistry.register({
        path: '/api/conflict',
        method: 'GET',
        handler: 'handler1',
        auth_required: false,
        moduleName: 'mod1',
      });

      expect(function() {
        routeRegistry.register({
          path: '/api/conflict',
          method: 'GET',
          handler: 'handler2',
          auth_required: false,
          moduleName: 'mod2',
        });
      }).toThrow('conflict');
    });

    test('should allow same path with different methods', function() {
      routeRegistry.register({ path: '/api/dual', method: 'GET', handler: 'get_h', auth_required: false, moduleName: 'mod' });
      routeRegistry.register({ path: '/api/dual', method: 'POST', handler: 'post_h', auth_required: false, moduleName: 'mod' });

      expect(routeRegistry.exists('/api/dual', 'GET')).toBe(true);
      expect(routeRegistry.exists('/api/dual', 'POST')).toBe(true);
    });

    test('should unregister a route', function() {
      routeRegistry.register({ path: '/api/temp', method: 'GET', handler: 'temp_h', auth_required: false, moduleName: 'mod' });
      routeRegistry.unregister('/api/temp', 'GET');
      expect(routeRegistry.exists('/api/temp', 'GET')).toBe(false);
    });

    test('should list routes by module', function() {
      routeRegistry.register({ path: '/api/a', method: 'GET', handler: 'h_a', auth_required: false, moduleName: 'mod_a' });
      routeRegistry.register({ path: '/api/b', method: 'GET', handler: 'h_b', auth_required: false, moduleName: 'mod_a' });
      routeRegistry.register({ path: '/api/c', method: 'GET', handler: 'h_c', auth_required: false, moduleName: 'mod_b' });

      var routes = routeRegistry.getRoutesByModule('mod_a');
      expect(routes.length).toBe(2);
    });
  });

  // ====================
  // FunctionRegistry
  // ====================
  describe('FunctionRegistry', function() {
    test('should register and retrieve a function', function() {
      var fn = function() { return 'hello'; };
      functionRegistry.register('test_fn', 'test_module', fn, { params: [] });

      var retrieved = functionRegistry.get('test_fn');
      expect(retrieved).not.toBeNull();
      expect(retrieved.module).toBe('test_module');
      expect(typeof retrieved.implementation).toBe('function');
      expect(retrieved.implementation()).toBe('hello');
    });

    test('should check if function exists', function() {
      functionRegistry.register('exists_fn', 'mod', function() {}, {});
      expect(functionRegistry.exists('exists_fn')).toBe(true);
      expect(functionRegistry.exists('missing_fn')).toBe(false);
    });

    test('should list functions by module', function() {
      functionRegistry.register('mod_fn1', 'mod_a', function() {}, {});
      functionRegistry.register('mod_fn2', 'mod_a', function() {}, {});
      functionRegistry.register('mod_fn3', 'mod_b', function() {}, {});

      var fns = functionRegistry.listByModule('mod_a');
      expect(fns.length).toBe(2);
      expect(fns).toContain('mod_fn1');
      expect(fns).toContain('mod_fn2');
    });

    test('should unregister a function', function() {
      functionRegistry.register('temp_fn', 'mod', function() {}, {});
      functionRegistry.unregister('temp_fn');
      expect(functionRegistry.exists('temp_fn')).toBe(false);
    });
  });

  // ====================
  // CapabilityRegistry
  // ====================
  describe('CapabilityRegistry', function() {
    test('should register and check existence', function() {
      capabilityRegistry.register('capability:test.read', 'test_module');
      expect(capabilityRegistry.exists('capability:test.read')).toBe(true);
      expect(capabilityRegistry.exists('capability:test.write')).toBe(false);
    });

    test('should detect capability conflicts', function() {
      capabilityRegistry.register('capability:unique', 'mod_a');
      expect(function() {
        capabilityRegistry.register('capability:unique', 'mod_b');
      }).toThrow('conflict');
    });

    test('should list capabilities by module', function() {
      capabilityRegistry.register('capability:a', 'mod_a');
      capabilityRegistry.register('capability:b', 'mod_a');
      capabilityRegistry.register('capability:c', 'mod_b');

      var caps = capabilityRegistry.getByModule('mod_a');
      expect(caps.length).toBe(2);
    });

    test('should check if module provides a capability', function() {
      capabilityRegistry.register('capability:check', 'mod_a');
      expect(capabilityRegistry.provides('mod_a', 'capability:check')).toBe(true);
      expect(capabilityRegistry.provides('mod_b', 'capability:check')).toBe(false);
    });

    test('should unregister a capability', function() {
      capabilityRegistry.register('capability:temp', 'mod');
      capabilityRegistry.unregister('capability:temp');
      expect(capabilityRegistry.exists('capability:temp')).toBe(false);
    });
  });

  // ====================
  // DependencyGraph
  // ====================
  describe('DependencyGraph', function() {
    test('should add modules and compute boot order', function() {
      dependencyGraph.addModule('a', []);
      dependencyGraph.addModule('b', ['a']);
      dependencyGraph.addModule('c', ['b']);

      var order = dependencyGraph.computeBootOrder();
      expect(order).toEqual(['a', 'b', 'c']);
    });

    test('should detect circular dependencies', function() {
      dependencyGraph.addModule('x', ['y']);
      dependencyGraph.addModule('y', ['x']);

      expect(function() {
        dependencyGraph.computeBootOrder();
      }).toThrow('Circular dependency');
    });

    test('should detect cycles via detectCycles()', function() {
      dependencyGraph.addModule('p', ['q']);
      dependencyGraph.addModule('q', ['r']);
      dependencyGraph.addModule('r', ['p']);

      var cycles = dependencyGraph.detectCycles();
      expect(cycles.length).toBeGreaterThan(0);
    });

    test('should find missing dependencies', function() {
      dependencyGraph.addModule('a', ['nonexistent']);
      var missing = dependencyGraph.getMissingDependencies('a');
      expect(missing).toContain('nonexistent');
    });

    test('should get dependents', function() {
      dependencyGraph.addModule('base', []);
      dependencyGraph.addModule('child', ['base']);

      var dependents = dependencyGraph.getDependents('base');
      expect(dependents).toContain('child');
    });

    test('should remove a module', function() {
      dependencyGraph.addModule('a', []);
      dependencyGraph.addModule('b', ['a']);
      dependencyGraph.removeModule('b');

      expect(dependencyGraph.getAllNodes()).toContain('a');
      expect(dependencyGraph.getAllNodes()).not.toContain('b');
    });

    test('should export adjacency list', function() {
      dependencyGraph.addModule('a', []);
      dependencyGraph.addModule('b', ['a']);

      var json = dependencyGraph.toJSON();
      expect(json.a).toEqual([]);
      expect(json.b).toEqual(['a']);
    });

    test('should handle independent modules', function() {
      dependencyGraph.addModule('a', []);
      dependencyGraph.addModule('b', []);
      dependencyGraph.addModule('c', []);

      var order = dependencyGraph.computeBootOrder();
      expect(order.length).toBe(3);
      expect(order).toContain('a');
      expect(order).toContain('b');
      expect(order).toContain('c');
    });
  });

  // ====================
  // SchemaRegistry
  // ====================
  describe('SchemaRegistry', function() {
    test('should register and check table ownership', function() {
      schemaRegistry.register('users', 'user_management', ['001_users.sql']);

      expect(schemaRegistry.hasTable('users')).toBe(true);
      expect(schemaRegistry.ownsTable('user_management', 'users')).toBe(true);
      expect(schemaRegistry.ownsTable('other_module', 'users')).toBe(false);
    });

    test('should get owner of a table', function() {
      schemaRegistry.register('courses', 'course_module', ['001_courses.sql']);
      expect(schemaRegistry.getOwner('courses')).toBe('course_module');
    });

    test('should list tables by owner', function() {
      schemaRegistry.register('table_a', 'mod_x', []);
      schemaRegistry.register('table_b', 'mod_x', []);
      schemaRegistry.register('table_c', 'mod_y', []);

      var tables = schemaRegistry.getTablesByOwner('mod_x');
      expect(tables.length).toBe(2);
      expect(tables).toContain('table_a');
      expect(tables).toContain('table_b');
    });

    test('should unregister a table', function() {
      schemaRegistry.register('temp_table', 'mod', []);
      schemaRegistry.unregister('temp_table');
      expect(schemaRegistry.hasTable('temp_table')).toBe(false);
    });
  });
});