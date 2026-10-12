# Corrected 1b v2 — pre-registration, 12 October 2026

Authorized by Tim's clarification rulings. Commit this spec and executable before extension retrieval or selection measurement. Original v1 outputs and diagnostic inclusive-close audit remain immutable. No P&L, fills, trades, profile implementation, merge or publication.

## Dataset and partitions

Original native dataset manifest SHA-256 `eed9e1378d1edcc07397d8d79783737dcc7d8f68f5e90e4aa47674bcf36c0336` and exact `confirmation-events.ndjson` form the unchanged event/sample inputs. Spec commit `8f8bf88a8236bb3aa9ca07fa0568b4716c7364f4`, original executable `5483b67f406f265616bc481b2a4c67302505665a`.

Retrieve Binance Spot BTCUSDT/ETHUSDT native 1m/5m/15m/1h/4h through the production BinanceRestAdapter, from **2025-09-29T00:00:00Z through 2026-04-12T00:00:00Z exclusive**:

- Holdout startup history: [2025-09-29, 2025-10-01), not evaluated.
- Intended evaluated backward holdout: **[2025-10-01, 2026-04-10)**, October 1 through April 9.
- Approved strip: **[2026-04-10, 2026-04-12)**, neither holdout nor in-sample evaluated events.
- Evaluated in-sample: **[2026-04-12, 2026-10-12)**, April 12 through October 11.

Do not recompute 1a/1c or any calibration statistic on the holdout. Earlier candles are retrieved and integrity-checked only; the strip supplies pre-April-12 1b context. The evaluated holdout's first events use September startup history, never April's strip. This is retrospective time-separated validation, not a prospective prediction claim.

Use sequential REST requests with at least 200ms between starts, 15-second timeout and at most three retries; transport/5xx backoff 1/2/4 seconds; 429 respects Retry-After or 60 seconds; 418 halts. Pages checkpoint atomically after persistence, with SHA-256 hashes. Verify expected grids, native closure, OHLC containment, duplicate open-times, and endpoint boundaries. Any missing/invalid/duplicate/incomparable data causes STOP; do not silently remove holdout days. Verify April 11 overlap against the previous frozen dataset. Do not commit the final split as usable until this gate passes.

## Event and level definitions

Use all **1,622 level-specific events**, preserving IDs, including 227 symbol/sweep moments shared across level families. Never replace the sample with unique market moments, NY-only events or new detector events. Report overlap as dependency annotation.

For each event, sweep reference instant T = sweep native inclusive close +1ms, and price P = the exact next/reclaim candle close from the original dataset. No hypothetical order or executable entry is computed. Retain the original event's sweep low.

Strict 2L/2R pivots: high/low must exceed/be below all four neighboring native extrema; equals do not qualify. Availability A = second right native inclusive close +1ms. Only **lower pivots with A ≤ T** can enter selection. Do not use a pivot confirmed during or after the later reclaim candle.

Lookback means the last L fully closed native bars as of T. Eligible pivot centers lie within that span, with their two right bars already closed. Require the complete **L+4** contiguous closed-bar history before evaluating the event; this conservative history check is identical in definition for every L. Report discard count per L, and compare rates on the common valid intersection. If warmup discard counts differ despite the retrieved full history, STOP rather than manipulating denominators.

An actionable candidate low V must satisfy **sweep.low < V × (1−0.001)** and **P > V**. This is the exact same-event >10bps pierce and reclaim predicate Tim approved. No broader “any low below price” substitution.

Rank by `(P−V)/P × 10,000` ascending, availability descending, timeframe ID ascending. Pivot identity is `(symbol,timeframe,side,center-open-time)`; price ties with different documentary identity are resolved by the same precedence, not merged.

Native 15m candidates: **12,24,32,36,48**; native 1h candidates: **12,24,36**. Ratified mapping candidates are 32 and 24 respectively, but their installation remains pending robustness and Tim's review.

## Statistics and gates

Per symbol/timeframe/lookback: event count, warmup discard count, no-level count/rate, distance min/p25/p50/p75/p90/p95/max among selected events, selected-identity records for every event. Explicitly report the denominator; no-level cases are not silently dropped from rates.

All pairwise comparisons are pre-registered. Include requested 12:24,24:36,12:36 and all pairs bracketing 32. Difference means different identity, including exactly one null selection. Both null is identical, with no-level rate reported independently. Denominator is all common valid events; also report both-selected counts as a diagnostic, not a replacement denominator.

For each lookback, ROBUST requires **all pairs involving it ≤10% difference** AND **its no-level rate <1%**. Anything else is BRITTLE. Any brittle symbol/timeframe/lookback, malformed event, data-integrity failure or unequal warmup discard count triggers STOP and escalation. Never choose the least-bad lookback or broaden the predicate/tolerance.

For differing selections with both present, report whether the shorter lookback's level is nearer/farther/equal. R proxy = P − (same event sweep.low − metadata tick). Tick is fetched through production exchange metadata and preserved; current metadata is not asserted to be historical book evidence. With the approved fixed event reference and sweep-low stop, R is invariant even when level identity differs. Report exact invariance counts, particularly same-selection events, and material-change count `|ΔR|/R >0.10`; never alter the stop anchor to create a difference.

## Monthly correction

Each pivot belongs to **one** UTC month containing availability A. Count each `(symbol,timeframe,side,center-open-time)` once, with A inside the in-sample evaluated interval. Report highs, lows and total separately. Exposure comes from complete UTC days whose native **open-times** lie in the evaluated interval, excluding warmup, not from a closing-bar date set. April exposure = **19 days**.

Previous inclusive-close audit values are diagnostic references, not binding counts. Recompute using the ruled availability convention; do not force agreement with those values.

## Deliverables and stop

1. New extension provenance/integrity report and page manifest, without any holdout distribution or strategy statistics.
2. New corrected 1b report and per-event selections, keeping original v1 files intact.
3. Validation ledger updated with hashes and status. A failed measurement leaves pivot lookback PENDING. No backtest, profiles, paper epoch or fallback split follows without review.
