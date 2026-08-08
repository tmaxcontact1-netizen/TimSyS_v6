'use strict';

var db = require('../../shared/services/db');

function _formatRow(row) {
  return {
    id: row.id,
    ruleKey: row.rule_key,
    description: row.description,
    conditionType: row.condition_type,
    conditionData: typeof row.condition_data === 'string' ? JSON.parse(row.condition_data) : row.condition_data,
    sourceData: typeof row.source_data === 'string' ? JSON.parse(row.source_data) : row.source_data,
    confidence: row.confidence,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function _safeQuery(sql, params) {
  try {
    return db.query(sql, params || []);
  } catch (e) {
    return { rows: [] };
  }
}

function _analyzeEventFrequency() {
  var rules = [];
  var result = _safeQuery('SELECT channel, COUNT(*) as cnt FROM event_store GROUP BY channel HAVING cnt >= 3 ORDER BY cnt DESC');
  var totalEvents = _safeQuery('SELECT COUNT(*) as v FROM event_store');
  var total = totalEvents.rows.length > 0 ? totalEvents.rows[0].v : 1;

  for (var i = 0; i < result.rows.length; i++) {
    var r = result.rows[i];
    var confidence = Math.min(r.cnt / 10, 0.95);
    rules.push({
      ruleKey: 'event.threshold.' + r.channel,
      description: 'Alert when "' + r.channel + '" events exceed ' + Math.ceil(r.cnt * 1.5) + ' occurrences',
      conditionType: 'threshold',
      conditionData: { channel: r.channel, operator: '>', threshold: Math.ceil(r.cnt * 1.5) },
      sourceData: { channel: r.channel, observedCount: r.cnt, totalEvents: total },
      confidence: confidence
    });
  }
  return rules;
}

function _analyzeDecisionPatterns() {
  var rules = [];
  var result = _safeQuery('SELECT action, COUNT(*) as cnt FROM decision_log GROUP BY action HAVING cnt >= 2 ORDER BY cnt DESC');
  var totalDecisions = _safeQuery('SELECT COUNT(*) as v FROM decision_log');
  var total = totalDecisions.rows.length > 0 ? totalDecisions.rows[0].v : 1;

  for (var i = 0; i < result.rows.length; i++) {
    var r = result.rows[i];
    var confidence = Math.min(r.cnt / 8, 0.9);
    rules.push({
      ruleKey: 'decision.frequency.' + r.action,
      description: 'Action "' + r.action + '" has been taken ' + r.cnt + ' times — consider creating a template',
      conditionType: 'frequency',
      conditionData: { action: r.action, operator: '>=', threshold: r.cnt },
      sourceData: { action: r.action, observedCount: r.cnt, totalDecisions: total },
      confidence: confidence
    });
  }
  return rules;
}

function _analyzeEnrollmentTrend() {
  var rules = [];
  var result = _safeQuery("SELECT metric_value, captured_at FROM snapshots WHERE metric_key = 'students.total' ORDER BY captured_at ASC");

  if (result.rows.length >= 2) {
    var values = result.rows.map(function(r) { return parseInt(r.metric_value, 10); });
    var first = values[0];
    var last = values[values.length - 1];
    var delta = last - first;
    var pct = first > 0 ? (delta / first * 100) : 0;

    if (Math.abs(pct) >= 10) {
      rules.push({
        ruleKey: 'enrollment.trend.delta',
        description: 'Enrollment has ' + (delta > 0 ? 'increased' : 'decreased') + ' by ' + Math.abs(pct).toFixed(1) + '% (' + first + ' to ' + last + ')',
        conditionType: 'trend',
        conditionData: { metric: 'students.total', direction: delta > 0 ? 'up' : 'down', changePercent: Math.round(Math.abs(pct) * 100) / 100 },
        sourceData: { snapshots: values.length, firstValue: first, lastValue: last, delta: delta },
        confidence: Math.min(values.length / 5, 0.85)
      });
    }
  }

  return rules;
}

function _analyzeRelationshipDensity() {
  var rules = [];
  var result = _safeQuery('SELECT source_type, source_id, COUNT(*) as cnt FROM relationships WHERE active = 1 GROUP BY source_type, source_id HAVING cnt >= 3 ORDER BY cnt DESC');

  for (var i = 0; i < result.rows.length; i++) {
    var r = result.rows[i];
    rules.push({
      ruleKey: 'relationship.density.' + r.source_type + '.' + r.source_id,
      description: r.source_type + ' ' + r.source_id + ' has ' + r.cnt + ' active relationships — high connectivity',
      conditionType: 'correlation',
      conditionData: { entityType: r.source_type, entityId: r.source_id, relationshipCount: r.cnt, operator: '>=', threshold: 3 },
      sourceData: { entityType: r.source_type, entityId: r.source_id, relationshipCount: r.cnt },
      confidence: Math.min(r.cnt / 10, 0.8)
    });
  }

  var isolated = _safeQuery('SELECT source_type, source_id FROM relationships WHERE active = 1 GROUP BY source_type, source_id HAVING COUNT(*) = 1');
  for (var j = 0; j < isolated.rows.length; j++) {
    var iso = isolated.rows[j];
    rules.push({
      ruleKey: 'relationship.isolated.' + iso.source_type + '.' + iso.source_id,
      description: iso.source_type + ' ' + iso.source_id + ' has only 1 active relationship — potential isolation risk',
      conditionType: 'correlation',
      conditionData: { entityType: iso.source_type, entityId: iso.source_id, relationshipCount: 1, operator: '<=', threshold: 1 },
      sourceData: { entityType: iso.source_type, entityId: iso.source_id, relationshipCount: 1 },
      confidence: 0.5
    });
  }

  return rules;
}

function boot(ctx) {
  ctx.log.info('auto_rules booting', { module: 'auto_rules' });
}

function teardown(ctx) {
  ctx.log.info('auto_rules tearing down', { module: 'auto_rules' });
}

async function auto_rules_analyze(req, ctx) {
  var allRules = [];
  allRules = allRules.concat(_analyzeEventFrequency());
  allRules = allRules.concat(_analyzeDecisionPatterns());
  allRules = allRules.concat(_analyzeEnrollmentTrend());
  allRules = allRules.concat(_analyzeRelationshipDensity());

  var inserted = 0;
  var skipped = 0;

  for (var i = 0; i < allRules.length; i++) {
    var r = allRules[i];
    var existing = _safeQuery("SELECT id FROM auto_rules WHERE rule_key = ? AND status IN ('suggested', 'approved', 'active')", [r.ruleKey]);
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    db.query(
      "INSERT INTO auto_rules (rule_key, description, condition_type, condition_data, source_data, confidence, status) VALUES (?, ?, ?, ?, ?, ?, 'suggested')",
      [r.ruleKey, r.description, r.conditionType, JSON.stringify(r.conditionData), JSON.stringify(r.sourceData), r.confidence]
    );
    inserted++;
  }

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('auto_rules.analyzed', {
      entityType: 'auto_rule',
      entityId: 'batch',
      __module: 'auto_rules',
      totalDetected: allRules.length,
      inserted: inserted,
      skipped: skipped
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('auto_rules.analyze', req.userId || 'unknown', {
      entityType: 'auto_rule',
      entityId: 'batch',
      newValue: { detected: allRules.length, inserted: inserted, skipped: skipped }
    });
  }

  return { success: true, detected: allRules.length, inserted: inserted, skipped: skipped };
}

async function auto_rules_list(req, ctx) {
  var sql = 'SELECT * FROM auto_rules WHERE 1=1';
  var params = [];

  if (req.query.status) {
    sql += ' AND status = ?';
    params.push(req.query.status);
  }

  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;
  var offset = parseInt(req.query.offset, 10) || 0;

  sql += ' ORDER BY confidence DESC, updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  var result = db.query(sql, params);
  return { success: true, rules: result.rows.map(_formatRow), limit: limit, offset: offset };
}

async function auto_rules_active(req, ctx) {
  var result = db.query("SELECT * FROM auto_rules WHERE status = 'active' ORDER BY confidence DESC");
  return { success: true, rules: result.rows.map(_formatRow) };
}

async function auto_rules_getById(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }
  var result = db.query('SELECT * FROM auto_rules WHERE id = ?', [id]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Rule not found' } };
  }
  return { success: true, rule: _formatRow(result.rows[0]) };
}

async function auto_rules_updateStatus(req, ctx) {
  var id = parseInt(req.params.id, 10);
  if (!id) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid numeric ID required' } };
  }

  var body = req.body || {};
  var validStatuses = ['suggested', 'approved', 'rejected', 'active', 'archived'];
  if (!body.status || validStatuses.indexOf(body.status) === -1) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Valid status required: suggested, approved, rejected, active, archived' } };
  }

  var existing = db.query('SELECT * FROM auto_rules WHERE id = ?', [id]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Rule not found' } };
  }

  db.query("UPDATE auto_rules SET status = ?, updated_at = datetime('now') WHERE id = ?", [body.status, id]);

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('auto_rules.status_changed', {
      entityType: 'auto_rule',
      entityId: String(id),
      __module: 'auto_rules',
      newStatus: body.status
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('auto_rules.update_status', req.userId || 'unknown', {
      entityType: 'auto_rule',
      entityId: String(id),
      oldValue: existing.rows[0].status,
      newValue: body.status
    });
  }

  var updated = db.query('SELECT * FROM auto_rules WHERE id = ?', [id]);
  return { success: true, rule: _formatRow(updated.rows[0]) };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  auto_rules_analyze: auto_rules_analyze,
  auto_rules_list: auto_rules_list,
  auto_rules_active: auto_rules_active,
  auto_rules_getById: auto_rules_getById,
  auto_rules_updateStatus: auto_rules_updateStatus
};
