'use strict';
const { createTestServer, adminLogin } = require('../../helpers/test-server');

var server, makeRequest;

beforeAll(async function() {
  var instance = await createTestServer('pwd_prompt');
  server = instance;
  makeRequest = instance.makeRequest;
}, 30000);

afterAll(function() { return server.cleanup(); });

describe('Password change prompt for new users', function() {
  var adminTok = null;

  beforeAll(async function() {
    var r = await adminLogin(makeRequest);
    adminTok = r.data.token;
  });

  test('new user has mustChangePassword flag', async function() {
    var r = await makeRequest('POST', '/api/users', {
      username: 'newuser_' + Date.now(),
      email: 'newuser@test.com',
      password: 'TestPass123!',
      permissions: ['user:read']
    }, adminTok);
    expect(r.status).toBe(200);

    var loginR = await makeRequest('POST', '/api/auth/login', {
      username: r.data.user.username,
      password: 'TestPass123!'
    });
    expect(loginR.status).toBe(200);
    expect(loginR.data.mustChangePassword).toBe(true);
  });

  test('can change password', async function() {
    var username = 'chguser_' + Date.now();
    var r = await makeRequest('POST', '/api/users', {
      username: username,
      email: 'chguser@test.com',
      password: 'TestPass123!',
      permissions: ['user:read']
    }, adminTok);
    expect(r.status).toBe(200);

    var loginR = await makeRequest('POST', '/api/auth/login', {
      username: username,
      password: 'TestPass123!'
    });
    expect(loginR.status).toBe(200);

    var changeR = await makeRequest('POST', '/api/users/' + r.data.user.id + '/change-password', {
      newPassword: 'NewSecurePass456!'
    }, loginR.data.token);
    expect(changeR.status).toBe(200);

    var reloginR = await makeRequest('POST', '/api/auth/login', {
      username: username,
      password: 'NewSecurePass456!'
    });
    expect(reloginR.status).toBe(200);
    expect(reloginR.data.mustChangePassword).toBe(false);
  });
});
