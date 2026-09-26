# MemeCoin'Ed Paper Validation Protocol

## Authority and scope

This window is paper-only. It does not authorize real orders, wallet signing, or any live-money mode.
The evaluation begins only after the verified build is installed and its engine version is visible.

## Current window origin

- Results produced before release `2026.09.25.8` are diagnostic and are not part of this window.
- The current epoch began after `2026.09.25.8` was installed, MemeCoin'Ed restarted, and the database reported ready at `2026-09-25T19:54:26+03:00`.
- The exact source commit is recorded in `memecoined-verification-2026.09.25.8.json`; that release artifact is the authoritative build identity.
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
- A code, configuration, provider, allocation or parameter change invalidates the window and requires a fresh baseline.
- Oscillation Trader and Fast & Furious are evaluated independently. Their records must never be pooled.
- Breakout & Retest and Recovery & Reversal share a detector and are reported both separately for execution and together as the `shared_pullback` evaluation family. The family aggregate is the primary detector-level result.

## Minimum evaluable sample

Each evaluated profile requires at least 60 valid closed trades. A shorter active-time window with fewer than 60 closed trades is operational evidence but is not an efficacy verdict; the frozen run continues until either the trade-count target is reached or measured active scheduler time reaches 168 hours.

## Recurrence policy

- One unexplained process termination is retained as environmental noise only because the epoch/configuration hash and persisted evidence remained intact and the inactive interval is excluded.
- A second unexplained worker termination ends this epoch as `diagnostic`. The crash cause must then be corrected in code, a new verified release and epoch created, and validation restarted.
- Checkpoints remain read-only: cycle continuity, cohort occupancy, funnel counts, closed-trade evidence and captured process diagnostics. No mid-window strategy or runtime tuning is permitted.

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

## Interpretation order

1. Verify build identity, frozen configuration and uninterrupted provider availability.
2. Reconcile profile funnel totals and signal/outcome ownership.
3. Confirm observation density and exactly eight allocated pins at every snapshot.
4. Decompose exits by target, trail, hard stop and time limit.
5. Apply the friction kill switch.
6. Apply expectancy, win-rate and stop-slippage criteria.
7. Only then examine rejected opportunities or consider a new hypothesis.

No parameter is changed during the window. A failed result creates a new proposed experiment, not an edited result.
