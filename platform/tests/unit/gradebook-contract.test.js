'use strict';

const contract = require('../../contracts/gradebook');

describe('Gradebook foundation contract', function() {
  const group = {
    external_key: 'scheduler:group-42',
    academic_year_id: '2026-27',
    subject_id: 'visual-art',
    name: 'Grade 9 Art',
    kind: 'academic',
    status: 'active'
  };

  test('creates a stable gradebook identity from the teaching group rather than a lesson', function() {
    expect(contract.gradebookIdentity(group)).toBe('2026-27:scheduler:group-42:visual-art');
  });

  test('supports every agreed teaching group kind', function() {
    expect(contract.TEACHING_GROUP_KINDS).toEqual(expect.arrayContaining(['academic', 'homeroom', 'advisory', 'club', 'support']));
  });

  test('keeps evidence states distinct', function() {
    expect(new Set(contract.EVIDENCE_STATES).size).toBe(contract.EVIDENCE_STATES.length);
    expect(contract.EVIDENCE_STATES).toEqual(expect.arrayContaining(['missing', 'incomplete', 'exempt', 'absent', 'not_assessed', 'invalid']));
  });

  test('validates scheduler-compatible idempotent events', function() {
    expect(contract.validateTeachingGroupEvent('teaching_group.created', {
      event_id: 'event-1',
      occurred_at: '2026-08-13T00:00:00.000Z',
      source: 'scheduler',
      teaching_group_external_key: group.external_key,
      teaching_group: group
    })).toBeTruthy();
  });

  test('rejects an event without an idempotency key', function() {
    expect(function() {
      contract.validateTeachingGroupEvent('teaching_group.student_enrolled', {
        occurred_at: '2026-08-13T00:00:00.000Z', source: 'scheduler', teaching_group_external_key: group.external_key
      });
    }).toThrow('event_id is required');
  });

  test('resolves customised reporting periods in the agreed order', function() {
    expect(contract.resolveReportingPeriodConfiguration({school: 'school', programme: 'programme', course: 'art', gradebook: 'short-course'})).toBe('short-course');
    expect(contract.resolveReportingPeriodConfiguration({school: 'school', programme: 'programme', course: 'art'})).toBe('art');
    expect(contract.resolveReportingPeriodConfiguration({school: 'school', programme: 'programme'})).toBe('programme');
    expect(contract.resolveReportingPeriodConfiguration({school: 'school'})).toBe('school');
  });
});
