'use strict';

const fs = require('fs');
const path = require('path');

const moduleDir = path.join(__dirname, '..', '..', 'modules', 'student_exits');
const component = require(path.join(moduleDir, 'component.json'));
const manifest = require(path.join(moduleDir, 'module.json'));
const migration = fs.readFileSync(path.join(moduleDir, 'migrations', '001_student_exits_foundation.sql'), 'utf8');

describe('student exits phase 1 foundation', () => {
  test('defines one component boundary and three movement modes', () => {
    expect(component.name).toBe('student_exits');
    expect(component.type).toBe('operational_component');
    expect(manifest.status).not.toBe('draft');
    for (const mode of ['routine', 'destination_handoff', 'campus_release']) {
      expect(migration).toContain(`'${mode}'`);
    }
  });

  test('defines the canonical states and immutable transition storage', () => {
    for (const state of ['requested', 'approved', 'checked_out', 'received', 'returned', 'checked_in', 'closed', 'cancelled', 'denied', 'escalated']) {
      expect(migration).toContain(`'${state}'`);
    }
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS student_exit_transitions/i);
  });

  test('is additive and preserves legacy medical referrals', () => {
    expect(migration).not.toMatch(/\b(?:ALTER|DROP|DELETE|UPDATE)\s+(?:TABLE\s+)?medical_referrals\b/i);
    expect(migration).not.toMatch(/INSERT\s+INTO\s+student_exits[\s\S]+FROM\s+medical_referrals/i);
    expect(migration).toMatch(/student_exit_legacy_links/);
  });
});
