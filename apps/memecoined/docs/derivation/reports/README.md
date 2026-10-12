# Outcome-blind derivations — review checkpoint, 12 October 2026

**STOP FOR REVIEW. No profiles implemented, backtest run, parameter installed, merge, publication or strategy epoch.**

All three frozen measurements ran once. Their programmed stop gates did not fire, but a subsequent integrity audit found a calendar-boundary/exposure defect in **my 1b measurement tool**. The original outputs remain unchanged. I have not patched or rerun that tool, and its pivot-density report must not be treated as a passed validation.

| Measurement | Reported result | Status |
|---|---|---|
| Confirmation arrival | 1,622 events; pooled p90 **4 native 1m bars** | Histogram and percentile arithmetic reproduced; >10-bar stop not triggered |
| Pivot/session mapping | Pre-data mapping: **32 native 15m bars / 24 native 1h bars** | Mapping documented; empirical report blocked by integrity findings and non-identifying density statistic |
| Volatility, most volatile 60% | BTC **232.2812569236644 bps**; ETH **309.8626898215825 bps** | Per-instrument p40 arithmetic reproduced; 110/183 days each, **60.1092896%** |

No result here establishes profitable edge. No P&L, position, fill or trade outcome was calculated or used to choose constants.

## Reports

- [1a confirmation report](C:/Users/tmaxc/Downloads/TimSyS/adapter-crypto-playbook/apps/memecoined/docs/derivation/reports/01-confirmation-report.md)
- [1b pivot report and blocking audit](C:/Users/tmaxc/Downloads/TimSyS/adapter-crypto-playbook/apps/memecoined/docs/derivation/reports/02-pivot-report.md)
- [1c volatility report](C:/Users/tmaxc/Downloads/TimSyS/adapter-crypto-playbook/apps/memecoined/docs/derivation/reports/03-volatility-report.md)

## Dataset and provenance

Specs committed **before retrieval**: `8f8bf88a8236bb3aa9ca07fa0568b4716c7364f4`. Executable frozen before retrieval: `5483b67f406f265616bc481b2a4c67302505665a`.

Analysis window `[2026-04-12T00:00:00Z, 2026-10-12T00:00:00Z)`; one earlier warmup day. Two instruments, five native intervals. **682,272 rows** including warmup; **678,564 analysis rows**; 686 persisted pages and 686 HTTP requests. All responses HTTP 200 on attempt zero. **Zero missing, invalid or duplicate candle days; zero day exclusions.** Audit verified all 686 page hashes, with zero mismatches.

Per instrument, retrieved counts: 1m 264,960; 5m 52,992; 15m 17,664; 1h 4,416; 4h 1,104. These include warmup and exactly match the expected grid.

Dataset manifest SHA-256: `eed9e1378d1edcc07397d8d79783737dcc7d8f68f5e90e4aa47674bcf36c0336`.

Measurement config SHA-256: `8415dbb562a29a7dbbd5f6c62a96c30e51f460e7ddc16dd9ca5dd34613f5fb5c`.

Spec SHA-256 values: 1a `c28a5d6471ae4d4e00890a03e27fe429b451510803aa5f8f34d0479e316028f2`; 1b `7a5d0f0e525782b349b824f3e48ab7a5642f167838a51279ea1340cce3b9542a`; 1c `7c81ca52e2e909b96d0c462d4229426e16aac7fb6270b65312665dbe14d054b9`.

Raw data, manifest and original reports: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\data\derivation-2026.10.12`. No prior soak dataset was concatenated or modified.

## Operational closure

Independent Task Scheduler batch, not a launcher child. Worker ancestry: 25264 node → 27852 watchdog → 14764 PowerShell → 2576 svchost → 656 services → 948 wininit. No launcher/Codex ancestor. Durable request and incident logs present; no restart or heartbeat-failure incidents.

Origin 02:53:59 UTC / 05:53:59 Riyadh; finished event 02:59:29.062 UTC / 05:59:29.062 Riyadh. Watchdog config SHA-256 `451dcd62b377f40f9840473947c77cf251e600221645069d92c70b97a0c04e6d`.

Batch stopped through acknowledged durable shutdown: both PIDs absent, both ports released, no force-kill. Task Disabled. Logs and shutdown evidence: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\logs\derivation-2026.10.12`.

[Full CI passed for the frozen executable](https://github.com/tmaxcontact1-netizen/TimSyS_v6/actions/runs/38197496910), including measurement regressions, isolation regressions and complete workspace tests/builds. CI success does **not** negate the post-run 1b integrity finding.

## Review decisions — no action taken

1. Authorize a narrowly specified 1b calendar/exposure correction and rerun, or retain it as an invalidated measurement. Original output and audit must remain preserved. Do not confuse this with tuning a hypothesis.
2. Decide whether unique-pivot counts are the intended stability metric: fixed 2L/2R makes their lookback ratio non-identifying. Candidate-inventory diagnostics are separate, not a replacement made after seeing data.
3. Ratify the pre-registered per-instrument 60% policy and eight-hour/UTC-day lookback mapping; pooled volatility cutoff is shown only as a reference.
4. Resolve later holdout provenance: calibrating input distributions on the entire six months means a split of those same months is not an untouched holdout for input-derived constants. No split or backtest has been performed.
