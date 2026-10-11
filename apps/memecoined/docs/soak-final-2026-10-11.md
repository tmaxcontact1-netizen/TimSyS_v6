# Exchange adapter soak: final report with early-termination deviation

Report date: 11 October 2026. Disposition: accepted with deviation under Tim's standing order; not a completed seven-day pass.

## Preserved evidence

Archive: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-evidence\soak-2026-10-03-early-termination`.

Original summary/events, original runner, observer source, hourly observer log and design/verification documents are copied without altering originals. `manifest.json` records byte lengths and SHA-256 hashes. Raw candles and per-frame timestamp histories were never persisted by this runner and cannot be recreated from aggregates.

## Window and deviation

- Start: 3 October 2026 18:06:06.790 UTC / 21:06:06.790 Riyadh.
- Scheduled end: 10 October 2026 18:06:06.790 UTC / 21:06:06.790 Riyadh.
- Final persisted snapshot: 10 October 2026 11:04:13.385 UTC / 14:04:13.385 Riyadh.
- Measured collection duration: 160.9684986 hours (6 days 16 hours 58 minutes 6.595 seconds), 95.8146% of 168 hours.
- Uncollected scheduled remainder: 7 hours 1 minute 53.405 seconds.
- No `finished` event exists; original PID 8728 and observer PID 27556 are absent.

The standing incident record brackets death between 07:15 and 11:26 UTC and attributes it to platform development/launcher interference. The final persisted summary narrows the earliest possible termination to after 11:04:13 UTC, provided its local timestamp is accurate. The exact death time and parent kill action are not independently recorded. Application Event Viewer queries found no specific Node crash establishing a causal stack. Treat launcher interference as the recorded incident attribution, not independently proven OS forensics. Do not fabricate missing runtime or claim a clean completion.

## Final counters

| Metric | Value |
| --- | ---: |
| Frames | 89,125,217 |
| Candle updates | 2,679,418 |
| Closed candles | 24,862 |
| Book updates | 85,323,478 |
| Ticker updates | 1,122,321 |
| Duplicates | 0 |
| Detected gap events | 6 |
| Connection replacements | 9 |
| Scheduled 23.5-hour rotations | 5 |
| Unscheduled reconnects | 4 |
| Connection segments | 10 |
| Degraded events | 0 |
| Transport latency p95 | 131 ms |
| Closed-candle availability p95 | 190 ms |
| Future-timestamp candle updates | 352,991 |

Six gaps are three missing 1-minute candle pairs, BTCUSDT and ETHUSDT, at 5 October 14:17, 6 October 18:02, and 9 October 08:41 UTC. All were detected; none were repaired by the standalone runner. The first reconnect took 0.737 seconds. Its missing candles were available from Binance REST. Production repair validation remains supplemental work, not proven by this dataset.

## Clock and observer

Initial workstation skew was approximately 1.57 seconds; corrected on 4 October. Negative transport times were clamped to zero in the aggregate distribution, so early latency values are biased. The archive contains 117 observer sampler summaries, six successful subsequent clock resyncs and zero logged failed resyncs. Independent hourly signed-provider-minus-local p95 values are not transport p95: their sign reverses the distribution. Do not claim an exact merged unbiased transport percentile from hourly quantiles. Both symbols have independent observer counts. The observer's final hourly record is 10 October 10:09:19.128 UTC.

## Acceptance verdict

Measured aggregate latency (131 ms <=500) and candle availability (190 ms <=2500) meet the numerical thresholds, with the declared clock qualification. Stream continuity detection and reconnect behavior are evidenced over the collected duration. Exact >=99.9% availability cannot be certified from overwritten minute snapshots alone. Gap repair is unverified and absent from this runner. Closed-candle persistence/replay and decision completeness cannot be verified because canonical candles were not saved and no playbook decisions ran. Restart determinism failed operationally because neither runner nor observer recovered after interruption.

The standing incident labels restart determinism criterion 5 and accepts criteria 1–4 on measured data. The original design labels persistence/replay criterion 5 and restart recovery criterion 7. This report preserves Tim's disposition but does not silently turn unmeasured criteria into passes. Overall: accept collected evidence with deviation; isolation/recovery must be verified before further testing. No profitability or strategy conclusions arise from market-data ingestion.
