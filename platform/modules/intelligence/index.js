'use strict';

const intelligenceService = require('../../shared/services/intelligence');

function boot(ctx) {
  ctx.log.info('intelligence booting', { module: 'intelligence' });
}

function teardown(ctx) {
  ctx.log.info('intelligence tearing down', { module: 'intelligence' });
}

async function intelligence_synthesize(req, ctx) {
  var options = {};
  if (req.body && typeof req.body === 'object') {
    if (req.body.entityTypes && Array.isArray(req.body.entityTypes)) {
      options.entityTypes = req.body.entityTypes;
    }
    if (req.body.limit) {
      options.limit = parseInt(req.body.limit, 10);
    }
  }
  var result = await intelligenceService.synthesize(options);
  return { success: true, synthesis: result };
}

async function intelligence_getInsights(req, ctx) {
  var scopeType = req.params.scopeType;
  var scopeId = req.params.scopeId;
  var insightType = req.query.type || null;
  var insights = await intelligenceService.getInsights(scopeType, scopeId, insightType);
  return { success: true, insights: insights };
}

async function intelligence_getMetadata(req, ctx) {
  var entityType = req.params.entityType;
  var entityId = req.params.entityId;
  var metadata = await intelligenceService.getMetadata(entityType, entityId);
  return { success: true, metadata: metadata };
}

async function intelligence_storeMetadata(req, ctx) {
  var entityType = req.params.entityType;
  var entityId = req.params.entityId;
  var data = req.body;
  if (!data) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Request body required' } };
  }
  var id = await intelligenceService.storeMetadata(entityType, entityId, data);
  return { success: true, id: id };
}

async function intelligence_registerRule(req, ctx) {
  var b = req.body;
  if (!b.name || !b.conditions) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'name and conditions are required' } };
  }
  var id = await intelligenceService.registerRule(b.name, b.description || '', b.conditions, b.actions || {}, b.priority || 0);
  return { success: true, id: id };
}

async function intelligence_listRules(req, ctx) {
  var enabledOnly = req.query.enabled === 'true';
  var rules = await intelligenceService.listRules(enabledOnly);
  return { success: true, rules: rules };
}

async function intelligence_deleteRule(req, ctx) {
  var ruleId = req.params.id;
  await intelligenceService.deleteRule(ruleId);
  return { success: true };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  intelligence_synthesize: intelligence_synthesize,
  intelligence_getInsights: intelligence_getInsights,
  intelligence_getMetadata: intelligence_getMetadata,
  intelligence_storeMetadata: intelligence_storeMetadata,
  intelligence_registerRule: intelligence_registerRule,
  intelligence_listRules: intelligence_listRules,
  intelligence_deleteRule: intelligence_deleteRule
};
