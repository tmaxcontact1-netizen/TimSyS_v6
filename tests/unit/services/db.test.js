'use strict';

const fs = require('fs');
const path = require('path');

var DB_PATH = path.resolve('./data/test_db.sqlite');
process.env.DB_PATH = DB_PATH;

beforeAll(function() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');

  var { runMigrations } = require('../../../shared/migration-runner');
  return runMigrations();
});

afterAll(function() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
});

const db = require('../../../shared/services/db');

describe('DBService', function() {

  beforeAll(function() {
    db.query('CREATE TABLE IF NOT EXISTS crud_test (id INTEGER PRIMARY KEY, name TEXT)');
    db.query('CREATE TABLE IF NOT EXISTS tx_test (id INTEGER PRIMARY KEY, val INTEGER)');
  });

  beforeEach(function() {
    db.query('DELETE FROM crud_test');
    db.query('DELETE FROM tx_test');
  });

  describe('query', function() {
    test('should execute CREATE TABLE', function() {
      var result = db.query('CREATE TABLE IF NOT EXISTS create_test (id INTEGER PRIMARY KEY)');
      expect(result.changes).toBeDefined();
    });

    test('should execute INSERT and return rowid', function() {
      var result = db.query('INSERT INTO crud_test (name) VALUES (?)', ['Alice']);
      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeDefined();
    });

    test('should execute SELECT and return rows', function() {
      db.query('INSERT INTO crud_test (name) VALUES (?)', ['Bob']);
      var result = db.query('SELECT * FROM crud_test WHERE name = ?', ['Bob']);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].name).toBe('Bob');
    });

    test('should execute UPDATE', function() {
      db.query('INSERT INTO crud_test (name) VALUES (?)', ['Charlie']);
      db.query('UPDATE crud_test SET name = ? WHERE name = ?', ['Charles', 'Charlie']);
      var result = db.query('SELECT * FROM crud_test WHERE name = ?', ['Charles']);
      expect(result.rows.length).toBe(1);
    });

    test('should execute DELETE', function() {
      db.query('INSERT INTO crud_test (name) VALUES (?)', ['DeleteMe']);
      var result = db.query('DELETE FROM crud_test WHERE name = ?', ['DeleteMe']);
      expect(result.changes).toBe(1);
    });

    test('should return empty rows for no results', function() {
      var result = db.query('SELECT * FROM crud_test WHERE name = ?', ['NonExistent']);
      expect(result.rows.length).toBe(0);
      expect(result.changes).toBe(0);
    });
  });

  describe('transaction', function() {
    test('should commit on success', function() {
      var result = db.transaction(function(tx) {
        tx.query('INSERT INTO tx_test (val) VALUES (?)', [100]);
        tx.query('INSERT INTO tx_test (val) VALUES (?)', [200]);
        return 'committed';
      });
      expect(result).toBe('committed');
      var rows = db.query('SELECT * FROM tx_test ORDER BY val').rows;
      expect(rows.length).toBe(2);
    });

    test('should rollback on error', function() {
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
  });

  describe('poolAcquire/poolRelease', function() {
    test('should acquire and release a connection', function() {
      var conn = db.poolAcquire();
      expect(conn).toBeDefined();
      db.poolRelease(conn);
    });
  });
});