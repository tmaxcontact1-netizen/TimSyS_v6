'use strict';

/**
 * @typedef {Object} TokenPayload
 * @property {string} userId
 * @property {string[]} [permissions]
 * @property {number} [iat] - Issued at (unix seconds)
 * @property {number} [exp] - Expiry (unix seconds)
 */

/**
 * @typedef {Object} Session
 * @property {string} sessionId
 * @property {string} userId
 * @property {Object} payload
 * @property {number} createdAt - Unix ms
 * @property {number} expiresAt - Unix ms
 */

/**
 * AuthService Contract — JWT + session store + revocation.
 *
 * All token issuance, verification, revocation, and session lifecycle
 * flows through this interface. Revocation is permanent and immediate.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class AuthService {
  /**
   * Issue a signed JWT for a user.
   * @param {Object} user - Must contain at minimum { id, permissions }
   * @returns {string} Signed JWT string
   */
  issueToken(user) {
    throw new Error('AuthService.issueToken: not implemented');
  }

  /**
   * Verify a JWT signature and check revocation list.
   * @param {string} token - JWT string
   * @returns {TokenPayload} Decoded and verified payload
   * @throws {Error} If token is invalid, expired, or revoked
   */
  verifyToken(token) {
    throw new Error('AuthService.verifyToken: not implemented');
  }

  /**
   * Revoke a single token permanently.
   * @param {string} token - JWT string
   * @param {string} [reason] - Optional reason for audit
   */
  revokeToken(token, reason) {
    throw new Error('AuthService.revokeToken: not implemented');
  }

  /**
   * Revoke all tokens issued to a user.
   * Does NOT destroy sessions — call destroyUserSessions for full logout.
   * @param {string} userId
   * @param {string} [reason]
   */
  revokeAllUserTokens(userId, reason) {
    throw new Error('AuthService.revokeAllUserTokens: not implemented');
  }

  /**
   * Create a new session for a user.
   * @param {string} userId
   * @param {Object} payload - Arbitrary session data
   * @returns {Session}
   */
  createSession(userId, payload) {
    throw new Error('AuthService.createSession: not implemented');
  }

  /**
   * Retrieve a session by ID.
   * @param {string} sessionId
   * @returns {Session|null}
   */
  getSession(sessionId) {
    throw new Error('AuthService.getSession: not implemented');
  }

  /**
   * Destroy a single session.
   * @param {string} sessionId
   */
  destroySession(sessionId) {
    throw new Error('AuthService.destroySession: not implemented');
  }

  /**
   * Destroy all sessions for a user.
   * @param {string} userId
   * @param {string} [reason]
   * @returns {number} Count of destroyed sessions
   */
  destroyUserSessions(userId, reason) {
    throw new Error('AuthService.destroyUserSessions: not implemented');
  }

  /**
   * List all active (non-expired) sessions for a user.
   * @param {string} userId
   * @returns {Session[]}
   */
  getActiveSessions(userId) {
    throw new Error('AuthService.getActiveSessions: not implemented');
  }

  /**
   * Rotate a session: create a new one, transfer payload, destroy the old.
   * @param {string} sessionId
   * @returns {Session} New session
   */
  rotateSession(sessionId) {
    throw new Error('AuthService.rotateSession: not implemented');
  }

  /**
   * Force full logout: destroy all sessions + revoke all tokens.
   * @param {string} userId
   * @param {string} [reason]
   */
  forceLogout(userId, reason) {
    throw new Error('AuthService.forceLogout: not implemented');
  }

  /**
   * Check if a user possesses a specific permission.
   * @param {Object} user - Must contain permissions or a way to resolve them
   * @param {string} perm - Permission identifier (e.g., "admin:staging:write")
   * @returns {boolean}
   */
  checkPerm(user, perm) {
    throw new Error('AuthService.checkPerm: not implemented');
  }
}

module.exports = { AuthService };