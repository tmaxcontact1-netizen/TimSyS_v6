# 1b — Pivot density and session mapping: pre-registration v1

Shared dataset, retrieval, exclusion and provenance rules are frozen in `01-confirmation-spec.md`. No outcomes, fills or P&L. Commit before data retrieval. Measurement-only detector `pivot-density-v1`.

## Detector and counting

Native 15m and 1h bars, BTCUSDT/ETHUSDT. A strict high pivot has high greater than each of its two left and two right bars; a strict low pivot has low less than each. Equal extrema do not qualify. Require contiguous five-bar coverage. A bar can be both a high and low pivot: record both documentary identities. Availability begins at the second right bar's close, never at the center bar.

For lookbacks 12, 24 and 36, scan each contiguous trailing window of that many closed bars. Count distinct confirmed `(symbol,timeframe,side,center-open-time)` pivots ever available in each calendar month, attributed by confirmation time. Include April/October partial months, state observed-day exposure and report both raw counts and per-complete-day density. No normalization disguises partial-month counts.

Report max/min unique-count ratio across 12/24/36 per symbol/timeframe/month: positive/zero = infinity (BRITTLE); all zero = undefined/no evidence (flag), not ratio one. Ratio >2.0 is BRITTLE and triggers the global escalation rule. No retuning.

**Pre-analytic limitation:** with fixed 2L/2R, existence of newly confirmed pivots is normally identical for all lookbacks ≥5. The requested unique-pivot density ratio may therefore be one by construction, not proof that usable structural inventory is stable. Preserve that statistic, and separately report mean and quartiles of the number of confirmed pivots available in each trailing window, plus zero-inventory share. Do not substitute inventory ratios for the requested density ratio or infer profitability from either.

## Block-boundary mapping (decided before measurements)

Production session boundaries are NY [00,08) Asian and [13,21) entry blocks: eight civil hours. There is no defined six-hour block, so 24×15m=6h cannot be described as engine alignment. Task authorization explicitly allows adjustment to a real boundary.

- 15m mapping candidate: 32 bars = eight elapsed hours on ordinary dates, matching those blocks. Also report its inventory for context, alongside requested 12/24/36; never select among them using density or P&L. On DST-transition Asian dates the resolved span is 28/36 bars; record this as a required date-dependent coverage distinction, not a new tuned hypothesis. Entry block remains eight hours.
- 1h mapping candidate: 24 bars = UTC daily cycle. This is not universally a NY civil day (23/25 hours at DST); retain UTC-authoritative daily cycle labeling.

Derived constants are thus session-mapped 32 (15m) and 24 (1h), subject to Tim's review and density annotations. If measurements flag brittleness/undefined evidence, halt. The inability of unique-pivot counts to identify lookback stability is itself a review finding; no profile implementation follows automatically even if ratios equal one.

Output: `02-pivot-report.json`, monthly counts, inventory summaries, mapping and caveats in Markdown. Only measurements; no structural target selection or trade simulation.
