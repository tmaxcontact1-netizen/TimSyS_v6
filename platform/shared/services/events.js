'use strict';

const crypto = require('crypto');
const { EventBus } = require('../../contracts/events');

/**
 * EventBus implementation — in-memory pub/sub + request/reply.
 */
class EventBusImpl extends EventBus {
  constructor() {
    super();
    this.channels = new Map(); // channel -> Set<handler>
    this._requestHandlers = new Map(); // reply channel -> { resolve, reject, timer }
  }

  publish(channel, payload) {
    const handlers = this.channels.get(channel);
    if (!handlers) return;

    // Copy to array to allow unsubscribe during iteration
    const handlerList = [...handlers];

    for (const handler of handlerList) {
      try {
        handler(payload);
      } catch (err) {
        // Error isolation — log and continue
        console.error(
          `EventBus handler error on channel "${channel}":`,
          err.message
        );
      }
    }
  }

  subscribe(channel, handler) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }

    // Deduplicate by reference
    this.channels.get(channel).add(handler);
  }

  unsubscribe(channel, handler) {
    const handlers = this.channels.get(channel);
    if (!handlers) return;

    handlers.delete(handler);

    if (handlers.size === 0) {
      this.channels.delete(channel);
    }
  }

  async request(channel, payload, timeout = 5000) {
    const replyChannel = `__reply:${crypto.randomUUID()}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.unsubscribe(replyChannel, replyHandler);
        this._requestHandlers.delete(replyChannel);
        reject(new Error(`EventBus request to "${channel}" timed out after ${timeout}ms`));
      }, timeout);

      const replyHandler = (reply) => {
        clearTimeout(timer);
        this.unsubscribe(replyChannel, replyHandler);
        this._requestHandlers.delete(replyChannel);
        resolve(reply);
      };

      this._requestHandlers.set(replyChannel, { resolve, reject, timer });
      this.subscribe(replyChannel, replyHandler);

      // Publish with reply-to channel attached
      this.publish(channel, { ...payload, __replyChannel: replyChannel });
    });
  }
}

const events = new EventBusImpl();

module.exports = events;