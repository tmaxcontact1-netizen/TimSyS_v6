# Research’Ed 0.9.5 — bounded semantic recovery and contextual citations

Processed 19 October 2026 (Riyadh, GMT+3).

The Director run reached 1,996/2,020 substantive assessments in 364 successful batches. Four six-passage batches exhausted their attempts: three repeatedly reached the 90-second deadline and one repeatedly cited the same contextual unit. The initial pass finished at 00:51 Riyadh; the researcher manually resumed at 05:17. No application or corpus intervention was made during diagnosis or development.

Observed successful request durations (364 requests): median 42.986 s, mean 45.448 s, p95 78.742 s, p99 84.517 s, maximum 89.399 s. Successful durations are censored by the old 90-second cutoff, so these do not estimate the slow tail. Operational policy 5 gives each batch three attempts with 120/180/210-second deadlines and 30/120-second retry delays. The first budget adds about 35 seconds above observed p99; subsequent attempts have bounded additional headroom. All remain below the unchanged shared bridge's 240-second deadline, with at least 30 seconds of margin. Concurrency remains one; target count, approved context, instrument and model are unchanged. This is a bounded recovery policy, not a guarantee of provider completion.

New runs use policy 5. Explicitly resuming an older eligible run upgrades only its execution-timeout policy and appends an audit entry with previous/new policies. Completed tasks, attempts, proposals, outputs and report snapshots are not rewritten or resubmitted. Existing in-flight runs keep their frozen timeout policy until an explicit resume. A later resume still requests only unresolved targets. New semantic proposal provenance records the effective timeout and policy version.

Exact duplicate (unit ID, quotation) references within one competency are removed before validation. Every removed reference and original index is retained in proposal provenance. Different exact quotations from the same contextual unit are retained with separate source spans. Competency counts are unchanged. Fabricated quotations, wrong review/version, self-citation, missing support and unsupported citations still fail validation. Historical results are untouched; this is citation transport normalization, not reinterpretation or relabelling.

Verification: 194 unit tests across 33 suites; TypeScript and Vite production build; browser/disposable-database regression, including old-policy resume, unresolved-only target submission, successful proposal/output byte equality, historical snapshot preservation, duplicate normalization and distinct source spans. Semantic integrity regression additionally checks actual per-attempt timeout propagation, finite retries, later-batch continuation and PDF/HTML/JSON coverage. Tests use synthetic providers only.

Export regression also identified and fixed a missing-source-list rendering guard when reopening a saved report without upload metadata.

Release scope: Research’Ed only; no migrations, shared AI, launcher, updater, platform or Trade’Ed changes. The Trade’Ed worker remains independently scheduled on port 18861 with separate runtime and durable logs. Publishing does not install or restart any application.

After the current resumed run settles, install this update. Reopen the same work and choose **Resume unfinished analysis** if any passages remain unresolved. Do not delete the work, re-upload the corpus, or start another analysis. If the existing resume finishes everything, no further analysis is needed.
