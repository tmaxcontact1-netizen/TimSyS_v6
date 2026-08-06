'use strict';

var MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE, 10) || 100;
var DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL, 10) || 60;

// Doubly-linked list node
function Node(key, value) {
  this.key = key;
  this.value = value;
  this.next = null;
  this.prev = null;
}

function LRUCache(maxSize) {
  this.maxSize = maxSize;
  this.size = 0;
  this.cache = new Map();
  this.head = null; // Most recently used
  this.tail = null; // Least recently used
}

LRUCache.prototype.get = function(key) {
  var node = this.cache.get(key);
  if (!node) return null;

  if (node.expiry && Date.now() > node.expiry) {
    this._remove(node);
    return null;
  }

  this._moveToFront(node);
  return node.value;
};

LRUCache.prototype.set = function(key, value, ttl) {
  var node = this.cache.get(key);

  if (node) {
    node.value = value;
    node.expiry = (ttl === undefined || ttl === null) ? null : (ttl === 0 ? null : Date.now() + (ttl * 1000));
    this._moveToFront(node);
    return;
  }

  node = new Node(key, value);
  node.expiry = (ttl === undefined || ttl === null) ? null : (ttl === 0 ? null : Date.now() + (ttl * 1000));

  this.cache.set(key, node);
  this._addToFront(node);
  this.size++;

  if (this.size > this.maxSize) {
    this._evict();
  }
};

LRUCache.prototype._addToFront = function(node) {
  node.next = this.head;
  node.prev = null;

  if (this.head) {
    this.head.prev = node;
  }
  this.head = node;

  if (!this.tail) {
    this.tail = node;
  }
};

LRUCache.prototype._remove = function(node) {
  if (node.prev) {
    node.prev.next = node.next;
  } else {
    this.head = node.next;
  }

  if (node.next) {
    node.next.prev = node.prev;
  } else {
    this.tail = node.prev;
  }

  delete node.next;
  delete node.prev;
};

LRUCache.prototype._moveToFront = function(node) {
  if (node === this.head) return;

  this._remove(node);
  this._addToFront(node);
};

LRUCache.prototype._evict = function() {
  if (!this.tail) return;

  var lru = this.tail;
  this._remove(lru);
  this.cache.delete(lru.key);
  this.size--;
};

LRUCache.prototype.flush = function() {
  this.cache.clear();
  this.head = null;
  this.tail = null;
  this.size = 0;
};

LRUCache.prototype.invalidate = function(pattern) {
  var count = 0;
  var keysToDelete = [];
  var regex = this._patternToRegex(pattern);

  for (var key of this.cache.keys()) {
    if (regex.test(key)) {
      keysToDelete.push(key);
    }
  }

  for (var i = 0; i < keysToDelete.length; i++) {
    var node = this.cache.get(keysToDelete[i]);
    if (node) {
      this._remove(node);
      this.cache.delete(keysToDelete[i]);
      this.size--;
      count++;
    }
  }

  return count;
};

LRUCache.prototype._patternToRegex = function(pattern) {
  var escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  var withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp('^' + withWildcards + '$');
};

LRUCache.prototype.keys = function() {
  return Array.from(this.cache.keys());
};

LRUCache.prototype.size = function() {
  return this.size;
};

var globalCache = new LRUCache(MAX_SIZE);

module.exports = {
  get: function(key) {
    return globalCache.get(key);
  },
  set: function(key, value, ttl) {
    globalCache.set(key, value, ttl);
  },
  invalidate: function(pattern) {
    return globalCache.invalidate(pattern);
  },
  flush: function() {
    globalCache.flush();
  },
  _cache: globalCache,
};