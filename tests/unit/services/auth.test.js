'use strict';

const fs = require('fs');
const path = require('path');
const auth = require('../../../shared/services/auth');
const db = require('../../../shared/services/db');
const { runMigrations } = require('../../../shared/migration-runner');

describe('AuthService', function() {

  beforeAll(function() {
    var dbPath = path.resolve('./data/test.sqlite');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

    return runMigrations();
  });

  afterAll(function() {
    var dbPath = path.resolve('./data/test.sqlite');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  });

  beforeEach(function() {
    db.query('DELETE FROM token_revocation');
    db.query('DELETE FROM sessions');
  });

  describe('issueToken / verifyToken', function() {
    test('should issue and verify a valid token', function() {
      var token = auth.issueToken({ id: 'user1', permissions: ['read'] });
      expect(typeof token).toBe('string');

      var payload = auth.verifyToken(token);
      expect(payload.userId).toBe('user1');
      expect(payload.permissions).toEqual(['read']);
    });

    test('should reject a tampered token', function() {
      var token = auth.issueToken({ id: 'user1', permissions: ['read'] });
      var tampered = token.slice(0, -5) + 'XXXXX';
      expect(function() {
        auth.verifyToken(tampered);
      }).toThrow();
    });

    test('should reject a revoked token', function() {
      var token = auth.issueToken({ id: 'user2', permissions: ['read'] });
      auth.revokeToken(token, 'test-revocation');
      expect(function() {
        auth.verifyToken(token);
      }).toThrow('revoked');
    });

    test('should reject all tokens for a user after revokeAllUserTokens', function() {
      var token1 = auth.issueToken({ id: 'user3', permissions: ['read'] });
      var token2 = auth.issueToken({ id: 'user3', permissions: ['read'] });

      auth.revokeAllUserTokens('user3', 'security-incident');

      expect(function() { auth.verifyToken(token1); }).toThrow('revoked');
      expect(function() { auth.verifyToken(token2); }).toThrow('revoked');
    });
  });

  describe('sessions', function() {
    test('should create and retrieve a session', function() {
      var session = auth.createSession('user10', { role: 'teacher' });
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user10');

      var retrieved = auth.getSession(session.sessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.userId).toBe('user10');
      expect(retrieved.payload.role).toBe('teacher');
    });

    test('should destroy a session', function() {
      var session = auth.createSession('user11', {});
      auth.destroySession(session.sessionId);
      expect(auth.getSession(session.sessionId)).toBeNull();
    });

    test('should destroy all sessions for a user', function() {
      auth.createSession('user12', {});
      auth.createSession('user12', {});
      auth.createSession('user12', {});

      var count = auth.destroyUserSessions('user12');
      expect(count).toBeGreaterThan(0);
      expect(auth.getActiveSessions('user12').length).toBe(0);
    });

    test('should rotate a session', function() {
      var original = auth.createSession('user13', { data: 'important' });
      var rotated = auth.rotateSession(original.sessionId);

      expect(rotated.sessionId).not.toBe(original.sessionId);
      expect(rotated.userId).toBe('user13');
      expect(rotated.payload.data).toBe('important');
      expect(auth.getSession(original.sessionId)).toBeNull();
      expect(auth.getSession(rotated.sessionId)).not.toBeNull();
    });

    test('should list active sessions for a user', function() {
      auth.createSession('user14', {});
      auth.createSession('user14', {});
      auth.createSession('user14', {});

      var sessions = auth.getActiveSessions('user14');
      expect(sessions.length).toBe(3);
    });
  });

  describe('forceLogout', function() {
    test('should revoke all tokens and destroy all sessions', function() {
      var token = auth.issueToken({ id: 'user15', permissions: ['read'] });
      auth.createSession('user15', {});
      auth.createSession('user15', {});

      auth.forceLogout('user15', 'forced-logout-test');

      expect(function() { auth.verifyToken(token); }).toThrow('revoked');
      expect(auth.getActiveSessions('user15').length).toBe(0);
    });
  });

  describe('checkPerm', function() {
    test('should grant exact permission match', function() {
      expect(auth.checkPerm({ permissions: ['admin:users:read'] }, 'admin:users:read')).toBe(true);
    });

    test('should deny unmatched permission', function() {
      expect(auth.checkPerm({ permissions: ['admin:users:read'] }, 'admin:users:write')).toBe(false);
    });

    test('should grant with wildcard prefix (admin:*)', function() {
      expect(auth.checkPerm({ permissions: ['admin:*'] }, 'admin:users:read')).toBe(true);
      expect(auth.checkPerm({ permissions: ['admin:*'] }, 'admin:users:write')).toBe(true);
      expect(auth.checkPerm({ permissions: ['admin:*'] }, 'admin:anything')).toBe(true);
    });

    test('should grant with full wildcard (*)', function() {
      expect(auth.checkPerm({ permissions: ['*'] }, 'anything')).toBe(true);
    });

    test('should deny when no permissions', function() {
      expect(auth.checkPerm({}, 'admin:users:read')).toBe(false);
      expect(auth.checkPerm(null, 'admin:users:read')).toBe(false);
      expect(auth.checkPerm({ permissions: [] }, 'admin:users:read')).toBe(false);
    });

    test('should not grant partial wildcard match', function() {
      expect(auth.checkPerm({ permissions: ['admin:users:*'] }, 'admin:sessions:read')).toBe(false);
    });
  });
});