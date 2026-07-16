/**
 * TimSyS Contract: EventBus
 * Status: FROZEN v6.0.0
 *
 * In-memory pub/sub for inter-module communication.
 * This is the sole legal mechanism for runtime inter-module communication.
 */

/**
 * @typedef {Function} EventHandler
 * @param {*} payload - Event-specific payload
 * @returns {void}
 */

/** @interface EventBus */
module.exports = {
  /**
   * Publish a payload to all subscribers of a channel.
   * @param {string} channel - Event channel name (e.g., "user.created")
   * @param {*} payload - Event payload
   */
  publish(channel, payload) {},

  /**
   * Subscribe a handler to a channel.
   * @param {string} channel - Event channel name
   * @param {EventHandler} handler - Function called on publish
   * @returns {string} Subscription ID (for unsubscribe)
   */
  subscribe(channel, handler) {},

  /**
   * Unsubscribe a handler from a channel.
   * @param {string} channel - Event channel name
   * @param {EventHandler} handler - The handler function or subscription ID
   */
  unsubscribe(channel, handler) {}
};
