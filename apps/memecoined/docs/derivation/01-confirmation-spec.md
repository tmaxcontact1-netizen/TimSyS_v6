# 1a — Confirmation arrival: pre-registration v1

Authorized 12 October 2026. Measurement only; no profile implementation, orders, fills or P&L. Commit this document and its executable before the first dataset request. Stop after the three reports for Tim's review.

## Shared dataset contract (applies to 1a/1b/1c)

- Venue/instruments: native Binance Spot BTCUSDT, ETHUSDT; intervals 1m/5m/15m/1h/4h. Use the existing production BinanceRestAdapter, not a separate candle decoder.
- Analysis: `[2026-04-12T00:00:00Z, 2026-10-12T00:00:00Z)` — six calendar months, 183 UTC days. Retrieval also includes `[2026-04-11T00:00:00Z, 2026-04-12T00:00:00Z)` as explicitly non-analysis warmup. No later candle enters a measurement.
- Download every interval directly; never aggregate one interval into another. Paginate at the adapter's 1,000-row limit. Rate: one request at a time, at least 200 ms between starts; timeout 15 seconds. Transport failures/HTTP 5xx: at most three retries at 1/2/4 seconds. HTTP 429: respect Retry-After, otherwise 60 seconds; three retries maximum. HTTP 418: halt immediately. No data-dependent endpoint or dataset change.
- Persist canonical candles in immutable numbered pages, request log, SHA-256 page manifest, config hash and source/spec commit. Existing complete pages resume without refetch; checkpoint replaced atomically after each page. A page is committed before its checkpoint advances.
- Verify grid alignment, closed finality, positive OHLC, high/low containment, unique open-times and expected close-time. Count gaps against the expected grid; do not invent rows. Each UTC day with any missing/invalid/duplicate native candle in any requested symbol/interval is excluded globally from the analysis. Record offending symbol/interval/day/count.
- Day-dependent tasks exclude New York dates whose required history intersects an excluded UTC day. Pivot windows never bridge exclusions or gaps. Boundary-censored cases are reported separately, not silently dropped.
- No old soak telemetry, trade outcomes, security scores or profits enter these calculations. The same manifest is the intended forthcoming backtest dataset; no backtest is run now.
- Input-distribution calibration covers all six months. Therefore a later split of this same dataset is not an untouched holdout for input-derived constants. Flag this for review; do not claim otherwise or quietly switch calibration dates.

## Frozen detector: sweep-arrival-v1

Use closed native 1m bars. Lower levels only: (a) current New York date's locked Asian range low, available after local 08:00; (b) the most recently fully closed native 4h candle's low. London open is contextual telemetry, NOT an additional actionable lower-level detector.

Session boundaries come from the production session engine. Asian hourly completeness must match its resolved UTC duration. The existing implementation's hard-coded eight-hour completeness is disclosed; this April–October dataset contains no NY DST-transition date. Do not modify production code to measure it.

For each level instance and sweep bar i:

1. `low[i] < level × (1 − 0.001)` — strictly greater than 10 bps penetration.
2. Immediately adjacent 1m bar i+1 closes strictly above the same level.
3. Event key: symbol, level family, level version/window, sweep open-time. Two distinct level instances remain distinct events; report this rather than pretending they are independent token-days. No extra previous-close, volatility, volume, spread, trend or trading-session admission filter.
4. From reclaim, search bars i+2 through i+21 for the first `close > open`. Arrival is 1..20 bars after reclaim. The reclaim candle itself never confirms (bin zero is explicitly zero).
5. Full 20-bar search must be present and contiguous, even if an early green candle is found. Missing-history or end-boundary cases are recorded as excluded. An event with no green candle in a complete 20-bar search is right-censored as `>20`, not assigned an invented exact time.

## Reporting and frozen statistic

Report event counts, 0..20 and >20 histogram, p50/p75/p90/p95 using nearest-rank `ceil(p × N)` with censored events sorted after 20. A censored percentile is reported `>20`, not calculated from confirmed events alone. Report mass >10 and no-confirmation-within-20 count/rate.

Break down by symbol and reporting-only NY civil-clock bucket: Asian range [00,08), London-marker period [08,13), NY window [13,21), and off-window [21,24). The London bucket is a reporting period, not a new session/entry rule. Also report level-family counts. Classify by reclaim-close time. These partitions are explicit because the original labels mixed level families with clock windows.

Derived expiry: nearest-rank p90 of all complete-search events pooled across both symbols and reporting buckets, rounded upward to bars. Also show NY-window-only p90 as a diagnostic; it cannot replace the pre-registered pooled value. If pooled p90 >10, censored, undefined or predominantly >10, STOP/escalate; no implementation. Report any other inconsistency without adjusting the detector.

Output: `01-confirmation-report.json`, full per-event `confirmation-events.ndjson`, missing/boundary exclusion counts and Markdown report. Tool version and spec/page hashes accompany every report.
