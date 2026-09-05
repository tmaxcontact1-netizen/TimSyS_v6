'use strict';

const db = require('../../db');
const products = require('../products');

const ID = 'principal.operations';
const VERSION = '1.0.0';
const APP = 'principal-ed';

function exists(table) { return Boolean(db.scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", [table])); }
function count(table, sql, parameters) { return exists(table) ? Number(db.scalar(sql, parameters) || 0) : 0; }
function evidence(area, code, value) { return [{ kind: 'operational_queue', area, code, count: value, appId: APP }]; }
function add(created, input) {
  if (!input.count) return;
  created.push(products.create({
    type: input.type || 'alert', scope: { type: 'organisation', id: 'current' },
    title: input.title, summary: input.summary, explanation: input.explanation,
    evidence: evidence(input.area, input.code, input.count), possibleActions: input.actions,
    confidence: 1, severity: input.severity || 'warning', audience: ['principal', 'superuser', 'developer'],
    providerId: ID, providerVersion: VERSION, providerRunId: input.runId,
  }));
}

function analyse(context) {
  const created = [];
  const queues = {
    gradebooksWithoutPolicy: count('gradebook_instances', "SELECT COUNT(*) FROM gradebook_instances g WHERE g.app_id=? AND g.status='active' AND NOT EXISTS(SELECT 1 FROM evaluation_policy_assignments a JOIN evaluation_policies p ON p.id=a.policy_id WHERE a.app_id=g.app_id AND a.status='active' AND p.status='active' AND ((a.scope_type='gradebook' AND a.scope_id=CAST(g.id AS TEXT)) OR (a.scope_type='course' AND a.scope_id=CAST(g.subject_id AS TEXT)) OR a.scope_type='school'))", [APP]),
    insufficientGradeEvidence: count('grade_results', "SELECT COUNT(*) FROM grade_results r JOIN gradebook_instances g ON g.id=r.gradebook_id WHERE g.app_id=? AND r.status IN ('calculated','overridden') AND r.confidence='insufficient'", [APP]),
    reportsAwaitingModeration: count('grade_report_snapshots', "SELECT COUNT(*) FROM grade_report_snapshots WHERE app_id=? AND status='submitted'", [APP]),
    reportsAwaitingPublication: count('grade_report_snapshots', "SELECT COUNT(*) FROM grade_report_snapshots WHERE app_id=? AND status='approved'", [APP]),
    lateEntryExceptions: count('late_entry_exceptions', "SELECT COUNT(*) FROM late_entry_exceptions WHERE app_id=? AND status='open'", [APP]),
    lateEntryReconciliations: count('late_entries', "SELECT COUNT(*) FROM late_entries WHERE app_id=? AND status IN ('context_resolved','reconciliation_pending','exception')", [APP]),
    lateEntryThresholds: count('late_entry_threshold_cases', "SELECT COUNT(*) FROM late_entry_threshold_cases WHERE app_id=? AND status='recommended'", [APP]),
    programmeFlaggedResponses: count('programme_manager_responses', "SELECT COUNT(*) FROM programme_manager_responses WHERE app_id=? AND status='flagged'", [APP]),
    programmeIdentityReviews: count('programme_manager_identity_resolutions', "SELECT COUNT(*) FROM programme_manager_identity_resolutions WHERE app_id=? AND status IN ('ambiguous','unresolved')", [APP]),
    programmeAllocationDecisions: count('programme_manager_allocation_recommendations', "SELECT COUNT(*) FROM programme_manager_allocation_recommendations r JOIN programme_manager_allocation_runs x ON x.id=r.allocation_run_id LEFT JOIN programme_manager_allocation_decisions d ON d.recommendation_id=r.id WHERE r.app_id=? AND x.status='generated' AND r.state<>'excluded' AND d.id IS NULL", [APP]),
    failedAttendanceHandoffs: count('programme_manager_attendance_handoffs', "SELECT COUNT(*) FROM programme_manager_attendance_handoffs WHERE app_id=? AND status='failed'", [APP]),
    preferenceRestrictions: count('teacher_preference_entries', "SELECT COUNT(*) FROM teacher_preference_entries WHERE app_id=? AND status='active' AND stance='declared_restriction' AND review_state='pending'", [APP]),
    studentExitExceptions: count('student_exit_exceptions', "SELECT COUNT(*) FROM student_exit_exceptions WHERE app_id=? AND status='open'", [APP]),
    unresolvedStudentExits: count('student_exits', "SELECT COUNT(*) FROM student_exits WHERE app_id=? AND status NOT IN ('checked_in','closed','cancelled','denied')", [APP]),
    infeasibleSchedulerRuns: count('scheduler_validation_runs', "SELECT COUNT(*) FROM scheduler_validation_runs v WHERE v.app_id=? AND v.feasible=0 AND v.id IN (SELECT MAX(id) FROM scheduler_validation_runs WHERE app_id=? GROUP BY scheduler_setup_id)", [APP, APP]),
  };
  const definitions = [
    ['gradebooksWithoutPolicy','gradebook','missing_policy','Active gradebooks need an evaluation policy','active gradebook(s) have no resolvable active evaluation policy.','Assign and review the appropriate school, course or gradebook policy.'],
    ['insufficientGradeEvidence','gradebook','insufficient_evidence','Some calculated results have insufficient evidence','calculated result(s) are explicitly marked as having insufficient evidence.','Review the underlying assessment evidence before reporting.'],
    ['reportsAwaitingModeration','gradebook','moderation','Grade reports await moderation','submitted report(s) require a human moderation decision.','Open the grade reporting moderation queue.'],
    ['reportsAwaitingPublication','gradebook','publication','Approved grade reports await publication','approved report(s) have not yet been published.','Confirm the intended audience and publish when ready.'],
    ['lateEntryExceptions','attendance','late_exception','Late-entry exceptions require review','arrival context exception(s) remain open.','Resolve the recorded context before relying on attendance conclusions.'],
    ['lateEntryReconciliations','attendance','late_reconciliation','Attendance reconciliation is incomplete','late-entry record(s) have not completed attendance reconciliation.','Review and explicitly confirm or reject the proposed reconciliation.'],
    ['lateEntryThresholds','attendance','late_threshold','Tardy threshold recommendations await decisions','threshold recommendation(s) await a human decision.','Review the evidence and approve, modify or dismiss each recommendation.'],
    ['programmeFlaggedResponses','programme_manager','flagged_response','Programme responses contain intake flags','survey response(s) require contextual review.','Review the flagged response without changing its recorded submission evidence.'],
    ['programmeIdentityReviews','programme_manager','identity_review','Programme identities require reconciliation','response identity record(s) are ambiguous or unresolved.','Resolve identity before allocation.'],
    ['programmeAllocationDecisions','programme_manager','allocation_decision','Programme allocations await human decisions','current allocation recommendation(s) remain undecided.','Accept, alter or reject recommendations before publishing enrolments.'],
    ['failedAttendanceHandoffs','programme_manager','attendance_handoff','Attendance roster handoffs failed','Event Attendance handoff(s) require retry.','Review the error and retry the explicit handoff.'],
    ['preferenceRestrictions','teacher_preferences','restriction_review','Declared teacher restrictions await review','declared restriction(s) remain pending.','Review the declaration before using it as scheduling evidence.'],
    ['studentExitExceptions','student_exits','exit_exception','Student-exit exceptions require review','movement exception(s) remain unresolved.','Reconcile location and context through an authorised human.'],
    ['unresolvedStudentExits','student_exits','open_exit','Student exits remain operationally open','student movement record(s) have not reached a closed state.','Confirm current student locations and complete the appropriate workflow.'],
    ['infeasibleSchedulerRuns','scheduler','infeasible_latest','Latest scheduler validation is infeasible','scheduler setup(s) have a latest validation run with hard conflicts.','Review the explained hard constraints before selecting or publishing a timetable.'],
  ];
  for (const [key, area, code, title, sentence, action] of definitions) add(created, { runId: context.runId, count: queues[key], area, code, title, summary: `${queues[key]} ${sentence}`, explanation: 'This is a deterministic count from the module’s current operational state. It identifies work awaiting review and does not make the decision.', actions: [action] });
  return { queues, products: created };
}

module.exports = { id: ID, version: VERSION, analyse, governance: {
  inputs: ['gradebook workflow state', 'attendance workflow state', 'programme workflow state', 'teacher preference review state', 'student-exit workflow state', 'scheduler validation state'],
  outputs: ['alert', 'operational review queues'], supportedScopes: ['organisation'],
  minimumEvidence: { alert: 1 }, confidenceMethod: 'exact current queue counts from explicit workflow states',
  failureMode: 'missing optional module tables contribute zero; query failures fail the provider visibly', knowledgeDependencies: [],
  suppression: ['no product for an empty queue', 'no causal, disciplinary, fairness or performance inference'],
} };
