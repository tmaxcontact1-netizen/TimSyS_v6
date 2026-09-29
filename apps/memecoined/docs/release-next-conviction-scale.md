# Conviction Scale — dormant experimental profile

Status: implemented on `release-next-conviction`; inactive by default and not part of epoch 16.

## Controlled experiment

Conviction Scale uses the same entry pattern and exact 250-bps stop, 600-bps target, and ten-minute horizon as Fast & Furious. Position sizing is the sole experimental variable.

## Admission score

The score is calculated once at admission and every input and component is persisted:

| Component            | Weight | Normalization                                 |
| -------------------- | -----: | --------------------------------------------- |
| Entry depth          |     35 | absolute entry/reference distance, 20–100 bps |
| Effective spread     |     25 | best at 0 bps, zero points at 150 bps         |
| Buy pressure         |     20 | normalized from 45% to 100%                   |
| Token session record |     20 | normalized from -1,000 to +1,000 net bps      |

The normal profile parameter `minimumCandidateScore` is 60.

## Sizing invariant

The ordinary risk-sized amount is multiplied linearly from 0.5× at score 0 to 1.5× at score 100. The final amount is always the minimum of available cash, scaled risk size, and the profile's absolute position cap. No score can override the cap.

## Activation boundary

The profile ships disabled, in observe mode, with zero allocation. The dashboard labels it `Inactive — experimental` and does not offer in-window activation. It is intended for a deliberate fresh validation epoch only after 200+ closed trades exist for score calibration.
