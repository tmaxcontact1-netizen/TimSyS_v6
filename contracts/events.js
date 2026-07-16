/**
 * TimSyS Contract: EventBus
 * Status: PENDING FREEZE
 *
 * In-memory pub/sub + request/reply for inter-module communication.
 * Modules communicate exclusively through EventBus.
 */

/** @interface EventBus */
module.exports = {
  /**
   * Publish an event to a channel (fire-and-forget).
   * @param {string} channel - Event channel name
   * @param {Object} payload - Event data
   */
  publish(channel, payload) {},

  /**
   * Subscribe to an event channel.
   * @param {string} channel
   * @param {Function} handler - Receives (payload, publisherModuleId)
   * @returns {string} subscriptionId (for unsubscribe)
   */
  subscribe(channel, handler) {},

  /**
   * Unsubscribe from a channel.
   * @param {string} subscriptionId
   */
  unsubscribe(subscriptionId) {},

  /**
   * Send synchronous request/reply message to subscribers.
   * Timeout prevents indefinite blocking.
   * @param {string} channel
   * @param {Object} payload
   * @param {number} timeoutMs
   * @returns {Promise<Array<Object>>} - Array of subscriber responses
   * @throws {Error} If timeout exceeded
   */
  request(channel, payload, timeoutMs) {}
};
