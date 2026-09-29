# Post-epoch-16 collapse-defense design

Status: release-next branch implementation. Nothing in this document is active in epoch 16.

Evidence cutoff: 29 September 2026, 04:57:20 Asia/Riyadh. Epoch 16 remains frozen.

## 1. Consecutive-loss token lockout

### Rule

- Scope: token mint across both evaluated profiles, not profile-specific.
- Trigger: two `hard_stop` exits for the same mint within a four-hour rolling session.
- Effect: reject new entry authorization for that mint until four hours after the second stop fill.
- State transition: a profitable or time exit does not erase prior stops; expiry is time-based.
- Required telemetry: first stop, second stop, lockout start/end, blocked profile and signal ID.
- Restart behavior: derive the lockout from persisted fills; do not keep it only in memory.

### Epoch-16 replay

`NVpUDQR6…ryECsw` stopped at 01:03:08 Riyadh (OT) and 01:18:20 (F&F). The third entry at 02:51:38 occurred 1h33m18s after the second stop and would therefore have been blocked until 05:18:20. That third entry was the -10,000-bps loss.

No other epoch-16 entry would have been blocked. This is a one-trade intervention in the 28-trade checkpoint sample: it removes the catastrophic third NVpUDQ entry without suppressing B4znEr's later profitable repeats, DYpNiZ's profitable repeats, or 2zMMhc's mixed low-magnitude repeats.

## 2. Per-token session loss cap

The release-next threshold is **-500 realized bps per mint across all profiles in the current epoch/session**. Once cumulative closed-trade net performance reaches or falls below -500 bps, later entries are barred for the remainder of that session.

This value sits below the ordinary losing-token aggregates observed in epochs 15/16 while catching the demonstrated repeated-token failure:

- NVpUDQ was already -713 bps after its first two stops, so its -10,000-bps third entry is blocked.
- The next-worst non-NVp aggregate was approximately -307 bps and remains admitted.
- DYpNiZ (+1,610 bps) and B4znEr (+987 bps) remain admitted.

The replay therefore blocks the same single NVpUDQ third entry and no profitable control named in the instruction.

## 3. Rejected: corrected liquidity-decline entry gate

### Measurement

For each entry authorization:

`declinePct = 100 * (maxLiquidity30m - currentLiquidity) / maxLiquidity30m`

Use only observations from the same epoch and mint. When current liquidity or the window high is unavailable, the result is `null` and **passes**, preserving release .14 null-data semantics.

### Proposed threshold

Reject at `declinePct >= 35%`.

Epoch-16 30-minute decline distribution across 10,653 observations:

| Statistic | Decline |
| --------- | ------: |
| P50       |   0.19% |
| P75       |   1.29% |
| P90       |   5.08% |
| P95       |   9.77% |
| P99       |  96.91% |
| Maximum   | 100.00% |

Counts: 203 observations >=30%, 179 >=35%, and 148 >=40%. A 35% threshold lies above approximately 98.3% of observed states and is the midpoint of the requested 30-40% defensive region.

### Epoch-16 entry replay

- Rejected: one of 28 entries (3.57%), DYpNiZ…T5uF at 36.77% decline.
- That entry subsequently made +601.23 bps. This is a known false positive.
- The catastrophic NVpUDQ entry showed only 0.75% decline and would pass.

Conclusion: **not implemented**. It misses NVpUDQ and rejects a +601-bps winner, so the available evidence argues against adding it.

## 4. Rejected: exit-side collapse monitor

### Proposed rule

Every open-position cycle requests a position-sized reverse quote and persists it before evaluating:

1. Spread alarm: exit when implied effective spread exceeds `2.0 * admissionSpreadLimit` (F&F: 300 bps; OT: 150 bps).
2. Deterioration alarm: exit when return is below the configured -250-bps stop and the next consecutive valid reverse quote is worse.
3. Existing hard stop remains active; the deterioration condition must never delay an already executable hard-stop exit.
4. Null/unquotable reverse quotes do not invent a value. They increment a consecutive-unquotable counter and are reported separately.

The 2x multiplier places the F&F alarm above epoch 16's P95 candidate spread of 198 bps while still detecting a material expansion from the 150-bps admission ceiling. OT's tighter 75-bps admission limit yields a 150-bps alarm, intentionally below the population P90 of 178 bps because OT's target is only 300 bps.

### NVpUDQ replay

Entry: 02:51:38.753 Riyadh. Admission median spread: 59 bps; limit: 150 bps.

- The persisted position path remained between -188.83 and +148.30 bps until 02:54:30.655, when it was -42.46 bps.
- At 02:54:32.475, 1.82 seconds later, the reverse quote value fell from 62,234,597 raw to 4 raw: -10,000 bps.
- Candidate spread samples remained 59-60 bps after entry; the last was 02:53:37.763. They did not capture a precursor.

Replay result: both the existing stop and proposed monitor first see the collapse on the same terminal quote. The realizable result remains approximately -10,000 bps. A two-consecutive-quote deterioration rule cannot improve it because the first below-stop quote is already effectively zero.

Therefore this monitor is **not implemented**. It sees the demonstrated collapse no earlier than the existing hard stop and would add strategy behavior without validated benefit.

## Required regressions for a later authorized implementation

1. Cross-profile two-stop lockout blocks NVpUDQ trade three and no other epoch-16 trade.
2. Null liquidity decline passes; 34.99% passes; 35.00% rejects.
3. Replay rejects the 36.77% DYpNiZ entry and reports the known blocked winner.
4. Reverse-quote spread alarm fires at 2x the profile admission limit.
5. Deterioration alarm requires consecutive valid quotes but does not delay the hard stop.
6. NVpUDQ replay honestly returns approximately -10,000 bps rather than a fabricated earlier exit.
