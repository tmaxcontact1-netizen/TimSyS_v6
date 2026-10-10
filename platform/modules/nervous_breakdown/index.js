'use strict';
const crypto = require('crypto');
const model = require('./model');
const { inspect } = require('./validation');
const { isDeepStrictEqual } = require('util');
const importSchema = require('./import-schema');
const { vocabulary } = require('./vocabulary');
const scope = require('../../shared/services/appScope');
const unpack = row => ({ id: row.id, kind: row.kind, revision: row.revision, data: JSON.parse(row.data_json), created_at: row.created_at, updated_at: row.updated_at });
function all(ctx, app) { return ctx.db.query('SELECT * FROM nb_records WHERE app_id=? ORDER BY kind,id', [app]).rows.map(unpack); }
function histories(ctx, app) {
  return ctx.db.query('SELECT h.* FROM nb_revisions h JOIN nb_records r ON r.id=h.record_id WHERE r.app_id=? ORDER BY h.record_id,h.revision', [app]).rows;
}
async function invoke(ctx, name, req) {
  const fn = ctx.functionRegistry.get(name);
  if (!fn) model.fail(`Required service unavailable: ${name}`, 'SERVICE_UNAVAILABLE', 503);
  const result = await fn.implementation(req, ctx);
  if (!result.success) model.fail(result.error?.message || 'Linked service failed', result.error?.code, result.statusCode || 400);
  return result;
}
function wrap(fn) { return async (req, ctx) => { try { return await fn(req, ctx); } catch (error) { if (error.code === 'INVALID_APP_SCOPE') error.status = 400; if (!error.status) throw error; return { success: false, statusCode: error.status, error: { code: error.code, message: error.message } }; } }; }
function boot(ctx) { ctx.log.info('Nervous Breakdown responsibility network ready', { module: 'nervous_breakdown' }); }
function teardown() {}
const workspace = wrap(async (req, ctx) => {
  const records = all(ctx, scope.fromRequest(req));
  return { success: true, records: req.query.compact === 'true' ? [] : records, can_draft_review: ctx.auth.checkPerm(req.user, 'admin:nervous_breakdown:govern'), import_schema: importSchema, ontology: vocabulary(records), schema: { kinds: model.KINDS, fields: model.FIELDS, statuses: model.STATUSES, evidence: model.EVIDENCE, categories: model.CATEGORIES } };
});
async function externalReferences(req, ctx, changed) {
  for (const record of changed) {
    const d = record.data;
    if (record.kind === 'source') {
      if (!ctx.auth.checkPerm(req.user, 'admin:documents:read')) model.fail('Reading source Documents requires document read permission', 'FORBIDDEN', 403);
      const result = await invoke(ctx, 'documents_history', { ...req, params: { id: d.document_id } });
      const version = result.document.versions.find(v => v.id === d.document_version_id);
      if (!version) model.fail('Source document version does not exist');
      if (d.document_sha256 && d.document_sha256 !== version.sha256) model.fail('Source document digest mismatch');
      d.document_sha256 = version.sha256;
    }
    if (record.kind === 'role_assignment') {
      // Canonical registry identity, declared as a dependency; never copied into the formal role.
      if (!ctx.db.query('SELECT id FROM staff WHERE staff_id=?', [d.staff_id]).rows.length) model.fail('Canonical staff ID was not found');
    }
    if (record.kind === 'responsibility' && d.operational_ownership_id) {
      if (!ctx.db.query('SELECT id FROM responsibilities WHERE id=? AND app_id=?', [d.operational_ownership_id, scope.fromRequest(req)]).rows.length) model.fail('Operational ownership record was not found');
    }
  }
}
async function apply(req, ctx, items) {
  const app = scope.fromRequest(req), reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason) model.fail('A reason for the change is required');
  for (const field of ['dry_run', 'confirm_review']) if (req.body[field] != null && typeof req.body[field] !== 'boolean') model.fail(`${field} must be boolean`);
  if (!Array.isArray(items) || items.length < 1 || items.length > 10000) model.fail('Provide between 1 and 10,000 records');
  const current = all(ctx, app), map = new Map(current.map(r => [r.id, r])), ids = new Set();
  const baseline = new Map(current.map(r => [r.id, r]));
  const rowErrors = [], unchanged = [], changes = [];
  for (const [row, input] of items.entries()) {
    try {
    if (!input || typeof input !== 'object') model.fail('Every import row must be a record object');
    if (req.body.format && !input.id) model.fail('Imports require an explicit stable ID', 'MISSING_ID');
    const id = input.id || crypto.randomUUID();
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(id)) model.fail('Invalid stable ID', 'INVALID_ID');
    if (ids.has(id)) model.fail('Duplicate stable ID in batch', 'DUPLICATE_ID');
    ids.add(id); const old = map.get(id);
    if (!old && ctx.db.query('SELECT id FROM nb_records WHERE id=?', [id]).rows.length) model.fail('Stable ID belongs to another application scope', 'REVISION_CONFLICT', 409);
    if (input.expected_revision !== (old?.revision || 0)) model.fail(`Record ${id} changed; reload and review before saving`, 'REVISION_CONFLICT', 409);
    if (old && old.kind !== input.kind) model.fail('Record kind cannot change');
    const next = { id, kind: input.kind, revision: (old?.revision || 0) + 1, data: model.clean(input.kind, input.data) };
    if (next.data.is_fixture && process.env.NODE_ENV !== 'test') model.fail('Synthetic records belong in an isolated test database, not the working application.', 'TEST_DATA_NOT_ALLOWED');
    if (old && old.data.is_fixture !== next.data.is_fixture) model.fail('Test records cannot be converted into organisational records');
    if (old?.kind === 'source' && ['document_id', 'document_version_id', 'role_id'].some(k => old.data[k] !== next.data[k])) model.fail('Create a successor source to change its document version or formal role');
    if (old?.kind === 'statement' && old.data.source_id !== next.data.source_id) model.fail('A source statement cannot move between sources');
    if (next.data.review_status === 'reviewed' && req.body.confirm_review !== true && req.body.dry_run !== true) model.fail('Explicit human review confirmation is required');
    await externalReferences(req, ctx, [next]);
    if (old && isDeepStrictEqual(old.data, next.data)) { unchanged.push(old); continue; }
    map.set(id, next); changes.push(next);
    } catch (error) {
      if (!error.status) throw error;
      rowErrors.push({ severity: 'error', row: row + 1, record_id: input?.id || null, field: null, code: error.code, message: error.message, status: error.status });
    }
  }
  const historical = new Map(histories(ctx, app).map(h => [`${h.record_id}:${h.revision}`, JSON.parse(h.snapshot_json)]));
  const report = inspect([...map.values()], historical);
  report.errors.unshift(...rowErrors);
  report.valid = report.errors.length === 0;
  report.counts = { submitted: items.length, changes: changes.length, unchanged: unchanged.length, errors: report.errors.length, warnings: report.warnings.length };
  if (!report.valid) return { success: false, statusCode: rowErrors.some(e => e.status === 403) ? 403 : rowErrors.some(e => e.status === 409) ? 409 : 400, error: { code: 'IMPORT_INVALID', message: report.errors[0].message }, report };
  if (req.body.dry_run === true) return { success: true, dry_run: true, report };
  ctx.db.transaction(() => {
    const fresh = all(ctx, app);
    if (fresh.length !== current.length || fresh.some(r => baseline.get(r.id)?.revision !== r.revision)) model.fail('The network changed during validation; reload before saving', 'REVISION_CONFLICT', 409);
    for (const next of changes) {
      const expected = next.revision - 1;
      if (expected === 0) {
        if (ctx.db.query('SELECT id FROM nb_records WHERE id=?', [next.id]).rows.length) model.fail('Stable ID already exists', 'REVISION_CONFLICT', 409);
        ctx.db.query('INSERT INTO nb_records(id,app_id,kind,revision,data_json) VALUES(?,?,?,?,?)', [next.id, app, next.kind, next.revision, JSON.stringify(next.data)]);
      } else {
        const result = ctx.db.query("UPDATE nb_records SET revision=?,data_json=?,updated_at=datetime('now') WHERE id=? AND app_id=? AND revision=?", [next.revision, JSON.stringify(next.data), next.id, app, expected]);
        if (result.changes !== 1) model.fail('A concurrent edit occurred; reload before retrying', 'REVISION_CONFLICT', 409);
      }
      ctx.db.query('INSERT INTO nb_revisions(record_id,revision,snapshot_json,actor_id,reason) VALUES(?,?,?,?,?)', [next.id, next.revision, JSON.stringify(next), String(req.user.id), reason]);
      ctx.log.audit('nervous_breakdown.saved', String(req.user.id), { entityType: 'formal_' + next.kind, entityId: next.id, oldValue: baseline.get(next.id), newValue: next });
    }
  });
  for (const record of changes.filter(r => !r.data.is_fixture)) ctx.events.publish('nervous_breakdown.changed', { entityId: record.id, record: { id: record.id, kind: record.kind, revision: record.revision, status: record.data.status }, __module: 'nervous_breakdown' });
  return { success: true, records: [...changes, ...unchanged], report };
}
const save = wrap((req, ctx) => apply(req, ctx, [req.body.record]));
const importRecords = wrap((req, ctx) => {
  if (req.body.format !== 'timsys.nervous-breakdown.v1') model.fail('Unsupported import format');
  return apply(req, ctx, req.body.records);
});
const exportRecords = wrap(async (req, ctx) => {
  const app = scope.fromRequest(req);
  return { success: true, format: 'timsys.nervous-breakdown.v1', exported_at: new Date().toISOString(), ontology: vocabulary(all(ctx, app)), records: all(ctx, app).map(r => ({ ...r, expected_revision: r.revision })), history: histories(ctx, app), source_files: 'Document IDs and immutable versions refer to the host Documents store. Back up that store with this export. For a new record in an empty store use expected_revision: 0; historical snapshots are exported for recovery and analysis, not client-written into server history.' };
});
const history = wrap(async (req, ctx) => ({ success: true, history: histories(ctx, scope.fromRequest(req)).filter(h => h.record_id === req.params.id).map(h => ({ ...h, snapshot: JSON.parse(h.snapshot_json), snapshot_json: undefined })) }));
const graph = wrap(async (req, ctx) => {
  if (req.query.mode === 'draft_review' && !ctx.auth.checkPerm(req.user, 'admin:nervous_breakdown:govern')) model.fail('Draft Review requires organisational governance permission', 'FORBIDDEN', 403);
  const network = model.graph(all(ctx, scope.fromRequest(req)), req.query);
  return { success: true, mode: req.query.mode || 'normal', ...network, trail: model.trail(network, req.query.selected, req.query.direction || 'both', req.query.depth == null ? 2 : Number(req.query.depth)) };
});
function assertProjection(req, ctx) {
  if (req.query.mode === 'draft_review' && !ctx.auth.checkPerm(req.user, 'admin:nervous_breakdown:govern')) model.fail('Draft Review requires organisational governance permission', 'FORBIDDEN', 403);
}
const topology = wrap(async (req, ctx) => {
  assertProjection(req, ctx);
  const app = scope.fromRequest(req);
  return {success:true,...require('./exploration').project(all(ctx,app),req.query,app)};
});
const detail = wrap(async (req, ctx) => {
  assertProjection(req,ctx);
  const app=scope.fromRequest(req), records=all(ctx,app), map=new Map(records.map(r=>[r.id,r]));
  const projection=require('./exploration').project(records,req.query,app);
  if (![...projection.nodes,...projection.edges].some(r=>r.id===req.params.id)) model.fail('Record is not visible in this projection','NOT_FOUND',404);
  const record=map.get(req.params.id), d=record.data;
  const statement=d.statement_id ? map.get(d.statement_id) : null;
  const pinned=statement && (statement.revision===d.statement_revision ? statement : JSON.parse(histories(ctx,app).find(h=>h.record_id===statement.id&&h.revision===d.statement_revision)?.snapshot_json || 'null'));
  const source=map.get(pinned?.data.source_id);
  const related=records.filter(r=>r.kind==='connection'&&(r.data.from_id===record.id||r.data.to_id===record.id));
  return {success:true,record,statement:pinned,source,related,history:histories(ctx,app).filter(h=>h.record_id===record.id).map(h=>({...h,snapshot:JSON.parse(h.snapshot_json),snapshot_json:undefined}))};
});
module.exports = { boot, teardown, workspace, save, importRecords, exportRecords, history, graph, topology, detail };
