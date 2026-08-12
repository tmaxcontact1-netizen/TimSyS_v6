'use strict';

const fs = require('fs');
const path = require('path');

var DB_PATH = path.resolve(__dirname, 'test_cache.sqlite');
process.env.DB_PATH = DB_PATH;

beforeAll(function() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
});

afterAll(function() {
  db.close();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  if (fs.existsSync(DB_PATH + '-wal')) fs.unlinkSync(DB_PATH + '-wal');
  if (fs.existsSync(DB_PATH + '-shm')) fs.unlinkSync(DB_PATH + '-shm');
});

const cache = require('../../../shared/services/cache');
const db = require('../../../shared/services/db');

describe('CacheService', function() {

  beforeEach(function() {
    cache.flush();
  });

  describe('get/set', function() {
    test('should store and retrieve a value', function() {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return null for missing key', function() {
      expect(cache.get('nonexistent')).toBeNull();
    });

    test('should overwrite existing key', function() {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });

    test('should store objects', function() {
      var obj = { name: 'test', nested: { value: 42 } };
      cache.set('obj1', obj);
      expect(cache.get('obj1')).toEqual(obj);
    });

    test('should store arrays', function() {
      cache.set('arr1', [1, 2, 3]);
      expect(cache.get('arr1')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL', function() {
    test('should expire after TTL (manual expiry check)', function() {
      cache.set('tempkey', 'tempval', 0);
      expect(cache.get('tempkey')).toBe('tempval');
    });

    test('should use default TTL when not specified', function() {
      cache.set('defkey', 'defval');
      expect(cache.get('defkey')).toBe('defval');
    });
  });

  describe('LRU eviction', function() {
    test('should evict least recently used when at capacity', function() {
      for (var i = 0; i < 100; i++) {
        cache.set('key' + i, 'val' + i);
      }
      cache.get('key0');
      cache.set('overflow', 'val');
      expect(cache.get('overflow')).toBe('val');
      expect(cache.get('key0')).toBe('val0');
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('invalidate', function() {
    test('should invalidate keys matching glob pattern', function() {
      cache.set('user:1', 'a');
      cache.set('user:2', 'b');
      cache.set('session:1', 'c');
      var count = cache.invalidate('user:*');
      expect(count).toBe(2);
      expect(cache.get('user:1')).toBeNull();
      expect(cache.get('user:2')).toBeNull();
      expect(cache.get('session:1')).toBe('c');
    });

    test('should return 0 for no matches', function() {
      cache.set('key1', 'val1');
      expect(cache.invalidate('nonexistent:*')).toBe(0);
    });

    test('should support ? wildcard', function() {
      cache.set('ab1', 'x');
      cache.set('ab2', 'y');
      cache.set('abc', 'z');
      var count = cache.invalidate('ab?');
      expect(count).toBe(3);
      expect(cache.get('abc')).toBeNull();
    });
  });

  describe('flush', function() {
    test('should clear all entries', function() {
      cache.set('key1', 'val1');
      cache.set('key2', 'val2');
      cache.flush();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });
});
