'use strict';

/**
 * @typedef {Object} DBQueryResult
 * @property {Array<Object>} rows - Returned rows (empty for INSERT/UPDATE/DELETE with RETURNING off)
 * @property {number} changes - Number of rows affected
 * @property {number} [lastInsertRowid] - Last insert rowid (if applicable)
 */

/**
 * @typedef {Object} TransactionContext
 * @property {(sql: string, params?: Array<*>) => DBQueryResult} query - Execute SQL within transaction scope
 */

/**
 * DBService Contract — Sync wrapper over better-sqlite3.
 *
 * All database access in the platform goes through this interface.
 * No module shall import better-sqlite3 directly.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class DBService {
  /**
   * Execute a SQL statement with optional parameter binding.
   * @param {string} sql - SQL statement
   * @param {Array<*>} [params] - Bound parameters
   * @returns {DBQueryResult}
   * @throws {Error} On SQL error
   */
  query(sql, params) {
    throw new Error('DBService.query: not implemented');
  }

  /**
   * Execute a function within a database transaction.
   * Commits if fn returns, rolls back if fn throws.
   * @param {(tx: TransactionContext) => *} fn - Receives a scoped query interface
   * @returns {*} Whatever fn returns
   * @throws {Error} Rethrows any error from fn after rollback
   */
  transaction(fn) {
    throw new Error('DBService.transaction: not implemented');
  }

  /**
   * Acquire a connection from the pool for manual multi-statement work.
   * Caller MUST call poolRelease(conn) when done.
   * @returns {Object} Connection handle
   */
  poolAcquire() {
    throw new Error('DBService.poolAcquire: not implemented');
  }

  /**
   * Release a previously acquired connection back to the pool.
   * @param {Object} conn - Connection handle from poolAcquire()
   */
  poolRelease(conn) {
    throw new Error('DBService.poolRelease: not implemented');
  }
}

module.exports = { DBService };