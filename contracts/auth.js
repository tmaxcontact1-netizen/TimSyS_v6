/**
 * TimSyS Contract: AuthService
 * Status: PENDING FREEZE
 *
 * JWT + session store with immediate revocation support.
 * Modules consume auth exclusively through Context.
 */

/** @interface AuthService */
module.exports = {
  /**
   * Issue a new JWT token for authenticated user.
   * @param {Object} user - User record with id, roles, permissions
   * @returns {{token: string, expiresIn: number}}
   */
  issueToken(user) {},

  /**
   * Verify JWT token validity against signing key + revocation list.
   * Returns decoded payload if valid, throws if expired/revoked.
   * @param {string} token
   * @returns {Object} Decoded payload
   * @throws {Error} If token invalid, expired, or revoked
   */
  verifyToken(token) {},

  /**
   * Immediately invalidate a specific JWT token (adds to revocation list).
   * @param {string} token
   */
  revokeToken(token) {},

  /**
   * Invalidate ALL JWT tokens for a user (security breach, termination).
   * @param {string} userId
   */
  revokeAllUserTokens(userId) {},

  /**
   * Create a new server-side session (sqlite-backed).
   * @param {string} userId
   * @param {Object} payload - Session metadata
   * @returns {string} sessionId
   */
  createSession(userId, payload) {},

  /**
   * Retrieve session data by ID.
   * @param {string} sessId
   * @returns {Object|null} Session record or null if expired/not found
   */
  getSession(sessId) {},

  /**
   * Destroy a specific session (logout from one device).
   * @param {string} sessId
   */
  destroySession(sessId) {},

  /**
   * Destroy ALL sessions for a user (termination, compromise).
   * @param {string} userId
   * @param {string} reason - Audit trail explanation
   */
  destroyUserSessions(userId, reason) {},

  /**
   * List active sessions for a user (audit / "where am I logged in").
   * @param {string} userId
   * @returns {Array<{sessionId, createdAt, lastActivity, payload}>}
   */
  getActiveSessions(userId) {},

  /**
   * Rotate session (destroy old, create new - session fixation defense).
   * @param {string} sessId
   * @returns {string} New sessionId
   */
  rotateSession(sessId) {},

  /**
   * Force logout: revoke all tokens + destroy all sessions + audit entry.
   * @param {string} userId
   * @param {string} reason
   */
  forceLogout(userId, reason) {},

  /**
   * Check if user has required permission.
   * @param {Object} user
   * @param {string} perm - Permission identifier
   * @returns {boolean}
   */
  checkPerm(user, perm) {},

  /**
   * Check if session exists and is active.
   * @param {string} sessId
   * @returns {boolean}
   */
  sessionExists(sessId) {}
};
