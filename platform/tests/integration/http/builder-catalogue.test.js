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
    expect(apps.map(function(app) { return app.id; })).toEqual(['principal-ed', 'competeed', 'sanctifyed']);
    const principal = apps[0];
    expect(principal.essentialServices.map(function(service) { return service.name; })).toEqual(['db', 'cache', 'auth', 'log', 'validate', 'events']);
    expect(principal.modules.length).toBeGreaterThan(0);
    expect(principal.modules.find(function(mod) { return mod.name === 'student_profile'; }).components[0].intelligence).toBeTruthy();
    expect(apps[1].modules.map(function(mod) { return mod.name; }).sort()).toEqual(['inventory', 'room_registry']);
    expect(apps[2].modules.map(function(mod) { return mod.name; }).sort()).toEqual(['inventory', 'room_registry']);
  });

  test('registered modules retain their complete manifests', function() {
    const registry = require('../../../shared/registry/moduleRegistry');
    const studentProfile = registry.get('student_profile');
    expect(studentProfile.routes.length).toBeGreaterThan(0);
    expect(studentProfile.functions.length).toBeGreaterThan(0);
    expect(studentProfile.capabilitiesRequired).toContain('capability:staff.read'.replace('staff', 'student'));
  });

  test('places and stuff are isolated by application', async function() {
    await context.makeRequest('POST', '/rooms', { room_number: 'COMPETE-PLACE', capacity: 20, app_id: 'competeed' }, token);
    await context.makeRequest('POST', '/inventory', { item_number: 'SANCTIFY-STUFF', item_name: 'Safety kit', quantity: 2, app_id: 'sanctifyed' }, token);
    const competePlaces = await context.makeRequest('GET', '/rooms?app_id=competeed', null, token);
    const sanctifyPlaces = await context.makeRequest('GET', '/rooms?app_id=sanctifyed', null, token);
    const competeStuff = await context.makeRequest('GET', '/inventory?app_id=competeed', null, token);
    const sanctifyStuff = await context.makeRequest('GET', '/inventory?app_id=sanctifyed', null, token);
    expect(competePlaces.data.rooms.map(function(room) { return room.room_number; })).toContain('COMPETE-PLACE');
    expect(sanctifyPlaces.data.rooms).toEqual([]);
    expect(competeStuff.data.items).toEqual([]);
    expect(sanctifyStuff.data.items.map(function(item) { return item.item_number; })).toContain('SANCTIFY-STUFF');

    const competeRoom = competePlaces.data.rooms[0];
    const hiddenRead = await context.makeRequest('GET', '/rooms/' + competeRoom.id + '?app_id=sanctifyed', null, token);
    const hiddenUpdate = await context.makeRequest('PUT', '/rooms/' + competeRoom.id, { app_id: 'sanctifyed', notes: 'cross-scope' }, token);
    const hiddenDelete = await context.makeRequest('DELETE', '/rooms/' + competeRoom.id + '/permanent?app_id=sanctifyed', { reason: 'cross-scope' }, token);
    expect(hiddenRead.status).toBe(404);
    expect(hiddenUpdate.status).toBe(404);
    expect(hiddenDelete.status).toBe(404);

    const invalidScope = await context.makeRequest('GET', '/inventory?app_id=unknown-app', null, token);
    expect(invalidScope.status).toBe(400);
    expect(invalidScope.data.error.code).toBe('INVALID_APP_SCOPE');
  });

  test('baseline modules are required and cannot be removed', async function() {
    const catalogue = await context.makeRequest('GET', '/builder/catalogue', null, token);
    const compete = catalogue.data.data.apps.find(function(app) { return app.id === 'competeed'; });
    expect(compete.modules.every(function(mod) { return mod.required && !mod.removable; })).toBe(true);

    const moduleRemoval = await context.makeRequest('DELETE', '/modules/unassign?appId=competeed&moduleName=inventory', {}, token);
    const componentRemoval = await context.makeRequest('DELETE', '/components/unassign?appId=competeed&componentName=inventory', {}, token);
    expect(moduleRemoval.status).toBe(409);
    expect(moduleRemoval.data.error.code).toBe('REQUIRED_BASELINE');
    expect(componentRemoval.status).toBe(409);
  });
});
