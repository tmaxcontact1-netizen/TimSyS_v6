# MCF evidential protocol 2 / semantic run protocol 3

MCF v1.0 is unchanged. New run configuration freezes evidential instructions and the approved context unit IDs. The existing JSONB code schema is extended; no SQL data rewrite is required. The compatibility key `evidenceStrength` is retained in stored codes, with `evidenceProtocol: 2` distinguishing its new evidential-basis meaning. It is not a confidence score.

Explicit: target alone is sufficient. Contextual: target plus cited same-review material is sufficient. Both count equally. Successful assessments retain the complement of the 21 supported competencies as `noApplicationCompetencyIds`; unresolved work never implies No application.

Confirm that each record is one individual review before new analysis. Confirmed structural mappings already establish boundaries. Generic imports require an explicit session-level researcher confirmation. Institution metadata does not define boundaries. Context uses all approved units in the frozen segmentation of the same record; excluded coding units are not silently reintroduced. Blind samples can access approved population context, without other researcher decisions or machine proposals.

Requests contain at most six targets, plus the permitted same-review context. Reviews over 200,000 characters remain unresolved with an explicit error; context is never silently truncated. Operational retry limits are separately versioned (see policy 5 below). Model classification is not guaranteed correct; the software enforces scope, citations and retention.

Context references retain unit IDs, exact quotations, review ID, segmentation set ID and UTF-16 offsets. Run/output links retain provider, model, attempt and run provenance. Manual decisions retain actor, timestamp and append-only revision provenance.

Historical Explicit/Implicit codes retain their original labels and protocol. They are excluded from new-protocol percentages and counted separately. Resuming an old run retains its original protocol; it does not upgrade earlier results. Reassessment requires a new analysis, never automatic relabelling.

Counts are competency applications at target evidence locations, not independent observations or institution/domain scores. Total supported = Explicit + Contextual. Percentages use this total; empty denominators are N/A. All 21 competencies remain separate.

## Batch recovery (Research’Ed 0.9.1)

The following describes historical policy 4; policy 5 below supersedes its request deadlines on new runs or explicit resume.

Each batch has at most three attempts per explicit resume cycle, with 30-second and 120-second retry delays and the existing 90-second request timeout. Invalid response schemas, quotations and citations are rejected and retried, never repaired or accepted without validation. Other ready batches continue while retries wait; exhausted response failures remain unresolved and do not block other batches. Authentication, exhausted rate limits, unavailable/changed providers and local integrity failures pause the run because they require intervention. Terminal status is complete only when all tasks succeeded; otherwise it is partial or failed. Resume targets only unresolved tasks and retains successful outputs unchanged. This execution repair applies when an updated worker is next started; it does not rewrite historical run configuration or findings. Attempts remain individually logged.

## Provider readiness and structural safety (Research’Ed 0.9.2)

Operational retry policy v4 uses the first scheduled batch (at most six target units plus same-review context) as a combined connection/generation/schema/evidence check. No later batch is released until this check succeeds. This avoids relying on a model-list endpoint that some shared assistant connections do not implement. It does not establish model accuracy. The initial successful result is retained, not generated twice.

Three consecutive provider-level failures (HTTP 429/5xx, network errors or timeouts) pause the whole run. A success or a response-validation failure interrupts that consecutive provider-failure sequence. Authentication failures and provider changes require intervention. The finite per-batch limit remains three attempts, delays 30/120 seconds, timeout 90 seconds, concurrency one. If the first batch exhausts retries without a retained result, remaining batches stay pending. After readiness succeeds, isolated malformed responses can retry while other batches continue. No failed attempt creates findings; deterministic retrieval remains separate. Explicit resume processes unresolved tasks only. A resumed run with retained successes keeps those successes and still applies the consecutive-provider-failure breaker.

The observed failed Director pilot had no successful requests; its 502 attempts took approximately 1.7–11.8 seconds (median 2.26 seconds). Increasing the 90-second timeout would not address that failure. No new real-model request was made for this repair. The upstream service still needs a successful connection/structured-response check before a new corpus run; this release cannot prove or fix a remote service's availability.

Migration 0025 adds nullable failure category and diagnostic fields to attempts. New HTTP failures retain status, a syntax-limited request ID and upstream code/type, plus a SHA-256 digest of at most the first 8 KiB of response text. Raw provider prose is omitted. Existing attempt rows and successful outputs are not rewritten.

The reusable director-questionnaire@1.0 profile detects the repeated characteristics/experience table, with the overall-rating row optional. Narrative subsection headings are markers, not boundaries. Missing optional fields and unrecognised tables require review. A missing heading alone does not make an otherwise exact questionnaire boundary ambiguous; identifiers and institution names remain unassigned. School questionnaire behaviour is retained. Repeated known review markers without a matched profile enter manual structural review instead of generic document mapping. This conservative guard is not a universal detector for every possible compilation format.

Known compiled sources cannot use generic mapping, create a new population from old document records, start classification, or resume an old compiled population merely by selecting the review-boundary checkbox. Structural mappings create new versions and unique records. Attempts to merge multiple recognised questionnaires into one record are rejected. Original bytes and prior mappings, populations, runs and reports remain unchanged.

For the existing Director failed pilot, retain the failed run for audit. When a new analysis is authorised: create a new MCF work item and upload the source; the profile is detected automatically. On Clean, review the proposed boundaries, accept the clear boundaries together and individually inspect the ambiguous cases. Choose which components enter analysis; the default is narrative only. Questionnaire responses and section markers remain preserved separately. Institutions may remain unassigned. Preparing this mapping must precede any new analytical population. Do not resume the historical document-level population.

Read-only inspection on 2026-10-18 identified 76 Director candidates: 74 clear, two requiring review (one missing rating row; one containing an unrecognised table). All 76 lack standard review headings. These are observations from the document, not hard-coded expected counts. No mapping was saved and no Director analysis or validation sample was run as part of verification.

## Operational policy 5 (Research’Ed 0.9.5)

Three finite attempts use 120/180/210-second deadlines and unchanged 30/120-second retry delays. The shared AI bridge remains capped at 240 seconds. Explicit resume upgrades older execution limits with a previous/new-policy audit entry, without changing successful tasks or their results. Evidential protocol and MCF v1.0 remain frozen. See RELEASE_0.9.5.md for measured durations and rationale.

Machine responses may repeat a contextual reference. Remove only exact (unit ID, quotation) duplicates within a competency; record each removed reference and its index in provenance. Retain distinct quotations from the same permitted unit with their exact offsets. All remaining evidential validation applies unchanged. No historical payload is normalized retrospectively.


## Operational policy 6 (Research’Ed 0.9.7)

Supersedes the first-batch gate and consecutive-provider-failure breaker described above. Every batch independently receives up to three attempts (120/180/210-second deadlines, 30/120-second retry delays). Ready later batches can proceed while earlier retries wait. Exhausted provider or response failures affect only their batch; the run settles as partial or failed after all remaining work settles. Authentication, changed/unavailable provider configuration and integrity/retention failures still require intervention. No deterministic substitution occurs. Explicit resume upgrades the scheduling policy only for unresolved work; successful outputs and attempt history remain unchanged. Installing this release never resumes a paused run.

## Operational policy 7 — untouched work before retry rounds

The durable queue orders ready tasks by the number of attempts in their current cycle, then by their original ordinal. Untouched batches therefore run before any ready retry. Unsuccessful batches automatically return in subsequent rounds; no resume click is needed between rounds. Backoff remains 30/120 seconds and each batch has at most three attempts with 120/180/210-second deadlines. While retries are queued or waiting, the run remains active; only exhausted failures produce a terminal partial/failed run. Successful tasks are never selected again.

Ordering is computed from persisted attempt history and applies when this worker next runs; it does not rewrite existing results or restart/resume a live run. Explicit resume upgrades the recorded operational policy for unresolved work and starts a new finite retry cycle as before. Authentication/configuration, integrity failures, researcher cancellation and restart interruption still require intervention. No infinite retry loop or deterministic substitute is introduced; MCF v1.0 and evidence classification are unchanged.


## Operational policy 8 — two concurrent semantic batches (Research’Ed 0.10.8)

New runs and explicitly resumed older runs allow up to two in-flight semantic batches. A database transaction serializes claims only, with a shared advisory lock and fresh statement snapshot; provider calls execute outside that transaction. The database enforces an overall two-batch ceiling across semantic workers and a per-run ceiling from its recorded policy. Older runs remain serial until explicitly resumed. A free worker lane refills on the next one-second tick without waiting for its peer.

This changes scheduling only: six-target/10,000-character batching, all approved same-review context, the frozen MCF instrument, evidential instructions and schema, citation checks, provider/model identity, three-attempt retry budgets, 120/180/210-second deadlines, 30/120-second backoff and untouched-first ordering are unchanged. No successful task is eligible for another claim. Results may finish out of order but retain their original task and unit identities. Authentication or integrity pauses still stop queued work; a peer’s valid in-flight success is retained and makes failed coverage partial without resuming the run. Cancellation also retains valid in-flight semantic successes.

Verification uses synthetic fixtures only: the full regression suite, worker-lane refill tests and `scripts/verify-semantic-concurrency.mjs` against disposable PostgreSQL. The latter checks five competing workers, a two-request ceiling, independent retries, unresolved-only resume, legacy serial policy, same-review request contents, cancellation and concurrent authentication failure. No Director run is created, resumed or rewritten. Concurrency may reduce elapsed time but actual gains depend on provider capacity and throttling.


## AI ambiguity protocol 1 (Research’Ed 0.10.10)

New semantic runs retain semanticProtocol 3 and evidential protocol 2, adding ambiguityProtocol 1 and prompt mcf-evidential-proposals.v3. The frozen MCF v1.0 instrument, supported-application definitions, same-review context boundary, operational policy 8 and retry/timeout limits are unchanged. The extended prompt explicitly distinguishes overlap from unresolved interpretive ambiguity; Contextual is never treated as weaker or inherently ambiguous.

Every target, including zero-supported-code targets, must return an ambiguity assessment: none or identified, reason, evidence quotations and alternative readings. Identified ambiguity requires exact cited target/same-review evidence. Each alternative requires its own interpretation and exact citations. Alternatives must be unique and cannot also appear among supported codes. They are excluded from both supported counts and No-application IDs, and retained in unresolvedCompetencyIds. Semantic zero-code remains zero supported codes and may coexist with unresolved alternatives.

The worker validates every quotation against the frozen permitted review context and provider citation list, retaining source offsets, record/unit IDs, run/attempt/provider/model and prompt provenance. Missing or invalid ambiguity responses fail the whole batch and follow the existing finite retry policy. Deterministic candidates never supply ambiguity or semantic findings. No percentages or confidence hierarchy are introduced.

Old runs keep their original configuration on resume: no ambiguity upgrade, no extra historical requests, no rewriting successful output. Missing historical ambiguity is displayed as not assessed by this analysis, as are pending or failed units. This distinction also applies when displaying previously frozen report snapshots; the stored snapshots remain unchanged.

The analysis UI has an AI ambiguity section and passage filters. JSON, HTML and PDF reports expose assessed/flagged/no-ambiguity/not-assessed counts, alternative mentions, reasons, citations and provenance. AI ambiguity remains separate from researcher annotations. Staged validation reveals AI ambiguity alongside frozen findings only after initial coding is locked; the researcher can accept, amend or leave the interpretation unresolved through the existing independent final judgement.

Verification uses synthetic provider responses and disposable PostgreSQL, including a missing-assessment retry, unchanged retained outputs, old-protocol resume, alternative exclusion, blind-review hiding, UI filters and all report exports. This verifies implementation, not the accuracy/calibration of a real model’s ambiguity judgements. No Director corpus run or live model request is made.

## ISR numerical rating metadata (ambiguity protocol 2)

New runs snapshot researcher-authorised ISR Director rating scale metadata separately from MCF v1.0. Values 1–5 mean strongly negative, negative, midpoint/average, positive, strongly positive respectively. Metadata applies only to recognised, approved questionnaire rating spans in director-questionnaire mappings. It resolves unknown numerical direction only; referent and competency ambiguity remain assessable. Alternatives remain excluded from supported counts. The unchanged semantic protocol is 3, evidence protocol is 2, and the response format remains ambiguity version 1.

Ambiguity is coupled to semantic assessment; there is no ambiguity-only rerun. Existing runs retain their saved protocol, instructions and outputs, including on resume. The next new analysis uses ambiguity protocol 2 with versioned scale metadata in run configuration and finding provenance. No run is started by this change.
