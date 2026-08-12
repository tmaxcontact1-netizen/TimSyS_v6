'use strict';
var helper = require('../helpers/test-server');
var Database = require('better-sqlite3');

describe('profile schema consistency', function() {
  var server;
  afterEach(async function() { if (server) await server.cleanup(); });

  test('fresh schema supports extended profiles and the canonical insight lifecycle', async function() {
    server = await helper.createTestServer('profile_schema_consistency');
    var login = await server.makeRequest('POST', '/api/auth/dev-login', {});
    var token = login.data.token;
    var created = await server.makeRequest('POST', '/students', {
      student_id: 'PROFILE-1', first_name: 'Schema', last_name: 'Test',
      date_of_birth: '2012-01-01', sex: 'Female'
    }, token);
    expect(created.status).toBe(200);
    var id = created.data.student.id;

    var updated = await server.makeRequest('PUT', '/students/' + id + '/profile/extended', {
      interests: { reading: true }, strengths: { collaboration: true }, goals: { attendance: 'improve' }
    }, token);
    expect(updated.status).toBe(200);

    var generated = await server.makeRequest('POST', '/students/' + id + '/profile/insights/generate', {}, token);
    expect(generated.status).toBe(200);
    var profile = await server.makeRequest('GET', '/students/' + id + '/profile', null, token);
    expect(profile.status).toBe(200);
    expect(profile.data.profile.extended.interests.reading).toBe(true);
    expect(profile.data.profile.deep_insights.some(function(i) { return i.id === generated.data.insightId; })).toBe(true);

    var db = new Database(server.dbPath, { readonly: true });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='staff_profile_extended'").get()).toBeTruthy();
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='role_hierarchy'").get()).toBeTruthy();
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='intelligence_insights'").get()).toBeUndefined();
    expect(db.prepare('SELECT provider_id FROM insight_products WHERE id=?').get(generated.data.insightId).provider_id).toBe('core.student-profile');
    expect(db.prepare('SELECT action FROM insight_actions WHERE insight_id=?').get(generated.data.insightId).action).toBe('presented');
    db.close();
  });
});
