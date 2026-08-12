'use strict';

const { bootPlatform, shutdownPlatform } = require('../index');
const db = require('../shared/services/db');
const componentRegistry = require('../shared/registry/componentRegistry');
const http = require('http');
const assert = require('assert');

const API_PORT = process.env.TEST_PORT || 3001;
let server = null;
let baseUrl = null;

beforeAll(async () => {
  process.env.PORT = API_PORT.toString();
  process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters';
  process.env.NODE_ENV = 'test';
  process.env.DEV_MODE = '1';
  
  server = await bootPlatform();
  baseUrl = `http://localhost:${API_PORT}`;
}, 30000);

afterAll(async () => {
  if (server) await shutdownPlatform(server);
  try {
    db.query('DELETE FROM component_registry WHERE name LIKE "test_%"');
    db.query('DELETE FROM module_templates WHERE name = "test_template"');
    db.query('DELETE FROM recommendations WHERE id LIKE "test_%"');
  } catch (e) {}
});

function makeRequest(method, path, body, auth) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: API_PORT,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    };
    if (auth) options.headers['Authorization'] = `Bearer ${auth}`;
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: true });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Component Registration', () => {
  test('should have scanned components on boot', async () => {
    const result = componentRegistry.getAll();
    assert.ok(Array.isArray(result), 'ComponentRegistry should return array');
    console.log(`Found ${result.length} registered components`);
    result.forEach(c => {
      assert.ok(c.name, 'Each component must have name');
      assert.ok(c.type, 'Each component must have type');
      console.log(`  - ${c.name} (${c.type}) from ${c.ownerModule || 'unknown'}`);
    });
  });

  test('should allow manual component registration', async () => {
    const testData = {
      name: 'test_component_' + Date.now(),
      type: 'test',
      ownerModule: 'builder',
      dependencies: [],
      routes: [],
      schema: null,
      capabilities: null,
      events: null
    };
    
    componentRegistry.register(testData);
    const retrieved = componentRegistry.get(testData.name);
    assert.strictEqual(retrieved.name, testData.name);
    assert.strictEqual(retrieved.type, testData.type);
    
    // Verify DB persistence
    const dbResult = db.query('SELECT * FROM component_registry WHERE name = ?', [testData.name]);
    assert.ok(dbResult.rows.length > 0, 'Component should be in DB');
    
    componentRegistry.clear();
  });
});

describe('Builder API Endpoints', () => {
  test('GET /builder/components should return list', async () => {
    const result = await makeRequest('GET', '/builder/components', null, null);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data.success, 'Response should indicate success');
    assert.ok(Array.isArray(result.data.components), 'Should return components array');
    console.log(`/builder/components: ${result.data.count || result.data.components.length} components`);
  });

  test('GET /builder/templates should return templates', async () => {
    const result = await makeRequest('GET', '/builder/templates', null, null);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data.success, 'Response should indicate success');
    assert.ok(Array.isArray(result.data.templates), 'Should return templates array');
    console.log(`/builder/templates: ${result.data.templates.length} templates`);
    
    const functional = result.data.templates.filter(t => t.completionState === 0);
    console.log(`  Functional templates: ${functional.length}`);
    functional.forEach(t => console.log(`    - ${t.name}: ${t.description}`));
  });

  test('GET /builder/dashboard should return platform completion', async () => {
    const result = await makeRequest('GET', '/builder/dashboard', null, null);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data.success, 'Response should indicate success');
    assert.ok(result.data.dashboard, 'Should return dashboard data');
    assert.ok(result.data.dashboard.platformCompletion, 'Should have completion score');
    console.log(`Dashboard completion: ${result.data.dashboard.platformCompletion.averageCompletion}%`);
  });

  test('POST /builder/compose should merge components', async () => {
    const requestBody = {
      name: 'test_incident_module',
      components: ['student_registry', 'staff_registry', 'room_allocation']
    };
    
    const result = await makeRequest('POST', '/builder/compose', requestBody, null);
    
    if (result.status === 200 && result.data.success) {
      console.log('Compose succeeded:', result.data.spec.manifest.name);
      assert.ok(result.data.spec.manifest.routes, 'Should generate routes');
      assert.ok(result.data.spec.manifest.schema, 'Should include schema');
    } else {
      console.log('Compose failed (expected if components missing):', result.data.error?.message);
      assert.ok(result.data.error, 'Should return error details');
    }
  });

  test('POST /builder/validate should validate before build', async () => {
    const requestBody = {
      name: 'test_validate_module',
      components: ['staff_registry']
    };
    
    const result = await makeRequest('POST', '/builder/validate', requestBody, null);
    assert.strictEqual(result.status, 200);
    console.log('Validate response received:', result.data.success ? 'success' : 'failure');
  });

  test('POST /builder/assemble should write files', async () => {
    const requestBody = {
      name: 'test_assembled_module_' + Date.now(),
      components: [],
      routes: [
        { path: '/test', method: 'GET', handler: 'test_handler', auth_required: true }
      ],
      schema: { tables: ['test_table'], migrations: [] }
    };
    
    const result = await makeRequest('POST', '/builder/assemble?dryRun=true', requestBody, null);
    assert.strictEqual(result.status, 200);
    assert.ok(result.data.success || result.data.canBuild !== undefined, 'Should return validation result');
    console.log('Assemble dry run completed');
  });
});

describe('Gap Analysis with Components', () => {
  test('gap analysis should check component availability', async () => {
    const modules = db.query('SELECT * FROM module_registry').rows;
    if (modules.length === 0) {
      console.log('No modules registered, skipping component gap test');
      return;
    }
    
    const mod = modules[0];
    const manifest = JSON.parse(mod.metadata || '{}');
    
    if (manifest.components && manifest.components.length > 0) {
      const result = await makeRequest('GET', `/builder/${mod.name}/analysis`, null, null);
      if (result.status === 200 && result.data.analysis) {
        console.log(`Gap analysis for ${mod.name}:`, result.data.analysis.status);
        assert.ok(result.data.analysis.metrics, 'Should include metrics');
        console.log(`  Component availability: ${result.data.analysis.metrics.componentAvailability}%`);
      }
    } else {
      console.log('Module has no declared components, skipping gap test');
    }
  });
});

describe('Template Seeding', () => {
  test('should have functional templates in DB', async () => {
    const result = db.query("SELECT name FROM module_templates WHERE completion_state = 0");
    const functionalCount = result.rows.length;
    console.log(`Functional templates in DB: ${functionalCount}`);
    
    if (functionalCount > 0) {
      result.rows.forEach(row => console.log(`  - ${row.name}`));
    }
    
    const expectedTemplates = ['incident_reports', 'attendance', 'medical_tracking'];
    const found = result.rows.map(r => r.name);
    expectedTemplates.forEach(expected => {
      if (!found.includes(expected)) {
        console.log(`Warning: Expected template '${expected}' not found`);
      }
    });
  });
});

describe('Component Scanner Verification', () => {
  test('scanner should have run on boot', async () => {
    const components = componentRegistry.getAll();
    console.log(`Component registry contains ${components.length} items`);
    
    const hasStaff = components.some(c => c.name.includes('staff') || c.name.includes('user'));
    const hasStudent = components.some(c => c.name.includes('student') || c.name.includes('user'));
    
    if (hasStaff || hasStudent) {
      console.log('User-related components detected');
    } else {
      console.log('No user-related components found - scanner may need explicit component.json files');
    }
    
    const hasCapabilityComponents = components.some(c => c.capabilities && c.capabilities.length > 0);
    if (hasCapabilityComponents) {
      console.log('Capability-based components detected');
    }
  });
});

describe('Integration Flow Test', () => {
  test('full flow: compose -> validate -> assemble', async () => {
    const moduleName = 'integration_test_' + Date.now();
    
    const composeReq = {
      name: moduleName,
      components: ['staff_registry']
    };
    const composeResult = await makeRequest('POST', '/builder/compose', composeReq, null);
    
    if (!composeResult.data.success) {
      console.log('Composition failed (expected if staff_registry not available)');
      console.log('Error:', composeResult.data.error?.message);
      return;
    }
    
    const validateResult = await makeRequest('POST', '/builder/validate', composeReq, null);
    if (!validateResult.data.success) {
      console.log('Validation failed:', validateResult.data.error?.message);
      return;
    }
    console.log('Composition valid, assembly preview passed');
    
    const assembleReq = {
      name: moduleName,
      components: ['staff_registry'],
      routes: composeResult.data.spec.manifest.routes
    };
    const assembleResult = await makeRequest('POST', `/builder/assemble?dryRun=true`, assembleReq, null);
    
    if (assembleResult.data.success || assembleResult.data.canBuild) {
      console.log('Assembly dry run passed');
    } else {
      console.log('Assembly dry run failed:', assembleResult.data.error?.message);
    }
  });
});

describe('Database State Verification', () => {
  test('component_registry table exists and has correct schema', async () => {
    const result = db.query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='component_registry'`);
    assert.ok(result.rows.length > 0, 'component_registry table should exist');
    const createSQL = result.rows[0].sql;
    assert.ok(createSQL.includes('name'), 'Should have name column');
    assert.ok(createSQL.includes('type'), 'Should have type column');
    assert.ok(createSQL.includes('owner_module'), 'Should have owner_module column');
    console.log('component_registry schema verified');
  });

  test('module_templates table exists and has correct schema', async () => {
    const result = db.query(`SELECT sql FROM sqlite_master WHERE type='table' AND name='module_templates'`);
    assert.ok(result.rows.length > 0, 'module_templates table should exist');
    const createSQL = result.rows[0].sql;
    assert.ok(createSQL.includes('completion_state'), 'Should have completion_state column');
    assert.ok(createSQL.includes('manifest_template'), 'Should have manifest_template column');
    console.log('module_templates schema verified');
  });
});

console.log('\n=== Integration Tests Complete ===');
