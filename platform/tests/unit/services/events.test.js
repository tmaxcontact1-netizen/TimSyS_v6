'use strict';

const events = require('../../../shared/services/events');

describe('EventBus', function() {

  beforeEach(function() {
    // Clean up all channels between tests
    for (var channel of events.channels.keys()) {
      events.channels.delete(channel);
    }
  });

  describe('publish/subscribe', function() {
    test('should deliver payload to subscriber', function() {
      var received = null;
      events.subscribe('test.channel', function(payload) {
        received = payload;
      });
      events.publish('test.channel', { message: 'hello' });
      expect(received).toEqual({ message: 'hello' });
    });

    test('should deliver to multiple subscribers', function() {
      var received1 = null;
      var received2 = null;
      events.subscribe('multi.channel', function(p) { received1 = p; });
      events.subscribe('multi.channel', function(p) { received2 = p; });
      events.publish('multi.channel', 'broadcast');
      expect(received1).toBe('broadcast');
      expect(received2).toBe('broadcast');
    });

    test('should not deliver to unsubscribed handlers', function() {
      var received = null;
      var handler = function(p) { received = p; };
      events.subscribe('unsub.channel', handler);
      events.unsubscribe('unsub.channel', handler);
      events.publish('unsub.channel', 'should-not-receive');
      expect(received).toBeNull();
    });

    test('should silently ignore publish to empty channel', function() {
      expect(function() {
        events.publish('empty.channel', 'data');
      }).not.toThrow();
    });

    test('should isolate errors — one failing handler should not block others', function() {
      var received = null;
      events.subscribe('error.channel', function() { throw new Error('Handler error'); });
      events.subscribe('error.channel', function(p) { received = p; });
      events.publish('error.channel', 'after-error');
      expect(received).toBe('after-error');
    });
  });

  describe('request/reply', function() {
    test('should receive a reply within timeout', async function() {
      events.subscribe('req.channel', function(payload) {
        if (payload.__replyChannel) {
          events.publish(payload.__replyChannel, { answer: 42 });
        }
      });

      var reply = await events.request('req.channel', { question: 'life' }, 1000);
      expect(reply.answer).toBe(42);
    });

    test('should timeout when no responder replies', async function() {
      await expect(events.request('no.responder', 'data', 100)).rejects.toThrow('timed out');
    });
  });
});