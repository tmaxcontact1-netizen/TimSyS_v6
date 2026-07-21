'use strict';

/**
 * CacheService Contract — LRU + pattern matching.
 *
 * In-memory LRU cache with configurable max size and default TTL.
 * Pattern invalidation supports glob-style key matching.
 * Redis adapter is a future concern; this contract does not accommodate it yet.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class CacheService {
  /**
   * Retrieve a value by key.
   * Returns null if key is missing or expired.
   * Touches recency for LRU ordering.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    throw new Error('CacheService.get: not implemented');
  }

  /**
   * Store a value with an optional TTL override.
   * If ttl is omitted, uses the default TTL configured at init.
   * Setting ttl=0 stores with no expiry.
   * @param {string} key
   * @param {*} val
   * @param {number} [ttl] - Seconds. 0 = no expiry. Omit = default.
   */
  set(key, val, ttl) {
    throw new Error('CacheService.set: not implemented');
  }

  /**
   * Invalidate all keys matching a glob pattern.
   * Supported wildcards: * (any chars), ? (single char).
   * @param {string} pattern - e.g., "user:*", "session:?123"
   * @returns {number} Count of invalidated keys
   */
  invalidate(pattern) {
    throw new Error('CacheService.invalidate: not implemented');
  }

  /**
   * Clear all entries from the cache regardless of TTL.
   * Resets LRU state.
   */
  flush() {
    throw new Error('CacheService.flush: not implemented');
  }
}

module.exports = { CacheService };