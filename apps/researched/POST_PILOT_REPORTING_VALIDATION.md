# Post-pilot reporting and validation implementation

19 October 2026, Riyadh (GMT+3). This is a reporting/validation extension, not a classifier revision.

## Inspection and architecture

Existing immutable units and unit sets identify source records, and completed semantic runs retain passage-level proposals, task attempts and confirmed report snapshots. Existing validation uses seeded simple random sampling from current prepared text, with session-local blind manual coding. That workflow is retained.

The smallest extension adds pure review aggregation and stratified sampling modules, a dedicated validation application service, API routes and two workbench panels. It reuses `mcf_sessions`, `mcf_session_units`, `mcf_report_snapshots` and `audit_events`. No migration or shared infrastructure change is required. Independent validation judgements are append-only audit events, protected by session-unit transaction locks and previous-revision checks; they are not inserted as classifier outputs or ordinary manual competency codes. An explicit reveal event separates blind and subsequent visible-candidate judgements. Removing a validation sample removes only its session, snapshot and judgements; candidate outputs remain intact.

## Reporting specification v1

Review-level analysis appears automatically immediately after Evidence-location analysis on completed reports. Existing passage findings and their Explicit/Contextual counts remain unchanged. Review-level counts use unique existing source-record IDs only. Eligible reviews have at least one substantive unit in the pinned population, including reviews whose assessed units are all zero-code. No director/school identifiers are generated, inferred or grouped.

For each competency: locations; unique represented reviews; prevalence using the eligible-review denominator; explicit reviews; contextual-only reviews; locations per represented review; and finding-level valence distribution. Missing valence is separately unassigned. Density is N/A with no represented reviews; prevalence is N/A with no eligible reviews. There are no numerical weights, roll-ups, independence assumptions, composite scores or inferential estimators.

The privacy notice appears alongside prevalence in UI, HTML/PDF and the separately versioned review JSON. Every row exposes represented review IDs and unit IDs; the JSON includes the denominator review IDs and evidence-location trail. The existing confirmed snapshot is never rewritten. The extended view is included by default, with its own version; the evidence-location table remains unchanged. Review JSON/HTML/PDF use confirmed human decisions where present, without changing the frozen machine candidate used for validation.

## Validation workflow

Open **Human validation of this completed run**. Supply seed, blind/non-blind choice, overlap policy, and each stratum's label, size and optional competency, route, valence and coded/zero-code filters. Filters on competency/route/valence match the same finding. Preview is read-only. Confirm explicitly to create a sample. No design, quota, sample size, seed or reliability threshold is assumed by the new workflow.

Sampling ranks unique unit IDs using SHA-256 with the researcher seed and stratum index. Stratum order is part of the reproducibility specification. Overlap is either rejected or explicitly deduplicated across strata, with no automatic quota refill. Eligible and selected IDs, original plan, algorithm, candidate hash and candidate outputs are pinned in an immutable snapshot.

During review, independently assess application, evidence route and valence for competencies, and whether no competency is supported. Blank remains not assessed. Context displays only the original permitted units from the same review. Save appends a revision; undo appends a reversal. Blind views omit candidate findings and stratum membership. Ending blind review requires explicit confirmation and creates an audit event. The workspace export includes history and, after reveal, the pinned proposals for separate comparison; no agreement score or threshold is imposed. Blind mode is a workspace presentation boundary, not a separate-user authorization system; the researcher who designed strata necessarily knows the design.

## Methodological choices left to the researcher

Final stratification scheme, sample sizes, overlap allocation, blind-review protocol, acceptance thresholds and any reliability estimators remain unset. Review prevalence is descriptive within the frozen corpus. Sampling-unit independence is not assumed. No real validation sample was created during implementation.

## Candidate export supplied after deletion

The live candidate work was deleted by the researcher. The supplied JSON export preserves run `39a5cbab-6653-47c3-b735-80a1ec6c59e5`: 2,020 unique assessed units, 77 reviews, 368 outputs, 1,296 coded and 724 zero-code units. All original-text offsets and contextual quotations validated; the instrument hash matches. The archived evidence-location counts sum to 2,607 competency applications and match the new calculation. Source export SHA-256: `6d1cf5d98cebc8a929e47344d398f656c8a9625ed18c9ed47c075c38e998f926`.

A separate derived review report was produced from that JSON without changing it, restoring live records, invoking AI or creating a validation sample. Restoring the deleted candidate into the live application is separate from this reporting/validation implementation; the exported evidence remains recoverable. The attached HTML/PDF were not needed to reconstruct numerical findings because the JSON contains the full candidate outputs and context spans.

## Verification

200 unit tests across 34 suites; TypeScript/Vite builds; 16 isolated semantic/persistence/export checks; 28 browser/workflow checks. Synthetic tests cover denominator handling, multiple findings per review, explicit/contextual overlap, null valence, trace IDs, deterministic sampling, intersecting filters, overlap choices, blind isolation, append-only corrections, stale revision rejection, reveal, undo, deletion, zero AI calls, and unchanged candidate outputs. The semantic instrument, prompts, classification/valence rules, segmentation, structural parser, context retrieval and zero-code engine are unchanged. Tradeâ€™Ed remains isolated on its original worker/watchdog with no restart or database access by this work.

## 0.10.6 retrospective reporting verification — 23 October 2026

Removed the review-report opt-in gate in the UI and HTML/PDF export; added review aggregation to the main JSON export. The eligible distinct review denominator and formula are explicit, and density displays two decimals. Missing review IDs are reported as unavailable rather than inferred. No schema, classifier, instrument or validation-methodology change.

326 tests pass; TypeScript and production frontend builds pass. Existing saved run verification covers 2,020 substantive units, 77 review IDs and 2,082 same-review context references. All 21 partitions reconcile, original evidence counts match, and the original HTML evidence-location section is byte-for-byte unchanged. The stored candidate passes the read-only validation candidate check. HTML/JSON/PDF checks pass and the PDF review table was visually inspected. No semantic run or validation sample was created.
