'use strict';

const fs = require('fs');
const path = require('path');

var DB_PATH = path.resolve(__dirname, 'test_registries.sqlite');
process.env.DB_PATH = DB_PATH;

beforeAll(function() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');

  var { runMigrations } = require('../../../shared/migration-runner');
  return runMigrations();
});

afterAll(function() {
  db.close();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
});

const db = require('../../../shared/services/db');
const moduleRegistry = require('../../../shared/registry/moduleRegistry');
const routeRegistry = require('../../../shared/registry/routeRegistry');
const functionRegistry = require('../../../shared/registry/functionRegistry');
const capabilityRegistry = require('../../../shared/registry/capabilityRegistry');
const dependencyGraph = require('../../../shared/registry/dependencyGraph');
const schemaRegistry = require('../../../shared/registry/schemaRegistry');

describe('Registries', function() {

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

  describe('ModuleRegistry', function() {
    test('should register a module', function() {
      moduleRegistry.register({ name: 'test_mod', version: '1.0.0', author: 'test' });
      var mod = moduleRegistry.get('test_mod');
      expect(mod).not.toBeNull();
      expect(mod.name).toBe('test_mod');
    });

    test('should list all modules', function() {
      moduleRegistry.register({ name: 'mod_a', version: '1.0.0', author: 'test' });
      var all = moduleRegistry.getAll();
      expect(all.length).toBe(1);
    });

    test('should mark module as booted', function() {
      moduleRegistry.register({ name: 'boot_test', version: '1.0.0' });
      moduleRegistry.markBooted('boot_test');
      expect(moduleRegistry.isBooted('boot_test')).toBe(true);
    });

    test('should deregister a module', function() {
      moduleRegistry.register({ name: 'del_me', version: '1.0.0' });
      moduleRegistry.deregister('del_me');
      expect(moduleRegistry.get('del_me')).toBeNull();
    });
  });

  describe('RouteRegistry', function() {
    test('should register a route', function() {
      routeRegistry.register({ path: '/api/test', method: 'GET', handler: 'h1', auth_required: false, moduleName: 'm1' });
      var route = routeRegistry.get('/api/test', 'GET');
      expect(route).not.toBeNull();
    });

    test('should detect route conflicts', function() {
      routeRegistry.register({ path: '/api/conflict', method: 'GET', handler: 'h1', auth_required: false, moduleName: 'm1' });
      expect(function() {
        routeRegistry.register({ path: '/api/conflict', method: 'GET', handler: 'h2', auth_required: false, moduleName: 'm2' });
      }).toThrow('conflict');
    });

    test('should allow same path with different methods', function() {
      routeRegistry.register({ path: '/api/dual', method: 'GET', handler: 'gh', auth_required: false, moduleName: 'm' });
      routeRegistry.register({ path: '/api/dual', method: 'POST', handler: 'ph', auth_required: false, moduleName: 'm' });
      expect(routeRegistry.exists('/api/dual', 'GET')).toBe(true);
      expect(routeRegistry.exists('/api/dual', 'POST')).toBe(true);
    });
  });

  describe('FunctionRegistry', function() {
    test('should register and retrieve a function', function() {
      var fn = function() { return 'hello'; };
      functionRegistry.register('fn1', 'm1', fn, { params: [] });
      var retrieved = functionRegistry.get('fn1');
      expect(retrieved).not.toBeNull();
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
      var fns = functionRegistry.listByModule('mod_a');
      expect(fns.length).toBe(2);
    });
  });

  describe('CapabilityRegistry', function() {
    test('should register and check existence', function() {
      capabilityRegistry.register('capability:test', 'mod');
      expect(capabilityRegistry.exists('capability:test')).toBe(true);
    });

    test('should detect capability conflicts', function() {
      capabilityRegistry.register('capability:conflict', 'mod_a');
      expect(function() {
        capabilityRegistry.register('capability:conflict', 'mod_b');
      }).toThrow('conflict');
    });
  });

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
      expect(function() { dependencyGraph.computeBootOrder(); }).toThrow('Circular dependency');
    });

    test('should find missing dependencies', function() {
      dependencyGraph.addModule('a', ['nonexistent']);
      var missing = dependencyGraph.getMissingDependencies('a');
      expect(missing).toContain('nonexistent');
    });

    test('should remove a module', function() {
      dependencyGraph.addModule('a', []);
      dependencyGraph.addModule('b', ['a']);
      dependencyGraph.removeModule('b');
      expect(dependencyGraph.getAllNodes()).toContain('a');
      expect(dependencyGraph.getAllNodes()).not.toContain('b');
    });
  });

  describe('SchemaRegistry', function() {
    test('should register and check table ownership', function() {
      schemaRegistry.register('users', 'user_mgmt', ['001_users.sql']);
      expect(schemaRegistry.hasTable('users')).toBe(true);
      expect(schemaRegistry.ownsTable('user_mgmt', 'users')).toBe(true);
    });

    test('should get owner of a table', function() {
      schemaRegistry.register('courses', 'course_mod', []);
      expect(schemaRegistry.getOwner('courses')).toBe('course_mod');
    });

    test('should list tables by owner', function() {
      schemaRegistry.register('table_a', 'mod_x', []);
      schemaRegistry.register('table_b', 'mod_x', []);
      var tables = schemaRegistry.getTablesByOwner('mod_x');
      expect(tables.length).toBe(2);
    });
  });
});