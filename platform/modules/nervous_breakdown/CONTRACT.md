# Nervous Breakdown responsibility network

Nervous Breakdown owns source-derived formal roles, source-version links, source statements, atomic responsibilities, organisational ontology, governed connections, role occupancy links and durable revisions. It provides Foundation, Governance and Layer 1. Process design (Layer 2) and live execution (Layer 3) are outside this implementation.

The current source type is job description. The Documents component owns physical files, hashes and immutable versions. Sources reference an exact Documents version and its verified digest. Source identity cannot be moved to another role or document version: create a successor instead. Responsibilities pin an exact source-statement revision, so correcting a transcription never silently changes the wording underpinning existing responsibilities.

Organisational roles are independent of authentication roles and people. Optional role occupancy references canonical Staff Registry IDs. Formal responsibilities may reference operational Ownership records but never update them. Existing Ownership `responsibilities` rows and standards-specific ontology remain separate.

Persistence uses typed, validated organisational records with stable IDs and versioned JSON payloads, plus append-only snapshots in `nb_revisions`. The schema supports evolving domain vocabulary without migrations for new terms. The module validates reference types, provenance, classifications, hierarchy and supersession cycles, dates, human review, fixture separation and optimistic concurrency before transactional batch writes. Records cannot be hard-deleted through this API. A lifecycle change creates a revision. TimSyS audit events supplement permanent domain revisions; audit retention cannot erase source history.

## Governance

POST `/nervous-breakdown/records` takes `{record:{id,kind,expected_revision,data},reason,confirm_review}`. New records use revision 0. Statements, responsibilities and connections accept draft, proposed or reviewed human-review state independently of evidence. Active statements, responsibilities and connections require reviewed state; writing reviewed records requires explicit human review confirmation. Similar responsibilities and orphan nodes remain valid. Referenced roles do not acquire invented responsibilities.

Editable ontology categories are domain, responsibility type, authority type, relationship type and responsibility level. Responsibilities may optionally reference a level term through level_id while retaining legacy level text. Category semantics are application constraints; terms, names, definitions, aliases and parent hierarchy are data. Responsibilities may have multiple classifications; the first domain is primary. Renaming/deprecating terms preserves stable references. Splits and merges can be performed through new terms, revised classifications and supersession rather than destructive changes.

Connections distinguish documentary, inferred, proposed, approved operational and unresolved evidence. Superseded is a lifecycle status, not a claim about original evidence. Documentary connections require source-statement evidence. Human review of an inferred/proposed edge does not transform its evidentiary basis into documentary fact.

## Graph and trail

The graph is generated from the record store, not maintained independently. Default scope includes all active non-fixture responsibilities and reviewed active connections between them. No 50-row truncation is applied to graph data. Governance lists paginate separately. Role, source, classification, textual, lifecycle and relationship/evidence filters combine. Synthetic fixtures are a separate explicit graph view, excluded from the intelligence contribution view and events.

Trail traversal is deterministic breadth-first traversal of the filtered directed network. Direction is upstream, downstream or both; depth is 0–20, default 2. Nodes outside the selected trail remain visible but fade. A reviewed edge may retain proposed or inferred evidence; use the evidence filter to restrict traversal. Cycles terminate through a visited set. SVG layout clusters by formal role using deterministic positions; zoom, pan, fit and focus do not mutate organisational data.

## Data exchange and recovery

POST `/nervous-breakdown/import` takes `format: timsys.nervous-breakdown.v1`, an array of record writes, a reason and human-review confirmation where applicable. Maximum batch size is 10,000. All records are validated as one projected network, allowing references between new records. Any error rejects the entire batch; none are silently skipped. Existing records require their current expected revision.

The producer-facing contract is `docs/nervous-breakdown/IMPORT_CONTRACT.md`; `import-schema.js` publishes its JSON Schema through workspace. Imports accept up to 16 MiB, require explicit IDs, and support `dry_run: true` without writes. Reports distinguish blocking errors from incomplete-organisational-data warnings. Null/omitted classifications and levels are legitimate; unknown relationship types can be null. Unknown non-null references remain errors. Terms and domain-parent subdomains are editable data, not code. Unchanged export replays are no-ops preserving revision identity and history. Workspace/export include current non-fixture ontology and controlled vocabulary definitions.

GET `/nervous-breakdown/export` includes stable identities, record data, current revisions and full domain snapshot history. Document IDs remain references to the shared Documents store: export that store/database and `.documents` directory as part of a complete backup. Cross-installation source-ID remapping is not automatic. The import API applies reviewed record changes; it does not allow a client to forge historical actors or overwrite server history. Restore the database and immutable document store together for exact recovery.

The existing intelligence contribution exposes factual record kind, revision and status, excluding fixtures. No organisational inference, new insight provider, automated responsibility decomposition or authoritative relationship inference is implemented.
