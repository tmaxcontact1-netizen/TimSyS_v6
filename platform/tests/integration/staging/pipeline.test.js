'use strict';

const fs = require('fs');
const path = require('path');

var DB_PATH = path.resolve(__dirname, 'test_pipeline.sqlite');
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
      expect(discovered.length).toBeGreaterThanOrEqual(8);
      var names = discovered.map(function(d) { return d.name; });
      expect(names).toContain('builder');
      expect(names).toContain('student_registry');
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
  });

  describe('register', function() {
    test('should register module in all registries', function() {
      var discovered = discover();
      var first = discovered[0];
      var validated = validate(first);
      var registered = register(validated);
      expect(registered.registered).toBe(true);
      expect(moduleRegistry.get(first.manifest.name)).not.toBeNull();
    });
  });

  describe('resolve', function() {
    test('should resolve dependencies for real modules', function() {
      var discovered = discover();
      var validated = discovered.map(function(d) { return validate(d); });
      var registered = validated.map(function(d) { return register(d); });
      expect(function() { resolve(registered); }).not.toThrow();
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
      expect(wired.ctx.auth).toBeDefined();
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
      expect(moduleRegistry.get(moduleName)).not.toBeNull();
      unstage(wired);
      expect(moduleRegistry.get(moduleName)).toBeNull();
    });
  });

  describe('full pipeline (discover → validate → register → resolve → wire → unstage)', function() {
    test('should complete full staging lifecycle for all modules', function() {
      var discovered = discover();
      var validated = discovered.map(function(d) { return validate(d); });
      var registered = validated.map(function(d) { return register(d); });
      resolve(registered);
      var wired = registered.map(function(d) { return wire(d); });
      for (var i = 0; i < wired.length; i++) {
        expect(wired[i].ctx).toBeDefined();
        expect(wired[i].ctx.db).toBeDefined();
      }
      for (var j = wired.length - 1; j >= 0; j--) {
        unstage(wired[j]);
      }
      expect(moduleRegistry.count()).toBe(0);
    });
  });
});
