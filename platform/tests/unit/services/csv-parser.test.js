'use strict';

const csv = require('../../../shared/services/csv_parser');

describe('CSV parser', () => {
  test('handles BOM, reordered alias headings, quoted commas and CRLF', () => {
    const parsed = csv.parse(Buffer.from('\uFEFFSurname,Student ID,First Name,Notes\r\nHaddad,STU-1,Amina,"Strong, steady progress"\r\n'));
    const result = csv.mapRows(parsed.rows, {
      surname: 'last_name', studentid: 'student_id', firstname: 'first_name', notes: 'notes'
    })[0];
    expect(result.mapped).toEqual({ last_name: 'Haddad', student_id: 'STU-1', first_name: 'Amina', notes: 'Strong, steady progress' });
  });

  test('preserves unsupported headings for reporting instead of silently mapping them', () => {
    const parsed = csv.parse(Buffer.from('Student ID,Comment\nSTU-1,unsupported alias\n'));
    const result = csv.mapRows(parsed.rows, { studentid: 'student_id' })[0];
    expect(result.mapped.student_id).toBe('STU-1');
    expect(result.unmapped.Comment).toBe('unsupported alias');
  });

  test('prepares incomplete rows for retention with review metadata', () => {
    const prepared = csv.prepareImportedRow({ mapped: { first_name: 'Amina' }, unmapped: { Mystery: 'value' } }, {
      rowNumber: 4, entity: 'student', identifier: 'student_id', required: ['student_id', 'first_name', 'last_name']
    });
    expect(prepared.row.student_id).toMatch(/^IMPORT-STUDENT-/);
    expect(prepared.row.last_name).toBe('');
    expect(prepared.customFields.csv_import.warnings.length).toBeGreaterThan(0);
  });
});
