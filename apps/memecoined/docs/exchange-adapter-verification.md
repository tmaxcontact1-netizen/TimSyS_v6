# Exchange Adapter Verification Record

**Date:** 2026-10-03  
**Branch:** `adapter-crypto-playbook`  
**Execution authority:** Paper and offline verification only

## Jurisdiction and endpoint result

- Deployment location: Saudi Arabia.
- Binance supported-region page: Saudi Arabia listed as available on the check date.
- Public REST `GET https://api.binance.com/api/v3/ping`: HTTP 200.
- Native candle REST probe: valid BTCUSDT 1-minute candle returned.
- Public WebSocket `wss://stream.binance.com:9443/ws/btcusdt@kline_1m`: connected and delivered a native kline event; initial event observed after 1,742 ms.
- Decision: retain Binance as the first concrete adapter. Kraken substitution not triggered.

This is an operational and published-terms check, not legal advice or a guarantee of account-level product eligibility.

## Implemented scope

- Binance native stream map for BTCUSDT and ETHUSDT at 1m/5m/15m/1h/4h.
- Book-ticker and rolling 24-hour ticker normalization.
- Strict schema validation, stable fingerprints, open/final candle distinction.
- Bounded retry/backoff primitives and `Retry-After` parsing.
- Bounded priority queue that sheds low-priority repair work first.
- PostgreSQL persistence schema for candles, top-of-book, ticker, versioned session levels, and stream events, plus a provider-neutral read model that does not alter existing MemeCoin'Ed queries.
- Metadata-driven instrument catalogue and configuration; venue symbols and URLs are not embedded in adapter logic.
- Exact REST bootstrap and bounded priority gap repair, event deduplication, reconnect jitter, and controlled pre-24-hour stream rotation.
- `America/New_York` session boundary engine with per-date UTC conversion and DST transition handling.
- Top-of-book paper quoting using ask for buys, bid for sells, evidenced quantity, fee, spread, and staleness rejection.
- Trade'Ed segment controls, both default off. MemeCoin'Ed off also disables its paper profiles.
- No-active-epoch startup now resolves to safe idle instead of a fatal process error.

## Verification results

- TypeScript type-check: passed.
- Build: passed.
- Full MemeCoin'Ed/Trade'Ed regression suite: **144 files, 856 tests passed**.
- Focused adapter/session/paper-book coverage: **100% statements, 99.05% branches, 100% functions, and 100% lines** (154/154 statements, 105/106 branches, 42/42 functions, 102/102 lines).
- Focused integration checks for segment controls and safe no-epoch behavior: passed.

## Gate status

The offline parser, session, retry, bounded-queue, paper-book, persistence-contract, UI-control, and regression gates pass. Section 11 is represented by named tests covering all intervals and both instruments, provisional/final candles, frame deduplication, exact gap repair, connection rotation, 429/418 handling, queue saturation, New York boundaries and DST, Asian and London levels, incomplete-session blocking, deterministic calculation, continuity isolation, executable-side paper fills, absence of a live execution mode, and compatibility of the provider-neutral read model.

The seven-day empirical acceptance gate is **in progress** and cannot truthfully be marked passed until seven elapsed days of production-public telemetry have completed:

- transport latency p95 <= 500 ms;
- closed-candle availability p95 <= 2,500 ms;
- availability >= 99.9%;
- reconnection/gap-repair observations over the window.

The soak runner writes immutable event records and minute snapshots under `diagnostics/exchange-adapter-soak/`. It consumes only production public market data and exposes no order endpoint.

No claim is made that the seven-day gate has passed. Consequently `Playbook-translation.md` has not been produced yet, and no profile implementation has begun.

## Release boundary

Nothing from this branch is merged, published, installed, or enabled for live execution. There is no live-order path.
