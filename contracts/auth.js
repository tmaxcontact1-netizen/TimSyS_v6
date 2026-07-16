/**
 * TimSyS Contract: AuthService
 * Status: FROZEN v6.0.0
 *
 * JWT + session store authentication.
 * Token management delegated to SessionService for persistence.
 */

/**
 * @typedef {Object} User
 * @property {string|number} id - User identifier
 * @property {string[]} permissions - Granted permission strings
 */

/**
 * @typedef {Object} TokenPayload
 * @property {string|number} userId
 * @property {string[]} permissions
 * @property {number} issuedAt - Unix timestamp
 * @property {number} expiresAt - Unix timestamp
 */

/** @interface AuthService */
module.exports = {
  /**
   * Verify a JWT token and return decoded payload.
   * @param {string} token - JWT token string
   * @returns {TokenPayload}
   * @throws {Error} If token is invalid, expired, or malformed
   */
  verifyToken(token) {},

  /**
   * Issue a new JWT token for a user.
   * Creates a session record in the session store.
   * @param {User} user
   * @returns {{token: string, sessionId: string, expiresIn: number}}
   */
  issueToken(user) {},

  /**
   * Check if a user has a specific permission.
   * @param {User} user
   * @param {string} perm - Permission string (e.g., "admin:read")
   * @returns {boolean}
   */
  checkPerm(user, perm) {},

  /**
   * Check if a session exists and is active.
   * @param {string} sessId - Session identifier
   * @returns {boolean}
   */
  sessionExists(sessId) {}
};
