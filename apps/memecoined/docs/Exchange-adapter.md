# Trade'Ed Crypto'Ed Exchange Adapter Design

**Status:** Proposed for Tim's review  
**Branch:** `adapter-crypto-playbook`  
**Scope of this document:** API selection, native-candle ingestion, session-level calculation, persistence, reliability, and paper-execution boundaries  
**Implementation status:** Design only. No adapter code, runtime configuration, schema migration, profile logic, release, or live trading is authorized by this document.

## 1. Decision summary

Use **Binance Spot as the first concrete adapter**, with:

- production public WebSocket market data for `BTCUSDT` and `ETHUSDT`;
- exchange-native `1m`, `5m`, `15m`, `1h`, and `4h` kline streams;
- real-time best bid/ask plus the 24-hour ticker;
- Binance Spot Test Network for API-contract and order-lifecycle testing only; and
- Trade'Ed's internal paper ledger, driven by the production public order book, for realistic paper P&L.

Keep the application-facing contract exchange-neutral. **Kraken** is the preferred secondary market-data implementation because its WebSocket v2 OHLC feed supports the required native intervals for exact `BTC/USD` and `ETH/USD` instruments. **Coinbase Advanced Trade is not suitable as the first provider** because its candle channel publishes five-minute buckets only; using it for the other intervals would breach the instruction not to reconstruct candles from ticks or lower-period data.

The first implementation must not silently describe `BTCUSDT` as `BTC/USD`. Internally, the strategy may use canonical asset identities `BTC` and `ETH`, but every observation must retain the venue symbol, quote asset, and venue. The USDT/USD basis difference is therefore measurable and auditable.

## 2. Design principles

1. **One strategy decision uses one venue's continuous history.** Candles from different exchanges are never spliced into a single indicator series.
2. **Native candles remain native.** A 15-minute candle comes from the exchange's 15-minute stream, not from fifteen 1-minute candles and not from ticks.
3. **Closed candles govern decisions.** An open candle may be displayed and persisted as provisional telemetry, but it cannot confirm a sweep, reclaim, swing, or entry.
4. **The existing 15-second Trade'Ed scheduler remains unchanged.** The WebSocket receiver operates independently and continuously; each scheduler cycle reads a consistent snapshot from persisted/cache state.
5. **UTC is authoritative for storage.** Session boundaries are defined in `America/New_York` civil time and converted to UTC for each trading date. Candle keys, persisted timestamps, and event ordering remain UTC.
6. **Missing or discontinuous data causes a visible degraded state, not invented data.** No interpolation is used to make a session or pattern appear complete.
7. **Paper execution uses executable sides of the book.** A buy is valued at ask-side liquidity and a sell at bid-side liquidity, including configured fees and measured slippage.
8. **A provider change creates a new data-continuity segment.** Strategies warm up again before entries are permitted.

## 3. Provider evaluation

| Requirement | Binance Spot | Kraken Spot WebSocket v2 | Coinbase Advanced Trade |
|---|---|---|---|
| Native 1m/5m/15m/1h/4h candles | Yes | Yes (`1`, `5`, `15`, `60`, `240`) | No; candle channel is five-minute buckets |
| BTC and ETH liquidity | Very high | High | High |
| Exact BTC/USD and ETH/USD | No on the chosen liquid streams; initial mapping is BTCUSDT/ETHUSDT | Yes | Yes, subject to venue product availability |
| Real-time best bid/ask | Yes, `bookTicker` | Yes | Yes |
| 24h high/low and volume | Yes, ticker stream | Yes through ticker/OHLC APIs | Yes through ticker/product APIs |
| Public WebSocket authentication | Not required | Not required | Not required for market data |
| Spot sandbox/test network | Yes | Not a comparable public spot paper venue | Sandbox exists but market-data/candle limitation remains |
| Suitability as v1 | **Recommended** | Recommended fallback/exact-USD adapter | Deferred |

### 3.1 Why Binance is first

Binance satisfies the native interval requirement and provides the broadest path from public market data to a test order lifecycle. The required subscription set is small: ten kline streams, two best-bid/ask streams, and two 24-hour ticker streams. This is far below Binance's documented maximum of 1,024 streams per connection.

The principal compromise is the quote asset. The most liquid initial pairs are `BTCUSDT` and `ETHUSDT`, not exact USD pairs. The normalized instrument record must therefore contain:

- `canonicalAsset`: `BTC` or `ETH`;
- `venue`: `binance`;
- `venueSymbol`: `BTCUSDT` or `ETHUSDT`;
- `baseAsset`: `BTC` or `ETH`;
- `quoteAsset`: `USDT`; and
- `priceCurrency`: `USDT`.

UI copy may say “BTC / ETH segment,” but reports must show the venue pair. Any later USD normalization is a separate, explicit conversion step using a persisted USDT/USD basis observation; it is not part of v1.

Initial endpoint and stream map (verified against the official documentation on 2026-10-03):

| Purpose | Endpoint / stream |
|---|---|
| Production public WebSocket | `wss://stream.binance.com:9443` (combined or raw stream form) |
| Spot Test Network WebSocket | `wss://stream.testnet.binance.vision` |
| Production REST | `https://api.binance.com` |
| Native candles | `<symbol>@kline_1m`, `_5m`, `_15m`, `_1h`, `_4h` |
| Best bid/ask | `<symbol>@bookTicker` |
| Rolling 24-hour telemetry | `<symbol>@ticker` |

Endpoint names are configuration, not constants embedded in strategy logic.

### 3.2 Kraken's role

Kraken is the first alternate adapter and the preferred source when exact USD denomination is more important than Binance continuity. Its native OHLC intervals satisfy the brief. It is not used to fill holes inside a Binance series. On Binance failure, Kraken may keep the dashboard informed, but entry decisions remain suspended until the configured warm-up exists entirely within a new Kraken continuity segment.

### 3.3 Why Coinbase is deferred

Coinbase's Advanced Trade candle WebSocket supplies five-minute buckets. Deriving 1m, 15m, 1h, or 4h candles would violate the native-aggregation rule. The generic interface should still permit a later Coinbase adapter if Coinbase adds the required native feeds or Tim explicitly revises that rule.

## 4. Exchange-neutral boundaries

The adapter layer is split into four responsibilities. These are design contracts, not code in this deliverable.

### 4.1 Instrument catalogue

Resolves canonical assets into venue products and exposes trading constraints:

- symbol and venue product ID;
- base/quote assets;
- price tick and quantity step;
- minimum notional and quantity;
- status (`trading`, `halted`, `delisted`); and
- fee schedule or configured paper fee.

The catalogue is refreshed at startup and at a conservative interval. A product-status change immediately bars new entries while exits and reconciliation remain enabled.

### 4.2 Market-data stream

Produces normalized events for:

- native candle updates for each instrument and interval;
- best bid/ask updates;
- 24-hour ticker updates;
- connection state and heartbeat; and
- provider errors/rate-limit notices.

Every normalized event carries `venue`, `venueSymbol`, provider event timestamp, local receive timestamp, connection ID, continuity-segment ID, and raw-payload fingerprint.

### 4.3 Historical/backfill client

Uses the exchange REST API only to bootstrap history and repair explicit gaps. It does not continuously poll data already available on WebSocket. Backfilled rows carry `source=rest_backfill` and are distinguishable from streamed rows.

### 4.4 Paper execution adapter

Consumes current book state and returns an immutable paper quote with:

- executable bid or ask;
- requested and executable quantity;
- depth-weighted average price when level-2 data is enabled;
- fee, spread, and slippage components;
- provider/book timestamp and local timestamp; and
- quote expiry.

The execution boundary deliberately resembles a future live adapter, but v1 contains no live credential or real-order path.

## 5. Candle streaming architecture

### 5.1 Subscription topology

One primary public WebSocket connection subscribes to:

- `BTCUSDT`: `1m`, `5m`, `15m`, `1h`, `4h` klines, book ticker, 24h ticker;
- `ETHUSDT`: the same streams.

A separate authenticated Test Network connection is used only by contract tests of order submission, acknowledgement, cancellation, and rejection. It is not a source of performance evidence because its book is not representative of the production market.

### 5.2 Data flow

```text
Exchange WebSocket
    -> frame decoder
    -> provider schema validation
    -> normalized event
    -> idempotency/deduplication
    -> continuity and gap detector
    -> transactional persistence
    -> bounded latest-state cache
    -> unchanged 15-second scheduler snapshot
    -> session engine and profile evaluators
```

The receiver and scheduler do not share a blocking work queue. The receiver writes continuously. The scheduler asks for the latest committed, internally consistent snapshot at its tick boundary.

### 5.3 Candle identity and finality

A candle's stable key is:

`(venue, venue_symbol, interval, open_time)`.

Updates to an open candle upsert the same row. Once the exchange reports the candle closed, `is_closed=true` becomes immutable. Later corrections are never silently overwritten; they create an audit event containing old and new fingerprints.

Only closed candles feed:

- Asian range finalization;
- sweep and reclaim detection;
- three-candle momentum;
- swing-high/swing-low confirmation; and
- profile admissions.

### 5.4 Persistence model and backward compatibility

The existing MemeCoin'Ed observation table is quote-shaped: wallet, mint, raw input/output amounts, and quote fingerprint. Pretending an exchange candle is a Solana swap quote would create false semantics. The design therefore adds normalized exchange tables while preserving a shared query contract:

1. `exchange_candles` — OHLCV, trade count where supplied, interval, finality, venue metadata, timestamps, and continuity segment.
2. `exchange_top_of_book` — bid/ask price and quantity, event/receive timestamps.
3. `exchange_ticker_24h` — rolling high, low, base volume, quote volume, and provider window.
4. `exchange_session_levels` — computed, versioned session markers.
5. `exchange_stream_events` — connection, gap, correction, and failover audit.

The application receives both Solana observations and exchange observations through a **provider-neutral read model**, not by changing the meaning of `paper_fast_market_observations`. Existing MemeCoin'Ed queries remain valid. New Trade'Ed analytical queries target a union-compatible projection containing common fields such as instrument, observed time, market price, volume evidence, source, venue, and epoch. Provider-specific evidence remains JSON or provider-specific columns behind that projection.

This is backward-compatible at the application boundary while refusing to corrupt the old schema's meaning.

### 5.5 Bootstrap and gap repair

At startup, each instrument/interval is bootstrapped far enough to satisfy the longest indicator lookback plus a safety margin. Live subscription begins before the REST bootstrap is committed, and events are buffered in a bounded in-memory queue. The merge is keyed by candle identity, so the transition cannot duplicate candles.

For each interval, the gap detector expects the next `open_time` exactly one interval later. On a missing interval:

1. mark the series `incomplete`;
2. block new strategy admissions using that series;
3. request only the missing REST range;
4. validate interval alignment and finality;
5. persist with `source=rest_backfill`; and
6. restore `complete` only when the sequence is contiguous.

No zero-volume or interpolated candle is manufactured.

### 5.6 Latency definition

The brief's “within 500 ms of exchange timestamp” needs a precise measurement. Binance kline updates for intervals above one second are documented at an update speed of approximately two seconds. It is therefore impossible to guarantee a candle mutation within 500 ms of the underlying trade while consuming native klines.

The proposed acceptance split is:

- **transport latency:** `local_received_at - provider_event_time`, p95 <= 500 ms over seven days;
- **closed-candle availability:** `local_received_at - candle_close_time`, p95 <= 2,500 ms over seven days; and
- **scheduler visibility:** first scheduler snapshot containing the closed candle occurs within one 15-second cycle after persistence.

This preserves the intended network-latency test without setting an SLA the selected native feed cannot meet. Tim must approve this clarification before implementation.

### 5.7 Reconnection and failover

Binance connections expire after 24 hours. The adapter schedules a controlled replacement before expiry, subscribes the replacement, confirms live data, atomically promotes it, then closes the old connection. Duplicate frames are removed by stable event keys.

Unexpected disconnect backoff uses full jitter with ceilings:

`250ms -> 500ms -> 1s -> 2s -> 4s -> 8s -> 15s -> 30s`.

After reconnection, the gap-repair process runs before the series returns to `complete`. A provider outage never causes the scheduler to reuse an old candle as if it were current.

If the configured outage threshold is exceeded, the system may activate Kraken market data in a **new continuity segment**. The UI must show the venue change. New entries remain blocked until the strategy's complete warm-up exists on Kraken. Open paper positions remain classified against the venue/book that opened them; they are not silently repriced using another venue.

## 6. Session logic implementation

### 6.1 Clock and calendar

Session rules are expressed in the IANA time zone `America/New_York`, then converted to UTC independently for every New York civil trading date:

- Asian range: local `[00:00:00, 08:00:00)`;
- London marker: local `08:00:00`;
- entry window: local `[13:00:00, 21:00:00)`.

The persisted session record contains the civil date, IANA zone, resolved UTC start/end, and the zone offset used at each boundary. No workstation-local time participates. Exits, stops, reconciliation, and health work continue outside the entry window; only new entries are gated.

Daylight-saving transitions are resolved from the IANA time-zone database, never from a fixed `-04:00` or `-05:00` constant. These boundaries do not fall inside the ambiguous/repeated 01:00 hour or nonexistent 02:00 hour, but the engine still records offset changes and tests both transition dates. A tzdata/runtime upgrade that changes a previously persisted resolution creates a calculation-version change rather than silently rewriting historical session keys.

### 6.2 Session-level state machine

For each `(venue, venue_symbol, America/New_York civil trading date)` the engine maintains:

- `BUILDING` — session currently accumulating closed candles;
- `LOCKED` — the session interval ended and the level is final;
- `INCOMPLETE` — one or more required candles are missing;
- `SUPERSEDED` — a later correction produced a new version.

An incomplete level may be displayed but cannot authorize a trade.

### 6.3 Asian-range high and low

The range uses the highs and lows of the eight closed native `1h` candles whose openings fall from 00:00 through 07:00 New York local time after per-date UTC conversion. The 1-minute series independently verifies coverage and supplies detailed replay evidence; it does not replace the native hourly aggregation.

During the session, provisional high/low values are updated every scheduler cycle. At or after local 08:00, the level locks only if the complete resolved UTC interval is covered. Persisted fields include contributing candle IDs and a calculation fingerprint, so the level can be reproduced exactly.

### 6.4 London open

The London marker is the **open price of the native 1-minute candle whose UTC open time equals local 08:00 after time-zone resolution**. It is provisional when that candle first arrives and locks after the exchange closes the candle. If the candle is missing, the level is `INCOMPLETE`; the engine does not substitute the nearest tick.

### 6.5 New York session gate

At every 15-second cycle:

```text
new_entries_allowed =
    now_utc >= resolved_utc(local trading_date 13:00 America/New_York)
    AND now_utc < resolved_utc(local trading_date 21:00 America/New_York)
    AND required series are complete
    AND required session levels are locked
    AND provider health is not degraded
```

Existing positions remain actively managed after 21:00.

### 6.6 Daily, rolling-24h, and four-hour levels

Three concepts are stored separately:

- **UTC-day high/low:** derived from native intraday candles since 00:00 UTC and finalized at the next UTC midnight;
- **rolling 24-hour high/low and volume:** supplied by the exchange ticker and retained with the provider's window timestamps; and
- **4h high/low:** the high and low of each closed native four-hour candle, plus the most recently closed candle reference used by the profile.

They are never collapsed into one ambiguous “daily high/low” field.

### 6.7 Idempotent persistence

The 15-second scheduler may calculate the same provisional level repeatedly. The unique logical key is:

`(epoch, venue, venue_symbol, trading_date, level_type, level_window_start, version)`.

An unchanged calculation updates `last_verified_at` without creating a new semantic record. A changed contributing candle fingerprint creates a new version and retains the prior version for replay.

## 7. Volume and liquidity telemetry

Hourly volume comes from closed native 1h candles. Daily UTC volume is the sum of closed native 1h candles within the UTC date, marked provisional until the day closes. Rolling 24-hour volume comes from the ticker stream and remains a distinct metric.

Spread is calculated from contemporaneous best bid and ask:

`spread_bps = ((ask - bid) / midpoint) * 10,000`.

The snapshot must be fresh at admission and again at paper fill. The age limit is a profile/runtime contract to be specified in the playbook document; the adapter always reports the precise age rather than returning a bare pass/fail.

## 8. Rate limits and graceful degradation

### 8.1 Binance constraints relevant to this design

- A WebSocket connection is valid for 24 hours.
- The server sends a ping every 20 seconds and requires a pong within one minute.
- The documented incoming-message ceiling is five messages per second, counting ping, pong, and control messages.
- A connection may carry up to 1,024 streams.
- The documented connection-attempt ceiling is 300 attempts per five minutes per IP.
- REST request weights are exposed by exchange metadata and response headers.
- HTTP 429 requires backoff and respect for `Retry-After`; repeated abuse may cause HTTP 418 bans.

The implementation must read current venue metadata rather than treating values in this document as permanent constants.

### 8.2 Budgeting

Normal operation is WebSocket-first. REST budget is reserved for:

1. startup bootstrap;
2. verified gap repair;
3. product metadata refresh; and
4. reconciliation.

Backfill requests enter a bounded priority queue. Priority is open-position safety and reconciliation, then missing closed candles nearest the present, then older historical bootstrap. When saturated, low-priority historical work waits; closed live events are never dropped.

On 429, the adapter obeys `Retry-After`, opens a provider circuit for the affected endpoint, and records the event. On 418, all nonessential REST calls stop and operator attention is required. WebSocket health and REST health are reported independently.

Paid-tier headroom is provided through configuration of endpoint, quota budget, concurrency, and credentials; strategy code contains no free-tier assumption.

## 9. Paper-mode boundary

The Binance Spot Test Network is valuable for proving signed requests and order-state handling, but it is not a reliable representation of production liquidity. The recommended separation is:

- **contract test mode:** Binance Test Network, validating API behavior with valueless test assets;
- **strategy paper mode:** production public candles/order book plus Trade'Ed's internal immutable paper ledger; and
- **live mode:** absent from this release and not enabled merely by adding credentials.

Paper fills use the executable side and available depth. If only top-of-book data is initially implemented, any requested quantity larger than displayed top-level quantity is rejected as insufficient evidence rather than assumed filled. A later level-2 implementation can calculate depth-weighted VWAP.

## 10. Observability and acceptance measurements

The adapter must emit persistent metrics for:

- received, parsed, rejected, duplicate, corrected, and backfilled candle events;
- event transport latency and closed-candle availability;
- disconnects, reconnect attempts, continuity-segment changes, and gap duration;
- REST response class, 429/418 count, retry delay, and request weight;
- session-level status and missing contributors;
- order-book age at admission and fill;
- paper quote spread, fee, slippage, and depth sufficiency; and
- scheduler snapshot age.

Proposed seven-day acceptance:

1. transport-latency p95 <= 500 ms;
2. closed-candle-availability p95 <= 2,500 ms for Binance native klines;
3. market-data availability >= 99.9%, excluding declared upstream exchange-wide outages but reporting them separately;
4. automatic recovery with zero undetected candle gaps;
5. exact persistence and replay of every closed candle used in a decision;
6. no decision from an incomplete or cross-venue-spliced series; and
7. restart recovery produces the same session levels from persisted candles.

## 11. Verification plan before profile code

No playbook implementation begins until these adapter/session tests pass:

1. parse every required Binance kline interval and both instruments;
2. distinguish open updates from the final candle;
3. deduplicate identical frames and preserve corrected frames;
4. disconnect/reconnect with a missing interval and exact REST repair;
5. proactive 24-hour connection rotation without a gap;
6. 429, `Retry-After`, and 418 circuit behavior;
7. bounded backfill queue under prolonged throttling;
8. New York local boundary tests at 00:00, 08:00, 13:00, 21:00, both DST transitions, and both UTC offsets;
9. Asian level stays provisional until all eight native hourly candles close;
10. London level uses the native 08:00 one-minute candle open;
11. incomplete session blocks entries and remains visibly incomplete;
12. restart reproduces byte-equivalent session calculation fingerprints;
13. venue failover creates a new continuity segment and forces warm-up;
14. paper buy uses ask, paper sell uses bid, with measured cost attribution;
15. Test Network order lifecycle never writes a production/live-trade record; and
16. compatibility queries continue to return unchanged MemeCoin'Ed observations.

The “100% coverage” gate applies to the adapter's parsing, interval mapping, candle-finality, session-boundary, and error-state branches. It does not justify claiming 100% coverage of unrelated Trade'Ed code.

## 12. Security and configuration

Public market data requires no secret. Test Network credentials belong in the existing secret/configuration mechanism, never source control or telemetry. Configuration separates:

- market-data venue;
- execution mode (`paper_internal` or `sandbox_contract_test`);
- venue endpoints;
- instrument mapping;
- quota/concurrency budgets; and
- account identifier references.

There is no `live` execution value in the first implementation. Adding it requires a distinct reviewed release and the gate sequence in the brief.

## 13. Decisions requested from Tim

Approval of this design should explicitly settle these points:

1. **Primary feed:** approve Binance Spot first, with Kraken as the next adapter.
2. **Quote basis:** accept `BTCUSDT`/`ETHUSDT` for v1 while preserving the USDT label everywhere, or require exact USD and select Kraken first.
3. **Paper architecture:** approve production public data plus internal paper fills, using Binance Test Network only for order-contract testing.
4. **Latency SLA:** approve the split between <=500 ms transport latency and <=2,500 ms closed-candle availability.
5. **Session clock:** approved as `America/New_York` civil-time windows with per-date UTC conversion and explicit DST-transition coverage.
6. **Failover:** approve failover as a new continuity segment with warm-up and no cross-venue candle splicing.

No implementation should begin until all six are resolved.

## 14. Official API references

- [Binance Spot WebSocket streams](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams)
- [Binance Spot Test Network WebSocket streams](https://developers.binance.com/docs/binance-spot-api-docs/testnet/web-socket-streams)
- [Binance Spot REST API and limits](https://developers.binance.com/docs/binance-spot-api-docs/rest-api)
- [Kraken WebSocket v2 OHLC](https://docs.kraken.com/api/docs/websocket-v2/ohlc/)
- [Kraken Spot REST rate limits](https://docs.kraken.com/api/docs/guides/spot-rest-ratelimits/)
- [Coinbase Advanced Trade WebSocket channels](https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/websocket/websocket-channels)
- [Coinbase Advanced Trade WebSocket endpoints](https://docs.cdp.coinbase.com/coinbase-app/advanced-trade-apis/websocket/websocket-endpoints)
