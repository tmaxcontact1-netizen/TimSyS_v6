# 1c — Most volatile 60%: outcome-blind report

**Tim chose 60% before retrieval.** Binding percentile p40 was not changed after seeing results. The spec pre-registered per-instrument cutoffs, with a pooled cutoff as a non-binding comparison; that policy remains subject to Tim's review before implementation.

Each NY civil date April 12–October 11 was sampled at local 13:00, using only the preceding 1,440 closed native 1m bars. Formula `(high − low)/low × 10,000`. This is a rolling range sampled at entry-window start—not statistical return volatility or future daily range. **183 valid symbol-days each; zero exclusions.**

| Statistic (bps) | BTCUSDT | ETHUSDT |
|---|---:|---:|
| Minimum | 66.946225 | 74.504990 |
| p25 | 181.124629 | 236.569553 |
| **p40, derived threshold** | **232.281257** | **309.862690** |
| Median | 257.539608 | 347.168803 |
| p75 | 375.843513 | 483.280104 |
| p90 | 507.577925 | 683.078146 |
| p95 | 625.366717 | 791.284651 |
| Maximum | 991.289921 | 1,552.026167 |

Full unrounded thresholds: BTC **232.2812569236644 bps** (2.322812569%); ETH **309.8626898215825 bps** (3.098626898%). Type-7 interpolated quantiles; range ≥ threshold.

Each threshold includes **110/183 days = 60.1092896%**, with zero exact threshold ties. The slight difference from 60.000% is finite-sample discreteness; it was not corrected by adjusting thresholds.

## Non-binding pooled reference

Pooled p40: **256.92189933222517 bps**; **220/366 = 60.1092896%**, with one exact threshold tie. It would include BTC **92/183 = 50.2732240%** and ETH **128/183 = 69.9453552%**. It is shown transparently, not selected because of those figures.

The inherited 200-bps gate would include BTC **123/183 = 67.2131148%**, ETH **153/183 = 83.6065574%**, pooled **276/366 = 75.4098361%**. It is not the chosen 60% inclusion statement and was not retained or reverse-fitted.

Integrity audit independently recomputed p40 from the stored 183 dated measurements per instrument and matched both reported thresholds exactly. It verified every underlying page hash. No trade outcome, expectancy or return entered the selection.

[Original report, unrounded distributions and every symbol-day](C:/Users/tmaxc/Downloads/TimSyS/tradeed-validation/data/derivation-2026.10.12/03-volatility-report.json)

No threshold has been installed. The overall work is stopped for review, including the separate 1b integrity blocker and later holdout-provenance question.
