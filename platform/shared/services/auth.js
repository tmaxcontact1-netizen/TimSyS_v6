'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { AuthService } = require('../../contracts/auth');
const db = require('./db');
const sessionStore = require('./session');
const refresh = require('./refresh');

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? null
    : 'dev-secret-change-me');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

class AuthServiceImpl extends AuthService {
  _hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  issueToken(user, sessionId) {
    var payload = {
      userId: user.id,
      permissions: user.permissions || [],
      sessionId: sessionId,
      mustChangePassword: user.mustChangePassword || false,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  }

  issueRefreshToken(userId, sessionId) {
    return refresh.issueRefreshToken(userId, sessionId);
  }

  verifyToken(token) {
    var decoded = jwt.verify(token, JWT_SECRET);
    var tokenHash = this._hashToken(token);
    var userId = decoded.userId;

    var result = db.query(
      'SELECT 1 FROM token_revocation WHERE token_hash = ? OR (token_hash = ? AND user_id = ?) LIMIT 1',
      [tokenHash, '*', userId]
    );

    if (result.rows.length > 0) {
      throw new Error('Token has been revoked');
    }

    return decoded;
  }

  verifyRefreshToken(token) {
    return refresh.verifyRefreshToken(token);
  }

  revokeToken(token, reason) {
    var tokenHash = this._hashToken(token);
    var userId = null;

    try {
      var decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch (e) {
    }

    db.query(
      'INSERT INTO token_revocation (token_hash, revoked_at, user_id, reason) VALUES (?, ?, ?, ?)',
      [tokenHash, Date.now(), userId, reason || null]
    );
  }

  rotateRefreshToken(token) {
    return refresh.rotateRefreshToken(token);
  }

  revokeRefreshToken(token, reason) {
    return refresh.revokeRefreshToken(token, reason);
  }

  revokeAllUserTokens(userId, reason) {
    db.query(
      'INSERT INTO token_revocation (token_hash, revoked_at, user_id, reason) VALUES (?, ?, ?, ?)',
      ['*', Date.now(), userId, reason || null]
    );
  }

  revokeAllUserRefreshTokens(userId, reason) {
    return refresh.revokeAllUserRefreshTokens(userId, reason);
  }

  createSession(userId, payload) {
    return sessionStore.create(userId, payload);
  }

  getSession(sessionId) {
    return sessionStore.get(sessionId);
  }

  destroySession(sessionId) {
    sessionStore.destroy(sessionId);
  }

  destroyUserSessions(userId, reason) {
    return sessionStore.destroyByUser(userId);
  }

  getActiveSessions(userId) {
    return sessionStore.listActiveByUser(userId);
  }

  rotateSession(sessionId) {
    return sessionStore.rotate(sessionId);
  }

  forceLogout(userId, reason) {
    this.revokeAllUserTokens(userId, reason);
    sessionStore.destroyByUser(userId);
    this.revokeAllUserRefreshTokens(userId, reason);
  }

  checkPerm(user, perm) {
    if (!user || !user.permissions) return false;
    if (user.permissions.indexOf(perm) !== -1) return true;

    for (var i = 0; i < user.permissions.length; i++) {
      var p = user.permissions[i];
      if (p === '*') return true;
      if (p.endsWith(':*')) {
        var prefix = p.slice(0, -1);
        if (perm.indexOf(prefix) === 0) return true;
      }
    }

    return false;
  }
}

var auth = new AuthServiceImpl();

module.exports = auth;
