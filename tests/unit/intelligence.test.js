'use strict';
const metadataService = require('../../shared/services/intelligence/metadata');
const logicService = require('../../shared/services/intelligence/logic');

describe('Intelligence Service: Metadata', function() {
  test('suggest returns tags for student with email', async function() {
    var data = { email: 'student@school.edu', grade_level: 10 };
    var result = await metadataService.suggest('student', 'test-1', data);
    
    expect(result.tags).toContain('contact_email');
    expect(result.classifications).toContain('learner');
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('suggest detects at-risk student', async function() {
    var data = { email: 'x@y.com', gpa: 1.5, attendance_rate: 0.65 };
    var result = await metadataService.suggest('student', 'test-2', data);
    
    expect(result.classifications).toContain('at_risk');
  });

  test('suggest returns empty for invalid data', async function() {
    var result = await metadataService.suggest('student', 'test-3', null);
    expect(result.tags).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});

describe('Intelligence Service: Logic', function() {
  test('module exports functions', function() {
    expect(typeof logicService._matchesConditions).toBe('function');
    expect(typeof logicService._getFieldValue).toBe('function');
    expect(typeof logicService.evaluate).toBe('function');
  });

  test('equality operator works via direct module call', function() {
    expect(logicService._matchesConditions({ status: 'active' }, { status: 'active' })).toBe(true);
    expect(logicService._matchesConditions({ status: 'active' }, { status: 'inactive' })).toBe(false);
  });

  test('comparison operators work', function() {
    expect(logicService._matchesConditions({ gpa: { operator: '<', value: 2.0 } }, { gpa: 1.5 })).toBe(true);
    expect(logicService._matchesConditions({ gpa: { operator: '>', value: 3.0 } }, { gpa: 3.5 })).toBe(true);
  });

  test('nested field access with dot notation', function() {
    expect(logicService._matchesConditions({ 'profile.status': 'active' }, { profile: { status: 'active' } })).toBe(true);
  });
});
