'use strict';

const manifest = require('../../modules/scheduler/module.json');
const { localDateTimeToUtc } = require('../../modules/scheduler');

describe('Scheduler hardening contract', () => {
  test('separates read, configure, integration, approval and publication authority', () => {
    const permission = (method, path) => manifest.routes.find(route => route.method === method && route.path === path).permissions;
    expect(permission('GET', '/scheduler/versions')).toEqual(['admin:scheduler:read']);
    expect(permission('POST', '/scheduler/generate')).toEqual(['admin:scheduler:configure']);
    expect(permission('PUT', '/scheduler/providers/:provider/records')).toEqual(['admin:scheduler:integrate']);
    expect(permission('PUT', '/scheduler/versions/:id/approve')).toEqual(['admin:scheduler:approve']);
    expect(permission('PUT', '/scheduler/versions/:id/publish')).toEqual(['admin:scheduler:publish']);
  });

  test('converts local timetable times through daylight-saving boundaries', () => {
    expect(localDateTimeToUtc(new Date('2036-01-15T12:00:00Z'), '08:00', 'America/New_York').toISOString()).toBe('2036-01-15T13:00:00.000Z');
    expect(localDateTimeToUtc(new Date('2036-07-15T12:00:00Z'), '08:00', 'America/New_York').toISOString()).toBe('2036-07-15T12:00:00.000Z');
    expect(localDateTimeToUtc(new Date('2036-07-15T12:00:00Z'), '08:00', 'Asia/Riyadh').toISOString()).toBe('2036-07-15T05:00:00.000Z');
  });
});
