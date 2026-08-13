'use strict';

const helper = require('../../helpers/test-server');

describe('registry import and lifecycle workflows', function() {
  let context;
  let token;

  beforeAll(async function() {
    context = await helper.createTestServer('registry_workflows');
    token = (await context.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
  });
  afterAll(async function() { await context.cleanup(); });

  test.each([
    ['students', '/api/students/import', '/students', 'Student ID,First Name,Last Name,Date of Birth,Sex\n,Incomplete,,,\n', 'students'],
    ['staff', '/api/staff/import', '/staff', 'Staff ID,First Name,Last Name,Hire Date\n,Incomplete,,\n', 'staff'],
    ['rooms', '/api/rooms/import', '/rooms', 'Room Number,Capacity\n,not-a-number\n', 'rooms'],
    ['inventory', '/api/inventory/import', '/inventory', 'Item Number,Item Name,Quantity\n,,not-a-number\n', 'items'],
  ])('retains imperfect %s rows and reports warnings', async function(_name, importPath, listPath, csv, collection) {
    const imported = await context.makeRequest('POST', importPath, { csv }, token);
    expect(imported.status).toBe(200);
    expect(imported.data.inserted).toBe(1);
    expect(imported.data.skipped).toBe(0);
    expect(imported.data.warnings.length).toBeGreaterThan(0);
    const listed = await context.makeRequest('GET', listPath, null, token);
    expect(listed.data[collection]).toHaveLength(1);
    if (_name === 'students') {
      const db = require('../../../shared/services/db');
      expect(db.query("SELECT data_quality FROM world_entities WHERE entity_type = 'student'").rows[0].data_quality).toBeLessThan(1);
    }
  });

  test('paginates large registries at a hard maximum of 50 and searches across pages', async function() {
    const rows = Array.from({ length: 51 }, (_, index) =>
      `S-${String(index + 1).padStart(3, '0')},Student${index + 1},Pagination,2010-01-01,Male`
    );
    const csv = ['Student ID,First Name,Last Name,Date of Birth,Sex', ...rows].join('\n');
    const imported = await context.makeRequest('POST', '/api/students/import', { csv }, token);
    expect(imported.status).toBe(200);

    const first = await context.makeRequest('GET', '/students?page=1&limit=500', null, token);
    expect(first.data.students).toHaveLength(50);
    expect(first.data.limit).toBe(50);
    expect(first.data.total).toBe(52);

    const second = await context.makeRequest('GET', '/students?page=2&limit=50', null, token);
    expect(second.data.students).toHaveLength(2);
    expect(second.data.page).toBe(2);

    const searched = await context.makeRequest('GET', '/students?page=1&limit=50&q=Student51', null, token);
    expect(searched.data.total).toBe(1);
    expect(searched.data.students[0].student_id).toBe('S-051');
  });

  test('withdraws and reinstates with explicit user decisions', async function() {
    const student = (await context.makeRequest('GET', '/students', null, token)).data.students[0];
    const withdrawn = await context.makeRequest('PUT', `/students/${student.id}/withdraw`, { reasonCode: 'profile_incomplete', note: 'Confirmed in workflow test' }, token);
    expect(withdrawn.status).toBe(200);
    const reinstated = await context.makeRequest('PUT', `/students/${student.id}/reinstate`, { reason: 'Record reviewed' }, token);
    expect(reinstated.status).toBe(200);
  });

  test.each([
    ['student', '/students', 'students'],
    ['staff member', '/staff', 'staff'],
    ['room', '/rooms', 'rooms'],
    ['inventory item', '/inventory', 'items'],
  ])('withdraws and permanently deletes a %s', async function(_label, path, collection) {
    const record = (await context.makeRequest('GET', path, null, token)).data[collection][0];
    const withdrawn = await context.makeRequest('PUT', `${path}/${record.id}/withdraw`, {
      reasonCode: 'profile_incomplete',
      note: 'Confirmed for deletion in workflow test',
    }, token);
    expect(withdrawn.status).toBe(200);
    const deleted = await context.makeRequest('DELETE', `${path}/${record.id}/permanent`, {
      reason: 'Permanent deletion confirmed by the user',
    }, token);
    expect(deleted.status).toBe(200);
    const remaining = await context.makeRequest('GET', path, null, token);
    expect(remaining.data[collection].some(item => item.id === record.id)).toBe(false);
  });
});
