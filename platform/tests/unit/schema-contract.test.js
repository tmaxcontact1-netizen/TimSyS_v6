'use strict';
var helper = require('../helpers/test-server');

describe('canonical schema contract', function() {
  var server;
  afterEach(async function() { if (server) await server.cleanup(); });
  test('is enforced after every fresh migration', async function() {
    server = await helper.createTestServer('schema_contract');
    var contract = require('../../shared/schema-contract');
    expect(contract.verify()).toEqual({ tables: 10, columns: 69 });
  });
});
