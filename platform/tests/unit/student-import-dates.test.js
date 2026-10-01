'use strict';
const { importStudents } = require('../../modules/student_registry');

async function run(dob) {
  const writes = [];
  const ctx = { db: { query(sql, values) {
    if (sql.startsWith('INSERT')) { writes.push(values); return { lastInsertRowid: 1 }; }
    return { rows: sql.includes('WHERE id =') ? [{ id: 1 }] : [] };
  } }, events: { publish: jest.fn() } };
  const result = await importStudents({ body: { csv: `student_id,first_name,last_name,date_of_birth,sex\nTEST,A,B,${dob},Female\n` }, user: { id: 'test' } }, ctx);
  return { result, writes, ctx };
}

test.each(['not-a-date', '2025-02-29', '2024-02-30', '2024-13-01', '01/02/2024'])('invalid DOB %s cannot persist or emit a creation event', async dob => {
  const { result, writes, ctx } = await run(dob);
  expect(result).toMatchObject({ inserted: 0, skipped: 1, errors: [{ row: 2, reason: expect.stringContaining('Invalid date_of_birth') }] });
  expect(writes).toHaveLength(0);
  expect(ctx.events.publish).not.toHaveBeenCalled();
});
test('valid leap day persists unchanged', async () => {
  const { result, writes } = await run('2024-02-29');
  expect(result).toMatchObject({ inserted: 1, skipped: 0, errors: [] });
  expect(writes[0][3]).toBe('2024-02-29');
});
test('blank DOB stays blank and receives the existing review warning', async () => {
  const { result, writes } = await run('');
  expect(result.inserted).toBe(1);
  expect(result.warnings).toContainEqual(expect.objectContaining({ reason: 'Missing date_of_birth' }));
  expect(writes[0][3]).toBe('');
});
