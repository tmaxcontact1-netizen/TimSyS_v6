'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const sdk = require('./index.cjs');

test('state machines are deterministic and reject invalid transitions', function() {
  const machine = sdk.createStateMachine({ open: ['closed'], closed: [] });
  assert.equal(machine.transition('open', 'closed'), 'closed');
  assert.throws(function() { machine.transition('closed', 'open'); }, sdk.InvalidTransitionError);
});

test('retry delay is bounded exponential backoff', function() {
  const policy = { baseDelayMs: 1000, maximumDelayMs: 5000 };
  assert.deepEqual([1, 2, 3, 4].map(function(attempt) { return sdk.retryDelay(attempt, policy); }), [1000, 2000, 4000, 5000]);
});

test('health projections identify their protocol', function() {
  const health = sdk.createApplicationHealth({ application: 'test', status: 'healthy', observedAt: '2026-09-05T00:00:00.000Z', components: [] });
  assert.equal(health.protocol, sdk.APPLICATION_PROTOCOL);
});

test('redaction recursively removes credential-shaped fields', function() {
  assert.deepEqual(sdk.redact({ token: 'secret', nested: { password: 'secret', safe: 'visible' } }), {
    token: '[REDACTED]', nested: { password: '[REDACTED]', safe: 'visible' },
  });
});

test('bounded transport enforces origins and response limits', async function() {
  const transport = new sdk.BoundedJsonHttpTransport({
    allowedOrigins: new Set(['https://provider.example']),
    maximumResponseBytes: 16,
    fetch: async function() { return new Response('{"ok":true}', { status: 200 }); },
  });
  assert.equal((await transport.get('https://provider.example/health')).body.ok, true);
  await assert.rejects(transport.get('https://other.example/health'), /allowlisted/);
  const oversized = new sdk.BoundedJsonHttpTransport({
    allowedOrigins: new Set(['https://provider.example']), maximumResponseBytes: 2,
    fetch: async function() { return new Response('{"ok":true}', { status: 200 }); },
  });
  await assert.rejects(oversized.get('https://provider.example/health'), /size limit/);
});
