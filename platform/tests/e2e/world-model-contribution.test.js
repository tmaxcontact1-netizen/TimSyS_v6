'use strict';
var helper = require('../helpers/test-server');
var Database = require('better-sqlite3');

describe('declarative component contribution to shared world model', function() {
  var testServer;
  afterEach(async function() { if (testServer) await testServer.cleanup(); });

  test('a registry record becomes a canonical entity without module-specific engine code', async function() {
    testServer = await helper.createTestServer('world_model_contribution');
    var login = await testServer.makeRequest('POST', '/api/auth/dev-login', {});
    expect(login.status).toBe(200);
    var created = await testServer.makeRequest('POST', '/students', { student_id: 'CONTRACT-1', first_name: 'Ada', last_name: 'Test', date_of_birth: '2012-01-01', sex: 'Female' }, login.data.token);
    expect(created.status).toBe(200);
    var database = new Database(testServer.dbPath, { readonly: true });
    var entity = database.prepare("SELECT * FROM world_entities WHERE entity_type='student' AND entity_id=?").get(String(created.data.student.id));
    var event = database.prepare("SELECT * FROM event_store WHERE channel='student.created' AND entity_id=?").get(String(created.data.student.id));
    database.close();
    expect(entity.display_name).toBe('Ada Test');
    expect(entity.data_quality).toBe(1);
    expect(event.module).toBe('student_registry');
    expect(event.actor_id).toBeTruthy();
  });
});
