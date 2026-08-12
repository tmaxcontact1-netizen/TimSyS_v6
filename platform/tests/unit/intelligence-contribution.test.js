'use strict';
var contract = require('../../shared/contracts/intelligenceContribution');

describe('component intelligence contribution contract', function() {
  var valid = { version: 1, entities: [{ type: 'student', source: { table: 'students', idField: 'id' }, displayFields: ['first_name'], statusField: 'enrollment_status', events: [{ channel: 'student.created', kind: 'created' }], dataQuality: [{ field: 'first_name', expectation: 'required' }] }] };
  test('accepts a complete declarative contribution', function() { expect(contract.validate(valid, 'students').valid).toBe(true); });
  test('rejects unknown lifecycle event semantics', function() { var bad = JSON.parse(JSON.stringify(valid)); bad.entities[0].events[0].kind = 'maybe_changed'; expect(contract.validate(bad, 'bad').errors).toContain('intelligence.entities[0].events[0].kind is invalid'); });
  test('rejects a contribution with no traceable source', function() { var bad = JSON.parse(JSON.stringify(valid)); delete bad.entities[0].source; expect(contract.validate(bad, 'bad').valid).toBe(false); });
  test('rejects duplicate event declarations', function() { var bad = JSON.parse(JSON.stringify(valid)); bad.entities[0].events.push({ channel: 'student.created', kind: 'updated' }); expect(contract.validate(bad, 'bad').valid).toBe(false); });
});
