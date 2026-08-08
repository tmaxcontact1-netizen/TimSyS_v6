'use strict';

var decisionLog = require('../../shared/services/decision_log');

function boot(ctx) {
  ctx.log.info('decision_log booting', { module: 'decision_log' });
}

function teardown(ctx) {
  ctx.log.info('decision_log tearing down', { module: 'decision_log' });
}

async function decision_log_list(req, ctx) {
  var limit = parseInt(req.query.limit, 10) || 50;
  var offset = parseInt(req.query.offset, 10) || 0;
  if (limit > 500) limit = 500;
  var result = decisionLog.getRecent(limit, offset);
  var count = decisionLog.getCount();
  return { success: true, decisions: result, total: count, limit: limit, offset: offset };
}

async function decision_log_getById(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }
  var decision = decisionLog.getById(id);
  if (!decision) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Decision not found' } };
  }
  return { success: true, decision: decision };
}

async function decision_log_getByActor(req, ctx) {
  var actorId = req.params.actorId;
  var limit = parseInt(req.query.limit, 10) || 50;
  var result = decisionLog.getByActor(actorId, limit);
  return { success: true, decisions: result, actorId: actorId };
}

async function decision_log_getByEntity(req, ctx) {
  var entityType = req.params.entityType;
  var entityId = req.params.entityId;
  var limit = parseInt(req.query.limit, 10) || 50;
  var result = decisionLog.getByEntity(entityType, entityId, limit);
  return { success: true, decisions: result, entityType: entityType, entityId: entityId };
}

async function decision_log_getByAction(req, ctx) {
  var action = req.params.action;
  var limit = parseInt(req.query.limit, 10) || 50;
  var result = decisionLog.getByAction(action, limit);
  var count = decisionLog.getCount(action);
  return { success: true, decisions: result, total: count, action: action };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  decision_log_list: decision_log_list,
  decision_log_getById: decision_log_getById,
  decision_log_getByActor: decision_log_getByActor,
  decision_log_getByEntity: decision_log_getByEntity,
  decision_log_getByAction: decision_log_getByAction
};
