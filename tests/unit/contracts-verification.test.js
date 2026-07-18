'use strict';

describe('Contract Verification', function() {
  describe('DB Contract', function() {
    var contract = require('../../contracts/db');
    var impl = require('../../shared/services/db');

    test('query method exists', function() {
      expect(typeof impl.query).toBe('function');
    });

    test('getConnection method exists', function() {
      expect(typeof impl.getConnection).toBe('function');
    });

    test('exec method exists', function() {
      expect(typeof impl.exec).toBe('function');
    });

    test('scalar method exists', function() {
      expect(typeof impl.scalar).toBe('function');
    });

    test('close method exists', function() {
      expect(typeof impl.close).toBe('function');
    });
  });

  describe('Cache Contract', function() {
    var impl = require('../../shared/services/cache');

    test('get method exists', function() {
      expect(typeof impl.get).toBe('function');
    });

    test('set method exists', function() {
      expect(typeof impl.set).toBe('function');
    });

    test('invalidate method exists', function() {
      expect(typeof impl.invalidate).toBe('function');
    });

    test('flush method exists', function() {
      expect(typeof impl.flush).toBe('function');
    });
  });

  describe('Auth Contract', function() {
    var impl = require('../../shared/services/auth');

    test('issueToken method exists', function() {
      expect(typeof impl.issueToken).toBe('function');
    });

    test('verifyToken method exists', function() {
      expect(typeof impl.verifyToken).toBe('function');
    });

    test('revokeToken method exists', function() {
      expect(typeof impl.revokeToken).toBe('function');
    });

    test('createSession method exists', function() {
      expect(typeof impl.createSession).toBe('function');
    });

    test('destroyUserSessions method exists', function() {
      expect(typeof impl.destroyUserSessions).toBe('function');
    });

    test('checkPerm method exists', function() {
      expect(typeof impl.checkPerm).toBe('function');
    });
  });

  describe('Log Contract', function() {
    var impl = require('../../shared/services/log');

    test('info method exists', function() {
      expect(typeof impl.info).toBe('function');
    });

    test('error method exists', function() {
      expect(typeof impl.error).toBe('function');
    });

    test('warn method exists', function() {
      expect(typeof impl.warn).toBe('function');
    });

    test('audit method exists', function() {
      expect(typeof impl.audit).toBe('function');
    });
  });

  describe('Validate Contract', function() {
    var impl = require('../../shared/services/validate');

    test('validate method exists', function() {
      expect(typeof impl.validate).toBe('function');
    });

    test('sanitize method exists', function() {
      expect(typeof impl.sanitize).toBe('function');
    });
  });

  describe('Events Contract', function() {
    var impl = require('../../shared/services/events');

    test('subscribe method exists', function() {
      expect(typeof impl.subscribe).toBe('function');
    });

    test('publish method exists', function() {
      expect(typeof impl.publish).toBe('function');
    });

    test('request method exists', function() {
      expect(typeof impl.request).toBe('function');
    });
  });

  describe('Intelligence Contract', function() {
    var impl = require('../../shared/services/intelligence');

    test('suggestMetadata method exists', function() {
      expect(typeof impl.suggestMetadata).toBe('function');
    });

    test('getMetadata method exists', function() {
      expect(typeof impl.getMetadata).toBe('function');
    });

    test('storeMetadata method exists', function() {
      expect(typeof impl.storeMetadata).toBe('function');
    });

    test('synthesize method exists', function() {
      expect(typeof impl.synthesize).toBe('function');
    });

    test('getInsights method exists', function() {
      expect(typeof impl.getInsights).toBe('function');
    });

    test('evaluateLogic method exists', function() {
      expect(typeof impl.evaluateLogic).toBe('function');
    });

    test('registerRule method exists', function() {
      expect(typeof impl.registerRule).toBe('function');
    });

    test('deleteRule method exists', function() {
      expect(typeof impl.deleteRule).toBe('function');
    });
  });
});
