const test = require('node:test');
const assert = require('node:assert/strict');
const { connectionUrl } = require('./local-postgres-manager.cjs');

test('database URLs encode credentials and bind to loopback', () => {
  const result = connectionUrl('runtime', 'unsafe:/ password', 54321);
  assert.equal(result, 'postgresql://runtime:unsafe%3A%2F%20password@127.0.0.1:54321/memecoined');
});
