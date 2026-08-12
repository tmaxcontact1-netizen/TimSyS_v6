#!/usr/bin/env node
'use strict';

const path = require('path');
const http = require('http');

process.chdir(path.join(__dirname, '..'));

const { bootPlatform, shutdownPlatform } = require('../index');
const db = require('../shared/services/db');
const moduleRegistry = require('../shared/registry/moduleRegistry');
const routeRegistry = require('../shared/registry/routeRegistry');
const functionRegistry = require('../shared/registry/functionRegistry');
const componentRegistry = require('../shared/registry/componentRegistry');

const API_PORT = parseInt(process.env.PORT || '3000', 10);

const results = [];
let server = null;

function report(check, passed, message) {
  const status = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`${status} ${check}: ${message}`);
  results.push({ check, passed, message });
}

function makeRequest(method, requestPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: API_PORT,
      path: requestPath,
      method: method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    };
    
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
    req.on('timeout', () => req.destroy());
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSmokeTest() {
  console.log('\n\x1b[36m=== TIMSYS SMOKE TEST ===\x1b[0m\n');
  
  try {
    process.env.PORT = API_PORT.toString();
    process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters';
    process.env.NODE_ENV = 'test';
    process.env.DEV_MODE = '1';
    
    console.log('\x1b[33mBooting platform...\x1b[0m');
    server = await bootPlatform();
    report('Platform Boot', true, 'Server started and listening');
    
    console.log('\n\x1b[33mChecking services initialization...\x1b[0m');
    
    const services = ['db', 'auth', 'cache', 'log', 'events', 'ratelimit', 'metrics'];
    for (const svc of services) {
      try {
        const svcModule = require(`../shared/services/${svc}`);
        const passed = svcModule !== null && svcModule !== undefined &&
                       (typeof svcModule === 'object' || typeof svcModule === 'function');
        report(`Service: ${svc}`, passed, passed ? 'Loaded' : 'No exports');
      } catch (e) {
        report(`Service: ${svc}`, false, `Failed: ${e.message}`);
      }
    }
    
    console.log('\n\x1b[33mChecking module registry...\x1b[0m');
    const modules = moduleRegistry.getAll();
    const expectedModules = ['system_health', 'user_management', 'builder'];
    report('Module Registry', modules.length > 0, `${modules.length} module(s) registered`);
    for (const mod of expectedModules) {
      const found = modules.some(m => m.name === mod);
      report(`Module: ${mod}`, found, found ? 'Registered' : 'Missing');
    }
    
    console.log('\n\x1b[33mChecking route registry...\x1b[0m');
    const routes = routeRegistry.getAll();
    report('Route Registry', routes.length > 0, `${routes.length} route(s) registered`);
    for (const route of routes.slice(0, 5)) {
      try {
        const resp = await makeRequest(route.method === 'GET' ? 'GET' : 'POST', route.path, route.method !== 'GET' ? {} : null);
        const okStatus = resp.status !== 500 && resp.status !== 503;
        report(`Route: ${route.method} ${route.path}`, okStatus, `Status ${resp.status}`);
      } catch (e) {
        report(`Route: ${route.method} ${route.path}`, false, `Error: ${e.message}`);
      }
    }
    if (routes.length > 5) {
      report('Route Registry Summary', true, `+${routes.length - 5} additional routes`);
    }
    
    console.log('\n\x1b[33mChecking function registry...\x1b[0m');
    const functions = functionRegistry.getAll();
    report('Function Registry', functions.length > 0, `${functions.length} function(s) registered`);
    let implCount = 0;
    for (const fn of functions.slice(0, 10)) {
      if (fn.implementation && typeof fn.implementation === 'function') implCount++;
    }
    report('Functions: Implementations', implCount === Math.min(functions.length, 10), `${implCount}/${Math.min(functions.length, 10)} have valid implementations`);
    
    console.log('\n\x1b[33mChecking database schema...\x1b[0m');
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").rows.map(r => r.name);
    const expectedTables = ['users', 'sessions', 'module_registry', 'route_registry', 'function_registry', 'capability_registry', 'schema_registry', 'component_registry', 'module_templates'];
    report('Database Tables', tables.length >= 3, `${tables.length} table(s) found`);
    for (const tbl of expectedTables) {
      const found = tables.includes(tbl);
      report(`Table: ${tbl}`, found, found ? 'Exists' : 'Missing');
    }
    
    console.log('\n\x1b[33mChecking component scanner...\x1b[0m');
    const components = componentRegistry.getAll();
    report('Component Registry', Array.isArray(components), `Contains ${components.length} item(s)`);
    if (components.length > 0) {
      const hasUser = components.some(c => c.name.includes('user') || c.name.includes('staff'));
      report('Scanner: User Components', hasUser, hasUser ? 'Detected' : 'Not detected (may need component.json files)');
    }
    
    console.log('\n\x1b[33mChecking builder subsystem...\x1b[0m');
    try {
      const templatesResp = await makeRequest('GET', '/builder/templates', null);
      report('Builder Templates Endpoint', templatesResp.status === 200, `Status ${templatesResp.status}`);
      
      const componentsResp = await makeRequest('GET', '/builder/components', null);
      report('Builder Components Endpoint', componentsResp.status === 200, `Status ${componentsResp.status}`);
      
      const dashboardResp = await makeRequest('GET', '/builder/dashboard', null);
      report('Builder Dashboard Endpoint', dashboardResp.status === 200, `Status ${dashboardResp.status}`);
    } catch (e) {
      report('Builder Subsystem', false, `Error: ${e.message}`);
    }
    
    console.log('\n\x1b[33mChecking gap analysis integration...\x1b[0m');
    try {
      const gapResp = await makeRequest('GET', '/builder/system_health/analysis', null);
      report('Gap Analysis Endpoint', gapResp.status === 200, `Status ${gapResp.status}`);
    } catch (e) {
      report('Gap Analysis Endpoint', false, `Error: ${e.message}`);
    }
    
  } catch (err) {
    report('Critical', false, `Unhandled error: ${err.message}`);
    console.error('\x1b[31mCRITICAL ERROR:', err.message, '\x1b[0m');
  } finally {
    if (server) {
      try {
        await shutdownPlatform(server);
      } catch (e) {}
    }
  }
  
  console.log('\n\x1b[36m=== SMOKE TEST COMPLETE ===\x1b[0m\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`\x1b[36mSummary:\x1b[0m ${passed}/${total} checks passed`);
  
  if (failed > 0) {
    console.log('\n\x1b[31mFailed checks:\x1b[0m');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.check}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\x1b[32mAll checks passed. Backend operational.\x1b[0m');
    process.exit(0);
  }
}

runSmokeTest().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
