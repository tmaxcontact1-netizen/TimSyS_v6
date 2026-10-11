# Crypto'Ed gap-repair supplemental validation plan

Status: **Draft only — do not execute before the seven-day exchange-adapter soak completes.**

## Purpose

Supply criterion 4's repair-side evidence independently of the running soak. The soak that began on 3 October 2026 exercises public-stream continuity detection but does not instantiate `ExchangeIngestionService`, its bounded `BackfillCoordinator`, or `repairNext()`. It therefore cannot prove REST repair even though it detected the two missing 1-minute candles at 14:17 UTC on 5 October.

## Isolation and authority

- Run after the soak completes on 10 October 2026.
- Use a disposable staging PostgreSQL database and a separate process identity.
- Connect only to Binance production **public** WebSocket and REST market-data endpoints.
- Paper/data mode only; expose no order or live-execution route.
- Do not read from or write to the completed soak's diagnostic directory.
- Do not modify the completed soak dataset; attach this validation report alongside it.

## System under test

Instantiate the production path, without substitutes:

1. `BinanceStreamRuntime`
2. `ExchangeIngestionService`
3. production exchange market-data store
4. `CandleContinuityTracker`
5. bounded `BackfillCoordinator`
6. `BinanceRestAdapter`
7. the one-second `repairNext()` drain used by `crypto-runtime.ts`

## Test sequence

1. Start from empty staging exchange tables.
2. Bootstrap BTCUSDT and ETHUSDT for `1m`, `5m`, `15m`, `1h`, and `4h`.
3. Verify the series is contiguous and mark its state `complete`.
4. Record the last persisted closed-candle key for every symbol/interval.
5. Force one controlled mid-stream disconnect long enough to miss at least one closed 1-minute candle for both symbols. The fault injector must interrupt only the staging WebSocket transport; Binance and the workstation network remain otherwise available.
6. Restore the stream and wait for the first later closed candle to trigger continuity detection.
7. Assert one bounded backfill item is enqueued per affected symbol/interval, with exact missing start/end boundaries.
8. Run the normal repair worker; do not call the store directly from the test.
9. Assert Binance REST returns every missing candle.
10. Assert each repaired row is persisted once with `source='rest_backfill'` and its provider timestamps unchanged.
11. Assert WebSocket/REST overlap is idempotent: no duplicate candle keys and no conflicting values.
12. Re-evaluate the full series. It may return to `complete` only after a query proves every expected candle key between the bootstrap boundary and latest closed candle exists.

## Required telemetry

- disconnect, connecting, and connected timestamps
- time to reconnect
- missing-candle keys and detection latency
- backfill queue enqueue/dequeue timestamps and maximum depth
- REST request status, latency, retry/429/418 counts
- requested and returned time boundaries
- rows persisted by source (`websocket`, `rest_backfill`)
- duplicate/conflict counts
- time from reconnect to restored contiguity
- final continuity result per symbol and interval

## Pass criteria

- The forced disconnect creates a demonstrable missing interval.
- Every missing candle is obtained from public REST and persisted with `source='rest_backfill'`.
- No missing candle is silently marked repaired.
- No duplicate or conflicting candle row exists after repair.
- The series state remains incomplete while any expected key is absent.
- The series returns to `complete` only after an explicit contiguity query passes.
- The bounded queue drains to zero and does not exceed its configured capacity.
- No order, profile, or live-execution path is invoked.

## Failure conditions

- gap detected but no queue item created
- REST candle available but not persisted
- repaired candle stored as `websocket`
- `complete` state restored before contiguity proof
- duplicate/conflicting canonical candle
- unbounded retry or queue growth
- staging fault affects the completed soak or production Trade'Ed data

## Final report

Report exact timestamps, missing and repaired keys, persisted sources, queue behavior, provider outcomes, contiguity checks, and pass/fail for every criterion. Attach it to the final soak report as the repair-side evidence for criterion 4; do not merge its measurements into the uninterrupted-stream statistics.
