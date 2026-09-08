'use strict';

const protocol = require('../../shared/contracts/applicationProtocol');

describe('TimSyS application protocol', function() {
  test('accepts a conforming component health projection', function() {
    expect(protocol.validateHealth({
      protocol: protocol.PROTOCOL,
      application: 'dressed',
      status: 'healthy',
      observedAt: '2026-09-05T00:00:00.000Z',
      components: [{ id: 'database', status: 'healthy' }],
    }, 'dressed').application).toBe('dressed');
  });

  test('rejects identity and protocol drift', function() {
    expect(function() { protocol.validateHealth({ protocol: 'other', application: 'dressed', status: 'healthy', observedAt: '2026-09-05T00:00:00.000Z', components: [] }, 'dressed'); }).toThrow('Unsupported application protocol');
    expect(function() { protocol.validateHealth({ protocol: protocol.PROTOCOL, application: 'other', status: 'healthy', observedAt: '2026-09-05T00:00:00.000Z', components: [] }, 'dressed'); }).toThrow('mismatch');
  });
});
