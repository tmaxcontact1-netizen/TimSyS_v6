'use strict';

/**
 * @typedef {Function} EventHandler
 * @param {*} payload - Event payload
 * @returns {void|Promise<void>}
 */

/**
 * EventBus Contract — In-memory pub/sub + request/reply.
 *
 * The sole legal mechanism for inter-Module communication at runtime.
 * publish() is fire-and-forget. request() blocks with a timeout for a reply.
 *
 * FROZEN: Do not modify after sign-off. Implementations must conform exactly.
 */
class EventBus {
  /**
   * Publish a payload to all subscribers of a channel.
   * Synchronous dispatch — handlers execute in subscription order.
   * A throwing handler does not prevent subsequent handlers from receiving the event;
   * the error is logged and swallowed.
   * @param {string} channel - Event channel name
   * @param {*} payload - Event data
   */
  publish(channel, payload) {
    throw new Error('EventBus.publish: not implemented');
  }

  /**
   * Subscribe a handler to a channel.
   * @param {string} channel
   * @param {EventHandler} handler
   * @returns {void}
   */
  subscribe(channel, handler) {
    throw new Error('EventBus.subscribe: not implemented');
  }

  /**
   * Remove a previously subscribed handler from a channel.
   * No-op if the handler was never subscribed.
   * @param {string} channel
   * @param {EventHandler} handler
   */
  unsubscribe(channel, handler) {
    throw new Error('EventBus.unsubscribe: not implemented');
  }

  /**
   * Publish a request and wait for a single reply within a timeout.
   * @param {string} channel
   * @param {*} payload
   * @param {number} [timeout=5000] - Milliseconds
   * @returns {Promise<*>} Resolves with the reply, rejects on timeout
   * @throws {Error} If no responder replies within timeout
   */
  async request(channel, payload, timeout = 5000) {
    throw new Error('EventBus.request: not implemented');
  }
}

module.exports = { EventBus };