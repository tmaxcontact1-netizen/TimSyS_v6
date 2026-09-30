'use strict';

const KINDS = ['role', 'source', 'statement', 'term', 'responsibility', 'connection', 'role_assignment'];
const STATUSES = ['draft', 'active', 'inactive', 'superseded'];
const EVIDENCE = ['documentary', 'inferred', 'proposed', 'approved_operational', 'unresolved'];
const CATEGORIES = ['domain', 'responsibility_type', 'authority_type', 'relationship_type', 'responsibility_level'];
const FIELDS = {
  role: ['name', 'mapping_state', 'level'],
  source: ['name', 'source_type', 'document_id', 'document_version_id', 'document_sha256', 'version_label', 'role_id'],
  statement: ['source_id', 'original_text', 'location', 'section', 'review_status'],
  term: ['name', 'category', 'definition', 'parent_id', 'aliases', 'directionality', 'grouping', 'review_status'],
  responsibility: ['name', 'normalized_statement', 'role_id', 'statement_id', 'statement_revision', 'domain_ids', 'responsibility_type_ids', 'authority_type_ids', 'level', 'level_id', 'evidence', 'review_status', 'operational_ownership_id'],
  connection: ['from_id', 'to_id', 'direction', 'relationship_type_id', 'evidence', 'statement_id', 'statement_revision', 'review_status'],
  role_assignment: ['role_id', 'staff_id'],
};
const COMMON = ['status', 'notes', 'effective_from', 'effective_to', 'superseded_by', 'is_fixture'];
function fail(message, code = 'VALIDATION_ERROR', status = 400) {
  throw Object.assign(new Error(message), { code, status });
}
function text(value) { return typeof value === 'string' && value.trim().length > 0; }
function clean(kind, input) {
  if (!KINDS.includes(kind)) fail('Unknown record type');
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Record data must be an object');
  for (const key of Object.keys(input)) if (![...COMMON, ...FIELDS[kind]].includes(key)) fail(`Unknown ${kind} field: ${key}`);
  const value = { status: 'draft', notes: '', is_fixture: false, ...input };
  for (const key of ['role_id', 'source_id', 'statement_id', 'from_id', 'to_id', 'relationship_type_id', 'level_id', 'parent_id', 'superseded_by']) {
    if (value[key] != null && (typeof value[key] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(value[key]))) fail(`${key} must be a stable ID or null`);
  }
  for (const key of ['document_id', 'document_version_id', 'statement_revision', 'operational_ownership_id']) if (value[key] != null && (!Number.isInteger(value[key]) || value[key] < 1)) fail(`${key} must be a positive integer or null`);
  if (!STATUSES.includes(value.status)) fail('Invalid lifecycle status');
  if (typeof value.is_fixture !== 'boolean') fail('Fixture status must be true or false');
  if (value.notes != null && typeof value.notes !== 'string') fail('Notes must be text');
  for (const key of ['level', 'section', 'definition', 'document_sha256']) if (value[key] != null && typeof value[key] !== 'string') fail(`${key} must be text or null`);
  for (const key of ['effective_from', 'effective_to']) if (value[key] != null && (typeof value[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value[key]) || !Number.isFinite(Date.parse(value[key])) || new Date(value[key]).toISOString().slice(0, 10) !== value[key])) fail('Use a valid YYYY-MM-DD effective date or null');
  if (value.effective_from && value.effective_to && value.effective_from > value.effective_to) fail('Effective dates are reversed');
  if (['role', 'source', 'term', 'responsibility'].includes(kind) && !text(value.name)) fail('Name is required');
  if (kind === 'role' && !['mapped', 'referenced', 'placeholder'].includes(value.mapping_state)) fail('Role mapping state is required');
  if (kind === 'source' && (value.source_type !== 'job_description' || !Number.isInteger(value.document_id) || !Number.isInteger(value.document_version_id) || !text(value.version_label))) fail('A job description needs an exact document/version and a version label');
  if (kind === 'statement' && (!text(value.original_text) || !text(value.location))) fail('Exact source text and location are required');
  if (kind === 'term' && !CATEGORIES.includes(value.category)) fail('Ontology category is required');
  if (kind === 'term') {
    if (value.directionality != null && (value.category !== 'relationship_type' || !['directed', 'symmetric'].includes(value.directionality))) fail('Directionality requires a relationship type and directed or symmetric');
    if (value.grouping != null && (value.category !== 'relationship_type' || value.grouping !== 'source_statement' || value.directionality !== 'symmetric')) fail('Source-statement grouping requires a symmetric relationship type');
    if (value.review_status != null && !['draft', 'proposed', 'reviewed'].includes(value.review_status)) fail('Invalid ontology review status');
    if (value.status === 'active' && value.review_status != null && value.review_status !== 'reviewed') fail('Review a record before activating it');
  }
  if (kind === 'term' && value.aliases != null && (!Array.isArray(value.aliases) || value.aliases.some(x => !text(x)))) fail('Aliases must be a list of terms or null');
  if (kind === 'responsibility' && !text(value.normalized_statement)) fail('Responsibility wording is required');
  if (['statement', 'responsibility', 'connection'].includes(kind)) {
    if (!['draft', 'proposed', 'reviewed'].includes(value.review_status)) fail('Review status is required');
    if (value.status === 'active' && value.review_status !== 'reviewed') fail('Review a record before activating it');
  }
  if ((kind === 'connection' || (kind === 'responsibility' && value.evidence != null)) && !EVIDENCE.includes(value.evidence)) fail('Connection evidentiary basis is required');
  if (kind === 'connection' && 'direction' in value && value.direction !== 'from_to') fail('Direction must be from_to; reverse the endpoints for the opposite direction');
  if (kind === 'connection' && !value.statement_id && value.statement_revision != null) fail('An evidence revision requires an evidence statement');
  if (kind === 'role_assignment' && !text(value.staff_id)) fail('Canonical staff ID is required');
  return value;
}
function validateNetwork(records, revisions = new Map(), errors = null) {
  const map = new Map(records.map(r => [r.id, r]));
  if (map.size !== records.length) fail('Duplicate stable IDs');
  const activeSources = new Set();
  const symmetricPairs = new Set();
  for (const record of records) {
    try {
    const d = record.data;
    const ref = (id, kind, label, optional = false) => {
      if (!id && optional) return null;
      const target = map.get(id);
      if (!target || target.kind !== kind) fail(`${record.id}: ${label} must reference an existing ${kind}`);
      if (!d.is_fixture && target.data.is_fixture) fail('Organisational records cannot depend on test fixtures');
      return target;
    };
    if (d.superseded_by) {
      if (d.status !== 'superseded') fail('A supersession link requires superseded status');
      ref(d.superseded_by, record.kind, 'Successor');
      const seen = new Set([record.id]); let next = d.superseded_by;
      while (next) { if (seen.has(next)) fail('Supersession loop'); seen.add(next); next = map.get(next)?.data.superseded_by; }
    }
    if (record.kind === 'source') {
      ref(d.role_id, 'role', 'Source role');
      if (d.status === 'active') {
        const key = `${d.document_id}:${d.role_id}:${d.is_fixture}`;
        if (activeSources.has(key)) fail('Conflicting active source versions: supersede the earlier source in the same batch');
        activeSources.add(key);
      }
    }
    if (record.kind === 'statement') ref(d.source_id, 'source', 'Source');
    if (record.kind === 'role_assignment') ref(d.role_id, 'role', 'Role');
    if (record.kind === 'term' && d.parent_id) {
      const parent = ref(d.parent_id, 'term', 'Parent');
      if (parent.data.category !== d.category) fail('Parent ontology category differs');
      const seen = new Set([record.id]); let next = d.parent_id;
      while (next) { if (seen.has(next)) fail('Ontology hierarchy loop'); seen.add(next); next = map.get(next)?.data.parent_id; }
    }
    if (record.kind === 'responsibility' || (record.kind === 'connection' && d.statement_id)) {
      const statement = ref(d.statement_id, 'statement', 'Provenance statement');
      if (!Number.isInteger(d.statement_revision) || d.statement_revision < 1) fail('Pin an exact source-statement revision');
      const snapshot = d.statement_revision === statement.revision ? statement : revisions.get(`${statement.id}:${d.statement_revision}`);
      if (!snapshot) fail('Source-statement revision does not exist');
      if (d.status === 'active' && snapshot.data.review_status !== 'reviewed') fail('Active records require reviewed source wording');
      if (record.kind === 'responsibility') {
        ref(d.role_id, 'role', 'Formal role');
        const source = ref(snapshot.data.source_id, 'source', 'Source');
        if (source.data.role_id !== d.role_id) fail('Formal role must match its source role');
      }
    }
    if (record.kind === 'responsibility') {
      if (d.level_id != null && ref(d.level_id, 'term', 'Responsibility level').data.category !== 'responsibility_level') fail('Responsibility level must reference a responsibility_level term');
      for (const [field, category] of [['domain_ids', 'domain'], ['responsibility_type_ids', 'responsibility_type'], ['authority_type_ids', 'authority_type']]) {
        if (d[field] == null) continue;
        if (!Array.isArray(d[field]) || new Set(d[field]).size !== d[field].length) fail(`${field} must be a list of unique ontology IDs or null`);
        for (const id of d[field]) if (ref(id, 'term', field).data.category !== category) fail(`${field} contains the wrong ontology category`);
      }
    }
    if (record.kind === 'connection') {
      ref(d.from_id, 'responsibility', 'Start'); ref(d.to_id, 'responsibility', 'End');
      if (d.from_id === d.to_id) fail('A connection must join distinct responsibilities');
      if (d.relationship_type_id != null && ref(d.relationship_type_id, 'term', 'Relationship type').data.category !== 'relationship_type') fail('Wrong relationship ontology category');
      if (d.evidence === 'documentary' && !d.statement_id) fail('Documentary connections need source evidence');
      const type = map.get(d.relationship_type_id)?.data;
      if (type?.directionality === 'symmetric' && ['draft', 'active'].includes(d.status)) {
        const key = JSON.stringify([d.is_fixture, d.relationship_type_id, ...[d.from_id, d.to_id].sort()]);
        if (symmetricPairs.has(key)) fail('Duplicate symmetric connection; do not create a reverse edge');
        symmetricPairs.add(key);
      }
      if (type?.grouping === 'source_statement') {
        const a = map.get(d.from_id).data, b = map.get(d.to_id).data;
        if (d.evidence !== 'documentary' || a.evidence !== 'documentary' || b.evidence !== 'documentary' || !d.statement_id || a.statement_id !== d.statement_id || b.statement_id !== d.statement_id || a.statement_revision !== d.statement_revision || b.statement_revision !== d.statement_revision) fail('Companion grouping requires shared pinned documentary source-statement provenance');
      }
    }
    } catch (error) {
      if (!errors || !error.status) throw error;
      errors.push({ severity: 'error', code: error.code, record_id: record.id, field: null, message: error.message });
    }
  }
}
function graph(records, filters = {}) {
  if (filters.mode != null && !['normal', 'draft_review'].includes(filters.mode)) fail('Unknown graph mode');
  const draftReview = filters.mode === 'draft_review';
  const byId = new Map(records.map(r => [r.id, r]));
  const fixtures = filters.fixtures === 'true';
  const nodes = records.filter(r => r.kind === 'responsibility' && r.data.is_fixture === fixtures && (filters.status === 'all' || (!filters.status && draftReview) || r.data.status === (filters.status || 'active'))).filter(r => {
    const d = r.data, statement = byId.get(d.statement_id), source = byId.get(statement?.data.source_id);
    const classifications = [...(d.domain_ids || []), ...(d.responsibility_type_ids || []), ...(d.authority_type_ids || []), ...(d.level_id ? [d.level_id] : [])];
    const search = [d.name, d.normalized_statement, byId.get(d.role_id)?.data.name, statement?.data.original_text, source?.data.name, ...classifications.map(id => JSON.stringify(byId.get(id)?.data))].join(' ').toLowerCase();
    return (!filters.q || search.includes(String(filters.q).toLowerCase())) && (!filters.role_id || d.role_id === filters.role_id) && (!filters.source_id || source?.id === filters.source_id) && (!filters.term_id || classifications.includes(filters.term_id));
  });
  const ids = new Set(nodes.map(r => r.id));
  const edges = records.filter(r => r.kind === 'connection' && r.data.is_fixture === fixtures && (draftReview ? ['draft', 'active'].includes(r.data.status) : r.data.status === 'active' && r.data.review_status === 'reviewed') && ids.has(r.data.from_id) && ids.has(r.data.to_id) && (!filters.evidence || r.data.evidence === filters.evidence) && (!filters.relationship_type_id || r.data.relationship_type_id === filters.relationship_type_id));
  const projectedEdges = edges.map(edge => {
    const type = byId.get(edge.data.relationship_type_id)?.data;
    const directionality = type?.directionality || 'directed';
    return { ...edge, semantics: { directionality, process_order_inference: directionality === 'symmetric' ? 'excluded' : 'not_established', grouping: type?.grouping || null, source_statement_id: type?.grouping === 'source_statement' ? edge.data.statement_id : null, statement_revision: type?.grouping === 'source_statement' ? edge.data.statement_revision : null } };
  });
  const groups = new Map();
  for (const node of nodes) {
    const d = node.data; if (!d.statement_id) continue;
    const key = `${d.statement_id}:${d.statement_revision}`;
    if (!groups.has(key)) groups.set(key, { statement_id: d.statement_id, statement_revision: d.statement_revision, nodes: [] });
    groups.get(key).nodes.push(node.id);
  }
  return { nodes, edges: projectedEdges, statement_groups: [...groups.values()] };
}
function trail(network, selected, direction = 'both', depth = 2) {
  if (!['both', 'upstream', 'downstream'].includes(direction)) fail('Invalid trail direction');
  if (!Number.isInteger(depth) || depth < 0 || depth > 20) fail('Trail depth must be from 0 to 20');
  const nodes = new Set(), edges = new Set();
  if (!network.nodes.some(n => n.id === selected)) return { nodes: [], edges: [] };
  const adjacency = new Map();
  for (const edge of network.edges) {
    const { from_id: from, to_id: to } = edge.data;
    const symmetric = edge.semantics?.directionality === 'symmetric';
    for (const [a, b] of [...(symmetric || direction !== 'upstream' ? [[from, to]] : []), ...(symmetric || direction !== 'downstream' ? [[to, from]] : [])]) {
      if (!adjacency.has(a)) adjacency.set(a, []); adjacency.get(a).push([b, edge.id]);
    }
  }
  nodes.add(selected); let frontier = [selected];
  for (let level = 0; level < depth && frontier.length; level++) {
    const next = [];
    for (const id of frontier) for (const [target, edge] of adjacency.get(id) || []) {
      edges.add(edge); if (!nodes.has(target)) { nodes.add(target); next.push(target); }
    }
    frontier = next;
  }
  return { nodes: [...nodes], edges: [...edges] };
}
module.exports = { KINDS, STATUSES, EVIDENCE, CATEGORIES, FIELDS, COMMON, clean, validateNetwork, graph, trail, fail };
