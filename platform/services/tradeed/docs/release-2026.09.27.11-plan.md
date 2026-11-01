# Release 2026.09.27.11 implementation specification

Status: **plan only — not authorized for implementation or publication**.

This specification is based on the immutable epoch-5 archive and `epoch-5-entry-state-diagnostic.md`. A fresh validation epoch labelled `.11` now runs unchanged release `.10` code; that operational epoch is not an implementation of this release plan. Release `.11`, its commit, publication, and migration each require separate authorization.

## 0. Operational prerequisite: scheduler/pool liveness

The first epoch-7 run exposed a deterministic infrastructure blocker before any trade evaluation. The scheduler starts a new observation cycle every 15 seconds, while each cycle constructs its own 16-slot `ObservationAttemptExecutor` and awaits provider work. Overlapping cycles therefore bypass the intended 16-attempt process-wide bound. The managed worker has a six-connection PostgreSQL pool and a five-second acquisition timeout; at `2026-09-27T17:06:22.880+03:00`, the next cycle timed out acquiring a connection and the top-level worker exited.

Required design:

- one process-wide observation executor shared by every cycle;
- bounded queue and the already specified rotating-before-probe-before-watch drop policy enforced across cycles, not separately inside each cycle;
- cycle admission must not start another full batch when the executor is saturated;
- database writes for provider telemetry must never hold a checked-out client while awaiting provider I/O;
- a pool-acquisition timeout inside one cycle becomes a failed/partial cycle with a structured incident, never a top-level worker exit;
- the scheduler must reconcile and close any `running` cycle/attempt rows left by a terminated worker before resuming.

Regression acceptance:

1. Run 60 simulated minutes at 15-second cadence with provider latency longer than one tick and assert total in-flight attempts never exceeds 16 across all cycles.
2. Run against a six-connection pool with 30% and 75% injected provider failures; assert no pool-acquisition timeout escapes the cycle, cadence remains measurable, and queue depth stays bounded.
3. Seed abandoned `running` cycle/attempt rows, restart, and assert deterministic reconciliation before the first new cycle.
4. The exact epoch-7 failure fixture must produce a recorded partial/failed cycle while the worker remains alive.

This liveness work is a prerequisite to testing the strategy changes below; it does not alter profile thresholds or allocations.

## 1. Current-state entry validation

### Defect

`recentOversoldTransition(prices)` can keep `extreme_oversold` true after the current state has left the oversold region. The signal currently means “an oversold transition occurred recently,” not “a transition occurred and the present state remains a valid long-side mean-reversion entry.”

### Proposed rule

Separate transition evidence from admission state:

```
transitionOccurred = immediateOversold || recentOversoldTransition(prices)
currentStateValid = currentRsi <= 35 && zScore <= -1.0
reversalStarted = latestReturnBps > 0
flowValid = buyPressure == null || buyPressure >= 0.48

extremeOversoldEligible =
  transitionOccurred && currentStateValid && reversalStarted && flowValid
```

The exact RSI/Z constants are pre-registered candidates for `.11`; they are not runtime changes in this plan. Both bounds are required so a historical transition cannot survive a current neutral/overbought state. Admission must rerun the same predicate immediately before the sized entry quote, using a current position-comparable quote observation. Insufficient current state is neutral/retryable, not a market failure.

Apply the same pattern to every transition-derived label:

- `extreme_oversold`: historical transition **and** current RSI/Z oversold band **and** positive reversal step;
- `midpoint_reversion`: historical below-midpoint excursion **and** current midpoint band **and** upward crossing remains current;
- Fast & Furious pullback/rebound labels: historical setup **and** current setup-specific price/flow band, rather than a retained prior label.

### Intended implementation boundary

- Pure predicates in `src/domain/strategy/oscillation.ts` and the corresponding Fast & Furious signal module.
- Re-evaluation in `processPendingEntries` before `enterPosition`; the immutable original signal remains unchanged, and a new admission-decision record explains pass/reject/retry.
- No admission predicate may read profile-global state or another profile's decision.

### Epoch-5 replay result

The proposed conjunction was replayed against the stored current-state metrics of all seven epoch-5 Oscillation Trader entries:

| Token/trade | RSI | Z-score | Historical result | Corrected admission |
| --- | ---: | ---: | ---: | --- |
| `jLz71QZf…u9dyap` | 55.20 | +0.24 | -109.59 bps | reject |
| `GTBxUiw6…yDpump` | 18.80 | -1.63 | +88.45 bps | **retain** |
| `4G5YDqDv…4Tqbzi` trailing | 69.46 | +0.52 | -38.31 bps | reject |
| `4G5YDqDv…4Tqbzi` hard stop | 77.00 | +1.34 | -113.76 bps | reject |
| `CbcyNo7m…kzpKoU` | 55.76 | -0.42 | -97.65 bps | reject |
| `777XNvfV…rwo777` | 63.95 | +1.42 | -356.26 bps | reject |
| `DAemPFNc…m8DGqN` | 78.68 | +2.60 | -112.28 bps | reject |

Result: **all five rapid hard-stop entries are rejected**, exceeding the required four-of-five criterion, while the profitable `GTBxUi` trade remains admissible. The other losing OT trade is also rejected. This is an offline replay result, not evidence of future profitability.

Required regression fixtures must reproduce these seven rows from immutable signal JSON and assert the table above. A separate boundary matrix covers RSI 35/35.01, Z -1.0/-0.99, missing metrics, future timestamps, and current-state expiry.

## 2. Reversal-onset persistence

Persist a first-class onset snapshot when a transition first becomes true, before admission:

- onset identifier and signal family;
- token, profile, epoch, candidate and observation fingerprint;
- onset timestamp;
- executable input/output raw amounts and quote size;
- RSI, Z-score, return, buy pressure and observation-window identity;
- source-provider timestamps.

The onset is immutable for one transition episode and expires when the state returns through a defined reset boundary. The admitted signal references the onset identifier.

Normalize onset-to-entry movement for unlike quote sizes:

```
entry_vs_onset_bps =
  ((onset_output * entry_input) / (onset_input * entry_output) - 1) * 10,000
```

Store onset-to-signal time, signal-to-fill time, onset-to-entry bps and signal-to-entry bps separately. This distinguishes detector lateness from executor latency.

## 3. Position-sized MFE/MAE

### Single source of truth

Closed-trade excursions must be calculated exclusively from `paper_profile_position_quote_paths` for the exact `(epoch, wallet, profile, token, position episode)` and inclusive entry-to-exit interval.

For position cost `C` and quote values `V_i`:

```
return_i_bps = (V_i / C - 1) * 10,000
MFE = max(0, max(return_i_bps))
MAE = max(0, -min(return_i_bps))
```

The entry point (0 bps) and final executable exit quote must always be present. If the path is incomplete, the outcome is marked `excursion_incomplete`; it must never silently become zero.

`paper_fast_market_observations` remains detector evidence only. It must not contribute to position P&L, high-water, MFE, MAE, stop, or trail arithmetic because its 0.01 SOL quote size differs from actual position size.

### Epoch-5 fixture acceptance

- `jLz71QZf…u9dyap`: MAE approximately 107.99 bps, not zero.
- `777XNvfV…rwo777`: MAE approximately 354.66 bps, not zero.
- `4G5YDqDv…4Tqbzi` trailing position: MFE approximately 83.20 bps, not 352.38; MAE approximately 37.25 bps before the exit fill, with final exit return -36.71 bps.
- Recomputed values must agree with an independent SQL fixture within 0.01 bps.

## 4. Quote-discontinuity calibration design

For consecutive position-sized quotes, calculate adverse jump:

```
adverse_jump_bps_i = max(0, (V_(i-1) - V_i) / V_(i-1) * 10,000)
```

Build distributions by liquidity band, position-size/pool-liquidity ratio, quote provider/route and elapsed-time band. Use non-overlapping samples to avoid pseudo-replication.

Proposed effective controls:

```
jump_floor = Q75(adverse_jump_bps | liquidity, size_ratio, cadence)
effective_stop = max(strategy_stop, jump_floor + measured_round_trip_cost)
effective_trail = max(strategy_trail, jump_floor)
```

The 4G5YDq path moved about 86.6 bps in 1.597 seconds; a 50-bps trail was therefore not executable as stated. A wider effective stop does **not** authorize more account risk. Position size falls inversely:

```
risk_sized_notional = account_risk_budget / effective_stop_fraction
```

If `effective_stop` exceeds the profile's absolute risk envelope, or target/stop expectancy becomes uneconomic, reject the trade rather than widen the risk.

### Liquidity-conditional sizing

The current 415-bps impact rejections indicate that risk sizing can propose a notional larger than the pool can execute inside the 125-bps short-horizon impact limit. `.11` should design a deterministic liquidity-sized ceiling using bounded quote probes or a conservative local impact curve:

```
entry_notional = min(cash, risk_sized_notional, absolute_cap, liquidity_sized_notional)
```

The liquidity ceiling is the largest tested notional satisfying both entry impact and immediate reverse-quote round-trip limits. If it falls below the minimum economically meaningful position, reject with an explicit reason. It must not weaken security gates.

## 5. Friction allowance semantics

The epoch-5 value called `estimated_friction_bps` is not a measured estimate. For Oscillation Trader it is:

```
maximumRoundTripCostBps = floor(0.60 * targetBps)
```

Thus the 777XNv target of 150 bps produced a 90-bps **allowance ceiling**. At entry, the sized buy is immediately reverse-quoted and rejected only if actual quoted round-trip loss exceeds that ceiling. Therefore 90 bps did gate the entry, but it does not mean the system estimated that trade's friction at 90 bps. The later 1.60-bps figure is execution fees divided by cost and is not the entry round-trip quote either.

`.11` should separate:

- `round_trip_cost_limit_bps` — policy ceiling;
- `entry_quoted_round_trip_cost_bps` — measured buy/reverse quote at admission;
- `realized_fee_bps`;
- `exit_quote_slippage_or_gap_bps`;
- `realized_total_execution_drag_bps`.

Acceptance: no UI, report, or pass criterion labels a policy ceiling as estimated or measured friction.

## 6. Accept-to-fill conversion funnel

Instrument one immutable stage event per signal/profile without changing signal ownership:

1. profile signal eligible;
2. unique entry intent acquired or blocked by existing owner;
3. evidence age valid;
4. source score identity current;
5. current-state admission valid;
6. confirmation count/span complete;
7. confirmation-lag limit passed;
8. risk/account/position-cap sizing passed;
9. sized entry quote obtained;
10. executable evidence freshness/flow/liquidity/impact passed;
11. reverse quote obtained;
12. quoted round-trip cost passed;
13. atomic fill committed.

Every signal reaches exactly one terminal funnel state with a machine reason. Dashboard counts use immutable signal IDs, not candidate rows, so repeated discovery cannot inflate denominators. The report must show count, distinct tokens, conversion percentage, and reason distribution at every transition, separately for F&F and OT.

Regression: a fixture containing owner collision, stale evidence, 415-bps impact, quote failure, round-trip failure and successful fill reconciles exactly: eligible signals = terminal rejections + expiries + pending + fills, with no duplicated signal.

## 7. Security-evidence age and provider cadence

Current code reduces security freshness to `candidate.evaluated_at <= 15 minutes`; this obscures the actual observation time of each independent security provider. `.11` analysis must extract each security evidence item's provider and `observedAt` from rule-evaluation evidence and persist the oldest required source timestamp on the signal/admission decision.

Required readout, per provider and rejection reason:

- evidence age at candidate evaluation, signal creation and entry authorization;
- p50, p75, p90, p95, maximum and histogram buckets;
- provider refresh intervals from successful provider calls;
- refresh failure/429/timeout rates;
- percentage rejected as stale despite a successful provider refresh being available;
- percentage admitted with each source inside its declared TTL.

Compare the measured provider refresh distribution with the 15-minute policy. A TTL change is not authorized merely because many entries are rejected: first determine whether the provider cadence is too slow, refreshed evidence is not being attached, or the TTL is economically justified.

Acceptance: a security-staleness rejection names the oldest source, its age, its TTL, and the most recent refresh attempt outcome. Provider evidence is never replaced by candidate-row age alone.

## 8. Verification and release boundary

Before any `.11` publication proposal:

- epoch-5 replay fixtures pass exactly as specified;
- MFE/MAE fixtures reconcile to the position quote paths;
- current-state revalidation is exercised at signal creation and entry authorization;
- funnel conservation holds under concurrency and retries;
- security-age distributions are produced from a frozen fixture and a read-only production export;
- the discontinuity/sizing design is reported with achieved rejection/fill counts under replay;
- the full discovery-to-displayed-result pipeline is verified end to end.

No implementation, migration, commit, or publication is authorized by this document.
