'use strict';

/**
 * EventStore Contract — Persists all EventBus events to a durable store.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class EventStore {
  /**
   * Persist a single event to the store.
   * @param {string} channel - Event channel name
   * @param {*} payload - Event payload (will be JSON-stringified)
   * @returns {number|null} - Inserted row ID or null
   */
  persist(channel, payload) {
    throw new Error('EventStore.persist: not implemented');
  }

  /**
   * Get a single event by ID.
   * @param {number} id - Event ID
   * @returns {object|null} - Event record or null
   */
  getById(id) {
    throw new Error('EventStore.getById: not implemented');
  }

  /**
   * Get recent events, newest first.
   * @param {number} [limit=50] - Max events to return
   * @param {number} [offset=0] - Pagination offset
   * @returns {object[]} - Array of event records
   */
  getRecent(limit, offset) {
    throw new Error('EventStore.getRecent: not implemented');
  }

  /**
   * Get events for a specific channel.
   * @param {string} channel - Event channel name
   * @param {number} [limit=50] - Max events to return
   * @returns {object[]} - Array of event records
   */
  getByChannel(channel, limit) {
    throw new Error('EventStore.getByChannel: not implemented');
  }

  /**
   * Get events for a specific entity.
   * @param {string} entityType - Entity type (e.g. 'student', 'staff')
   * @param {string} entityId - Entity ID
   * @param {number} [limit=50] - Max events to return
   * @returns {object[]} - Array of event records
   */
  getByEntity(entityType, entityId, limit) {
    throw new Error('EventStore.getByEntity: not implemented');
  }

  /**
   * Get events within a time range, oldest first.
   * @param {number} from - Start timestamp (epoch ms)
   * @param {number} to - End timestamp (epoch ms)
   * @param {number} [limit=500] - Max events to return
   * @returns {object[]} - Array of event records in chronological order
   */
  getTimeline(from, to, limit) {
    throw new Error('EventStore.getTimeline: not implemented');
  }

  /**
   * Get count of events, optionally filtered by channel.
   * @param {string} [channel] - Optional channel filter
   * @returns {number} - Total count
   */
  getCount(channel) {
    throw new Error('EventStore.getCount: not implemented');
  }
}

module.exports = { EventStore };
