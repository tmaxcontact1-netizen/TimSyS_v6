# Epoch 16 offline exit-rule study

Status: completed from the immutable 65-trade endpoint. Replay only; no runtime rule, release or successor epoch is authorized.

## Method

- Source: every epoch-16 closed outcome and its persisted position-sized executable quote path.
- Baseline: the recorded exit and recorded net result.
- A replay rule can act only on a persisted executable quote. It cannot assume a fill between quotes.
- Breakeven arms were tested at 200, 250, 300, 350, 400 and 500 bps. After arming, the first executable quote at or below entry triggers exit.
- Peak trails were armed above 150 bps and tested at distances of 150, 200, 250, 300, 350, 400 and 450 bps.
- Ratchets were tested at +150/+75, +300/+150 and +450/+225 bps.
- Each rule was tested alone and with the four-hour two-stop lockout plus -500-bps per-token session cap. Defenses are applied chronologically using the replayed outcomes already known at each later entry.
- Winner degradation is the total reduction applied to trades that were profitable in the recorded epoch. Tail recovery is the improvement across the three recorded near-total-loss trades.
- The complete per-trade delta arrays are produced by `scripts/epoch-16-exit-sweep.mjs`; running it without flags emits every changed or blocked trade for all 34 cases. `--summary` emits the aggregate table, and `--deltas=<variant>:alone|defended` selects one case.

## Aggregate results

| Rule | Defenses | Executed | Net bps | Expectancy | Winner degradation | Tail recovery |
|---|---:|---:|---:|---:|---:|---:|
| Baseline | No | 65 | -23,193.26 | -356.82 | 0.00 | 0.00 |
| Baseline | Yes | 63 | -13,801.88 | -219.08 | 610.22 | 10,001.60 |
| Breakeven 200 | No | 65 | -24,123.48 | -371.13 | 1,760.51 | 0.00 |
| Breakeven 200 | Yes | 63 | -14,732.10 | -233.84 | 2,370.73 | 10,001.60 |
| Breakeven 250 | No | 65 | -23,936.15 | -368.25 | 1,573.18 | 0.00 |
| Breakeven 250 | Yes | 63 | -14,544.77 | -230.87 | 2,183.40 | 10,001.60 |
| Breakeven 300 | No | 65 | -22,593.91 | -347.60 | 230.94 | 0.00 |
| Breakeven 300 | Yes | 63 | -13,202.53 | -209.56 | 841.16 | 10,001.60 |
| Breakeven 350 | No | 65 | -22,593.91 | -347.60 | 230.94 | 0.00 |
| Breakeven 350 | Yes | 63 | -13,202.53 | -209.56 | 841.16 | 10,001.60 |
| Breakeven 400 | No | 65 | -22,520.71 | -346.47 | 230.94 | 0.00 |
| Breakeven 400 | Yes | 63 | -13,129.33 | -208.40 | 841.16 | 10,001.60 |
| Breakeven 500 | No | 65 | -22,979.00 | -353.52 | 230.94 | 0.00 |
| Breakeven 500 | Yes | 63 | -13,587.62 | -215.68 | 841.16 | 10,001.60 |
| Trail 150 | No | 65 | **-4,534.75** | **-69.77** | 3,746.63 | 20,153.90 |
| Trail 150 | Yes | 64 | -5,144.97 | -80.39 | 4,356.85 | 20,153.90 |
| Trail 200 | No | 65 | -4,597.77 | -70.73 | 3,597.53 | 20,026.94 |
| Trail 200 | Yes | 64 | -5,207.99 | -81.37 | 4,207.75 | 20,026.94 |
| Trail 250 | No | 65 | -14,380.30 | -221.24 | 3,258.88 | 9,916.49 |
| Trail 250 | Yes | 64 | -14,990.52 | -234.23 | 3,869.10 | 9,916.49 |
| Trail 300 | No | 65 | -14,688.05 | -225.97 | 2,830.05 | 9,833.77 |
| Trail 300 | Yes | 64 | -15,298.27 | -239.04 | 3,440.27 | 9,833.77 |
| Trail 350 | No | 65 | -23,842.11 | -366.80 | 1,811.90 | 0.00 |
| Trail 350 | Yes | 63 | -14,450.73 | -229.38 | 2,422.12 | 10,001.60 |
| Trail 400 | No | 65 | -23,494.99 | -361.46 | 1,286.25 | 0.00 |
| Trail 400 | Yes | 63 | -14,103.61 | -223.87 | 1,896.47 | 10,001.60 |
| Trail 450 | No | 65 | -22,303.52 | -343.13 | 22.21 | 0.00 |
| Trail 450 | Yes | 63 | -12,912.14 | -204.95 | 632.43 | 10,001.60 |
| Ratchet 150/75 | No | 65 | -13,652.17 | -210.03 | 2,350.42 | 10,055.42 |
| Ratchet 150/75 | Yes | 64 | -14,262.39 | -222.85 | 2,960.64 | 10,055.42 |
| Ratchet 300/150 | No | 65 | -12,899.53 | -198.45 | 1,635.74 | 10,137.68 |
| Ratchet 300/150 | Yes | 64 | -13,509.75 | -211.09 | 2,245.96 | 10,137.68 |
| Ratchet 450/225 | No | 65 | -23,152.63 | -356.19 | 969.99 | 0.00 |
| Ratchet 450/225 | Yes | 63 | -13,761.25 | -218.43 | 1,580.21 | 10,001.60 |

## Findings

1. No tested rule or defense combination has positive expectancy.
2. No breakeven threshold rescues BXG8go. Thresholds 300-500 preserve AFFm3e and both protected B4znEr winners, but their aggregate expectancy remains between -346 and -354 bps per trade before defenses.
3. The 150-bps trail produces the least-negative aggregate result, but fails the explicit winner-retention requirement: AFFm3e retains 7.12%; the two protected B4znEr winners retain 12.08% and 20.71%.
4. The only tested rule that preserves all three named winners above 80% is the 450-bps trail, but it recovers none of the collapse losses. With token defenses its expectancy remains -204.95 bps per executed trade.
5. GhT9cg is not rescued by any breakeven arm. Contrary to the initial expectation, it is rescued by 150/200-bps peak trails and the +300/+150 ratchet because an executable quote remained available after its peak and before final collapse. This makes its final discontinuity structural, but its entire position path was not inescapable.
6. The endpoint contains three near-total-loss trades among 65 closes: a 4.62% observed collapse base rate.
7. Under the best aggregate variant, Trail 150 without token defenses, residual collapse loss is approximately -9,843.70 bps, or -151.44 bps allocated across every epoch trade. The rule still finishes at -69.77 bps per trade because its tail recovery is partly offset by 3,746.63 bps of winner degradation and other ordinary losses.
8. The token defenses are not cost-free at the final endpoint. They avoid the third NVpUDQ collapse but also block a later BpoqtU profit-target trade worth +610.22 bps after two earlier BpoqtU stops.

## Decision

The sweep is a null result for the tested family. It does not authorize a release. The Conviction branch remains unmerged, no successor epoch exists, and the rejected breakeven amendment is recorded as rejected rather than implemented.
