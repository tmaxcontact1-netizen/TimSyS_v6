'use strict';

const helper = require('../../helpers/test-server');

describe('builder application catalogue', function() {
  let context;
  let token;

  beforeAll(async function() {
    context = await helper.createTestServer('builder_catalogue');
    token = (await context.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
  });
  afterAll(async function() { if (context) await context.cleanup(); });

  test('returns app-scoped manifests, dependencies and essential services', async function() {
    const response = await context.makeRequest('GET', '/builder/catalogue', null, token);
    expect(response.status).toBe(200);
    expect(response.data.data.excludedApplications).toEqual(['memecoined']);
    expect(response.data.data.profileAccess).toEqual(['superuser', 'principal']);

    const apps = response.data.data.apps;
    expect(apps.map(function(app) { return app.id; })).toEqual(['principal-ed']);
    const principal = apps[0];
    expect(principal.essentialServices.map(function(service) { return service.name; })).toEqual(['db', 'cache', 'auth', 'log', 'validate', 'events']);
    expect(principal.modules.length).toBeGreaterThan(0);
    expect(principal.modules.map(function(mod) { return mod.name; })).toEqual(expect.arrayContaining(['gradebook','scheduler','teacher_preferences','cover','programme_manager']));
    const principalAssignments = await context.makeRequest('GET', '/modules/list-for-app?appId=principal-ed', null, token);
    const enabledPrincipal = principalAssignments.data.data.filter(function(mod) { return mod.enabled; }).map(function(mod) { return mod.name; });
    expect(enabledPrincipal).toEqual(expect.arrayContaining(['gradebook','scheduler','teacher_preferences','cover','programme_manager']));
    expect(principal.modules.find(function(mod) { return mod.name === 'student_profile'; }).components[0].intelligence).toBeTruthy();
  });

  test('registered modules retain their complete manifests', function() {
    const registry = require('../../../shared/registry/moduleRegistry');
    const studentProfile = registry.get('student_profile');
    expect(studentProfile.routes.length).toBeGreaterThan(0);
    expect(studentProfile.functions.length).toBeGreaterThan(0);
    expect(studentProfile.capabilitiesRequired).toContain('capability:staff.read'.replace('staff', 'student'));
  });

  test('rejects retired and unknown application scopes', async function() {
    const invalidScope = await context.makeRequest('GET', '/inventory?app_id=unknown-app', null, token);
    expect(invalidScope.status).toBe(400);
    expect(invalidScope.data.error.code).toBe('INVALID_APP_SCOPE');
  });

  test('only certified components are exposed and assignments include dependencies', async function() {
    const catalogue = await context.makeRequest('GET', '/builder/catalogue', null, token);
    const components = catalogue.data.data.apps.flatMap(function(app) { return app.modules.flatMap(function(mod) { return mod.components; }); });
    expect(components.length).toBeGreaterThan(0);
    expect(components.every(function(component) { return component.certification.status === 'certified'; })).toBe(true);
    expect(components.every(function(component) { return component.parts.every(function(part) { return typeof part === 'string'; }); })).toBe(true);
    const assigned = await context.makeRequest('POST', '/components/assign', { appId:'principal-ed', componentName:'venue_bookings' }, token);
    expect(assigned.status).toBe(200);
    expect(assigned.data.data.dependenciesAdded).toContain('room_manifest');
    const appComponents = await context.makeRequest('GET', '/components/list-for-app?appId=principal-ed', null, token);
    expect(appComponents.data.data.find(function(component) { return component.name === 'venue_bookings'; }).enabled).toBe(true);
    expect(appComponents.data.data.find(function(component) { return component.name === 'room_manifest'; }).enabled).toBe(true);
  });
});
