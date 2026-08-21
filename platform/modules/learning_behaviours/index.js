'use strict';

const appScope = require('../../shared/services/appScope');

function boot(ctx) { ctx.log.info('learning_behaviours booting', { module: 'learning_behaviours' }); }
function teardown() {}
function scope(req) { return appScope.fromRequest(req); }
function text(value) { return String(value == null ? '' : value).trim(); }
function bad(message, code, statusCode) {
  return { success:false, statusCode:statusCode || 400, error:{ code:code || 'VALIDATION_ERROR', message } };
}
function emit(ctx, channel, record) {
  ctx.events.publish(channel, { entityId:record.id, record, __module:'learning_behaviours' });
}
function framework(ctx, id, appId) {
  return ctx.db.query('SELECT * FROM behaviour_frameworks WHERE id=? AND app_id=?', [id, appId]).rows[0];
}
function gradebook(ctx, id, appId) {
  return ctx.db.query('SELECT * FROM gradebook_instances WHERE id=? AND app_id=?', [id, appId]).rows[0];
}
function hydrateFramework(ctx, row) {
  if (!row) return row;
  row.indicators = ctx.db.query(
    'SELECT * FROM behaviour_indicators WHERE framework_id=? ORDER BY domain,sequence,id', [row.id]
  ).rows;
  return row;
}

async function listFrameworks(req, ctx) {
  const rows = ctx.db.query(
    'SELECT * FROM behaviour_frameworks WHERE app_id=? ORDER BY code,version DESC', [scope(req)]
  ).rows.map(row => hydrateFramework(ctx, row));
  return { success:true, frameworks:rows };
}

async function createFramework(req, ctx) {
  const body = req.body || {}, appId = scope(req);
  if (!text(body.code) || !text(body.name)) return bad('Framework code and name are required');
  try {
    const inserted = ctx.db.query(
      'INSERT INTO behaviour_frameworks(app_id,code,name,created_by) VALUES(?,?,?,?)',
      [appId, text(body.code), text(body.name), String(req.user.id)]
    );
    const row = hydrateFramework(ctx, framework(ctx, inserted.lastInsertRowid, appId));
    emit(ctx, 'learning_behaviour.framework_created', row);
    return { success:true, framework:row };
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return bad('Framework version already exists', 'FRAMEWORK_EXISTS', 409);
    throw error;
  }
}

async function addIndicator(req, ctx) {
  const row = framework(ctx, req.params.id, scope(req)), body = req.body || {};
  if (!row) return bad('Framework not found', 'NOT_FOUND', 404);
  if (row.status !== 'draft') return bad('Active framework versions are immutable', 'IMMUTABLE_VERSION', 409);
  if (!text(body.code) || !text(body.name) || !text(body.domain)) return bad('Indicator code, name and domain are required');
  try {
    const inserted = ctx.db.query(
      'INSERT INTO behaviour_indicators(framework_id,code,name,domain,description,sequence) VALUES(?,?,?,?,?,?)',
      [row.id, text(body.code), text(body.name), text(body.domain), body.description || null, Number(body.sequence) || 1]
    );
    return { success:true, indicator:ctx.db.query('SELECT * FROM behaviour_indicators WHERE id=?', [inserted.lastInsertRowid]).rows[0] };
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) return bad('Indicator already exists', 'INDICATOR_EXISTS', 409);
    throw error;
  }
}

async function activateFramework(req, ctx) {
  const appId = scope(req), row = framework(ctx, req.params.id, appId);
  if (!row) return bad('Framework not found', 'NOT_FOUND', 404);
  if (row.status !== 'draft') return bad('Only draft frameworks can activate', 'INVALID_STATE', 409);
  if (!ctx.db.query("SELECT id FROM behaviour_indicators WHERE framework_id=? AND status='active' LIMIT 1", [row.id]).rows[0]) {
    return bad('At least one active indicator is required');
  }
  ctx.db.query("UPDATE behaviour_frameworks SET status='retired',updated_at=datetime('now') WHERE app_id=? AND code=? AND status='active'", [appId, row.code]);
  ctx.db.query("UPDATE behaviour_frameworks SET status='active',updated_at=datetime('now') WHERE id=?", [row.id]);
  const active = hydrateFramework(ctx, framework(ctx, row.id, appId));
  emit(ctx, 'learning_behaviour.framework_activated', active);
  return { success:true, framework:active };
}

async function assignFramework(req, ctx) {
  const appId = scope(req), book = gradebook(ctx, req.params.id, appId), body = req.body || {};
  if (!book) return bad('Gradebook not found', 'NOT_FOUND', 404);
  const configured = framework(ctx, body.framework_id, appId);
  if (!configured || configured.status !== 'active') return bad('Active behaviour framework not found', 'NOT_FOUND', 404);
  const scale = ctx.db.query("SELECT * FROM assessment_scales WHERE id=? AND app_id=? AND status='active'", [body.scale_id, appId]).rows[0];
  if (!scale) return bad('Active behaviour scale not found', 'NOT_FOUND', 404);
  if (!ctx.db.query("SELECT id FROM assessment_scale_levels WHERE scale_id=? AND status='active' AND numeric_value IS NOT NULL LIMIT 1", [scale.id]).rows[0]) {
    return bad('Behaviour scale requires active numeric levels');
  }
  ctx.db.query("UPDATE gradebook_behaviour_frameworks SET status='withdrawn' WHERE gradebook_id=? AND status='active'", [book.id]);
  ctx.db.query(
    "INSERT INTO gradebook_behaviour_frameworks(gradebook_id,framework_id,scale_id,status) VALUES(?,?,?,'active') ON CONFLICT(gradebook_id,framework_id) DO UPDATE SET scale_id=excluded.scale_id,status='active',assigned_at=datetime('now')",
    [book.id, configured.id, scale.id]
  );
  const assignment = ctx.db.query("SELECT * FROM gradebook_behaviour_frameworks WHERE gradebook_id=? AND status='active'", [book.id]).rows[0];
  emit(ctx, 'learning_behaviour.framework_assigned', assignment);
  return { success:true, assignment };
}

function activeAssignment(ctx, gradebookId) {
  return ctx.db.query(
    `SELECT a.*,f.app_id FROM gradebook_behaviour_frameworks a
      JOIN behaviour_frameworks f ON f.id=a.framework_id
     WHERE a.gradebook_id=? AND a.status='active' AND f.status='active'`, [gradebookId]
  ).rows[0];
}
function validateObservation(ctx, assignment, body) {
  const indicator = ctx.db.query(
    "SELECT * FROM behaviour_indicators WHERE id=? AND framework_id=? AND status='active'",
    [body.indicator_id, assignment.framework_id]
  ).rows[0];
  if (!indicator) return { error:bad('Active indicator is not assigned to this Gradebook', 'INDICATOR_NOT_ASSIGNED', 409) };
  const level = ctx.db.query(
    "SELECT * FROM assessment_scale_levels WHERE id=? AND scale_id=? AND status='active'",
    [body.scale_level_id, assignment.scale_id]
  ).rows[0];
  if (!level) return { error:bad('Scale level is not part of the assigned behaviour scale', 'SCALE_LEVEL_NOT_ASSIGNED', 409) };
  return { indicator, level };
}
function insertObservation(ctx, book, studentId, body, userId, supersedesId) {
  const assignment = activeAssignment(ctx, book.id);
  if (!assignment) return { error:bad('No active behaviour framework is assigned', 'FRAMEWORK_NOT_ASSIGNED', 409) };
  const checked = validateObservation(ctx, assignment, body);
  if (checked.error) return checked;
  const inserted = ctx.db.query(
    'INSERT INTO behaviour_observations(gradebook_id,student_id,indicator_id,scale_level_id,observed_at,notes,recorded_by,supersedes_id) VALUES(?,?,?,?,?,?,?,?)',
    [book.id, studentId, checked.indicator.id, checked.level.id, text(body.observed_at), body.notes || null, String(userId), supersedesId || null]
  );
  return { row:ctx.db.query('SELECT * FROM behaviour_observations WHERE id=?', [inserted.lastInsertRowid]).rows[0] };
}

async function recordObservation(req, ctx) {
  const appId = scope(req), book = gradebook(ctx, req.params.id, appId), studentId = text(req.params.studentId), body = req.body || {};
  if (!book) return bad('Gradebook not found', 'NOT_FOUND', 404);
  if (!text(body.observed_at)) return bad('Observation date is required');
  if (!ctx.db.query('SELECT id FROM teaching_group_enrolments WHERE teaching_group_id=? AND student_id=?', [book.teaching_group_id, studentId]).rows[0]) {
    return bad('Student has no enrolment history in Gradebook', 'STUDENT_NOT_ENROLLED', 409);
  }
  const result = insertObservation(ctx, book, studentId, body, req.user.id, null);
  if (result.error) return result.error;
  emit(ctx, 'learning_behaviour.observed', result.row);
  return { success:true, observation:result.row };
}

async function correctObservation(req, ctx) {
  const appId = scope(req), body = req.body || {};
  const old = ctx.db.query(
    `SELECT o.*,g.app_id FROM behaviour_observations o
      JOIN gradebook_instances g ON g.id=o.gradebook_id
     WHERE o.id=? AND g.app_id=?`, [req.params.id, appId]
  ).rows[0];
  if (!old) return bad('Observation not found', 'NOT_FOUND', 404);
  if (old.superseded_by_id) return bad('Observation has already been superseded', 'ALREADY_SUPERSEDED', 409);
  if (!text(body.reason)) return bad('Correction reason is required');
  const book = gradebook(ctx, old.gradebook_id, appId);
  const result = insertObservation(ctx, book, old.student_id, {
    indicator_id:body.indicator_id || old.indicator_id,
    scale_level_id:body.scale_level_id || old.scale_level_id,
    observed_at:body.observed_at || old.observed_at,
    notes:`Correction: ${text(body.reason)}${body.notes ? ` — ${body.notes}` : ''}`
  }, req.user.id, old.id);
  if (result.error) return result.error;
  ctx.db.query("UPDATE behaviour_observations SET superseded_by_id=?,status='superseded' WHERE id=?", [result.row.id, old.id]);
  emit(ctx, 'learning_behaviour.corrected', result.row);
  return { success:true, observation:result.row, superseded:ctx.db.query('SELECT * FROM behaviour_observations WHERE id=?', [old.id]).rows[0] };
}

async function summary(req, ctx) {
  const appId = scope(req), book = gradebook(ctx, req.params.id, appId), studentId = text(req.params.studentId);
  if (!book) return bad('Gradebook not found', 'NOT_FOUND', 404);
  const params = [book.id, studentId];
  let dateClause = '';
  if (req.query.reporting_period_id) {
    const period = ctx.db.query('SELECT * FROM reporting_periods WHERE id=? AND app_id=? AND academic_year_id=?', [req.query.reporting_period_id, appId, book.academic_year_id]).rows[0];
    if (!period) return bad('Reporting period not found for Gradebook', 'NOT_FOUND', 404);
    dateClause = ' AND o.observed_at BETWEEN ? AND ?';
    params.push(period.starts_on, period.ends_on);
  }
  const rows = ctx.db.query(
    `SELECT o.*,i.code indicator_code,i.name indicator_name,i.domain,l.code level_code,l.label level_label,l.numeric_value
       FROM behaviour_observations o
       JOIN behaviour_indicators i ON i.id=o.indicator_id
       JOIN assessment_scale_levels l ON l.id=o.scale_level_id
      WHERE o.gradebook_id=? AND o.student_id=? AND o.superseded_by_id IS NULL${dateClause}
      ORDER BY i.domain,i.sequence,o.observed_at,o.id`, params
  ).rows;
  const groups = new Map();
  rows.forEach(row => {
    if (!groups.has(row.indicator_id)) groups.set(row.indicator_id, []);
    groups.get(row.indicator_id).push(row);
  });
  const indicators = [...groups.values()].map(items => ({
    indicator_id:items[0].indicator_id,
    code:items[0].indicator_code,
    name:items[0].indicator_name,
    domain:items[0].domain,
    observation_count:items.length,
    average:items.every(item => item.numeric_value != null)
      ? Math.round(items.reduce((sum, item) => sum + Number(item.numeric_value), 0) / items.length * 100) / 100
      : null,
    latest:items[items.length - 1]
  }));
  const domainMap = new Map();
  indicators.forEach(item => {
    if (!domainMap.has(item.domain)) domainMap.set(item.domain, []);
    domainMap.get(item.domain).push(item);
  });
  const domains = [...domainMap].map(([domain, items]) => {
    const numeric = items.filter(item => item.average != null);
    return {
      domain,
      indicator_count:items.length,
      average:numeric.length ? Math.round(numeric.reduce((sum, item) => sum + item.average, 0) / numeric.length * 100) / 100 : null
    };
  });
  return { success:true, summary:{ gradebook_id:book.id, student_id:studentId, observation_count:rows.length, indicators, domains } };
}

module.exports = {
  boot, teardown, listFrameworks, createFramework, addIndicator, activateFramework,
  assignFramework, recordObservation, correctObservation, summary
};
const exportedCorrect=module.exports.correctObservation;module.exports.correctObservation=function(req,ctx){let promise;ctx.db.transaction(()=>{promise=exportedCorrect(req,ctx)});return promise};
