'use strict';

/**
 * @typedef {Object} LogContext
 * @property {string} [requestId]
 * @property {string} [moduleId]
 * @property {string} [userId]
 * @property {string} [action]
 * @property {*} [extra] - Arbitrary additional context
 */

/**
 * LogService Contract — Structured JSON logs.
 *
 * Every log entry is a JSON object written to stdout (or configured transport).
 * Fields: level, message, timestamp (ISO8601), and flattened context.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class LogService {
  /**
   * Log at INFO level.
   * @param {string} msg - Human-readable message
   * @param {LogContext} [ctx] - Structured context
   */
  info(msg, ctx) {
    throw new Error('LogService.info: not implemented');
  }

  /**
   * Log at WARN level.
   * @param {string} msg
   * @param {LogContext} [ctx]
   */
  warn(msg, ctx) {
    throw new Error('LogService.warn: not implemented');
  }

  /**
   * Log at ERROR level.
   * @param {string} msg
   * @param {LogContext} [ctx]
   */
  error(msg, ctx) {
    throw new Error('LogService.error: not implemented');
  }

  /**
   * Write an audit entry. Audit logs are immutable append-only records
   * separate from operational logs. Stored in audit_log table.
   * @param {string} action - What happened (e.g., "user.create", "module.stage")
   * @param {string} userId - Who did it
   * @param {Object} [meta] - Additional metadata (entity, old/new values, ip, etc.)
   */
  audit(action, userId, meta) {
    throw new Error('LogService.audit: not implemented');
  }
}

module.exports = { LogService };