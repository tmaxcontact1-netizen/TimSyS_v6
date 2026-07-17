'use strict';

const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');
const { DBService } = require('../../contracts/db');

/**
 * Configuration loaded from environment
 */
const DB_PATH = process.env.DB_PATH || './data/timsys.sqlite';
const POOL_SIZE = parseInt(process.env.DB_POOL_SIZE, 10) || 5;

// Ensure data directory exists
const DB_DIR = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

/**
 * Internal connection pool implementation.
 * SQLite connections are file-based and synchronous.
 * Pool simulates concurrency by round-robin distributing queries across multiple connections.
 */
class ConnectionPool {
  constructor(dbPath, size) {
    this.dbPath = dbPath;
    this.size = size;
    this.connections = [];
    this.acquired = new Set();

    // Initialize all connections on boot
    for (let i = 0; i < size; i++) {
      const conn = new Database(dbPath, {
        readonly: false,
        fileMustExist: false,
      });
      conn.pragma('journal_mode = WAL');
      conn.pragma('foreign_keys = ON');
      this.connections.push(conn);
    }
  }

  acquire() {
    // Round-robin: find first connection not currently acquired
    for (let i = 0; i < this.connections.length; i++) {
      if (!this.acquired.has(this.connections[i])) {
        this.acquired.add(this.connections[i]);
        return this.connections[i];
      }
    }
    // All connections busy
    throw new Error('DB connection pool exhausted');
  }

  release(conn) {
    this.acquired.delete(conn);
  }

  close() {
    for (const conn of this.connections) {
      conn.close();
    }
    this.connections = [];
  }
}

/**
 * Global pool instance — initialized once at boot
 */
let globalPool = null;

/**
 * DBService implementation using better-sqlite3
 */
class DBServiceImpl extends DBService {
  constructor() {
    super();
    if (!globalPool) {
      globalPool = new ConnectionPool(DB_PATH, POOL_SIZE);
    }
  }

  query(sql, params = []) {
    const conn = globalPool.acquire();
    try {
      const stmt = conn.prepare(sql);
      let result;

      if (stmt.reader) {
        // SELECT query
        result = {
          rows: stmt.all(...params),
          changes: 0,
        };
      } else {
        // INSERT/UPDATE/DELETE
        const res = stmt.run(...params);
        result = {
          rows: [],
          changes: res.changes,
          lastInsertRowid: res.lastInsertRowid,
        };

        // Return inserted row for INSERT with RETURNING clause
        if (sql.trim().toUpperCase().startsWith('INSERT') && sql.includes('RETURNING')) {
          const returningStmt = conn.prepare(sql);
          result.rows = returningStmt.all(...params);
        }
      }

      return result;
    } finally {
      globalPool.release(conn);
    }
  }

  transaction(fn) {
    const conn = globalPool.acquire();
    try {
      // Begin transaction
      conn.exec('BEGIN TRANSACTION');

      // Wrap query for transaction scope
      const txQuery = (sql, params = []) => {
        const stmt = conn.prepare(sql);
        if (stmt.reader) {
          return { rows: stmt.all(...params), changes: 0 };
        } else {
          const res = stmt.run(...params);
          return { rows: [], changes: res.changes, lastInsertRowid: res.lastInsertRowid };
        }
      };

      const txCtx = { query: txQuery };

      // Execute user's function
      const result = fn(txCtx);

      // Commit
      conn.exec('COMMIT');
      return result;
    } catch (err) {
      // Rollback on error
      try {
        conn.exec('ROLLBACK');
      } catch (rollbackErr) {
        // Ignore rollback errors after transaction failure
      }
      throw err;
    } finally {
      globalPool.release(conn);
    }
  }

  poolAcquire() {
    return globalPool.acquire();
  }

  poolRelease(conn) {
    globalPool.release(conn);
  }
}

/**
 * Singleton instance exported for use in modules
 */
const db = new DBServiceImpl();

module.exports = db;