'use strict';

const fs = require('fs');
const path = require('path');

var DB_PATH = path.resolve(__dirname, 'test_auth.sqlite');
process.env.DB_PATH = DB_PATH;

beforeAll(function() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');

  var { runMigrations } = require('../../../shared/migration-runner');
  return runMigrations();
});

afterAll(function() {
  db.close();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
});

const db = require('../../../shared/services/db');
const auth = require('../../../shared/services/auth');

describe('AuthService', function() {

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
      expect(function() { auth.verifyToken(tampered); }).toThrow();
    });

    test('should reject a revoked token', function() {
      var token = auth.issueToken({ id: 'user2', permissions: ['read'] });
      auth.revokeToken(token, 'test-revocation');
      expect(function() { auth.verifyToken(token); }).toThrow('revoked');
    });

    test('should reject all tokens for a user after revokeAllUserTokens', function() {
      var token1 = auth.issueToken({ id: 'user3', permissions: ['read'] });
      var token2 = auth.issueToken({ id: 'user3', permissions: ['read'] });
      auth.revokeAllUserTokens('user3', 'security-incident');
      expect(function() { auth.verifyToken(token1); }).toThrow('revoked');
      expect(function() { auth.verifyToken(token2); }).toThrow('revoked');
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
    });

    test('should grant with full wildcard (*)', function() {
      expect(auth.checkPerm({ permissions: ['*'] }, 'anything')).toBe(true);
    });

    test('should deny when no permissions', function() {
      expect(auth.checkPerm({}, 'admin:users:read')).toBe(false);
      expect(auth.checkPerm(null, 'admin:users:read')).toBe(false);
    });
  });
});