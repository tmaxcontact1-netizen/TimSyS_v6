# ResearchEd bounded retry execution revision — 6 November 2026

Execution revision: `bounded-retry-batches.v1`. Coding policy remains v10; MCF v1.0, F1, ambiguity, same-review context, rating exclusion and supported-count rules are unchanged.

- First request deadline: 150 seconds. Second/third: 180/210 seconds.
- Initial batches: up to six targets; retry batches: at most three targets. Every request retains the full approved same-review context. Two concurrent lanes remain.
- A failed batch is partitioned transactionally with the run lock held. The existing task keeps the first group; new tasks receive the remaining groups. No completed task is partitioned. All original attempt targets are frozen in `target_unit_ids`; children reference the parent attempt and inherit the consumed submission budget.
- Maximum three submissions per unit per explicit-resume cycle. Splitting does not reset this budget. Untouched batches precede retries. Successful groups are retained independently and never resubmitted by automatic retry or explicit resume. Explicit resume starts a new bounded cycle for unresolved groups only.
- New runs snapshot the revision. Existing runs retain their settings while running. After a future installation, explicit resume upgrades execution settings only and audits the prior settings; saved classification rules and successful outputs remain unchanged.

Diagnostics record attempt correlation ID, requested deadline, target count, context size, serialized request bytes, time to HTTP headers, total transport duration, HTTP status, and sanitized provider error identifiers. Local deadline expiration is `ai_provider_local_timeout` with `failureOrigin=researched-local-deadline`; upstream HTTP/body errors and transport failures are distinguished. Successful transport diagnostics are retained even when semantic validation fails. No credentials, URLs, corpus text or arbitrary upstream prose are added to diagnostics. First-token timing is explicitly unavailable because the shared bridge buffers its response; this change does not modify that bridge.

The 150-second first deadline follows the observed audit: successful retries exceeded 120 seconds and reached 137.21 seconds. All three deadlines remain below the bridge's 240-second deadline. This is a bounded operational adjustment, not a claim that all provider requests will finish.

## Verification

- Final complete ResearchEd suite: 449 tests passed across 51 files.
- TypeScript production build: passed.
- New worker regression exercises six targets failing, partition into two groups of three, one successful group retained unchanged, other group exhausting its inherited budget; verifies full context and unchanged rules on every request.
- Adapter tests distinguish local timeout from HTTP 502 and verify diagnostics exclude sensitive fixture text.
- Existing policy tests verify explicit resume keeps historical reasoning version and leaves the supplied saved object unchanged.
- Additive migration 0026 tested in a disposable PostgreSQL 18.4 cluster on loopback port 57781. Historical rows default to zero inherited attempts; negative budgets rejected; production claim SQL parsed and executed. Test cluster stopped. No live migration performed.
- `git diff --check`: passed.

The first full-suite invocation overlapped the final explicit-resume source adjustment and saw cached old implementation with new expectations (7 failures). The final clean invocation passed all 449. A Windows inherited-pipe issue in the disposable database harness was corrected before the successful schema check.

TradeEd watchdog state was stale (November 1); recorded worker/watchdog PIDs were absent, and process inspection found no TradeEd validation worker. No TradeEd, launcher, shared AI, updater or live data changes were made. No live analysis was started, resumed, cancelled or restarted.

Source commit/push only. No publication, installation or release manifest change.
