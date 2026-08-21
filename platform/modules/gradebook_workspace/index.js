'use strict';

const appScope = require('../../shared/services/appScope');
const reportingPeriodService = require('../../shared/services/reportingPeriods');
const access = require('../../shared/services/gradebookAccess');

function boot(ctx) { ctx.log.info('gradebook_workspace booting', { module: 'gradebook_workspace' }); }
function teardown() {}
function scope(req) { return appScope.fromRequest(req); }
function bad(message, code, statusCode) {
  return { success: false, statusCode: statusCode || 400, error: { code: code || 'VALIDATION_ERROR', message } };
}

function context(ctx, appId, gradebookId) {
  return ctx.db.query(
    `SELECT g.*,t.kind,t.external_key,t.programme_id
       FROM gradebook_instances g
       JOIN teaching_groups t ON t.id=g.teaching_group_id
      WHERE g.id=? AND g.app_id=?`,
    [gradebookId, appId]
  ).rows[0];
}

function resolvedPeriods(ctx, gradebook) {
  return reportingPeriodService.resolve(ctx,gradebook);
}

async function reportingPeriods(req, ctx) {
  const gradebook = context(ctx, scope(req), req.params.id);
  if (!gradebook) return bad('Gradebook not found', 'NOT_FOUND', 404);
  const denied=access.requireUse(req,ctx,gradebook);if(denied)return denied;
  return { success: true, gradebook_id: gradebook.id, ...resolvedPeriods(ctx, gradebook) };
}

function latestEvidence(ctx, assessmentIds, studentIds) {
  if (!assessmentIds.length || !studentIds.length) return [];
  const assessmentMarks = assessmentIds.map(() => '?').join(',');
  const studentMarks = studentIds.map(() => '?').join(',');
  return ctx.db.query(
    `SELECT e.* FROM assessment_evidence e
      WHERE e.assessment_id IN (${assessmentMarks})
        AND e.student_id IN (${studentMarks})
        AND e.superseded_by_id IS NULL
        AND e.id=(SELECT MAX(x.id) FROM assessment_evidence x
                   WHERE x.assessment_id=e.assessment_id AND x.student_id=e.student_id
                     AND x.superseded_by_id IS NULL)
      ORDER BY e.student_id,e.assessment_id`,
    assessmentIds.concat(studentIds)
  ).rows;
}

async function read(req, ctx) {
  const gradebook = context(ctx, scope(req), req.params.id);
  if (!gradebook) return bad('Gradebook not found', 'NOT_FOUND', 404);
  const denied=access.requireUse(req,ctx,gradebook);if(denied)return denied;
  const resolved = resolvedPeriods(ctx, gradebook);
  const requestedPeriod = req.query.reporting_period_id == null ? null : Number(req.query.reporting_period_id);
  const period = requestedPeriod == null ? null : resolved.periods.find(item => item.id === requestedPeriod);
  if (requestedPeriod != null && !period) return bad('Reporting period is not part of the resolved gradebook configuration', 'REPORTING_PERIOD_NOT_RESOLVED', 409);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
  const total = Number(ctx.db.query(
    'SELECT COUNT(*) total FROM teaching_group_enrolments WHERE teaching_group_id=?',
    [gradebook.teaching_group_id]
  ).rows[0].total);
  const students = ctx.db.query(
    'SELECT * FROM teaching_group_enrolments WHERE teaching_group_id=? ORDER BY student_id,id LIMIT ? OFFSET ?',
    [gradebook.teaching_group_id, limit, (page - 1) * limit]
  ).rows;

  const params = [gradebook.id];
  let periodClause = '';
  if (period) {
    periodClause = ' AND (assessment_date IS NULL OR assessment_date BETWEEN ? AND ?)';
    params.push(period.starts_on, period.ends_on);
  }
  const assessments = ctx.db.query(
    `SELECT * FROM assessments WHERE gradebook_id=?${periodClause} ORDER BY assessment_date,id`,
    params
  ).rows;
  const evidence = latestEvidence(ctx, assessments.map(item => item.id), students.map(item => item.student_id));
  const resultRows = ctx.db.query(
    `SELECT gr.* FROM grade_results gr
      WHERE gr.gradebook_id=? AND gr.reporting_period_id IS ?
        AND gr.status IN ('calculated','overridden')
        AND gr.id=(SELECT MAX(x.id) FROM grade_results x
                    WHERE x.gradebook_id=gr.gradebook_id AND x.student_id=gr.student_id
                      AND x.reporting_period_id IS gr.reporting_period_id
                      AND x.status IN ('calculated','overridden'))`,
    [gradebook.id, period ? period.id : null]
  ).rows;
  const results = new Map(resultRows.map(item => [item.student_id, item]));
  const cells = new Map();
  evidence.forEach(item => cells.set(`${item.student_id}:${item.assessment_id}`, item));

  return {
    success: true,
    workspace: {
      gradebook,
      reporting_period_configuration: resolved,
      selected_reporting_period: period || null,
      assessments,
      students: students.map(enrolment => ({
        ...enrolment,
        result: results.get(enrolment.student_id) || null,
        evidence: assessments.map(assessment => ({
          assessment_id: assessment.id,
          evidence: cells.get(`${enrolment.student_id}:${assessment.id}`) || null
        }))
      })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
    }
  };
}

module.exports = { boot, teardown, reportingPeriods, read, resolvedPeriods };
