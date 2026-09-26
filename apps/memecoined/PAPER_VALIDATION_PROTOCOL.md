# MemeCoin'Ed Paper Validation Protocol

## Authority and scope

This window is paper-only. It does not authorize real orders, wallet signing, or any live-money mode.
The evaluation begins only after the verified build is installed and its engine version is visible.

## Current window origin

- Epoch 3 / release `2026.09.25.8` terminated as diagnostic and is not part of the current efficacy window.
- The next validation window begins only after release `2026.09.26.9` is installed, migration `0062_epoch_9_clean_baseline.sql` creates the active epoch, the configuration hash is sealed, and the launcher-owned database, worker, dashboard, diagnostic capture, and resource ledger all report ready.
- Release tag `2026.09.26.9` and its published source commit are the authoritative build identity; the installed verification artifact records the exact commit.
- The exact source commit is recorded in the release verification artifact; that artifact is the authoritative build identity.
- Data from an earlier release is never concatenated with or averaged into this window.
- The release gate starts from a newly created database with zero persisted market observations and simulates four hours at the production 15-second dense/30-second rotating cadence across at least 50 competing tokens. It must demonstrate observation, qualification, eight pin assignments, entry eligibility, completed paper round trips and displayed results.

## Declared instrumentation intervention

- The worker process terminated without durable process output at `2026-09-25T21:18:30+03:00`; PostgreSQL remained healthy and the epoch/configuration hash survived unchanged.
- The resulting inactive segment ended when the worker was reopened at `2026-09-26T06:42:15+03:00`. The `9h 24m 15s` gap is excluded from active scheduler time.
- At `2026-09-26T06:51:35+03:00`, an instrumentation-only restart was declared and it became active at `2026-09-26T06:56:00+03:00`. The verified `.8` bundle and its database, epoch, profiles, allocations, thresholds, providers, balances and configuration hash remain unchanged. Worker/dashboard stdout and stderr are redirected to durable local files, and Node fatal-error and uncaught-exception diagnostic reports are enabled externally.
- Windows Event IDs 1000/1001 and existing crash-dump locations contained no evidence for the first termination. Windows rejected LocalDumps registry configuration from the unelevated desktop session, so the Node diagnostic reports are the active crash-capture mechanism.

## Frozen window

- Terminal condition: 60 valid closed trades per evaluated profile or 168 hours of measured active scheduler time, whichever occurs first.
- Active scheduler time is derived from `paper_observation_cycles`. It is the sum of elapsed time within continuous run segments; a gap greater than twice the nominal cycle interval ends the current segment and is not counted.
- All strategy constants, gates, sizing rules, sampling policy, provider configuration, fees and starting balances are frozen.
- The epoch `.9` profile set, allocations, parameters, providers and balances carry forward unchanged from epoch `.8`; only runtime evidence is reset by epoch isolation.
- A code, configuration, provider, allocation or parameter change invalidates the window and requires a fresh baseline.
- Oscillation Trader and Fast & Furious are evaluated independently. Their records must never be pooled.
- Breakout & Retest and Recovery & Reversal share a detector and are reported both separately for execution and together as the `shared_pullback` evaluation family. The family aggregate is the primary detector-level result.

## Minimum evaluable sample

Each evaluated profile requires at least 60 valid closed trades. A shorter active-time window with fewer than 60 closed trades is operational evidence but is not an efficacy verdict; the frozen run continues until either the trade-count target is reached or measured active scheduler time reaches 168 hours.

## Recurrence policy

- One unexplained process termination is retained as environmental noise only because the epoch/configuration hash and persisted evidence remained intact and the inactive interval is excluded.
- A second unexplained worker termination ends this epoch as `diagnostic`. The crash cause must then be corrected in code, a new verified release and epoch created, and validation restarted.
- Launcher/runtime ownership interference follows the same bounded rule. A repeated launcher-spawned worker or externally commanded database stop ends the epoch as `diagnostic`, because systematic gaps bias the sampled market conditions even when writes do not overlap.
- Checkpoints remain read-only: cycle continuity, cohort occupancy, funnel counts, closed-trade evidence and captured process diagnostics. No mid-window strategy or runtime tuning is permitted.

## Epoch 3 termination

- At `2026-09-26T07:18:56+03:00`, the launcher-owned database lifecycle issued a fast PostgreSQL shutdown while the externally instrumented `.8` worker was active. Cycles were continuous at 15-second cadence through `07:18:45`, with zero overlap detections and a maximum scheduler lag of 22 ms.
- During the attempted infrastructure recovery, a launcher-owned PostgreSQL instance and worker started on a temporary port before launcher supervision was neutralized. That worker stamped four additional epoch-3 cycles at `07:56:45`, `07:57:00`, `07:57:15`, and `07:57:30`. No overlaps were recorded, but this violated the precondition that no cycles be written during the inactive segment and constituted repeated supervision interference.
- The installed launcher has no per-application supervision-disable switch. For recovery investigation it was neutralized by stopping the launcher process family; PostgreSQL was then returned to the same data directory and port `53318` under external ownership. No strategy, profile, allocation, balance, provider, schema, or configuration-hash change was made.
- Epoch 3 (`2026.09.25.8`, configuration hash `c1c582432f85d60f97a5e628c2abe2dfd2bcf36c2ae46a017346f39b01dd671b`) therefore terminates as `diagnostic`. Its evidence must not be treated as an efficacy result or concatenated into a later validation epoch.

## Pre-registered pass conditions

For each profile independently:

1. Mean realized net outcome is greater than 0 bps after measured friction.
2. Win rate is at least 60%.
3. Mean positive gap between realized loss and planned stop is no more than 50 bps.
4. Mean `measured_round_trip_bps` divided by mean `planned_target_bps` is no more than 0.40.

If condition 4 fails, the conclusion is `structurally uneconomic at observed friction`; thresholds must not be tuned to disguise it.

## Required evidence per closed trade

The immutable signal/outcome ledger must contain:

- profile and token;
- first qualifying signal time and executable output;
- filled entry time and output;
- entry-to-first-signal price delta in bps;
- planned target, planned stop and planned loss in bps;
- exit time and exit reason;
- realized gross and net result in bps;
- estimated friction, measured round-trip friction and their difference;
- realized loss and realized-versus-planned loss gap;
- maximum favorable and adverse excursion;
- holding time.

Missing required fields invalidate that trade for efficacy analysis and are reported as an instrumentation failure.
The ledger stores both input and output amounts for the first signal and filled entry, so
`entry_to_first_signal_bps` compares normalized executable prices rather than unlike raw
token quantities. It also persists the signed estimated-to-measured friction difference
and signed realized-to-planned loss difference; the pass test uses the positive portion
of the latter.

## Environment-interrupted trade classification

- An `interruption event` is any timestamped event recorded in this protocol's event ledger: worker-process termination, launcher-caused runtime interference, database shutdown, or an interval in which `paper_observation_cycles` contains a gap greater than twice the nominal cadence.
- A closed trade is `environment_interrupted` when its inclusive open interval, from entry-fill timestamp through exit-fill timestamp, intersects an interruption event's inclusive start-to-recovery interval. Every other closed trade is `clean`.
- This classification is report-level for epoch 3; it does not alter the frozen runtime schema. It is derived from immutable fills, cycle gaps, and this protocol's event ledger and must be reproducible by the validation report.
- Every closed trade counts toward the 60-trade terminal condition for its profile, regardless of classification. Excluding a trade from primary efficacy metrics cannot extend the window.
- Win rate, expectancy, and exit-reason distribution are reported separately for the `clean` and `environment_interrupted` partitions. Both partitions remain visible and neither is deleted.
- The `clean` partition is the primary efficacy basis. The `environment_interrupted` partition is reported as platform-reliability evidence.
- This rule is fixed before evaluation and applies unchanged regardless of either partition's result. Trades cannot be reclassified post hoc.

### Epoch 3 interruption ledger

- `2026-09-25T21:18:30+03:00` through `2026-09-26T06:42:15+03:00`: unexplained worker-process termination and inactive scheduler interval.
- `2026-09-26T06:54:00+03:00` through `2026-09-26T06:56:15+03:00`: instrumentation-only restart interval, represented by a cycle gap greater than twice nominal cadence.
- `2026-09-26T07:18:56+03:00` through `2026-09-26T07:56:45+03:00`: launcher-caused PostgreSQL shutdown and inactive scheduler interval.
- `2026-09-26T07:56:45+03:00` through `2026-09-26T07:57:30+03:00`: launcher-owned recovery worker interference. Cycles were written without overlap, but the interval remains an environmental event under the pre-registered recurrence policy.

### Epoch 4 (`.9`) event ledger

- `2026-09-26T09:15:00+03:00` through `2026-09-26T09:15:45+03:00` — event type: `operational_test`; cause: deliberate stop-lifecycle verification. The 45-second scheduler-cycle gap is excluded from measured active time under the gap-exclusion protocol. The launcher stopped the instrumented worker and dashboard without starting a duplicate, but the PostgreSQL master remained active. MemeCoin'Ed then restarted cleanly against the same database; epoch 4 remained active and its sealed configuration hash `c1c582432f85d60f97a5e628c2abe2dfd2bcf36c2ae46a017346f39b01dd671b` was unchanged.
- `2026-09-26T09:49:31.610+03:00` — event type: `worker_termination`; cause: entry-consumer concurrency collision. One Oscillation Trader BUY for `CbcyNo…kzpKoU` committed at `09:49:31.465`, while a competing pending-entry consumer reached the same profile/token position and treated the idempotency collision as fatal. Scheduler cadence remained exactly 15 seconds through the final cycle; memory was 118.57 MB and did not indicate exhaustion. The still-open position intersects the outage and is fixed as `environment_interrupted`. Epoch `.9` is terminated as `diagnostic`; completed trades and the interrupted position are preserved in `paper_validation_trade_archive` by migration `0063`.

### Epoch 5 (`.10`) frozen protocol

- Release: `2026.09.26.10`; protocol: `atomic-entry-v1`.
- Terminal condition remains 60 closed trades per evaluated profile or 168 hours of measured active scheduler time, whichever occurs first.
- Oscillation Trader and Fast & Furious are both evaluated. Of four dense watch slots, at least one is reserved for a Fast & Furious watch; the other three remain score-ranked shared capacity.
- Entry processing has one owner per simulation cycle. Position, cash, fill, decision, intent and signal outcome are one atomic database commit.
- The `clean` / `environment_interrupted` classification and gap-exclusion rules apply from the first cycle.

## Interpretation order

1. Verify build identity, frozen configuration and uninterrupted provider availability.
2. Reconcile profile funnel totals and signal/outcome ownership.
3. Confirm observation density and exactly eight allocated pins at every snapshot.
4. Decompose exits by target, trail, hard stop and time limit.
5. Apply the friction kill switch.
6. Apply expectancy, win-rate and stop-slippage criteria.
7. Only then examine rejected opportunities or consider a new hypothesis.

No parameter is changed during the window. A failed result creates a new proposed experiment, not an edited result.
