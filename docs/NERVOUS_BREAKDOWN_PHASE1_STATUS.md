# Nervous Breakdown — Phase 1 local implementation

28 September 2026. Local implementation checkpoint, not an installed-release acceptance claim.

## Governed dataset readiness follow-up

The subsequent user instruction explicitly prohibits generating seven-JD responsibility/connection mappings. Import preparation is documented in `docs/nervous-breakdown/IMPORT_CONTRACT.md`, with machine-readable schema, current ontology export and separate synthetic producer examples. Imports now offer non-writing validation reports, null/unknown classifications, explicit connection direction, controlled ontology additions, and no-op preservation for unchanged export replays. The dedicated batch endpoint allows 16 MiB (10,000 records maximum); all other request limits are unchanged. The UI exposes schema/vocabulary downloads and visible/downloadable validation reports. No seven-JD records were populated in this follow-up. Its test receipts are under `../principaled-context/import-contract-*.log`. The follow-up passed 123 suites / 514 tests plus a final focused 16-test run and both frontend builds; details are in `docs/nervous-breakdown/VERIFICATION.md`.

## Scope and entry point

Principal’Ed → Organisation → Nervous Breakdown. The launcher embeds the same Principal’Ed dashboard. The new platform module is `nervous_breakdown` (55 modules at boot).

Implemented foundations and Layer 1: formal roles, versioned JD source references, source statements, editable classification terms, atomic responsibilities, directed connections, and separate canonical staff-to-role assignments. Governance records have stable IDs, lifecycle and effective dates, review state, optimistic revision checks and durable revision snapshots. Shared Documents retains original file bytes and immutable document versions. Responsibilities pin an exact statement revision. The existing operational ownership service remains separate, with an optional explicit link.

Explore provides an unpaginated network, role grouping, zoom/pan/fit/focus, searchable selection, evidence and classification filters, bounded upstream/downstream trails, and an inspector with original source access, pinned wording and revision history. Govern provides record forms and paginated lists. Sources & exchange provides document upload/extraction and validated batch JSON import/export. These are deterministic tools; they require no LLM.

Synthetic data is explicitly labelled and excluded from the default organisational graph and intelligence contribution. Organisational records cannot depend on synthetic records. The intelligence contribution exposes factual governed metadata without inventing connections or risks. Process and Execution layers were not implemented.

## Seven-JD intake

The supplied ZIP contains Teacher, Section Principal, MS Behavioral Interventionist, MS Activities Coordinator, MS Student Affairs and Administrative Supervisor, Subject Leader, and School Counselor JDs. All seven originals were retained and SHA-256 verified after upload/download through the actual shared Documents API in an isolated SQLite preview. All seven passed deterministic text extraction. The intake preserved 77 unreviewed source blocks. No authoritative BBS atomic responsibilities or connections were created.

Private source files, extracted corpus and receipts remain outside the Git repository under `../principaled-context/`. The receipt is `jd-intake-verification.json`. A local-only preview script is `preview-nervous-breakdown.cjs`; it uses a separate temporary database and explicitly synthetic graph fixtures. It is a test harness, not a deployment script.

## Verification

- Full platform suite: 123 suites, 510 tests passed (318.725 seconds). Log: `../principaled-context/platform-tests.log`.
- Final focused rerun after permission/date/source-conflict changes: three suites, 12 tests passed. Covers actual HTTP source upload, atomic imports, provenance, pinned historical wording, stale revisions, review confirmation, fixture isolation, export, authentication, permissions, boot and a 1,200-node traversal fixture.
- Principal’Ed and launcher production builds passed. Both emit the Vite large-bundle advisory; no build errors.
- Browser verification in isolated preview: organisational sources visible; synthetic 300-node/299-edge graph rendered; directed depth-two selection produced three nodes; a governed edit saved as revision 2 while retaining revision 1.
- `git diff --check` passed. No installed runtime, live database, installer or GitHub publication was changed.

## Remaining acceptance boundaries

Owner-reviewed responsibility decompositions and connection datasets still need to be supplied/imported and checked against the JDs. Unreviewed extraction is not an approved organisational model. Full acceptance of the real responsibility network therefore remains pending.

JSON export includes current records and history for analysis and recovery. Cross-installation restoration is not a one-click portable archive: document IDs refer to the shared Documents store, and historical snapshots cannot be client-written through the ordinary import endpoint. Preserve the SQLite database and Documents files together for exact recovery.

Installed-runtime and release-package verification remain necessary before deployment. The current changes are local and uncommitted. GitHub read access was verified against the configured origin; push access has not been exercised.

Implementation contract: `platform/modules/nervous_breakdown/CONTRACT.md`. User-authored brief and implementation instructions are recovered in `../principaled-context/sources/`.
