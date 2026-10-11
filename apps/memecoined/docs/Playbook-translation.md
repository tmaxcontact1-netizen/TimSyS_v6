# Trade'Ed Crypto'Ed — Playbook translation

**Status: review-only draft, 11 October 2026. No strategy code implemented.**

This translates Tim's Sweep-Reversal and Structure-Target brief against the approved exchange adapter. Proposed choices below require review; they are not silently approved constants. Remaining deployed-isolation and production gap-repair acceptance gates must pass before profile implementation/testing proceeds.

## 1. Boundaries and shared rules

- Initial instruments: Binance Spot **BTCUSDT and ETHUSDT**. Prices, fees, and P&L retain their USDT denomination; these are not relabeled USD pairs.
- Paper execution only. No live order path, shorts, leverage, or authenticated production trading.
- Profiles make independent decisions. Shared account limits constrain capital allocation, not another profile's signal interpretation. Capacity rejection is logged separately from strategy rejection.
- Native closed 1m/5m/15m/1h/4h candles only; no synthetic aggregation, interpolation, cross-venue splicing, or reuse of an already-consumed candle as a new signal.
- New entries require complete relevant series, locked required levels, fresh book, provider readiness, and sufficient quantity/depth evidence. Exits remain operational outside entry windows.
- Existing MemeCoin'Ed queries and profile logic remain untouched.
- No inherited F&F/OT score, RSI, quality, cooldown, or geometry gates unless separately specified and approved.

## 2. Session and market gates

All entry/session definitions use `America/New_York` civil time, converted per trading date to UTC. Storage and candle identity remain UTC-authoritative.

| Rule | Translation |
|---|---|
| Asian range | Local [00:00, 08:00), finalized only after complete native-hourly coverage |
| London marker | Native 1m candle open at local 08:00; locks after that candle closes |
| Entry window | Local [13:00, 21:00); no new entries outside it |
| Four-hour levels | High/low of explicitly referenced, already-closed native 4h candle |
| Daily volatility ≥2% | **Proposed:** rolling-24h range `(high − low)/low × 10,000 ≥ 200 bps`; distinguish from UTC-day range |
| Spread ≤10 bps | Contemporaneous `(ask − bid)/midpoint × 10,000`; checked at authorization and fill |
| Volume history | Complete required 24h history, with the provider's window identified |

DST: Asian coverage is the resolved UTC duration, not unconditionally eight hourly bars. Spring/fall transition dates can contain seven/nine hours. The approved adapter document's fixed-eight wording requires clarification before implementation; the profile must not manufacture missing hours. These are project session labels, not assertions about the actual London exchange opening time.

## 3. Sweep-Reversal

Long-only lower-level sweeps are actionable. Upper-level sweeps are diagnostic context, not short signals.

```text
locked lower level → closed-bar sweep → next-bar reclaim
→ later green confirmation → entry intent → fresh executable ask fill
→ bid-side target/stop exit
```

For level `L` and a closed candidate candle:

1. Sweep: `low < L × (1 − 0.001)`; penetration must exceed 10 bps, not merely touch the level.
2. Reclaim: the immediately following closed candle has `close > L`. A missing intervening candle invalidates the sequence.
3. Confirmation: first later closed green candle (`close > open`) after reclaim. **Proposed timeframe: 1m**, with a maximum three-following-bar confirmation lifetime. Expiry is visible, not an indefinite stale setup.
4. Authorization rechecks the current complete-series/session/book gates. It does not assume the historical confirmation close is an executable price.
5. Fill: first fresh ask-side paper quote after authorization, subject to depth, fee, minimum-notional and absolute-cap constraints.

**Proposed stop anchor:** sweep candle low minus one venue price tick. Let executable entry be `P_e`, stop `P_s`, and initial price risk `R = P_e − P_s`. Reject non-positive R.

- Baseline target: `P_t = P_e + 2R`.
- Stop: fixed initial `P_s`; no automatic breakeven/trailing amendment.
- Optional structure target stays disabled in the baseline experiment; enabling it is a separately frozen variant, not a silent fallback.
- “Enter at close” means authorize after closed-candle confirmation and record close-to-fill displacement. Paper accounting must never pretend a later order filled at the historical close.

## 4. Structure-Target

Same shared gates, sizing, and executable-side accounting; a distinct detector and target, not a rename of Sweep-Reversal.

**Proposed swing definition:** native 15m and 1h pivot with two closed bars on each side; lookback 24 bars per timeframe. A pivot is available only after the second right-hand bar closes. Strict inequalities avoid ambiguous equal-height pivots; ties must be explicit tests, not address-based ordering.

1. Select a previously confirmed lower swing, identified by timeframe, candle ID and confirmation timestamp.
2. Detect a >10-bps downside sweep of that swing on a closed 1m candle.
3. **Proposed three-candle reversal:** three subsequent closed 1m closes strictly increase, and the third closes above the swept level. This does not additionally require all three candles to be green.
4. Revalidate shared admission conditions, then quote executable ask.
5. Stop below sweep low by one price tick. Target the nearest already-confirmed opposing swing high above executable entry, available at authorization; do not choose it using future candles.
6. Reject if no valid opposing target or non-positive risk/reward distance. Record cost-adjusted reward/risk; do not invent a minimum-RR gate absent approval.

Selecting between overlapping 15m/1h levels needs deterministic precedence. **Proposed:** nearest actionable level, then most recently confirmed, then timeframe ID. Record all candidates and selected level. A single setup has one immutable signal ID even when detected at several scheduler ticks.

## 5. Sizing and fills

Reuse configured fixed risk fraction `r` and the existing absolute position cap. Do not introduce Conviction sizing.

For account equity E and valid long stop distance D:

```text
risk_budget = E × r
desired_quantity = risk_budget / D
quantity = floor_to_venue_step(min(desired_quantity,
             allocation_cash / executable_ask,
             absolute_position_cap / executable_ask,
             supported_book_quantity))
```

Reserve fees consistently. Reject below venue minimum quantity/notional; never round upward past a cap. Planned-at-stop risk and realized loss are distinct: gaps can exceed planned loss. Paper buys consume asks; sells consume bids. Insufficient displayed depth is rejection, not an assumed fill. Fee/tick/step/status values come from venue metadata/configuration, never embedded strategy constants.

Stops/targets trigger from executable exit value, not candle mid-price alone. Exit fills use fresh supported quotes; discontinuities, quote age and overshoot are persisted. No 10-minute timeout is inherited from MemeCoin'Ed: holding horizon and treatment of still-open positions at window termination require a separate pre-registered decision.

## 6. Idempotence, state, and rejection truth

Signal key includes profile, venue, instrument, continuity segment, trading date, level version and confirmation candle. Repeated evaluation of the same key cannot create another intent.

States: waiting-for-data, observing, swept, reclaimed, confirmed, authorized, intent-pending, filled, exited, expired/rejected. Waiting is not counted as a market rejection. Transactional commitment keeps fill, position and intent outcome consistent; repeated consumers must be idempotent.

Persist per evaluation:

- source candles/level versions, exact timestamps and continuity;
- each shared-gate result and specific blocker, including incomplete data;
- sweep/onset price, reclaim and confirmation closes, authorization and executable fill;
- entry-vs-onset and close-to-fill distance in bps;
- spread, book age, volume/range evidence, depth, fees and sizing/cap calculation;
- intent disposition, first/retry quote failures and accepted-to-fill delay;
- position-sized executable exit quote paths, target/stop and actual trigger/fill times;
- MFE/MAE from those position-sized paths, including exit-adjacent quote, realized net P&L and planned-vs-realized loss;
- clean/environment-interrupted classification under the fixed event-intersection rule.

No binary score masquerading as predictive confidence. Capacity ordering is deterministic and documented; no token/strategy is credited for another profile's signal.

## 7. Validation before activation

1. Complete adapter/isolation gates, including production-service forced-disconnect REST repair with `source=rest_backfill` and verified contiguity. The archived soak's aggregate counters are not a complete replay candle dataset.
2. Unit/regression tests: closed-bar finality, strict sweep boundary, next-bar reclaim, confirmation expiry, missing bars, pivot availability/no lookahead, both DST transitions, stale quotes, depth/minimum/cap failures, idempotent duplicate consumers, complete net accounting and quote-path excursions.
3. Six-month offline native-candle replay where data exists. Freeze rules before a time-separated held-out evaluation. Candle-only replay cannot establish measured historical execution cost; label any assumed spread/fees and intrabar ordering. When both stop and target fall inside one bar, report ambiguity or use an explicitly pessimistic assumption, not automatic target-first fills.
4. Report each profile independently: funnel, reasons, net expectancy, win/payoff, drawdown, cost sensitivity, sample size, availability, and every changed/ambiguous trade. Include negative/null results.
5. Tim reviews results and separately authorizes paper activation and a fresh epoch. Terminal condition: 30 closed trades **per evaluated profile** or 24 active hours, whichever first; define handling of incomplete per-profile samples before start.
6. Frozen code/configuration provenance, gap-excluded active time and interruption classifications apply. Report all trades and clean partition separately. No tuning mid-window.

The brief says “positive” but gives `≥0 bps/trade`: zero is break-even, not evidence of profit. Proposed report categories: negative / break-even / positive, with uncertainty and costs stated. No live phase is implemented or authorized by this draft.

## 8. Decisions required before implementation

| Decision | Draft proposal, not yet approved |
|---|---|
| Volatility meaning | Rolling-24h range ≥200 bps; not statistical return volatility |
| Signal bars and expiry | Native 1m; Sweep-Reversal confirmation within three later bars |
| Risk anchor | Sweep low minus one metadata tick |
| Structure pivots | Two-left/two-right, 24-bar lookback; nearest-level precedence |
| Book/signal freshness | Proposed book age ≤1s, authorization-to-fill ≤30s, otherwise requote/revalidate |
| Position timeout | Undecided; no inherited timer or forced profit assumption |
| Terminal open positions | Explicit reviewed close/mark/archive policy before paper start |
| DST hourly coverage | Resolved 7/8/9-hour duration, with adapter wording reconciled |
| Evaluation threshold | Distinguish ≥0 from strictly positive; specify minimum sample per profile |

This document is the translation deliverable, not permission to implement, merge, publish profile logic or start a new window.
