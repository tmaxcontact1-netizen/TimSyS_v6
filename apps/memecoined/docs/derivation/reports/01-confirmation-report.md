# 1a — Confirmation arrival report

Outcome-blind frozen detector `sweep-arrival-v1`; dataset/spec/source hashes are in the review index and original JSON. No entries, fills or outcomes.

**Derived expiry: 4 native 1m bars**, pooled nearest-rank p90. The >10-bar escalation threshold was not reached. Of **1,622** complete-search events, **2 (0.1233046%)** took more than ten bars; **0** failed to confirm within twenty. No missing-history/boundary events were excluded by this detector run.

Pooled p50/p75/p90/p95: **2 / 3 / 4 / 4 bars**. NY-only diagnostic: 463 events; **1 / 2 / 4 / 5 bars**. The NY-only value did not replace the pre-registered pooled statistic.

Level-family occurrences: Asian low **622**, last closed 4h low **1,000**. An event against each distinct level is preserved separately; these are not 1,622 independent traded positions.

## Per symbol and reporting clock bucket

| Symbol | NY civil-clock bucket | Events | p50 | p75 | p90 | p95 | >10 | No confirmation ≤20 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| BTCUSDT | Asian [00,08) | 75 | 2 | 3 | 3 | 4 | 0 | 0 |
| BTCUSDT | London-marker period [08,13) | 291 | 2 | 3 | 4 | 5 | 0 | 0 |
| BTCUSDT | NY [13,21) | 170 | 1 | 2 | 4 | 5 | 0 | 0 |
| BTCUSDT | Off-window [21,24) | 60 | 2 | 3 | 4 | 5 | 0 | 0 |
| ETHUSDT | Asian [00,08) | 102 | 2 | 2 | 3 | 4 | 0 | 0 |
| ETHUSDT | London-marker period [08,13) | 519 | 2 | 3 | 4 | 4 | 2 | 0 |
| ETHUSDT | NY [13,21) | 293 | 2 | 2 | 4 | 4 | 0 | 0 |
| ETHUSDT | Off-window [21,24) | 112 | 2 | 3 | 4 | 5 | 0 | 0 |

London marker denotes the pre-registered reporting period, not an additional actionable level. The actual level detector remained Asian low/4h low. Reclaim itself never counts as confirmation, so histogram bin zero is zero.

## Complete pooled histogram

| Bars | Count | Bars | Count |
|---:|---:|---:|---:|
| 0 | 0 | 11 | 2 |
| 1 | 764 | 12 | 0 |
| 2 | 444 | 13 | 0 |
| 3 | 214 | 14 | 0 |
| 4 | 122 | 15 | 0 |
| 5 | 43 | 16 | 0 |
| 6 | 19 | 17 | 0 |
| 7 | 8 | 18 | 0 |
| 8 | 4 | 19 | 0 |
| 9 | 1 | 20 | 0 |
| 10 | 1 | >20 | 0 |

The unabridged per-symbol/per-bucket histograms are preserved in the original JSON; every event is preserved in NDJSON. Integrity audit: 1,622 event rows, histogram sum 1,622, recomputed p90 4. No original result was rewritten.

[Original report](C:/Users/tmaxc/Downloads/TimSyS/tradeed-validation/data/derivation-2026.10.12/01-confirmation-report.json) · [Every event](C:/Users/tmaxc/Downloads/TimSyS/tradeed-validation/data/derivation-2026.10.12/confirmation-events.ndjson)

This is confirmation timing, not evidence of expectancy or executable entry price quality. No profile parameter was installed; review remains required.
