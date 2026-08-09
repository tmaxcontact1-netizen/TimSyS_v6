'use strict';

var db = require('../../shared/services/db');

function boot(ctx) {
  ctx.log.info('insight_management booting', { module: 'insight_management' });
}

function teardown(ctx) {
  ctx.log.info('insight_management tearing down', { module: 'insight_management' });
}

async function acknowledgeInsight(req, ctx) {
  var insightId = req.params.insightId;
  var userId = req.user?.id || 'unknown';
  var userRole = req.user?.role || 'viewer';

  var existing = db.query('SELECT * FROM intelligence_insights WHERE id = ?', [insightId]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Insight not found' } };
  }

  db.query(
    "UPDATE intelligence_insights SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = strftime('%s', 'now') * 1000 WHERE id = ?",
    [userId, insightId]
  );

  db.query(
    "INSERT INTO insight_visibility_log (insight_id, viewer_role, viewer_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'acknowledged', ?, ?)",
    [insightId, userRole, userId, existing.rows[0].entity_type, existing.rows[0].entity_id]
  );

  if (ctx.audit) {
    ctx.audit.action('insight.acknowledge', userId, {
      entityType: 'insight',
      entityId: insightId
    });
  }

  return { success: true };
}

async function dismissInsight(req, ctx) {
  var insightId = req.params.insightId;
  var userId = req.user?.id || 'unknown';
  var userRole = req.user?.role || 'viewer';

  var existing = db.query('SELECT * FROM intelligence_insights WHERE id = ?', [insightId]);
  if (existing.rows.length === 0) {
    return { success: false, statusCode: 404, error: { code: 'NOT_FOUND', message: 'Insight not found' } };
  }

  db.query(
    "UPDATE intelligence_insights SET status = 'dismissed', dismissed_by = ?, dismissed_at = strftime('%s', 'now') * 1000 WHERE id = ?",
    [userId, insightId]
  );

  db.query(
    "INSERT INTO insight_visibility_log (insight_id, viewer_role, viewer_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'dismissed', ?, ?)",
    [insightId, userRole, userId, existing.rows[0].entity_type, existing.rows[0].entity_id]
  );

  return { success: true };
}

async function listInsights(req, ctx) {
  var sql = "SELECT * FROM intelligence_insights WHERE 1=1";
  var params = [];

  if (req.query.scopeType) {
    sql += " AND scope_type = ?";
    params.push(req.query.scopeType);
  }
  if (req.query.scopeId) {
    sql += " AND scope_id = ?";
    params.push(req.query.scopeId);
  }
  if (req.query.insightLevel) {
    sql += " AND insight_level = ?";
    params.push(req.query.insightLevel);
  }
  if (req.query.status) {
    sql += " AND status = ?";
    params.push(req.query.status);
  }

  var limit = parseInt(req.query.limit, 10) || 50;
  if (limit > 500) limit = 500;

  sql += " ORDER BY generated_at DESC LIMIT ?";
  params.push(limit);

  var result = db.query(sql, params);
  return {
    success: true,
    insights: result.rows.map(row => ({
      id: row.id,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      insightType: row.insight_type,
      level: row.insight_level,
      summary: row.summary,
      metricsData: typeof row.metrics_data === 'string' ? JSON.parse(row.metrics_data) : row.metrics_data,
      trendsData: typeof row.trends_data === 'string' ? JSON.parse(row.trends_data) : row.trends_data,
      alerts: typeof row.alerts === 'string' ? JSON.parse(row.alerts) : row.alerts,
      generatedAt: row.generated_at,
      expiresAt: row.expires_at,
      status: row.status,
      acknowledgedBy: row.acknowledged_by,
      acknowledgedAt: row.acknowledged_at,
      dismissedBy: row.dismissed_by,
      dismissedAt: row.dismissed_at,
      generatedForRole: row.generated_for_role,
      viewCount: row.view_count
    }))
  };
}

async function getVisibilityLog(req, ctx) {
  var insightId = req.params.insightId;
  var sql = "SELECT * FROM insight_visibility_log WHERE insight_id = ? ORDER BY viewed_at DESC";
  var result = db.query(sql, [insightId]);

  return {
    success: true,
    log: result.rows.map(row => ({
      id: row.id,
      insightId: row.insight_id,
      viewerRole: row.viewer_role,
      viewerId: row.viewer_id,
      viewedAt: row.viewed_at,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id
    }))
  };
}

module.exports = {
  boot: boot,
  teardown: teardown,
  acknowledgeInsight: acknowledgeInsight,
  dismissInsight: dismissInsight,
  listInsights: listInsights,
  getVisibilityLog: getVisibilityLog
};
