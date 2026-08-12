'use strict';
const { createTestServer } = require('../helpers/test-server.js');

describe('E2E: boot sequence regression', function() {
  var context;
  beforeAll(async function() { context = await createTestServer('boot_sequence'); });
  afterAll(async function() { await context.cleanup(); });

  test('all current modules are registered after boot', function() {
    var registry = require('../../shared/registry/moduleRegistry');
    var names = registry.getAll().map(function(module) { return module.name; });
    expect(names).toEqual(expect.arrayContaining([
      'builder', 'intelligence_center', 'inventory', 'room_registry', 'school_analytics',
      'staff_profile', 'staff_registry', 'student_profile', 'student_registry'
    ]));
    expect(names).toHaveLength(9);
  });

  test('current migrations are durable', function() {
    var db = require('../../shared/services/db');
    var result = db.query('SELECT COUNT(*) AS count FROM schema_migrations');
    expect(Number(result.rows[0].count)).toBeGreaterThanOrEqual(12);
  });
});
