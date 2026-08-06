'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('./db');
const log = require('./log');

const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ||
  (process.env.NODE_ENV === 'production'
    ? null
    : 'refresh-secret-change-me-in-production');

const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

if (!REFRESH_TOKEN_SECRET) {
  throw new Error('REFRESH_TOKEN_SECRET must be set in production');
}

function _hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueRefreshToken(userId, sessionId) {
  const payload = {
    userId: userId,
    sessionId: sessionId,
    type: 'refresh',
  };
  const token = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
  
  const tokenHash = _hashToken(token);
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
  
  db.query(
    'INSERT INTO refresh_token (token_hash, user_id, session_id, expires_at) VALUES (?, ?, ?, ?)',
    [tokenHash, userId, sessionId, expiresAt]
  );
  
  return token;
}

function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    const tokenHash = _hashToken(token);
    const result = db.query(
      'SELECT id, user_id, session_id, expires_at, revoked_at FROM refresh_token WHERE token_hash = ?',
      [tokenHash]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Refresh token not found');
    }
    
    const row = result.rows[0];
    if (row.revoked_at) {
      throw new Error('Refresh token has been revoked');
    }
    
    if (Date.now() > row.expires_at) {
      throw new Error('Refresh token has expired');
    }
    
    return {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
    };
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      throw new Error('Invalid or expired refresh token');
    }
    throw err;
  }
}

function revokeRefreshToken(token, reason) {
  const tokenHash = _hashToken(token);
  const result = db.query(
    'SELECT user_id FROM refresh_token WHERE token_hash = ? AND revoked_at IS NULL',
    [tokenHash]
  );
  
  if (result.rows.length > 0) {
    db.query(
      'UPDATE refresh_token SET revoked_at = ? WHERE token_hash = ?',
      [Date.now(), tokenHash]
    );
    log.info('Refresh token revoked', { reason });
  }
}

function revokeAllUserRefreshTokens(userId, reason) {
  db.query(
    'UPDATE refresh_token SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
    [Date.now(), userId]
  );
  log.info('All refresh tokens revoked for user', { userId, reason });
}

function rotateRefreshToken(oldToken) {
  const verified = verifyRefreshToken(oldToken);
  const tokenHash = _hashToken(oldToken);
  
  // Revoke old token FIRST
  db.query(
    'UPDATE refresh_token SET rotated_at = ? WHERE token_hash = ?',
    [Date.now(), tokenHash]
  );
  
  // Issue new token with different secret/expiry to avoid hash collision
  const payload = {
    userId: verified.userId,
    sessionId: verified.sessionId,
    type: 'refresh',
    rot: Date.now() // Add timestamp to ensure unique hash
  };
  const newToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
  
  const newTokenHash = _hashToken(newToken);
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
  
  db.query(
    'INSERT INTO refresh_token (token_hash, user_id, session_id, expires_at) VALUES (?, ?, ?, ?)',
    [newTokenHash, verified.userId, verified.sessionId, expiresAt]
  );
  
  return newToken;
}
function getActiveRefreshTokens(userId) {
  const result = db.query(
    'SELECT id, session_id, created_at, expires_at, revoked_at FROM refresh_token WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC',
    [userId]
  );
  
  return result.rows;
}

module.exports = {
  issueRefreshToken: issueRefreshToken,
  verifyRefreshToken: verifyRefreshToken,
  revokeRefreshToken: revokeRefreshToken,
  revokeAllUserRefreshTokens: revokeAllUserRefreshTokens,
  rotateRefreshToken: rotateRefreshToken,
  getActiveRefreshTokens: getActiveRefreshTokens,
};
