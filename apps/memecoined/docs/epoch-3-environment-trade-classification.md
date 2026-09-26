# Epoch 3 environment-interruption trade classification

Generated from immutable epoch-3 fills, signal outcomes, scheduler gaps, and the interruption ledger in `PAPER_VALIDATION_PROTOCOL.md`. This is a report artifact only; no schema or runtime state was changed.

## Closed trades

| Profile | Token | Entry fill | Exit fill | Exit reason | Net result | Classification | Basis |
|---|---|---|---|---|---:|---|---|
| Oscillation Trader | `D1YZZg9dBZ7AbfknZVbaeVLto36eySwoFYEVhZrD4F4n` | 2026-09-25 21:18:01.706 +03:00 | 2026-09-26 06:42:29.571 +03:00 | hard stop | -5262.87 bps | `environment_interrupted` | The open interval intersects the worker outage from 2026-09-25 21:18:30 through 2026-09-26 06:42:15. |
| Oscillation Trader | `CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU` | 2026-09-26 07:04:01.938 +03:00 | 2026-09-26 07:04:35.082 +03:00 | trailing stop | -4.31 bps | `clean` | The complete 33.144-second fill interval lies inside a continuous 15-second scheduler segment and intersects no interruption interval. |

Both trades count toward the profile's terminal trade count. The clean trade belongs in the primary efficacy partition; the interrupted trade belongs in the separately reported platform-reliability partition.

## CbcyNo…kzpKoU exit arithmetic

Persisted entry calibration:

- target: 150 bps;
- hard stop: 90 bps;
- trailing activation: 75 bps;
- trailing distance: 75 bps;
- breakeven arm threshold: 75 bps (`target / 2`);
- calibrated typical move: 174.549699 bps;
- calibrated upper move / observed downside: 385.622630 bps;
- maximum holding period: 3 minutes;
- entry cost: 62,500,000 raw settlement units;
- exit quote value before the recorded fee: 62,483,051 raw settlement units.

The exit monitor evaluates the following predicates in this order: hard stop, target, trailing stop, breakeven stop, and time limit. For this profile:

1. The trailing and breakeven mechanisms both arm when the stored high-water value reaches at least `cost × 1.0075`, or 62,968,750 raw units.
2. A trailing exit then requires the current quote to be at most `high × 0.9925`.
3. At the minimum possible armed high, the exit quote represents a 77.133340-bps drawdown from high, satisfying the 75-bps trailing condition.
4. The exit quote is also below cost by 2.71184 bps gross, so the breakeven predicate was simultaneously true.
5. Because trailing stop has precedence over breakeven stop in reason selection, the persisted exit reason is `trailing_stop`.
6. After the recorded round-trip friction, the persisted net result is -4.31 bps.

Therefore this was not caused by a trail distance tighter than the entry calibration. It was an armed 75-bps profit-protection trail returning through breakeven, with the reason labelled `trailing_stop` because of predicate precedence.

## Nearest persisted executable-price observations

Prices below are normalized to the entry-fill executable price and expressed in basis points. The observation stream is sparse relative to position monitoring, so it does not persist the intratrade high-water quote that armed the trail.

| Observation time | Distance from entry fill | Normalized price |
|---|---:|---:|
| 07:03:31.604 | -30.334 s | -65.532583 bps |
| 07:04:01.474 | -0.464 s | -7.713391 bps |
| entry fill 07:04:01.938 | 0 s | 0 bps |
| exit fill 07:04:35.082 | +33.144 s | -2.711840 bps gross / -4.31 bps net |
| 07:04:46.425 | +44.487 s | +217.815461 bps |
| 07:05:16.472 | +74.534 s | +389.138112 bps |

The immutable outcome currently records maximum favorable and adverse excursion as zero even though the trailing predicate proves that the in-process high-water value reached at least +75 bps. That is a telemetry limitation in epoch 3, not a reason to reclassify the trade.

## Exact friction reconciliation

The `CbcyNo…kzpKoU` accounting reconciles exactly in raw lamports:

- entry quote: 62,500,000 raw = 0.062500000 SOL;
- entry fee: 5,000 raw = 0.000005000 SOL;
- total entry debit: 62,505,000 raw = 0.062505000 SOL;
- exit quote: 62,483,051 raw = 0.062483051 SOL;
- exit fee: 5,000 raw = 0.000005000 SOL;
- net exit proceeds: 62,478,051 raw = 0.062478051 SOL;
- gross P&L: -16,949 raw, or exactly -2.711840 bps relative to the 62,500,000-raw entry quote;
- net P&L: -26,949 raw, or -4.3114950804 bps relative to the 62,505,000-raw total entry debit;
- rounded persisted/display values: -2.71 bps gross and -4.31 bps net.

Each fee is exactly 0.8 bps of the entry quote. Round-trip explicit fees are therefore exactly 1.6 bps. The fee is non-zero, and the displayed two-decimal basis-point values are ordinary rounding rather than hidden zero precision. Friction is small but genuine for this trade: it moved the result from -2.71184 bps gross to -4.3114950804 bps net.
