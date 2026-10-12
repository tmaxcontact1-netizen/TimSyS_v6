# 1c — Volatility inclusion: pre-registration v1

**Tim selected before viewing the distribution: include the most volatile 60% of days.** The binding percentile is 40th. It must not be changed after data arrives.

Shared dataset, retrieval, exclusions and provenance are frozen in `01-confirmation-spec.md`. Detector `daily-range-v1`; no returns, fills or trade outcomes.

For every NY civil analysis date 2026-04-12 through 2026-10-11, sample exactly at NY entry-window start (13:00 local, resolved via production session engine). Use the 1,440 contiguous, already-closed native 1m bars in `[sample_time − 24 hours, sample_time)`. This is an entry-time rolling range, not realized volatility, UTC-day high/low, or intraday future range. The chosen value is frozen for that civil session in the future design; no future candles enter it.

Compute `range_bps = (max(high) − min(low)) / min(low) × 10,000`. Missing required history excludes the symbol-day and is reported, following global bad-UTC-day exclusions. Do not replace it with a ticker sampled now.

Report per-symbol n, min/max, p25/p40/p50/p75/p90/p95. Quantiles use linear interpolation on sorted samples (Hyndman–Fan type 7: h=(n−1)p). Derived thresholds are the pre-registered p40 **per instrument**, so the inclusion statement does not silently become "mostly ETH, few BTC." Also report a pooled p40 and its per-symbol inclusion rates as an explicitly non-binding reference; do not choose between these policies by the resulting values. Tim will review the per-instrument policy before implementation.

Gate convention: range ≥ threshold. Report exact empirical inclusion rate and ties, since finite samples do not guarantee mathematically exact 60.000%. No threshold adjustment to hit an exact sample quota.

The inherited 200-bps floor is not used. Report its inclusion rate and the distance from p40 only as historical context, never as a candidate chosen for profitability. If sample n is zero, inputs invalid, or required history cannot be verified, STOP/escalate. Otherwise return the measurements and wait for review; no profile parameter is installed.

Output: `03-volatility-report.json`, all dated symbol-day observations, thresholds/inclusion rates, and Markdown report with dataset/spec/source hashes.
