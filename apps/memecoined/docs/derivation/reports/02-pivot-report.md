# 1b — Pivot report: blocked by integrity audit

**STOP FOR REVIEW. The following is the original, uncorrected output—not a passed measurement.** Detector `pivot-density-v1`; strict native 2L/2R. No P&L or outcome conditioning.

The pre-registered session mapping is **32×15m = 8 hours**, matching the engine's ordinary Asian/entry blocks, and **24×1h = a UTC daily cycle**. The engine has no six-hour block. DST Asian coverage remains a separate 7/8/9-hour requirement; this April–October sample contains no transition date. These mappings are provisional for Tim's review, not an empirically validated parameter freeze.

## Original monthly output, preserved verbatim

Each count below is identical at lookbacks **12 / 24 / 36**; 15m's diagnostic 32-bar count is also identical. All 28 reported ratios are **1.0**; the original tool flagged **zero BRITTLE cells**. This is not evidence of lookback robustness: the unique-pivot existence statistic is invariant for fixed 2L/2R with a sufficient search window.

| Month | BTC 15m | BTC 1h | ETH 15m | ETH 1h | Reported observed UTC days |
|---|---:|---:|---:|---:|---:|
| April (partial) | 516 | 125 | 517 | 135 | **20 — incorrect exposure** |
| May | 785 | 207 | 789 | 218 | 31 |
| June | 762 | 204 | 807 | 204 | 30 |
| July | 802 | 211 | 817 | 215 | 31 |
| August | 822 | 209 | 840 | 215 | 31 |
| September | 773 | 203 | 815 | 198 | 30 |
| October (partial) | 288 | 72 | 291 | 73 | 11 |
| Original summed counts | 4,748 | 1,231 | 4,876 | 1,258 | — |

The original JSON also contains per-cell/per-lookback inventory mean/quartiles/zero-share and its per-day densities. Those outputs are retained, not silently replaced with a different stability statistic. The reported April per-day densities inherit the wrong exposure denominator and must not be relied upon.

## Confirmed measurement-tool defect

My tool uses native inclusive close time plus 1 ms for availability, assigns the monthly group using the prior millisecond, and filters retained pivots against the next month's boundary using availability. These inconsistent conventions can count a boundary pivot in both months. It also admits a warmup bar closing at analysis start into the set of observed opening dates, reporting April as 20 days rather than 19.

The post-run audit found **11 integrity discrepancies**: four April exposure denominators and seven monthly count comparisons. These are measurement bookkeeping defects, not a market-driven finding or permission to retune the detector.

| Symbol/timeframe/month | Original count | Native-inclusive-close audit count |
|---|---:|---:|
| BTC 15m August | 822 | 821 |
| BTC 15m October | 288 | 287 |
| BTC 1h July | 211 | 210 |
| BTC 1h August | 209 | 208 |
| BTC 1h October | 72 | 73 |
| ETH 15m October | 291 | 290 |
| ETH 1h October | 73 | 74 |

Audit values diagnose the discrepancy only; they do not replace the frozen output or constitute a rerun-approved result. Original files and dataset are unchanged. No tool correction or new parameter selection has been performed after these findings.

[Original report](C:/Users/tmaxc/Downloads/TimSyS/tradeed-validation/data/derivation-2026.10.12/02-pivot-report.json) · [Integrity audit and boundary cases](C:/Users/tmaxc/Downloads/TimSyS/tradeed-validation/data/derivation-2026.10.12/derivation-integrity-audit.json)

Review is required on both the narrow calendar/exposure correction and the intended stability metric. I will not implement Structure-Target on the strength of these raw ratios.
