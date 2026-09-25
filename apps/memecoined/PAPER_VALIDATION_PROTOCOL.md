# MemeCoin'Ed Paper Validation Protocol

## Authority and scope

This window is paper-only. It does not authorize real orders, wallet signing, or any live-money mode.
The evaluation begins only after the verified build is installed and its engine version is visible.

## Frozen window

- Duration: 24 consecutive hours on live provider data.
- All strategy constants, gates, sizing rules, sampling policy, provider configuration, fees and starting balances are frozen.
- A code, configuration, provider, allocation or parameter change invalidates the window and requires a fresh baseline.
- Oscillation Trader and Fast & Furious are evaluated independently. Their records must never be pooled.
- Breakout & Retest and Recovery & Reversal share a detector and are reported both separately for execution and together as the `shared_pullback` evaluation family. The family aggregate is the primary detector-level result.

## Minimum evaluable sample

Each of Oscillation Trader and Fast & Furious requires at least 60 closed trades. A 24-hour window with fewer than 60 closed trades is operational evidence but is not an efficacy verdict; the frozen run continues until the minimum is reached.

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

## Interpretation order

1. Verify build identity, frozen configuration and uninterrupted provider availability.
2. Reconcile profile funnel totals and signal/outcome ownership.
3. Confirm observation density and exactly eight allocated pins at every snapshot.
4. Decompose exits by target, trail, hard stop and time limit.
5. Apply the friction kill switch.
6. Apply expectancy, win-rate and stop-slippage criteria.
7. Only then examine rejected opportunities or consider a new hypothesis.

No parameter is changed during the window. A failed result creates a new proposed experiment, not an edited result.
