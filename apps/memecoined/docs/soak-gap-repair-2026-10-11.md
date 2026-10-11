# Archived soak — supplemental production REST repair evidence

Executed 11 October 2026, 17:15:18.642–17:15:23.374 UTC (20:15 Riyadh), separately from the archived soak. No subscriptions, trading, orders, live database modifications or strategy window.

The executable `verify-soak-gap-repair.cjs` calls the **production `ExchangeIngestionService` and `BinanceRestAdapter`**, not a hand-built replacement queue. For each gap it retrieves adjacent native candles, submits the before/after candles to the ingestion service to trigger the real bounded backfill queue, then calls `repairNext()`. The store contract persists the resulting candles in an isolated JSONL staging artifact.

| Missing minute (UTC) | Symbol | Repaired rows | Repair latency ms | Persisted source |
|---|---|---:|---:|---|
| 5 October 14:17 | BTCUSDT | 1 | 312 | rest_backfill |
| 5 October 14:17 | ETHUSDT | 1 | 317 | rest_backfill |
| 6 October 18:03 | BTCUSDT | 1 | 311 | rest_backfill |
| 6 October 18:03 | ETHUSDT | 1 | 322 | rest_backfill |
| 9 October 08:42 | BTCUSDT | 1 | 306 | rest_backfill |
| 9 October 08:42 | ETHUSDT | 1 | 306 | rest_backfill |

All twelve REST calls returned HTTP 200. Each missing candle was independently compared with the native three-minute range: exact OHLC and volume equality, aligned minute open and 59.999-second close, closed finality, valid high/low containment, three unique adjacent open-times and zero duplicate keys. Adjacent close/open prices are not required to be equal: real market gaps are valid.

The instruction's `BTCUS` typo was interpreted as the soak instrument `BTCUSDT`.

Provenance: production-module source commit `eb6590d2738bc63db2f4f0e0f88036bac298adac`; verifier was an uncommitted staging harness at execution and is retained with these artifacts. Configuration SHA-256 `ae7b6882b38e23970917fb601bc0cc9e68d5592aa33136290dfeec59cbb6c2e7`.

Raw artifacts: `verification/gap-repair-2026-10-11/gap-repair-report.json` and `persisted-candles.ndjson`.

**Boundary:** this proves the production REST repair queue retrieves and marks all six candles and that the stored staging series is contiguous. It does not prove PostgreSQL persistence, a forced live socket-disconnect recovery, or an automatic `complete` state transition: the current ingestion service exposes queue depth but no such completeness assertion. It supplements the archived detection evidence; it does not retroactively turn the 160.97-hour early-terminated soak into an unqualified seven-day pass.
