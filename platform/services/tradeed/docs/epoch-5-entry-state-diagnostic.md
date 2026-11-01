# Epoch 5 entry-state diagnostic

## Scope

This is the read-only execution-forensics artifact supporting termination of paper-validation epoch 5 (`2026.09.26.10`, protocol `atomic-entry-v1`). No strategy, threshold, schema, configuration, or runtime code was changed while producing it.

## Primary finding

Oscillation Trader's `extreme_oversold` classification can remain true after the executable current state has moved to neutral or overbought. Five epoch-5 positions reached a hard stop in 7–23 seconds. Four filled within 1.38 bps of their stored qualifying signal; the fifth filled 39.07 bps more cheaply. The loss pattern therefore does not originate in the signal-to-fill executor delay. It originates before the immutable signal is emitted.

At signal time the five rapid hard-stop positions had the following current-state evidence:

| Token | RSI | Z-score | Latest return | Signal-to-fill delta | Net result |
| --- | ---: | ---: | ---: | ---: | ---: |
| `jLz71QZf…u9dyap` | 55.20 | +0.24 | +525.78 bps | +0.17 bps | -109.59 bps |
| `4G5YDqDv…4Tqbzi` | 77.00 | +1.34 | +25.46 bps | +1.38 bps | -113.76 bps |
| `CbcyNo7m…kzpKoU` | 55.76 | -0.42 | -75.34 bps | 0.00 bps | -97.65 bps |
| `777XNvfV…rwo777` | 63.95 | +1.42 | -605.52 bps | +0.09 bps | -356.26 bps |
| `DAemPFNc…m8DGqN` | 78.68 | +2.60 | +1,313.35 bps | -39.07 bps | -112.28 bps |

The profitable `GTBxUiw6…yDpump` Oscillation Trader trade retained a genuinely oversold current state at signal time: RSI 18.80, Z-score -1.63, latest return +24.98 bps. It filled 237.37 bps below the stored signal and closed at +88.45 bps net.

## Confirmed telemetry defects

1. Close-out excursion calculation reads `paper_fast_market_observations`, not the position-sized `paper_profile_position_quote_paths` ledger. Five rapid hard-stop positions had zero fast-market samples during their holding intervals, producing false zero adverse excursions despite position-path minima from -96.05 to -354.66 bps.
2. The fast-market ledger represents a fixed 0.01 SOL quote while the affected position cost was 0.0625 SOL. Mixing those quote sizes produced a false +352.38-bps favorable excursion for the `4G5YDqDv…4Tqbzi` trailing-stop trade. Its position-sized high was +83.20 bps.

## Executable-quote discontinuity constraint

The `777XNvfV…rwo777` position had a planned 90-bps hard stop. Its first position-sized quote 0.292 seconds after entry was -61.99 bps; the next persisted executable quote 9.207 seconds later was -354.66 bps. It realized -356.26 bps net after 1.60 bps measured friction, a 266.26-bps realized-to-planned loss gap.

The `4G5YDqDv…4Tqbzi` trailing position reached +83.20 bps, was +49.89 bps at `18:22:48.243+03`, then quoted -36.71 bps at `18:22:49.840+03`. A 50-bps trail therefore realized a 119.91-bps high-to-exit giveback. This is a calibration constraint caused by executable-quote discontinuity, not evidence that the trailing predicate failed to run.

## Epoch classification

Epoch 5 contained three cycle gaps greater than twice nominal cadence: `12:39:30–12:40:30`, `13:14:15–15:25:30`, and `19:19:00–19:43:15` Asia/Riyadh on 2026-09-26. None intersects any of the eight closed-trade intervals. All eight closed trades are therefore `clean`. No position or entered outcome remained open at termination.
