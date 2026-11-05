# Principal ISR ratings reporting — verification

Verified 5 November 2026. Reporting revision: researched.principal-isr-ratings-report.v1.

## Scope and preservation

Adds ordinal Principal respondent ratings alongside saved narrative findings. No numeric conversion, composite, weighting, prompt-to-competency mapping, semantic request, segmentation change or database write. The seven Director numerical questionnaires are excluded.

Frozen saved session: 86f59b42-5c8f-4786-98e6-7863792390c4 (Principal 02 — confirmed).
Saved run: 997deea7-9a47-4b59-91d2-cb0e9206b47a.
F1 policy version 10 and revision f1-internal-communication.v1 retained.

A fresh read-only database capture after generation matched the initial capture exactly, excluding its export timestamp. Session, decisions, machine outputs and workbench state are unchanged. Narrative coverage remains 2,214 assessed: 1,808 coded and 406 zero-code; zero pending/failed. Narrative summary and evidential counts compare identically before and after generation.

## Source and join checks

Source: 02. Principal Reviews.docx.
SHA-256: bf3f574dccdf79aa63648140634324282201d4eec8168cdf5724de28db7de475.

Re-extraction found 118 questionnaires: 111 Principal and seven excluded Director questionnaires. All 999 Principal selections recovered. Every Principal rating row has exactly one selected structurally empty cell and three non-selected cells containing U+00A0. Existing extra blank header handling retained. Every stored prompt, selected label and source row agrees with fresh extraction.

All 111 existing review UUIDs joined uniquely. No missing IDs, duplicate IDs, duplicate source questionnaires, missing ratings or unresolved ratings. Each of the nine prompts has valid denominator 111. Every prompt reports all four categories, including zero counts, and separates missing/unresolved counts. Rounded percentages may sum to 99.99 or 100.01.

## Changed implementation

- platform/services/researched/src/domain/principal-ratings.ts: shared pure ratings aggregation, strict review joins, row validity checks, ordinal summaries and traceable records.
- platform/services/researched/src/application/principal-review.ts: shared existing prompt/category constants; retain all duplicate row locations. Extraction selection rules unchanged.
- platform/services/researched/src/entrypoints/mcf-api.ts: additive principalIsrRatings in saved JSON and review-report responses.
- apps/researched/frontend/src/workbench/principal-ratings-report.js: dedicated summary and per-review ratings rendering.
- apps/researched/frontend/src/workbench/report.js: ratings section in HTML and PDF report source.
- apps/researched/frontend/src/workbench/McfReport.jsx and ReviewSummary.jsx: dedicated ratings section and ratings alongside review-level narrative evidence.
- tests/principal-ratings-report.test.ts: nine tests covering summaries, zero categories, missing/unresolved rows, duplicates, joins, source provenance, profile/blind exclusion, escaping and export preservation.
- tests/principal-review.test.ts: missing/duplicate source-row provenance assertions.

Prior F1 v10 working-tree changes are preserved and are separate from this reporting change.

## Verification

- Full ResearchEd service suite: 433 tests passed across 49 files.
- Final focused parser, ratings, review-report regression and PDF suites: 30 tests passed.
- Backend TypeScript build and frontend Vite build passed.
- git diff --check passed (line-ending notices only).
- Actual saved-analysis JSON export preserves machine outputs, session, researcher decisions and evidential counts exactly.
- HTML and JSON use the same ratings model. PDF text verification matched all nine summary rows and all 999 per-review ratings, source rows and statuses to their review IDs.
- PDF generated using the production renderer; first two pages visually inspected, no clipped content. The full evidence-rich report is 2,221 pages; ratings occupy the first 57 pages. HTML is more convenient for navigation.
- No semantic analysis started or resumed. No TradeEd processes, files, ports or services modified; no active worker was found in the isolation inspection.

## Outputs and use

Generated JSON, HTML and PDF are in C:/Users/tmaxc/Downloads/TimSyS/verification-local/principal-ratings-report, named Principal 02 — narrative and ISR ratings.

These artifacts are available now. App source changes are tested but not installed or published. After installing a build containing this revision, open the existing confirmed Principal 02 report and use its JSON, HTML or PDF export controls. Do not create a new analysis, edit the draft or resume semantic processing to obtain ratings reports.
