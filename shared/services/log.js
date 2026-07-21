'use strict';

const { LogService } = require('../../contracts/log');
const auditWriter = require('./audit');

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[LOG_LEVEL] || LEVELS.info;

/**
 * LogService implementation — structured JSON to stdout.
 */
class LogServiceImpl extends LogService {
  _emit(level, msg, ctx) {
    if (LEVELS[level] < MIN_LEVEL) return;

    const entry = {
      level,
      message: msg,
      timestamp: new Date().toISOString(),
      ...(ctx || {}),
    };

    process.stdout.write(JSON.stringify(entry) + '\n');
  }

  info(msg, ctx) {
    this._emit('info', msg, ctx);
  }

  warn(msg, ctx) {
    this._emit('warn', msg, ctx);
  }

  error(msg, ctx) {
    this._emit('error', msg, ctx);
  }

  audit(action, userId, meta) {
    // Emit to operational log
    this._emit('info', `AUDIT: ${action}`, { action, userId, ...meta });

    // Write to immutable audit table
    auditWriter.write(action, userId, meta);
  }
}

const log = new LogServiceImpl();

module.exports = log;