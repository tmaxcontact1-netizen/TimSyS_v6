/**
 * TimSyS Contract: LogService
 * Status: FROZEN v6.0.0
 *
 * Structured JSON logging with audit trail support.
 * Implemented across log.js (logging) and audit.js (immutable audit log).
 */

/**
 * @typedef {Object} LogContext
 * @property {string} [module] - Module name
 * @property {string} [requestId] - Request correlation ID
 * @property {string} [userId] - Acting user ID
 * @property {...*} - Additional contextual fields
 */

/**
 * @typedef {Object} AuditEntry
 * @property {number} timestamp - Unix timestamp
 * @property {string|number} userId
 * @property {string} action - Audit action descriptor
 * @property {Object} meta - Additional metadata
 */

/** @interface LogService */
module.exports = {
  /**
   * Log an informational message.
   * @param {string} msg - Human-readable message
   * @param {LogContext} [ctx] - Structured context
   */
  info(msg, ctx) {},

  /**
   * Log a warning message.
   * @param {string} msg - Human-readable message
   * @param {LogContext} [ctx] - Structured context
   */
  warn(msg, ctx) {},

  /**
   * Log an error message.
   * @param {string} msg - Human-readable message
   * @param {LogContext} [ctx] - Structured context
   */
  error(msg, ctx) {},

  /**
   * Write an immutable audit log entry.
   * Entry is appended to audit_log table and cannot be modified.
   * @param {string} action - What action was performed
   * @param {string|number} userId - Who performed it
   * @param {Object} meta - Additional metadata (entity, old/new values, IP, etc.)
   * @returns {AuditEntry}
   */
  audit(action, userId, meta) {}
};
