'use strict';
const groups = {
  record_kind: {
    role: ['Role', 'Formal organisational role, separate from people and login permissions.'],
    source: ['Source', 'Link to an immutable job-description document version for a formal role.'],
    statement: ['Source statement', 'Exact located wording in a source document.'],
    term: ['Ontology term', 'Governed provisional classification or relationship vocabulary.'],
    responsibility: ['Atomic responsibility', 'Normalised responsibility pinned to exact source wording.'],
    connection: ['Connection', 'Governed relationship between responsibilities; directionality is inherited from its relationship term.'],
    role_assignment: ['Person in role', 'Link from a formal role to a canonical staff identity.'],
  },
  lifecycle: {
    draft: ['Draft', 'Not active; may await review.'], active: ['Active', 'Currently enabled record.'],
    inactive: ['Inactive', 'Retained but not currently active.'], superseded: ['Superseded', 'Replaced or retired; original evidence remains unchanged.'],
  },
  review: { draft: ['Draft', 'Analytical record awaiting human review, independent of evidence status.'], proposed: ['Proposed', 'Not marked human reviewed.'], reviewed: ['Reviewed', 'Human review confirmed; does not imply documentary evidence.'] },
  evidence: {
    documentary: ['Documentary / explicit', 'Connection explicitly supported by a pinned source statement.'],
    inferred: ['Inferred', 'Interpretation rather than an explicit documentary connection.'],
    proposed: ['Proposed', 'Suggested connection awaiting organisational acceptance.'],
    approved_operational: ['Approved operational', 'Operationally approved relationship; not necessarily stated in a JD.'],
    unresolved: ['Unresolved', 'Organisational question remains unresolved.'],
  },
  role_mapping: { mapped: ['Mapped', 'Role has been deliberately mapped.'], referenced: ['Referenced', 'Role referenced without a complete responsibility mapping.'], placeholder: ['Placeholder', 'Explicit unresolved role identity placeholder.'] },
  ontology_category: {
    domain: ['Domain / subdomain', 'Topic classification; a domain parent_id represents subdomain hierarchy.'],
    responsibility_type: ['Responsibility / action type', 'Classification of the kind of responsibility or action.'],
    responsibility_level: ['Responsibility level', 'Optional governed organisational or responsibility level.'],
    authority_type: ['Authority type', 'Classification of the authority involved.'],
    relationship_type: ['Relationship type', 'Meaning and optional directional semantics of a connection between responsibilities.'],
  },
  source_type: { job_description: ['Job description', 'Versioned source job description in shared Documents.'] },
  directionality: { directed: ['Directed', 'Stored endpoint order determines traversal direction; default for existing terms.'], symmetric: ['Symmetric', 'Traversable from either endpoint; no arrow or process-order inference.'] },
  grouping: { source_statement: ['Source statement', 'Shared pinned documentary statement identifies the companion group, not chain distance.'] },
  direction: { from_to: ['From → to', 'Ordered storage endpoints; semantic directionality is inherited from the governed relationship term.'] },
};
const controlled = Object.fromEntries(Object.entries(groups).map(([group, terms]) => [group, Object.entries(terms).map(([id, [name, definition]]) => ({ id, name, definition }))]));
function vocabulary(records) {
  return { provisional: true, controlled, levels: { controlled: true, optional: true, category: 'responsibility_level', reference_field: 'level_id', legacy_text_field: 'level', description: 'Optional governed term reference; legacy text and null/unknown remain supported.' },
    terms: records.filter(r => r.kind === 'term' && !r.data.is_fixture).map(r => ({ id: r.id, ...r.data, revision: r.revision })) };
}
module.exports = { vocabulary };
