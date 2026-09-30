'use strict';
// Reports observations, never resolves organisational ambiguity or rewrites source data.
const model = require('./model');
function inspect(records, historical) {
  const errors = [], warnings = [], map = new Map(records.map(r => [r.id, r]));
  const add = (list, r, field, code, message) => list.push({ severity: list === errors ? 'error' : 'warning', record_id: r.id, field, code, message });
  const duplicate = new Map();
  for (const r of records) {
    const d = r.data;
    const refs = [];
    if (['source', 'responsibility', 'role_assignment'].includes(r.kind)) refs.push(['role_id', 'role']);
    if (r.kind === 'statement') refs.push(['source_id', 'source']);
    if (r.kind === 'responsibility' || d.statement_id) refs.push(['statement_id', 'statement']);
    if (r.kind === 'connection') refs.push(['from_id', 'responsibility'], ['to_id', 'responsibility']);
    if (d.relationship_type_id != null) refs.push(['relationship_type_id', 'term']);
    if (d.level_id != null) refs.push(['level_id', 'term']);
    if (d.parent_id) refs.push(['parent_id', 'term']);
    if (d.superseded_by) refs.push(['superseded_by', r.kind]);
    for (const [field, kind] of refs) {
      const target = map.get(d[field]);
      if (!target || target.kind !== kind) add(errors, r, field, 'UNKNOWN_REFERENCE', `Expected an existing ${kind}: ${d[field] ?? '(missing)'}`);
      else {
        if (target.data.status !== 'active') add(warnings, r, field, 'NON_ACTIVE_REFERENCE', `References ${target.id} in ${target.data.status} state; review applicability.`);
        if (d.effective_from && target.data.effective_to && d.effective_from > target.data.effective_to) add(warnings, r, field, 'EFFECTIVE_DATE_REVIEW', 'Record starts after its referenced record ends; review applicability, not an automatic rewrite.');
      }
    }
    if (r.kind === 'responsibility') {
      for (const [field, category] of [['domain_ids', 'domain'], ['responsibility_type_ids', 'responsibility_type'], ['authority_type_ids', 'authority_type']]) {
        if (d[field] == null || (Array.isArray(d[field]) && !d[field].length)) add(warnings, r, field, 'UNRESOLVED_CLASSIFICATION', 'Classification not supplied; retained as unknown/unclassified.');
        if (Array.isArray(d[field])) for (const id of d[field]) {
          const term = map.get(id);
          if (!term || term.kind !== 'term' || term.data.category !== category) add(errors, r, field, 'UNKNOWN_ONTOLOGY_TERM', `Expected a ${category} term: ${id}`);
          else if (term.data.status !== 'active') add(warnings, r, field, 'NON_ACTIVE_TERM', `Term ${id} is ${term.data.status}; review classification.`);
        }
      }
      if (d.level_id != null) {
        const term = map.get(d.level_id);
        if (!term || term.kind !== 'term' || term.data.category !== 'responsibility_level') add(errors, r, 'level_id', 'INVALID_LEVEL_TERM', 'Expected a responsibility_level ontology term.');
        else if (d.level && d.level !== term.data.name) add(warnings, r, 'level', 'LEVEL_LABEL_REVIEW', 'Legacy level text differs from the governed term name; both values are retained.');
      }
      if (!d.level && !d.level_id) add(warnings, r, 'level', 'UNRESOLVED_LEVEL', 'Level unspecified; no level inferred.');
    }
    if (r.kind === 'connection') {
      if (d.relationship_type_id == null) add(warnings, r, 'relationship_type_id', 'UNRESOLVED_RELATIONSHIP', 'Relationship type is unknown; endpoints and direction are retained.');
      else if (map.get(d.relationship_type_id)?.data.category !== 'relationship_type') add(errors, r, 'relationship_type_id', 'INVALID_RELATIONSHIP_TYPE', 'Reference must be a relationship_type term.');
      if (d.evidence !== 'documentary' && !d.statement_id) add(warnings, r, 'statement_id', 'NO_DOCUMENTARY_EVIDENCE', 'No documentary evidence supplied; evidence status is retained.');
      if (['inferred', 'proposed', 'unresolved'].includes(d.evidence)) add(warnings, r, 'evidence', 'ORGANISATIONAL_REVIEW', `Connection evidence is ${d.evidence}; not documentary truth.`);
    }
    if (r.kind === 'role' && d.mapping_state !== 'mapped') add(warnings, r, 'mapping_state', 'UNRESOLVED_ROLE_MAPPING', `Role is ${d.mapping_state}; no role mapping inferred.`);
    if (r.kind === 'term' && !d.definition) add(warnings, r, 'definition', 'MISSING_DEFINITION', 'Term definition not supplied.');
    if (['draft', 'proposed'].includes(d.review_status)) add(warnings, r, 'review_status', 'PENDING_REVIEW', 'Record has not been marked reviewed.');
    if (d.status === 'superseded' && !d.superseded_by) add(warnings, r, 'superseded_by', 'UNKNOWN_SUCCESSOR', 'Superseded record has no known successor.');
    const normalized = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    let signature;
    if (r.kind === 'responsibility') signature = [r.kind, d.is_fixture, d.role_id, normalized(d.normalized_statement)];
    if (r.kind === 'connection') signature = [r.kind, d.is_fixture, d.from_id, d.to_id, d.relationship_type_id];
    if (r.kind === 'term') signature = [r.kind, d.is_fixture, d.category, d.parent_id || null, normalized(d.name)];
    if (r.kind === 'statement') signature = [r.kind, d.is_fixture, d.source_id, d.location, d.original_text];
    if (signature) {
      const key = JSON.stringify(signature);
      if (duplicate.has(key)) add(warnings, r, null, 'POSSIBLE_DUPLICATE', `Similar record ${duplicate.get(key)} exists; neither record is merged or discarded.`);
      else duplicate.set(key, r.id);
    }
  }
  model.validateNetwork(records, historical, errors);
  return { valid: errors.length === 0, errors, warnings };
}
module.exports = { inspect };
