# Nervous Breakdown: initial Layer 1 data contract

Version `timsys.nervous-breakdown.v1`, prepared 28 September 2026; additive remediation 29 September 2026. This contract covers governed data supplied by the owner. It does not author the seven-JD analysis or start Process/Execution functionality.

Machine-readable JSON Schema: [import.schema.json](import.schema.json). Vocabulary snapshot: [ontology.json](ontology.json). The runtime workspace response exposes the same schema and the current organisational ontology; the Sources & exchange screen can download both.

Synthetic producer examples: [responsibilities and their prerequisites](synthetic-responsibilities.example.json), then [separate connections](synthetic-connections.example.json). These are fixtures, not proposed BBS mappings. Before executing an example, upload the matching synthetic text file and replace its demonstration numeric document/version IDs with actual IDs from that isolated store. Both examples default to dry-run.

## Package and workflow

Submit JSON to `POST /nervous-breakdown/import`. Scope defaults to `principal-ed`; it may also be specified as `app_id` in query or body. Other application scopes are currently rejected.

```json
{
  "format": "timsys.nervous-breakdown.v1",
  "reason": "Initial human-reviewed Layer 1 dataset",
  "confirm_review": true,
  "dry_run": true,
  "records": [
    { "id": "stable-id", "kind": "responsibility", "expected_revision": 0, "data": {} }
  ]
}
```

The empty `data` above illustrates the envelope only; use the record fields below. `dry_run: true` validates without writing. After reviewing the report, resubmit with `dry_run: false`. Validation runs again at commit. Dry-run is not a reservation: concurrent changes can require a fresh review.

- Stable IDs are case-sensitive, 1–120 characters, matching `^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$`. They are globally unique across record kinds and application scopes. Imports never invent IDs.
- `expected_revision: 0` means new; an update requires the exact current revision. Existing records are full replacements of their `data`, not partial patches. An omitted optional field on an update is removed.
- New references may resolve within the same batch, irrespective of row order. Alternatively import roles/terms/sources/statements first, responsibilities second, connections last.
- Maximum 10,000 records and 16 MiB UTF-8 JSON per import request, including history/metadata if supplied. Larger packages need dependency-ordered batches; atomicity is per request, not across requests. Ordinary individual-record writes retain the platform’s 1 MiB limit.
- Govern permission is required; source writes additionally require Documents read permission. Source files must already exist in shared Documents. The source file limit is 10 MiB.
- `confirm_review: true` is required when committing records marked reviewed. Dry-run can inspect reviewed records without making that confirmation.
- Unknown `data` fields are errors. Export envelope metadata (`history`, `ontology`, timestamps, response metadata) is not imported as authority. Explicit record edits must be under `records[].data`.
- Normalisation of responsibility wording is supplied by the analyst. The importer does not rewrite text, guess classifications, merge duplicates or generate links.

## Common record fields

All kinds accept `status` (`draft` default, `active`, `inactive`, `superseded`), `is_fixture` (boolean, false default), `notes` (text/null), `effective_from` and `effective_to` (optional ISO `YYYY-MM-DD` dates/null), and `superseded_by` (optional same-kind stable ID/null). Date ranges cannot run backwards. Supersession links require superseded state and cannot form cycles. Superseded records without a known successor are allowed with a warning. Kind and fixture identity cannot change.

Examples and tests must explicitly set `is_fixture: true`; they must never be imported as BBS truth. An organisational record cannot depend on a fixture.

## Responsibility schema

Envelope: `kind: "responsibility"`.

| Field in data | Type / requirement | Meaning |
|---|---|---|
| `name` | Required nonblank text | Short display label; may repeat the atomic statement |
| `normalized_statement` | Required nonblank text | Human-reviewed atomic responsibility |
| `role_id` | Required stable role ID | Formal organisational role, separate from person or login role |
| `statement_id` | Required stable statement ID | Exact source evidence |
| `statement_revision` | Required positive integer | Exact statement revision supporting this responsibility |
| `domain_ids` | Optional unique ID array/null | Domain/subdomain terms; first supplied term is primary |
| `responsibility_type_ids` | Optional unique ID array/null | Responsibility/action-type terms |
| `authority_type_ids` | Optional unique ID array/null | Authority classification terms |
| `level_id` | Optional stable ID/null | Governed `responsibility_level` term; draft terms may be referenced |
| `level` | Optional text/null | Backward-compatible free-text level; never converted or discarded automatically |
| `evidence` | Optional evidence enum/null | Responsibility provenance, independent of human review; the workbook Provenance column can be represented here |
| `review_status` | Required `draft`, `proposed` or `reviewed` | Governance review state |
| `operational_ownership_id` | Optional positive integer/null | Existing operational Ownership record; normally omitted in the initial dataset |

Null, omitted and empty classification arrays are all legitimate unclassified states and are retained, not converted to invented terms. A non-null classification ID must actually exist in its correct category. Explain distinctions such as “not applicable” versus “unknown” in notes if material; there is no separate controlled reason field. Null/omitted levels are also legitimate. Active responsibilities require reviewed state and reviewed source wording; a reviewer may deliberately retain unknown classifications.

Exact source text, document/version and location are stored once through the source chain below, rather than copied into each responsibility. **Any number of responsibilities may cite the same statement ID/revision.** One responsibility currently has one primary statement/revision. If an atomic item genuinely needs several independently pinned statements, that requires an explicit provenance-model extension; do not concatenate unrelated evidence and pretend it has a single source location.

## Role, source, statement and classification records

| Kind | Required data | Optional data beyond common fields |
|---|---|---|
| `role` | `name`, `mapping_state` | `level` |
| `source` | `name`, `source_type: "job_description"`, `role_id`, `document_id`, `document_version_id`, `version_label` | `document_sha256` |
| `statement` | `source_id`, `original_text`, `location`, `review_status` | `section` |
| `term` | `name`, `category` | `definition`, `parent_id`, `aliases` (text array/null) |

`mapping_state` is `mapped`, `referenced` or `placeholder`. Unknown roles cannot be referenced by a dangling ID, but an explicitly supplied placeholder role is legitimate and flagged. No responsibilities are invented for referenced/placeholder roles.

`document_id` and `document_version_id` are positive integer IDs issued by TimSyS Documents. A `source` ID is a separate stable organisational ID. `version_label` is a human-readable label, not a sortable version number. The importer verifies document/version existence and SHA-256 (if supplied), and records the actual digest. It cannot independently certify a transcription: the reviewer compares `original_text` and `location` with that immutable original.

One source record belongs to one formal role. A responsibility's role must match its source role. Changing a source's document, version or role requires a successor source; moving an existing statement to another source is forbidden. Duplicate active versions for the same document/role/fixture combination are rejected; supersede the old source in the same batch. Existing responsibilities can retain historical source references with review warnings. Distinct Documents IDs are not automatically assumed to be versions of the same document.

`original_text` and `location` must be nonblank. Location is a verbatim locator such as page/section/paragraph/table-cell description. `section` may be null. Statements may use `review_status: "draft"` or the retained legacy value `proposed`; active statements require reviewed state. Corrections create revisions and never silently change the wording pinned by older responsibilities or connections.

`term.category` is `domain`, `responsibility_type`, `authority_type`, `relationship_type`, or `responsibility_level`. **Subdomains are domain terms with `parent_id` pointing to another domain term**; no separate subdomain column is needed. Parents must share category and form an acyclic hierarchy. A responsibility can list both domain and subdomain IDs. Term-ID filtering matches explicitly attached terms; it does not automatically expand descendants.

Names, definitions, aliases and hierarchy are provisional governed data. Definitions may be null/unknown (warning). Add terms in the UI or in the same batch as responsibilities. Rename a term while retaining its ID; reorganise its parent; split or merge by creating terms and explicitly revising classifications/superseding old terms. The importer never guesses the consequences of a split or merge. These operations need no code or database redesign. Adding an entirely new category, unlike a new term, is a contract change.

## Connection schema (separate package)

Use the same envelope with `kind: "connection"`; import only after its endpoints exist, or with endpoints in the same request.

| Field in data | Type / requirement | Meaning |
|---|---|---|
| `from_id` | Required responsibility ID | Source endpoint |
| `to_id` | Required distinct responsibility ID | Target endpoint |
| `direction` | Optional literal `from_to` | Explicit arrow from source to target; omission has the same fixed meaning |
| `relationship_type_id` | Optional relationship term ID/null | Relationship meaning; unknown is allowed with review warning |
| `evidence` | Required controlled value below | Evidentiary basis, independent of review/lifecycle |
| `statement_id` | Optional statement ID/null | Documentary evidence reference; required for documentary connections |
| `statement_revision` | Positive integer with statement ID | Exact evidence revision; cannot appear without a statement |
| `review_status` | Required `draft`, `proposed` or `reviewed` | Human review state |
| `notes`, `status`, dates, `superseded_by` | Common fields | Rationale, lifecycle and succession |

Connections have stable envelope IDs. Use separate IDs and reversed endpoints for two opposite directed connections; do not use `both`, `undirected` or an unrecognised direction value. Same-endpoint loops are rejected. Multiple distinct relationships between the same endpoints are allowed. Identical endpoint/type combinations are flagged as possible duplicates, never collapsed.

`evidence` is `documentary` (explicit documentary support), `inferred`, `proposed`, `approved_operational`, or `unresolved`. Use `documentary`, not a new literal `explicit`. Superseded is `status: "superseded"`, preserving the original `evidence`. For example, a retired inferred connection keeps `evidence: "inferred"`. Human review does not turn an inference into an explicit documentary claim.

Non-documentary connections may lack a source statement; the report flags the absence without rejecting it. Explain external approval or interpretive rationale in notes. No separate external-evidence object is currently implemented. Documentary connections require a pinned source statement. An active connection with a statement requires reviewed source wording.

The default graph contains active responsibilities and reviewed active connections whose endpoints are in view. Draft/inactive/superseded connections remain in the record store and export, although not in the default graph. A reviewed active connection may still have inferred/unresolved evidence; graph filters expose that distinction.

## Current vocabulary

On 29 September, seven original source files and seven placeholder role references were registered in the project Principal’Ed store. See `SOURCE_BINDINGS.md` for the exact store, IDs and revisions. **Zero organisational ontology terms, source statements, responsibilities or connections were created.** No JD-derived ontology was generated. Earlier isolated test terms are fixtures only. The complete stable IDs, names and definitions of implemented controlled values are in `ontology.json`:

- Domains/subdomains, responsibility/action types, authority types and relationship types: empty term lists awaiting governed input.
- Levels: optional `level_id` reference to `responsibility_level` terms; legacy free text remains supported. No level terms are seeded. The supplied `LEV-*` records can enter later as `kind: "term"`, `category: "responsibility_level"`, `status: "draft"`.
- Lifecycle: `draft`, `active`, `inactive`, `superseded`.
- Review: `draft`, `proposed`, `reviewed`.
- Evidence: `documentary`, `inferred`, `proposed`, `approved_operational`, `unresolved`.
- Role mapping: `mapped`, `referenced`, `placeholder`.
- Source type: `job_description`.
- Direction: `from_to`.
- Ontology categories: the five category IDs above. Record kinds: `role`, `source`, `statement`, `term`, `responsibility`, `connection`, `role_assignment`. Fixture identity is boolean. There are no other hidden classification vocabularies.

The current `GET /nervous-breakdown/workspace` and export responses include an `ontology` object with controlled vocabulary plus every non-fixture term's ID, display name, definition where known, hierarchy, lifecycle and revision. This reflects later additions without code changes.

## Validation and reporting

Both dry-run and commit return `report: {valid, errors, warnings, counts}`. Each issue carries `severity`, `code`, `record_id`, `field` when identifiable, and `message`; row preparation errors also carry the one-based submitted `row`. Reports cover the projected network, so pre-existing incomplete records can appear. Structurally malformed rows report their first structural error; independently resolvable reference/classification problems and other rows are aggregated. Correct errors and rerun until valid.

| Blocking invalid data (nothing saved) | Legitimate incomplete/ambiguous data (warning) |
|---|---|
| Missing/duplicate/invalid stable IDs; stale revisions | Similar records under distinct IDs |
| Dangling roles, source statements, source documents or endpoint IDs | Explicit referenced/placeholder roles |
| Unknown term IDs or terms from the wrong category | Null/omitted/empty classifications; unknown level/type |
| Missing responsibility provenance; nonexistent statement revision | Draft/proposed records; inferred/proposed/unresolved connections |
| Wrong document version/hash; changed immutable source identity | Non-documentary connections without evidence statements |
| Reversed/invalid dates, invalid enum/types or unknown data fields | Reference to inactive/superseded records; applicability-date uncertainty |
| Ontology/supersession cycles; same-endpoint connections | Undefined term definitions; unknown successor |
| Organisational dependency on synthetic fixtures | Reviewable duplicate wording without automatic merging |
| Active unreviewed records; missing human-review confirmation at commit | Reviewed records with consciously unresolved classifications |

Dates across records are not assumed to encode universal organisational policy: starting after a reference ends is a warning requiring review, while a record's own reversed date interval is invalid. Source version labels are opaque text; the importer verifies immutable version IDs instead of guessing chronology from labels.

Invalid imports normally return HTTP 400; stale/global-ID conflicts return 409 and permission failures 403. Authentication failures return 401. Malformed envelopes, oversized requests and route-level failures can occur before a per-record report exists. Error details are not silently corrected. Warnings allow import and are returned to the user; a valid dry-run does not certify the organisational conclusions. The UI provides “Validate without saving”, a visible issue list and a full downloadable report.

## Export/re-import guarantee and boundaries

`GET /nervous-breakdown/export` supplies records with `expected_revision`, current data, and retained historical snapshots. Add a reason and review confirmation, then submit that export to the same store. An unchanged record is a no-op: stable ID, data, revision, timestamps and audit history are retained. Genuine edits create new revisions. A changed store causes a conflict rather than silently applying a stale export.

Synthetic HTTP tests verify original file bytes → one exact statement → multiple atomic responsibilities → newly imported domains/subdomains/action/authority terms → directed documentary and unresolved connections → graph → export → re-import → equivalent records, history and graph. The tests include a corrected source statement with responsibilities still pinned to its earlier wording, and preserve null classifications.

**The JSON export is not a standalone cross-installation backup.** Original document bytes and server-issued document IDs belong to shared Documents. Historic statement pins can refer to earlier revisions included for analysis, but ordinary import must not forge past review actors/history. Exact migration requires restoring the SQLite database and immutable Documents files together. A future portable-package importer would need explicit file-ID mapping and trusted history restoration. This is not required to produce the approved dataset for this TimSyS installation, but must be resolved before claiming standalone portable restore.

The seven source/role bindings now exist in the project store, as listed in `SOURCE_BINDINGS.md`. Use those exact IDs in the corrected dataset; filenames alone are not references. Source and role revisions are 1. Do not recreate them with `expected_revision: 0`. New statement IDs supplied by the analyst use `expected_revision: 0`; their first saved statement revision is 1. Responsibilities and documentary connections must pin that statement revision, not confuse it with the document version ID or source-record revision. No source statements have been generated by registration.

The only potential analysis-shape decisions to surface early are multiple independently pinned source statements per atomic responsibility, an entirely new classification category, or structured non-JD evidence. Current minimum requirements are supported without any of these extensions. No seven-JD responsibilities/connections have been authored and no Layer 2/3 functionality has been added.

## 29 September remediation rules

`level_id` may be omitted or null. A non-null value must identify a `responsibility_level` term; a draft term is valid with a review warning. Existing free-text `level` is preserved. If both are supplied and their labels differ, validation reports `LEVEL_LABEL_REVIEW`, retaining both. The importer does not choose between them.

Keep lifecycle, evidence and human review separate. Initial analytical statements, responsibilities and connections may use `status: "draft"` and `review_status: "draft"`. Responsibility `evidence` is optional; connection `evidence` remains required. Documentary evidence may coexist with draft review. No record becomes reviewed because of its evidence value. Active records still require reviewed state and reviewed pinned source wording. Terms use lifecycle `status: "draft"`; they do not have a `review_status` field.

The relationship ontology is unchanged: stable-ID terms use `category: "relationship_type"`. No supplied relationship terms were created. Domain/subdomain hierarchy uses explicit `parent_id`; duplicate-name warnings are scoped to category and parent, so two General terms under different domains are distinct. Same-parent duplicate names remain review warnings.

Connections still require two existing responsibility IDs. No role-endpoint support was added, and no inferred direction was modified. Analytical workbook artefacts remain outside production record types. The format identifier remains `timsys.nervous-breakdown.v1`; these are backward-compatible additive schema changes.


## Pass 7 optional relationship semantics

Relationship terms may declare `directionality: directed | symmetric`; omitted semantics retain directed behaviour without backfilling stored records. Optional `grouping: source_statement` requires symmetric semantics and enforces shared pinned documentary provenance. Terms may now optionally declare `review_status`; existing terms remain valid without it. Active terms with an explicit review state require reviewed status.

Connection `direction: from_to` continues to describe ordered storage endpoints. The graph adapter derives effective semantics from the governed term; symmetric edges traverse both ways, render without arrowheads and expose process_order_inference=excluded. Do not derive process ordering from storage order or companion-chain distance. Current symmetric reverse duplicates are rejected. See [directionality foundation](SYMMETRIC_RELATIONSHIPS.md).
