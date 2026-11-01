# Release 2026.09.28.13 verification

Status: release candidate verified locally; publication and epoch creation occur only after the recorded gates pass.

## Simplified decision surface

Fast & Furious retains five admission requirements: a recent 15-minute high, a current price 20-100 bps below that high, five-minute buy pressure of at least 45%, liquidity of at least USD 25,000, and executable Jupiter buy/sell routes. Its fixed exit plan is +100/-50 bps with a five-minute time limit.

Oscillation Trader retains four admission requirements: at least three 20-sample-mean crossings in 30 minutes, RSI <= 30 or Z-score <= -2, liquidity of at least USD 25,000, and executable Jupiter buy/sell routes. Its fixed exit plan is +80/-50 bps with a ten-minute time limit.

The release removes the composite score, quality threshold, adaptive target/stop formula, excursion calibration, onset-distance gate, security-evidence-age gate, cost cap, loss cooldown, EMA alignment, named-pattern requirement, and cross-profile evidence from these profiles. Rug/honeypot controls and SEC-011 remain.

## Baseline replay

The six pre-registered epoch 10 cases were replayed against the new Oscillation Trader admission function:

| Case | RSI | Z-score | SMA crossings | Result |
| --- | ---: | ---: | ---: | --- |
| 3iUTyN winner 1 | 29.6943 | -1.2287 | 31 | admitted |
| 3iUTyN winner 2 | 27.9643 | -1.4500 | 27 | admitted |
| 3iUTyN loser | 29.8269 | -1.5055 | 28 | admitted by actual state |
| 98kfF7 | 6.2278 | -1.9137 | 13 | admitted with fixed +80-bps target |
| 8DXqVU | 29.9020 | -1.1549 | 8 | admitted by actual state |
| CbcyNo | 34.6307 | -1.1255 | 6 | rejected: current state was not oversold |

This regression deliberately does not force-fit the two losing cases. It records what the stripped rule does.

## Historical projections

- Fast & Furious: 65 of the original 1,605 stored confirmed triggers satisfy the historical pullback, pressure, and liquidity checks: 40.50 projected admissions per 1,000 confirmed triggers. This is an admission projection, not a profitability claim.
- Oscillation Trader: 1,639 of 9,221 stored evaluation events satisfy the simplified historical pattern/state/liquidity checks: 17.78%. Sized executable quotes were not persisted for unentered historical signals, so this is an admission projection rather than a fill projection.

## Verification gates

- TypeScript typecheck: pass.
- Full suite: 140 files, 797 tests passed.
- Baseline replay regression: pass.
- Isolated discovery-to-displayed-result verification: Fast & Furious 4 buys/4 sells; Oscillation Trader 1 buy/1 sell; zero accounting mismatches; unsafe token produced zero observations; repeated Jupiter HTTP 400 mint was excluded after three failures and produced zero fills.
- Production-density verification: 57 observed tokens, 9 dense tokens, 9 eligible tokens, 9 buys/9 sells, 8 pins, empty-state first eligibility at 18.5 simulated minutes, 150,001 stale rows reset to zero while two profile activations survived.
- Cold start: one-token and 50-token paths both reached entry eligibility in 20.5 simulated minutes.
- 30% provider-loss soak: 2,880 attempts, 2,614 observations, 43.57 observations/minute, maximum queue depth 10/64, zero cancellations, zero cadence drift.
- 75% provider-loss soak: 2,880 attempts, 983 observations, 16.38 observations/minute, maximum queue depth 59/64, 646 low-priority cancellations, zero final queue depth and zero cadence drift. All probes exceeded the 30-observation gate in the first 30 minutes.
- Handled worker crash/incident capture regression: pass.

## Code subtraction

The old adaptive-calibration implementation, live adaptive-gate audit script, Fast & Furious regime scorer, and their obsolete tests were deleted. The new code is limited to the two simple decision functions, immutable admission audit storage, and the persistent Jupiter-400 exclusion. Final line counts are captured from the release commit diff.
