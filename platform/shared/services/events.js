'use strict';

const crypto = require('crypto');
const { EventBus } = require('../../contracts/events');

/**
 * EventBus implementation — in-memory pub/sub + request/reply.
 * Extended with global handlers for event persistence.
 */
class EventBusImpl extends EventBus {
  constructor() {
    super();
    this.channels = new Map();
    this._globalHandlers = new Set();
    this._requestHandlers = new Map();
  }

  publish(channel, payload) {
    const handlers = this.channels.get(channel);
    if (handlers) {
      const handlerList = [...handlers];
      for (const handler of handlerList) {
        try {
          handler(payload);
        } catch (err) {
          console.error(
            `EventBus handler error on channel "${channel}":`,
            err.message
          );
        }
      }
    }

    for (const handler of this._globalHandlers) {
      try {
        handler(channel, payload);
      } catch (err) {
        console.error(
          `EventBus global handler error on channel "${channel}":`,
          err.message
        );
      }
    }
  }

  subscribe(channel, handler) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
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

  subscribeGlobal(handler) {
    this._globalHandlers.add(handler);
  }

  unsubscribeGlobal(handler) {
    this._globalHandlers.delete(handler);
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

      this.publish(channel, { ...payload, __replyChannel: replyChannel });
    });
  }
}

const events = new EventBusImpl();

module.exports = events;
