/**
 * TimSyS Contract: CacheService
 * Status: FROZEN v6.0.0
 *
 * LRU cache with configurable size/TTL and pattern-based invalidation.
 * Optional Redis adapter stub for distributed caching.
 */

/** @interface CacheService */
module.exports = {
  /**
   * Retrieve a value by key.
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined if missing/expired
   */
  get(key) {},

  /**
   * Store a value with optional TTL.
   * @param {string} key - Cache key
   * @param {*} val - Value to cache (must be serializable)
   * @param {number} [ttl] - Time-to-live in seconds. Uses default TTL if omitted.
   */
  set(key, val, ttl) {},

  /**
   * Invalidate cache entries matching a glob-style pattern.
   * @param {string} pattern - Glob pattern (e.g., "user:*" matches "user:123")
   * @returns {number} Count of invalidated entries
   */
  invalidate(pattern) {},

  /**
   * Flush all entries from the cache.
   * @returns {number} Count of flushed entries
   */
  flush() {}
};
