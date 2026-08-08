'use strict';

var db = require('../../shared/services/db');

function _formatRow(row) {
  return {
    id: row.id,
    runId: row.run_id,
    metricKey: row.metric_key,
    metricValue: row.metric_value,
    metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
    capturedAt: row.captured_at
  };
}

function _safeQuery(sql, params) {
  try {
    return db.query(sql, params || []);
  } catch (e) {
    return { rows: [] };
  }
}

function _genRunId() {
  var ts = Date.now().toString(36);
  var rand = Math.random().toString(36).substring(2, 8);
  return 'snap_' + ts + '_' + rand;
}

function _collectMetrics() {
  var metrics = [];

  // Students
  var stuTotal = _safeQuery('SELECT COUNT(*) as v FROM students');
  if (stuTotal.rows.length) metrics.push({ key: 'students.total', value: stuTotal.rows[0].v, metadata: {} });

  var stuActive = _safeQuery("SELECT COUNT(*) as v FROM students WHERE enrollment_status = 'active'");
  if (stuActive.rows.length) metrics.push({ key: 'students.active', value: stuActive.rows[0].v, metadata: {} });

  var stuByGrade = _safeQuery("SELECT grade_level as k, COUNT(*) as v FROM students GROUP BY grade_level");
  for (var i = 0; i < stuByGrade.rows.length; i++) {
    metrics.push({ key: 'students.by_grade', value: stuByGrade.rows[i].v, metadata: { grade: stuByGrade.rows[i].k } });
  }

  // Staff
  var stfTotal = _safeQuery('SELECT COUNT(*) as v FROM staff');
  if (stfTotal.rows.length) metrics.push({ key: 'staff.total', value: stfTotal.rows[0].v, metadata: {} });

  var stfActive = _safeQuery("SELECT COUNT(*) as v FROM staff WHERE employment_status = 'active'");
  if (stfActive.rows.length) metrics.push({ key: 'staff.active', value: stfActive.rows[0].v, metadata: {} });

  var stfByDept = _safeQuery("SELECT department as k, COUNT(*) as v FROM staff GROUP BY department");
  for (var j = 0; j < stfByDept.rows.length; j++) {
    metrics.push({ key: 'staff.by_department', value: stfByDept.rows[j].v, metadata: { department: stfByDept.rows[j].k } });
  }

  // Relationships
  var relTotal = _safeQuery('SELECT COUNT(*) as v FROM relationships WHERE active = 1');
  if (relTotal.rows.length) metrics.push({ key: 'relationships.active', value: relTotal.rows[0].v, metadata: {} });

  var relByType = _safeQuery("SELECT relationship_type as k, COUNT(*) as v FROM relationships WHERE active = 1 GROUP BY relationship_type");
  for (var r = 0; r < relByType.rows.length; r++) {
    metrics.push({ key: 'relationships.by_type', value: relByType.rows[r].v, metadata: { type: relByType.rows[r].k } });
  }

  // Decisions
  var decTotal = _safeQuery('SELECT COUNT(*) as v FROM decision_log');
  if (decTotal.rows.length) metrics.push({ key: 'decisions.total', value: decTotal.rows[0].v, metadata: {} });

  var decByAction = _safeQuery("SELECT action as k, COUNT(*) as v FROM decision_log GROUP BY action");
  for (var d = 0; d < decByAction.rows.length; d++) {
    metrics.push({ key: 'decisions.by_action', value: decByAction.rows[d].v, metadata: { action: decByAction.rows[d].k } });
  }

  // Events
  var evtTotal = _safeQuery('SELECT COUNT(*) as v FROM event_store');
  if (evtTotal.rows.length) metrics.push({ key: 'events.total', value: evtTotal.rows[0].v, metadata: {} });

  var evtByChannel = _safeQuery("SELECT channel as k, COUNT(*) as v FROM event_store GROUP BY channel");
  for (var e = 0; e < evtByChannel.rows.length; e++) {
    metrics.push({ key: 'events.by_channel', value: evtByChannel.rows[e].v, metadata: { channel: evtByChannel.rows[e].k } });
  }

  // Knowledge
  var knwApproved = _safeQuery("SELECT COUNT(*) as v FROM knowledge_documents WHERE status = 'approved'");
  if (knwApproved.rows.length) metrics.push({ key: 'knowledge.approved', value: knwApproved.rows[0].v, metadata: {} });

  // Inventory
  var invTotal = _safeQuery('SELECT COUNT(*) as v FROM inventory_items');
  if (invTotal.rows.length) metrics.push({ key: 'inventory.total', value: invTotal.rows[0].v, metadata: {} });

  return metrics;
}

function boot(ctx) {
  ctx.log.info('snapshot_service booting', { module: 'snapshot_service' });
}

function teardown(ctx) {
  ctx.log.info('snapshot_service tearing down', { module: 'snapshot_service' });
}

async function snapshot_service_run(req, ctx) {
  var runId = _genRunId();
  var metrics = _collectMetrics();

  for (var i = 0; i < metrics.length; i++) {
    var m = metrics[i];
    db.query(
      'INSERT INTO snapshots (run_id, metric_key, metric_value, metadata) VALUES (?, ?, ?, ?)',
      [runId, m.key, String(m.value), JSON.stringify(m.metadata || {})]
    );
  }

  if (ctx.events && ctx.events.publish) {
    ctx.events.publish('snapshot.completed', {
      entityType: 'snapshot',
      entityId: runId,
      __module: 'snapshot_service',
      metricCount: metrics.length
    });
  }

  if (ctx.audit && ctx.audit.action) {
    ctx.audit.action('snapshot.run', req.userId || 'unknown', {
      entityType: 'snapshot',
      entityId: runId,
      newValue: { metricCount: metrics.length }
    });
  }

  return { success: true, runId: runId, metricsCaptured: metrics.length };
}

async function snapshot_service_list(req, ctx) {
  var limit = parseInt(req.query.limit, 10) || 20;
  if (limit > 100) limit = 100;

  var result = db.query(
    'SELECT run_id, COUNT(*) as metric_count, MIN(captured_at) as captured_at FROM snapshots GROUP BY run_id ORDER BY captured_at DESC LIMIT ?',
    [limit]
  );

  return { success: true, runs: result.rows.map(function(r) {
    return { runId: r.run_id, metricCount: r.metric_count, capturedAt: r.captured_at };
  }), limit: limit };
}

async function snapshot_service_latest(req, ctx) {
  var latestRun = _safeQuery('SELECT run_id FROM snapshots ORDER BY id DESC LIMIT 1');
  if (latestRun.rows.length === 0) {
    return { success: true, metrics: [], message: 'No snapshots exist yet' };
  }

  var runId = latestRun.rows[0].run_id;
  var result = db.query('SELECT * FROM snapshots WHERE run_id = ? ORDER BY id ASC', [runId]);
  return { success: true, runId: runId, capturedAt: result.rows.length > 0 ? result.rows[0].captured_at : null, metrics: result.rows.map(_formatRow) };
}

async function snapshot_service_getById(req, ctx) {
  var runId = req.params.runId;
  if (!runId) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'runId is required' } };
  }

  var result = db.query('SELECT * FROM snapshots WHERE run_id = ? ORDER BY id ASC', [runId]);
  if (result.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Snapshot run not found' } };
  }

  return { success: true, runId: runId, capturedAt: result.rows[0].captured_at, metrics: result.rows.map(_formatRow) };
}

async function snapshot_service_trends(req, ctx) {
  var key = req.params.key;
  if (!key) {
    return { success: false, statusCode: 400, error: { code: 'VALIDATION_ERROR', message: 'Metric key is required' } };
  }

  var limit = parseInt(req.query.limit, 10) || 30;
  if (limit > 200) limit = 200;

  var result = db.query(
    'SELECT run_id, metric_value, metadata, captured_at FROM snapshots WHERE metric_key = ? ORDER BY captured_at DESC LIMIT ?',
    [key, limit]
  );

  var trends = result.rows.map(function(r) {
    return {
      runId: r.run_id,
      value: r.metric_value,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      capturedAt: r.captured_at
    };
  }).reverse();

  return { success: true, key: key, points: trends.length, trends: trends };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  snapshot_service_run: snapshot_service_run,
  snapshot_service_list: snapshot_service_list,
  snapshot_service_latest: snapshot_service_latest,
  snapshot_service_getById: snapshot_service_getById,
  snapshot_service_trends: snapshot_service_trends
};
