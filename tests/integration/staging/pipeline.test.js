'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../../../shared/services/db');
const { runMigrations } = require('../../../shared/migration-runner');

const discover = require('../../../shared/pipeline/discover');
const validate = require('../../../shared/pipeline/validate');
const register = require('../../../shared/pipeline/register');
const resolve = require('../../../shared/pipeline/resolve');
const wire = require('../../../shared/pipeline/wire');
const unstage = require('../../../shared/pipeline/unstage');

const moduleRegistry = require('../../../shared/registry/moduleRegistry');
const routeRegistry = require('../../../shared/registry/routeRegistry');
const functionRegistry = require('../../../shared/registry/functionRegistry');
const capabilityRegistry = require('../../../shared/registry/capabilityRegistry');
const dependencyGraph = require('../../../shared/registry/dependencyGraph');
const schemaRegistry = require('../../../shared/registry/schemaRegistry');

describe('Staging Pipeline (Integration)', function() {

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

  describe('discover', function() {
    test('should find modules in /modules directory', function() {
      var discovered = discover();
      expect(discovered.length).toBeGreaterThanOrEqual(2);
      var names = discovered.map(function(d) { return d.name; });
      expect(names).toContain('system_health');
      expect(names).toContain('user_management');
    });

    test('should return manifest with each discovered module', function() {
      var discovered = discover();
      for (var i = 0; i < discovered.length; i++) {
        expect(discovered[i].manifest).toBeDefined();
        expect(discovered[i].dir).toBeDefined();
        expect(discovered[i].name).toBeDefined();
      }
    });
  });

  describe('validate', function() {
    test('should validate discovered modules without errors', function() {
      var discovered = discover();
      for (var i = 0; i < discovered.length; i++) {
        var validated = validate(discovered[i]);
        expect(validated.validated).toBe(true);
      }
    });

    test('should fail on invalid manifest (missing required fields)', function() {
      var invalidModule = {
        name: 'invalid',
        dir: '/nonexistent',
        manifest: { name: 'invalid' }, // Missing required fields
      };

      expect(function() {
        validate(invalidModule);
      }).toThrow();
    });

    test('should fail when entry point does not exist', function() {
      var noEntryModule = {
        name: 'noentry',
        dir: '/nonexistent',
        manifest: {
          name: 'noentry',
          version: '1.0.0',
          dependencies: ['db'],
          provides: [],
          requires: [],
          routes: [],
          functions: [],
        },
      };

      expect(function() {
        validate(noEntryModule);
      }).toThrow();
    });
  });

  describe('register', function() {
    test('should register module in all registries', function() {
      var discovered = discover();
      var first = discovered[0];
      var validated = validate(first);
      var registered = register(validated);

      expect(registered.registered).toBe(true);
      expect(moduleRegistry.get(first.manifest.name)).not.toBeNull();

      // Check capabilities were registered
      if (first.manifest.provides && first.manifest.provides.length > 0) {
        expect(capabilityRegistry.exists(first.manifest.provides[0])).toBe(true);
      }

      // Check routes were registered
      if (first.manifest.routes && first.manifest.routes.length > 0) {
        var firstRoute = first.manifest.routes[0];
        expect(routeRegistry.exists(firstRoute.path, firstRoute.method.toUpperCase())).toBe(true);
      }

      // Check functions were registered
      if (first.manifest.functions && first.manifest.functions.length > 0) {
        expect(functionRegistry.exists(first.manifest.functions[0].name)).toBe(true);
      }

      // Check dependency graph was populated
      expect(dependencyGraph.getAllNodes()).toContain(first.manifest.name);
    });
  });

  describe('resolve', function() {
    test('should resolve dependencies for real modules', function() {
      var discovered = discover();
      var validated = discovered.map(function(d) { return validate(d); });
      var registered = validated.map(function(d) { return register(d); });

      expect(function() {
        resolve(registered);
      }).not.toThrow();
    });

    test('should fail when required capability is missing', function() {
      var fakeModule = {
        manifest: {
          name: 'fake_needy',
          version: '1.0.0',
          dependencies: [],
          provides: [],
          requires: ['capability:does.not.exist'],
          routes: [],
          functions: [],
        },
      };

      expect(function() {
        resolve([fakeModule]);
      }).toThrow('which is not available');
    });
  });

  describe('wire', function() {
    test('should wire module with context containing services', function() {
      var discovered = discover();
      var validated = discovered.map(function(d) { return validate(d); });
      var registered = validated.map(function(d) { return register(d); });
      resolve(registered);

      var first = registered[0];
      var wired = wire(first);

      expect(wired.wired).toBe(true);
      expect(wired.ctx).toBeDefined();
      expect(wired.ctx.db).toBeDefined();
      expect(wired.ctx.cache).toBeDefined();
      expect(wired.ctx.auth).toBeDefined();
      expect(wired.ctx.log).toBeDefined();
      expect(wired.ctx.validate).toBeDefined();
      expect(wired.ctx.events).toBeDefined();
      expect(wired.ctx.module.name).toBe(first.manifest.name);
    });
  });

  describe('unstage', function() {
    test('should cleanly remove a module from all registries', function() {
      var discovered = discover();
      var first = discovered[0];
      var validated = validate(first);
      var registered = register(validated);
      var wired = wire(registered);

      var moduleName = first.manifest.name;

      // Verify it exists
      expect(moduleRegistry.get(moduleName)).not.toBeNull();

      // Unstage
      unstage(wired);

      // Verify removal
      expect(moduleRegistry.get(moduleName)).toBeNull();

      // Routes should be gone
      if (first.manifest.routes) {
        for (var i = 0; i < first.manifest.routes.length; i++) {
          var r = first.manifest.routes[i];
          expect(routeRegistry.exists(r.path, r.method.toUpperCase())).toBe(false);
        }
      }

      // Functions should be gone
      if (first.manifest.functions) {
        for (var j = 0; j < first.manifest.functions.length; j++) {
          expect(functionRegistry.exists(first.manifest.functions[j].name)).toBe(false);
        }
      }

      // Capabilities should be gone
      if (first.manifest.provides) {
        for (var k = 0; k < first.manifest.provides.length; k++) {
          expect(capabilityRegistry.exists(first.manifest.provides[k])).toBe(false);
        }
      }

      // Should be removed from dependency graph
      expect(dependencyGraph.getAllNodes()).not.toContain(moduleName);
    });
  });

  describe('full pipeline (discover → validate → register → resolve → wire → unstage)', function() {
    test('should complete full staging lifecycle for all modules', function() {
      // Stage all modules
      var discovered = discover();
      expect(discovered.length).toBeGreaterThanOrEqual(2);

      var validated = discovered.map(function(d) { return validate(d); });
      expect(validated.length).toBe(discovered.length);

      var registered = validated.map(function(d) { return register(d); });
      expect(registered.length).toBe(discovered.length);

      // Resolve should pass
      resolve(registered);

      var wired = registered.map(function(d) { return wire(d); });
      expect(wired.length).toBe(discovered.length);

      // All modules should have context
      for (var i = 0; i < wired.length; i++) {
        expect(wired[i].ctx).toBeDefined();
        expect(wired[i].ctx.db).toBeDefined();
      }

      // Unstage all in reverse order
      for (var j = wired.length - 1; j >= 0; j--) {
        unstage(wired[j]);
      }

      // All registries should be empty
      expect(moduleRegistry.count()).toBe(0);
      expect(routeRegistry.count()).toBe(0);
      expect(functionRegistry.count()).toBe(0);
      expect(capabilityRegistry.count()).toBe(0);
    });
  });
});