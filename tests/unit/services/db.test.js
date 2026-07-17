'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../../../shared/services/db');
const { runMigrations } = require('../../../shared/migration-runner');

describe('DBService', function() {

  beforeAll(function() {
    // Clean and recreate test database
    var dbPath = path.resolve('./data/test.sqlite');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Remove WAL and SHM files
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

    // Run migrations synchronously
    return runMigrations();
  });

  afterAll(function() {
    // Cleanup
    var dbPath = path.resolve('./data/test.sqlite');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  });

  describe('query', function() {
    test('should execute CREATE TABLE', function() {
      var result = db.query('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, name TEXT)');
      expect(result.changes).toBeDefined();
    });

    test('should execute INSERT and return rowid', function() {
      var result = db.query('INSERT INTO test_table (name) VALUES (?)', ['Alice']);
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeDefined();
    });

    test('should execute SELECT and return rows', function() {
      db.query('INSERT INTO test_table (name) VALUES (?)', ['Bob']);
      var result = db.query('SELECT * FROM test_table WHERE name = ?', ['Bob']);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('Bob');
    });

    test('should execute UPDATE', function() {
      db.query('INSERT INTO test_table (name) VALUES (?)', ['Charlie']);
      db.query('UPDATE test_table SET name = ? WHERE name = ?', ['Charles', 'Charlie']);
      var result = db.query('SELECT * FROM test_table WHERE name = ?', ['Charles']);
      expect(result.rows.length).toBe(1);
    });

    test('should execute DELETE', function() {
      db.query('INSERT INTO test_table (name) VALUES (?)', ['DeleteMe']);
      var result = db.query('DELETE FROM test_table WHERE name = ?', ['DeleteMe']);
      expect(result.changes).toBe(1);
    });

    test('should return empty rows for no results', function() {
      var result = db.query('SELECT * FROM test_table WHERE name = ?', ['NonExistent']);
      expect(result.rows.length).toBe(0);
      expect(result.changes).toBe(0);
    });

    test('should throw on invalid SQL', function() {
      expect(function() {
        db.query('SELECT * FROM nonexistent_table');
      }).toThrow();
    });
  });

  describe('transaction', function() {
    test('should commit on success', function() {
      db.query('CREATE TABLE IF NOT EXISTS tx_test (id INTEGER PRIMARY KEY, val INTEGER)');

      var result = db.transaction(function(tx) {
        tx.query('INSERT INTO tx_test (val) VALUES (?)', [100]);
        tx.query('INSERT INTO tx_test (val) VALUES (?)', [200]);
        return 'committed';
      });

      expect(result).toBe('committed');

      var rows = db.query('SELECT * FROM tx_test ORDER BY val').rows;
      expect(rows.length).toBe(2);
      expect(rows[0].val).toBe(100);
      expect(rows[1].val).toBe(200);
    });

    test('should rollback on error', function() {
      db.query('DELETE FROM tx_test');

      expect(function() {
        db.transaction(function(tx) {
          tx.query('INSERT INTO tx_test (val) VALUES (?)', [1]);
          tx.query('INSERT INTO tx_test (val) VALUES (?)', [2]);
          throw new Error('Force rollback');
        });
      }).toThrow('Force rollback');

      var rows = db.query('SELECT * FROM tx_test').rows;
      expect(rows.length).toBe(0);
    });

    test('should support nested queries within transaction', function() {
      db.query('DELETE FROM tx_test');

      db.transaction(function(tx) {
        tx.query('INSERT INTO tx_test (val) VALUES (?)', [10]);
        var inner = tx.query('SELECT COUNT(*) as count FROM tx_test');
        expect(inner.rows[0].count).toBe(1);
        tx.query('INSERT INTO tx_test (val) VALUES (?)', [20]);
      });

      var rows = db.query('SELECT * FROM tx_test ORDER BY val').rows;
      expect(rows.length).toBe(2);
    });
  });

  describe('poolAcquire/poolRelease', function() {
    test('should acquire and release a connection', function() {
      var conn = db.poolAcquire();
      expect(conn).toBeDefined();
      db.poolRelease(conn);
    });

    test('should support multiple concurrent acquisitions', function() {
      var conn1 = db.poolAcquire();
      var conn2 = db.poolAcquire();
      expect(conn1).toBeDefined();
      expect(conn2).toBeDefined();
      expect(conn1).not.toBe(conn2);
      db.poolRelease(conn1);
      db.poolRelease(conn2);
    });
  });
});