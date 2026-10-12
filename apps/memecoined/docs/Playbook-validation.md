# Trade'Ed playbook validation contract

Status: 12 October 2026 — accepted constants recorded; **1b respecification blocked pending clarification**. No profile implementation, runtime activation, backtest, epoch, merge or publication.

This is the canonical parameter ledger for the forthcoming profiles. “Installed” below means installed in this design/validation contract, not in a running strategy: those profiles do not yet exist.

## Accepted derivations

### Confirmation expiry — installed

**4 native 1m bars**, from the pooled nearest-rank p90 of frozen 1a. This supersedes the translation draft's proposed three-bar expiry. The old proposal was never deployed; this is the first accepted derived value, not use of the one-revision allowance.

Source: `docs/derivation/01-confirmation-spec.md`, spec commit `8f8bf88a8236bb3aa9ca07fa0568b4716c7364f4`; frozen measurement executable `5483b67f406f265616bc481b2a4c67302505665a`; original `01-confirmation-report.json` under `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\data\derivation-2026.10.12`.

Sampling annotation: 622 Asian-low events and 1,000 last-closed-4h-low events, totaling 1,622 level-specific events. There are **1,395 distinct symbol/sweep-open moments**, of which **227 reference both families** (BTC 70, ETH 157). These are not 1,622 independent trades. No original event was merged or reclassified. NY-window-only p90 is also four bars; the eventual backtest report must restate both that fact and same-moment overlap descriptively.

### Volatility — installed, per instrument

- BTCUSDT: **232.2812569236644 bps**.
- ETHUSDT: **309.8626898215825 bps**.

These are the unrounded p40 values from the original `03-volatility-report.json`. Tim selected the most volatile 60% before retrieval. Each instrument admitted 110/183 sampled days, 60.1092896%, without post-measurement threshold adjustment.

Source: `docs/derivation/03-volatility-spec.md`, same spec/executable commits above. Daily range is sampled at NY 13:00 from the preceding complete 24 hours; no future daily range, fills or P&L enter the calibration.

Tim reviewed and rejected the pooled cutoff **256.92189933222517 bps**: it reweights inclusion to 50.2732240% BTC / 69.9453552% ETH. The inherited **200-bps** gate is rejected as misfit to the selected inclusion statement: 67.2131148% BTC / 83.6065574% ETH. Neither is a runtime fallback.

### Session mapping — ratified; pivot parameter not installed

- Native 15m: **32 bars = eight ordinary elapsed hours**, matching the Asian/entry block span.
- Native 1h: **24 bars = UTC daily cycle**.

Mappings are ratified. **Pivot lookback remains PENDING** corrected 1b and Tim's subsequent ratification. Do not mistake the mapping candidate for an activated or robustness-approved lookback. Asian DST coverage must follow resolved 7/8/9-hour duration; this does not turn a NY civil day into a fixed 24-hour interval.

## Parameter ledger

| Parameter | Contract value/status | Derivation layer | Spec/basis | Revisions used / allowed |
|---|---|---|---|---|
| Confirmation timeframe | Native 1m | Frozen hypothesis | Manual playbook, accepted derivation instruction | 0 / 1 |
| Confirmation expiry | 4 bars, installed in contract | Frozen hypothesis, outcome-blind derived | 1a v1 pooled p90 | 0 / 1 |
| Volatility | BTC 232.2812569236644 / ETH 309.8626898215825 bps | Frozen hypothesis, outcome-blind derived | 1c v1; per-instrument p40; policy ratified | 0 / 1 |
| Pivot definition | Strict 2L/2R native pivots | Frozen detector definition | Accepted manual definition | Not a tuning budget |
| Pivot lookback | **PENDING**; mapping candidates 32×15m / 24×1h | Frozen hypothesis, session-derived candidate | Replacement 1b spec not yet runnable | 0 / 1 |
| Stop anchor | Sweep low minus one metadata tick | Empirically anchored venue geometry | Approved constants, no level-anchor substitution | Fixed |
| Book freshness | ≤1 second | Empirically anchored | Approved 130–190ms soak-latency basis | Fixed |
| Authorization-to-fill | ≤30 seconds; requote/revalidate on violation | Empirically anchored | Approved constants | Fixed |
| Spread ceiling | 10 bps | Fixed manual playbook condition | Original common requirements | Fixed |
| Position timeout | None | Market mechanics / approved consequence | No temporal exit term introduced | Fixed |
| Instruments/mode | BTCUSDT, ETHUSDT, Binance Spot; internal paper only | Approved scope | No live, short, leverage or production-auth path | Fixed |
| Sizing | Existing fixed risk fraction r and absolute cap; unchanged | Approved mechanics | Conviction sizing parked | Fixed |
| DST coverage | Per-date resolved UTC interval, 7/8/9 Asian hours as applicable | Machinery-derived | NY IANA boundary contract | Fixed |
| Backtest acceptance | Strictly positive net expectancy after all costs, with uncertainty | Accounting / statistical evaluation | Break-even is not positive | Fixed |
| Paper epoch role | Implementation fidelity, not expectancy | Protocol/statistical consequence | 30 closed trades per profile or 24 active hours | Fixed |
| Terminal positions | Force-close at window end; separate mark-to-market annex; excluded from strategy closed-trade statistics | Protocol consequence | Categorical exclusion, not configurable | Fixed |

Exactly one revision ever per frozen-hypothesis parameter, only between backtest completion and paper start, requires a documented specific failure mode; never choose a value using better P&L or a parameter sweep. Sensitivity variants are annotations only and cannot update deployed values. No revision has been consumed by this work.

## Replacement 1b — scope and pending decisions

Use the unchanged 1a event set and dataset. Compare the pool of confirmed actionable lower levels, not invariant pivot existence. Required outputs are selection-difference rates, distance distributions, no-level rates and directional/R annotations. Do not retune if a robustness gate fails.

Intended comparisons retain 12/24/36 and bracket the ratified 15m candidate: proposed **12/24/32/36/48 for 15m**, **12/24/36 for 1h**. The final executable/statistical definition must be committed before the rerun. No new comparison has been run.

The replacement instruction's calendar requirements currently conflict:

1. Assign a pivot to the month containing native-inclusive-close **+1 ms**.
2. Treat previous audit numbers as binding, although those were explicitly calculated using **inclusive close without +1 ms**.

Example: BTC 15m pivot centered 2026-07-31 23:15, second right bar closes 23:59:59.999, available 2026-08-01 00:00:00.000. It belongs to August under availability grouping and July under the audit grouping. Both cannot be binding simultaneously. April 19-day exposure and no warmup-date leakage are unambiguous and accepted.

Also specify the price/instant anchoring “nearest actionable,” the exact eligibility predicate, and the diagnostic R price proxy before observing selection statistics. With a fixed reference price and the same event's sweep-low-minus-tick stop, R is invariant across lookbacks; do not silently move the stop to the selected level to manufacture an informative R statistic.

## Backward-extension holdout — pending retrieval gate

Intended requested periods: the original April 12–October 11 2026 data is in-sample; earlier October 2025–April 2026 data is the time-separated retrospective holdout. No calibration statistic may be recomputed on the holdout, and no alternative split is installed based on P&L.

Exact retrieval dates and provenance hashes must be recorded and verified before committing the final split. Retrieval has **not started**. Native production adapters, both symbols, all five intervals; same integrity rules. Gaps or incompatible venue/API behavior must be reported before any backtest; fallback input overlap requires Tim's written acceptance, never silent relabeling.

Full 1h lookback 36 plus four confirmation bars needs 40 hours before the first comparison event; the existing one-day warmup is insufficient to guarantee identical discard counts. The backward extension can supply that history, but any calibration-consumed warmup must be explicitly excluded from the holdout's evaluated core to avoid unnoticed input overlap. Proposed minimum embargo/warmup buffer: two complete days preceding April 12. This is pending review, not a committed split.

## Boundaries

All original 1a/1b/1c outputs and the 1b integrity audit remain unchanged. The rejected unique-existence metric is not a robustness pass; the measurement implementation's separate month/exposure defects remain disclosed. No profile implementation may begin until 1b is resolved, passes its frozen criteria, and Tim ratifies its installation.

No rerun, backward retrieval, backtest, merge, publication or automated validation window was started by this documentation update. Task Scheduler is Disabled and no validation worker is active.
