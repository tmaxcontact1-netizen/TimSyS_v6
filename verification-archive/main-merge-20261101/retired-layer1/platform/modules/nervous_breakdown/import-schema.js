'use strict';
// JSON Schema for producer tooling. Cross-record integrity is checked by validation.js.
const model = require('./model');
const id = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$' };
const text = { type: 'string', pattern: '\\S' };
const optionalText = { type: ['string', 'null'] };
const optionalId = { anyOf: [id, { type: 'null' }] };
const positive = { type: 'integer', minimum: 1 };
const nullablePositive = { anyOf: [positive, { type: 'null' }] };
const ids = { anyOf: [{ type: 'array', uniqueItems: true, items: id }, { type: 'null' }] };
const date = { anyOf: [{ type: 'string', format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, { type: 'null' }] };
const props = {
  status: { enum: model.STATUSES, default: 'draft' }, notes: optionalText, is_fixture: { type: 'boolean', default: false },
  effective_from: date, effective_to: date, superseded_by: optionalId,
  name: text, level: optionalText, level_id: optionalId, mapping_state: { enum: ['mapped', 'referenced', 'placeholder'] },
  source_type: { const: 'job_description' }, document_id: positive, document_version_id: positive,
  document_sha256: optionalText, version_label: text, role_id: id, source_id: id,
  original_text: text, location: text, section: optionalText, review_status: { enum: ['draft', 'proposed', 'reviewed'] },
  category: { enum: model.CATEGORIES }, definition: optionalText, parent_id: optionalId,
  directionality: { enum: ['directed', 'symmetric'] }, grouping: { enum: ['source_statement'] },
  aliases: { anyOf: [{ type: 'array', items: text }, { type: 'null' }] },
  normalized_statement: text, statement_id: optionalId, statement_revision: nullablePositive,
  domain_ids: ids, responsibility_type_ids: ids, authority_type_ids: ids,
  operational_ownership_id: nullablePositive, from_id: id, to_id: id,
  direction: { enum: ['from_to'] }, relationship_type_id: optionalId, evidence: { enum: model.EVIDENCE }, staff_id: text,
};
const required = {
  role: ['name', 'mapping_state'],
  source: ['name', 'source_type', 'document_id', 'document_version_id', 'version_label', 'role_id'],
  statement: ['source_id', 'original_text', 'location', 'review_status'],
  term: ['name', 'category'],
  responsibility: ['name', 'normalized_statement', 'role_id', 'statement_id', 'statement_revision', 'review_status'],
  connection: ['from_id', 'to_id', 'evidence', 'review_status'],
  role_assignment: ['role_id', 'staff_id'],
};
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'TimSyS Nervous Breakdown Layer 1 import', type: 'object',
  required: ['format', 'records', 'reason'],
  properties: {
    format: { const: 'timsys.nervous-breakdown.v1' }, reason: text,
    confirm_review: { type: 'boolean' }, dry_run: { type: 'boolean' },
    records: { type: 'array', minItems: 1, maxItems: 10000, items: { oneOf: model.KINDS.map(kind => ({ $ref: `#/$defs/${kind}` })) } },
  },
  // Server export metadata may travel back unchanged; it is never imported as authority.
  additionalProperties: true,
  $defs: Object.fromEntries(model.KINDS.map(kind => {
    const fields = Object.fromEntries([...model.COMMON, ...model.FIELDS[kind]].map(key => [key, props[key]]));
    if (kind === 'responsibility') { fields.evidence = { anyOf: [{ enum: model.EVIDENCE }, { type: 'null' }] }; fields.statement_id = id; fields.statement_revision = positive; }
    return [kind, { type: 'object', required: ['id', 'kind', 'expected_revision', 'data'], additionalProperties: true, properties: {
      id, kind: { const: kind }, expected_revision: { type: 'integer', minimum: 0 },
      data: { type: 'object', additionalProperties: false, required: required[kind], properties: fields },
    } }];
  })),
};
module.exports = schema;
