# Research’Ed semantic integrity protocol v2

Implementation date: 10 October 2026. MCF v1.0, its 21 competencies and operational definitions are unchanged.

## Analytical flow

1. Preserve source and original UTF-16 offsets. New sentence segmentation omits spans whose exact original text has an empty JavaScript `trim()`. Creating a new session from an older unit set also excludes those spans before freezing its population, selected units or seeded sample. Existing sessions and unit sets are never rewritten.
2. Retrieve deterministic candidates for every selected substantive unit. Store one separate candidate record per unit, including an explicit no-match result. Retrieval does not determine semantic eligibility.
3. Submit every eligible unit for semantic assessment, including units without deterministic matches. Retain a validated response for every unit in the request, including zero-code responses. A malformed or incomplete batch is rejected as a whole; none of its units is counted as successfully assessed.
4. Record request attempts, timestamps, elapsed duration, outcome and error. The immutable task membership links each attempt to its units. Successful proposals and outputs remain immutable. Finalized attempt history and candidate records cannot be overwritten.
5. Semantic coverage is derived from retained results and unresolved tasks. A deterministic candidate, no-match, or human edit never silently satisfies semantic coverage. This version requires semantic success for every substantive selected unit to claim complete semantic analysis. It does not introduce an alternative-treatment approval mechanism or reliability threshold.

Per-unit exports distinguish `semantic_success`, `semantic_zero_code`, `semantic_failed`, `semantic_pending`, `deterministic_candidate`, `deterministic_no_match`, and researcher review. Deterministic and semantic information may coexist. Historical mixed-method proposals remain unchanged; reporting classifies their stored method separately.

## Timeout and retry policy

The Director pilot retained completion timestamps but no request start times or elapsed durations. Therefore exact successful provider-request durations cannot be recovered from it. Intervals between output timestamps would be misleading because the old worker ran concurrent requests. The 25 successful semantic batches are evidence of successful processing, not a measured latency distribution. The aborted batch does not establish whether the remote provider finished processing it.

The provisional configuration keeps the existing 90-second request timeout. It reduces load from 12 passages / 20,000 passage characters to at most 6 passages / 10,000 passage characters, with one request in flight per worker. The instrument and instructions add to the input size; the character cap is not a token estimate. These limits reduce requested output and contention without claiming to be empirically optimal.

- Transient network errors, timeouts/aborts, HTTP 429 and 5xx: three total attempts per batch per explicit resume cycle, with 30-second and 120-second waits before attempts two and three.
- Authentication, schema, evidence validation, changed connection and oversized-passage errors: stop for intervention, rather than repeatedly submitting unchanged invalid work.
- While a retry is delayed, later batches of that run wait. On exhaustion, pause the run: the failed batch is `semantic_failed`, untouched batches remain `semantic_pending`, successes remain retained.
- An explicit resume retries only unresolved batches. It starts a new recorded retry cycle and requires the original provider/model/connection when one was previously recorded. Candidate-only or initially offline work can connect a provider on its first resume.
- Stop prevents further queued requests. An already-sent successful response may be retained; resume waits for that request to settle. Application restart marks in-flight attempts interrupted and requires explicit resume.
- A passage exceeding the character cap needs researcher-controlled splitting into a new segmentation version. It is never silently truncated or locally classified as a substitute.

The new attempt durations include validation and retention overhead. Synthetic test timings validate telemetry only; they are not measurements of the actual hosted model. Before adjusting the timeout further, collect a separate approved pilot with representative passage lengths and this smaller batch size, inspect successful elapsed-time percentiles and timeout frequency, and then version any policy change. Do not use the Director corpus for that exercise without approval.

## Reports and resume

The draft and confirmation screens, printable/PDF view, downloadable HTML, JSON evidence and assistant report expose substantive population, semantic assessed/coded/zero-code/pending/failed counts, deterministic match/no-match counts and researcher review counts. A local no-match is never a semantic zero-code result.

Open an unfinished v2 draft, connect its original AI connection if necessary, and choose **Resume unfinished analysis**. Successful units are not resubmitted. A confirmed report is an immutable snapshot: returning to and resuming its draft cannot change the earlier report. Confirm again to save a new snapshot.

`POST /api/mcf/sessions/:sessionId/ai-resume/:runId` takes `{ "actor": "Researcher name" }`. AI overview/export returns coverage, per-unit pathways, candidates, tasks and attempt history. Existing blind-validation guards apply.

## Schema and preservation

Migration `0024_mcf_semantic_integrity.sql` adds only new tables: `mcf_semantic_tasks`, `mcf_semantic_attempts`, `mcf_deterministic_candidates`, and `mcf_report_snapshots`. No data backfill updates historical runs. Project deletion includes these new records.

Pre-v2 classification runs are audit-only for the new worker; they cannot be resumed or cancelled through the new classification endpoints. Their stored operational status is preserved, while reports display independently calculated semantic coverage.

Director run `fbb2cf14-bf0a-4caa-9d3d-76bf565b045b` must remain untouched. Development verification uses disposable databases and synthetic providers. No live migration, application installation, external model request or Director rerun is part of this change.

## Verification — 11 October 2026

TypeScript compilation and the production Vite build passed. All 161 unit tests across 29 test files passed. Disposable PostgreSQL and production-browser regressions cover 23 simple-workflow checks, 16 manual/provenance checks, 8 guided-analysis checks, 8 assistant-contract checks, 12 content-pipeline checks and 9 semantic-integrity checks (76 total).

The semantic suite simulates retained success followed by HTTP 503 exhaustion, verifies the retry delay gate, resumes only unresolved units, compares original output rows exactly, preserves a confirmed partial snapshot, checks offline/cancel/restart pathways and verifies historical runs cannot be resumed. It also renders the real report as PDF and extracts its text to check all nine coverage categories. Permanent deletion includes the new history and snapshot tables.

The existing empty-document workflow remains available for a Source unavailable documentary observation, with zero analytical units. It does not permit semantic classification of whitespace.

MCF v1.0 file SHA-256: 2281e5f47bab00731fc76abaf2055269d291fc6a89fdd34d00e89779cb3ec8f3. The instrument has no Git diff. All model responses in verification are synthetic; no external model calls or live database writes were made. Test reports and the sample PDF are under apps/researched/verification-local/ (excluded from source control).

Implementation files: domain/mcf.ts and domain/mcf-coverage.ts; application/mcf-semantic.ts, mcf-ai.ts, mcf-coverage.ts, mcf-report.ts and ai-analysis.ts; repository/session population creation and project deletion; MCF, workbench and assistant API endpoints; main and specialist MCF views plus shared HTML/PDF report code; migration 0024; semantic-integrity tests and updated workflow regression expectations.
