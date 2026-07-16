/**
 * TimSyS Contract: DBService
 * Status: FROZEN v6.0.0
 *
 * Sync wrapper over better-sqlite3.
 * Modules consume database access exclusively through this interface via Context.
 */

/**
 * @typedef {Object} DBConnection
 * @description A pooled database connection. Must be released via poolRelease().
 */

/**
 * @typedef {Object} QueryResult
 * @property {Array<Object>} rows - Returned rows (empty for non-SELECT)
 * @property {number} changes - Number of rows affected
 * @property {number} lastInsertRowid - Last inserted row ID
 */

/** @interface DBService */
module.exports = {
  /**
   * Execute a SQL query with parameter binding.
   * @param {string} sql - SQL statement with ? placeholders
   * @param {...*} params - Positional parameters
   * @returns {QueryResult}
   * @throws {Error} On SQL syntax error or constraint violation
   */
  query(sql, ...params) {},

  /**
   * Execute a function within a database transaction.
   * Commits if fn returns successfully, rolls back on throw.
   * @param {Function} fn - Receives a scoped DBService-like object
   * @returns {*} Whatever fn returns
   * @throws {Error} Rethrows any error from fn after rollback
   */
  transaction(fn) {},

  /**
   * Acquire a connection from the pool for manual multi-statement operations.
   * Caller is responsible for releasing via poolRelease().
   * @returns {DBConnection}
   */
  poolAcquire() {},

  /**
   * Release a previously acquired connection back to the pool.
   * @param {DBConnection} conn
   * @throws {Error} If conn was not acquired from this pool
   */
  poolRelease(conn) {}
};
