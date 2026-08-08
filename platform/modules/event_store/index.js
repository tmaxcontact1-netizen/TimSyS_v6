'use strict';

var eventStore = require('../../shared/services/event_store');
var events = require('../../shared/services/events');

function boot(ctx) {
  ctx.log.info('event_store booting', { module: 'event_store' });

  events.subscribeGlobal(function (channel, payload) {
    try {
      eventStore.persist(channel, payload);
    } catch (err) {
      ctx.log.error('Failed to persist event', {
        channel: channel,
        error: err.message
      });
    }
  });

  ctx.log.info('event_store global handler registered', { module: 'event_store' });
}

function teardown(ctx) {
  ctx.log.info('event_store tearing down', { module: 'event_store' });
}

async function event_store_list(req, ctx) {
  var limit = parseInt(req.query.limit, 10) || 50;
  var offset = parseInt(req.query.offset, 10) || 0;
  if (limit > 500) limit = 500;
  var result = eventStore.getRecent(limit, offset);
  var count = eventStore.getCount();
  return { success: true, events: result, total: count, limit: limit, offset: offset };
}

async function event_store_getById(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }
  var event = eventStore.getById(id);
  if (!event) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Event not found' } };
  }
  return { success: true, event: event };
}

async function event_store_getByChannel(req, ctx) {
  var channel = req.params.channel;
  var limit = parseInt(req.query.limit, 10) || 50;
  var result = eventStore.getByChannel(channel, limit);
  var count = eventStore.getCount(channel);
  return { success: true, events: result, total: count, channel: channel };
}

async function event_store_getByEntity(req, ctx) {
  var entityType = req.params.entityType;
  var entityId = req.params.entityId;
  var limit = parseInt(req.query.limit, 10) || 50;
  var result = eventStore.getByEntity(entityType, entityId, limit);
  return { success: true, events: result, entityType: entityType, entityId: entityId };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  event_store_list: event_store_list,
  event_store_getById: event_store_getById,
  event_store_getByChannel: event_store_getByChannel,
  event_store_getByEntity: event_store_getByEntity
};
