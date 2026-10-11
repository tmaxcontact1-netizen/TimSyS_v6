# Archived soak — supplemental production REST repair evidence

Initial run executed 11 October 2026, 17:15:18.642–17:15:23.374 UTC (20:15 Riyadh). A second run used the final committed verifier at 17:27:45–17:27:49 UTC (20:27 Riyadh); the following table reports that second run. Both are separate from the archived soak. No subscriptions, trading, orders, live database modifications or strategy window.

The executable `verify-soak-gap-repair.cjs` calls the **production `ExchangeIngestionService` and `BinanceRestAdapter`**, not a hand-built replacement queue. For each gap it retrieves adjacent native candles, submits the before/after candles to the ingestion service to trigger the real bounded backfill queue, then calls `repairNext()`. The store contract persists the resulting candles in an isolated JSONL staging artifact.

| Missing minute (UTC) | Symbol | Repaired rows | Repair latency ms | Persisted source |
|---|---|---:|---:|---|
| 5 October 14:17 | BTCUSDT | 1 | 312 | rest_backfill |
| 5 October 14:17 | ETHUSDT | 1 | 322 | rest_backfill |
| 6 October 18:03 | BTCUSDT | 1 | 321 | rest_backfill |
| 6 October 18:03 | ETHUSDT | 1 | 313 | rest_backfill |
| 9 October 08:42 | BTCUSDT | 1 | 312 | rest_backfill |
| 9 October 08:42 | ETHUSDT | 1 | 323 | rest_backfill |

All twelve REST calls returned HTTP 200. Each missing candle was independently compared with the native three-minute range: exact OHLC and volume equality, aligned minute open and 59.999-second close, closed finality, valid high/low containment, three unique adjacent open-times and zero duplicate keys. Adjacent close/open prices are not required to be equal: real market gaps are valid.

The instruction's `BTCUS` typo was interpreted as the soak instrument `BTCUSDT`.

Final provenance: source commit `c8fcd37f74216203b30da89b6e1dc9a20610d466`; verifier SHA-256 `52551d879a194fc56be6e8c82b1a0a7f64aaa30c0b72ca1394064b64609817e4`. Configuration SHA-256 `ae7b6882b38e23970917fb601bc0cc9e68d5592aa33136290dfeec59cbb6c2e7`.

Final raw artifacts: `verification/gap-repair-final-2026-10-11/gap-repair-report.json` and `persisted-candles.ndjson`. Initial evidence is retained separately under `verification/gap-repair-2026-10-11`.

**Boundary:** this proves the production REST repair queue retrieves and marks all six candles and that the stored staging series is contiguous. It does not prove PostgreSQL persistence, a forced live socket-disconnect recovery, or an automatic `complete` state transition: the current ingestion service exposes queue depth but no such completeness assertion. It supplements the archived detection evidence; it does not retroactively turn the 160.97-hour early-terminated soak into an unqualified seven-day pass.
