# Epoch-16 binary-score diagnosis

Status: diagnosis complete; replacement implemented only on `release-next-conviction`. Epoch 16 remains unchanged.

## Finding

The 0/100 score is **by-design conjunction collapse**, not a numeric coercion bug.

In `profile-paper-simulation.ts`, the simplified path computes:

- F&F `simpleQualified`: liquidity >= $100k AND buy pressure >=45%.
- OT `simpleQualified`: liquidity >= $100k AND at least three SMA crossings.
- Watch update score: `simpleQualified ? 100 : 0`.
- Persisted signal score: `simplePattern.eligible ? 100 : 0`.

The actual entry decision remains the conjunction in `simple-patterns.ts`, plus the measured median-spread gate. No graded score is calculated from entry distance, spread, or buy pressure.

## Consumers

### Admission

The binary score does not authorize the trade. Admission uses `simplePattern.eligible && spreadEligible`. The score stored on `paper_profile_signals` is descriptive.

### Watch qualification and removal

The 0/100 watch score is operational:

- It increments/resets consecutive qualification state.
- It writes `regime_score`.
- Failed evaluations decay the stored regime score by one.
- Five consecutive qualifications can pin a watch.

### Dense watch allocation

The score affects allocation. Pin rebalancing orders by:

1. `regime_score DESC`
2. `consecutive_qualifications DESC`
3. `qualified_at`
4. `profile_id`
5. `token_mint`

Per-cycle watch selection aggregates `watch_score = max(regime_score)` and orders by:

1. `watch_score DESC`
2. `qualified_at DESC`
3. `mint_address`

Thus the binary score creates large ties, but the system does not immediately choose randomly: qualification streak and timestamps usually decide first. Mint text is the final arbitrary tie-break.

### Probe and rotating allocation

These paths use the separate candidate `total_score` from `score_breakdowns`, not the simplified 0/100 signal score. Sparse-volatility ranking also influences responsive probe selection.

### Candidate decision and execution

`paper_profile_candidate_decisions.score` is populated from the refreshed candidate score (`current.score.total`), not the 0/100 simplified score. Execution is not prioritized by the binary signal score.

### Dashboard

The dashboard reads and displays `paper_profile_signals.score`. In that context it conveys only pass/fail and is misleading if presented as signal strength.

## Epoch-16 tie evidence

At the diagnostic snapshot:

- F&F: 25 active watches at score 100, 56 at 99, 2 at 98; three score-100 watches pinned.
- OT: 36 active watches at score 100, 25 at 99; five score-100 watches pinned.
- All eight current pins have score 100. Their qualification streaks range from 223 to 669, so current pin ordering is primarily streak-driven, not mint-driven.

The database does not persist the full ranked candidate set and all tie-break inputs for each historical slot selection. Consequently, it is not possible to name every epoch-16 slot that reached the final mint-address tie-break without reconstructing unavailable point-in-time watch snapshots. Any such list would be invented.

## Next-release disposition

Do not retain a field called `score` if it means only Boolean eligibility.

Recommended split:

1. Rename the Boolean concept to `qualified` and persist it as a Boolean.
2. Introduce a separate deterministic `priority_rank`, used only for scarce observation capacity:
   - primary: deeper valid entry distance within the profile's permitted band;
   - secondary: lower measured median spread;
   - tertiary: higher buy pressure;
   - final deterministic tie-break: earlier qualification, then mint.
3. Do not use this rank as an extra admission gate. It allocates observation capacity among already qualified candidates.
4. Dashboard labels must say `Qualified` and show the ranking features individually, not present 100 as a confidence percentage.

For F&F, depth can be ordered toward 100 bps within the allowed 20-100-bps band. For OT, use oversold/onset distance rather than F&F pullback distance, then spread, then buy pressure. A single cross-profile numerical score would conceal different strategy meanings and should be avoided.
