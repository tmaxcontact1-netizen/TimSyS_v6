# Memecoined Strategy Specification

**Status:** Proposed for approval  
**Version:** 1.0.0  
**Date:** 2026-08-03  
**Strategy ID:** `strategy-v1.0.0`  
**Strategy:** Solana smart-wallet-confirmed momentum

## 1. Rule semantics

- All listed entry gates are conjunctive unless explicitly stated otherwise.
- Inclusive boundaries use `>=`/`<=`; ranges include both endpoints.
- An absolute rejection overrides score, wallet confirmation, operator approval, or operating mode.
- Missing, stale, contradictory, or unverifiable required evidence produces rejection, never a pass.
- Market-cap references mean circulating market capitalisation. FDV is separately named.
- Price, stop, target, trailing, and exit calculations use fresh executable Jupiter quotes, never displayed chart prices.
- Time windows end at evaluation time and exclude future information.
- Canonical identity is the Solana mint address.

## 2. Universe and portfolio rules

| Rule ID | Rule |
|---|---|
| `UNI-001` | Solana only; quote asset SOL only. |
| `UNI-002` | Pool age must be 30 minutes through 30 days inclusive. |
| `UNI-003` | Market capitalisation must be $250,000 through $20,000,000 inclusive. |
| `UNI-004` | Pool liquidity must be at least $75,000. |
| `UNI-005` | Maximum three concurrent open positions. |
| `UNI-006` | Maximum one non-closed position per mint. |
| `UNI-007` | Re-entry is prohibited until six hours after confirmed closure. |

## 3. Absolute rejection rules

| Rule ID | Reject when |
|---|---|
| `SEC-001` | Mint authority is active or unknown. |
| `SEC-002` | Freeze authority is active or unknown. |
| `SEC-003` | Token-2022 program is used. |
| `SEC-004` | Transfer fee, transfer hook, permanent delegate, pausable transfer, default-frozen account, or any unapproved extension exists or cannot be excluded. |
| `SEC-005` | Liquidity is below $75,000. |
| `SEC-006` | Pool age is below 30 minutes or above 30 days. |
| `SEC-007` | Market capitalisation is below $250,000 or above $20,000,000. |
| `SEC-008` | Top 10 normal holders exceed 35% of circulating supply after recognized pool/burn exclusions. |
| `SEC-009` | Developer and related wallets exceed 10% combined. |
| `SEC-010` | Largest normal holder exceeds 8%. |
| `SEC-011` | Liquidity has fallen by at least 15% during the preceding 15 minutes. |
| `SEC-012` | Five-minute sell transaction count exceeds buy transaction count. |
| `SEC-013` | A current executable full-position sell quote is unavailable. |
| `SEC-014` | Estimated full-position sell price impact exceeds 3%. |
| `SEC-015` | Required token data cannot be verified directly on-chain. |
| `SEC-016` | Mint, developer, funder, or related wallet is on an operator-approved blacklist. |
| `SEC-017` | Developer, funder, or related wallet is linked with sufficient evidence to a previously blacklisted token. |

## 4. Trusted-wallet qualification

Eligible tracked wallets require at least 30 completed historical trades, positive total realised profit, at least 60% of analysed trades with verifiable entry and exit, median holding period from five minutes through 24 hours, maximum historical drawdown no more than 35%, and no disqualifying manipulation evidence.

| Rule ID | Rule |
|---|---|
| `WAL-001` | Base eligibility: >=30 completed trades, win rate >=55%, profit factor >=1.5, median return >8%. |
| `WAL-002` | Tier A: >=100 completed trades, win rate >=60%, profit factor >=2.0. |
| `WAL-003` | Tier B: >=50 completed trades, win rate >=57%, profit factor >=1.7. |
| `WAL-004` | Tier C: base eligible but below Tier B; research only. |
| `WAL-005` | Disqualify evidence of self-trading, circular transfers, bundling, developer funding, or repeated provision of exit liquidity. |
| `WAL-006` | Confirmation requires one Tier A purchase or two independent Tier B purchases. |
| `WAL-007` | Two Tier B wallets are independent only if no 90-day transfers, common funder, repeated same-block coordination, or developer/deployer identity is found. |
| `WAL-008` | Confirming purchases must occur no more than 15 minutes apart. |
| `WAL-009` | Each confirming purchase must be within the preceding 10 minutes and at least 70% unsold. |
| `WAL-010` | Each qualifying purchase must equal at least the lower of $500 or 0.25% of pool liquidity. |
| `WAL-011` | Current executable entry price must not exceed the wallet’s entry price by more than 20%. |

## 5. Momentum gates

| Rule ID | Required condition |
|---|---|
| `MOM-001` | Five-minute price change is +3% through +18%. |
| `MOM-002` | One-hour price change is +8% through +60%. |
| `MOM-003` | Five-minute volume is at least $20,000. |
| `MOM-004` | Five-minute volume is at least 20% of the preceding one-hour volume, with the one-hour window excluding the current five minutes. |
| `MOM-005` | Five-minute buy/sell transaction-count ratio is at least 1.3; zero sells passes only if there are at least 25 unique buyers and no rejection applies. |
| `MOM-006` | At least 25 unique buyers in five minutes. |
| `MOM-007` | No wallet supplies more than 20% of five-minute buy volume. |
| `MOM-008` | Current executable price is no more than 12% below the five-minute executable high. |
| `MOM-009` | Current executable price is no more than 20% above confirming wallets’ purchase-volume-weighted entry. |
| `MOM-010` | Liquidity is stable or increasing over the preceding 15 minutes; stable means decline below 1%. |

## 6. Entry score

Eligibility requires at least 75 points. Maximum is 95. Exactly one band per component applies.

| Rule ID | Component | Condition | Points |
|---|---|---|---:|
| `SCR-001` | Wallet | Tier A confirmation | 30 |
| `SCR-002` | Wallet | Two Tier B confirmations | 25 |
| `SCR-003` | Liquidity | >=$250,000 | 20 |
| `SCR-004` | Liquidity | $150,000–$249,999.999… | 15 |
| `SCR-005` | Liquidity | $75,000–$149,999.999… | 10 |
| `SCR-006` | Momentum | Five-minute change +5% through +12% | 20 |
| `SCR-007` | Momentum | +3% to below +5%, or above +12% through +18% | 12 |
| `SCR-008` | Holders | Top 10 below 25% | 15 |
| `SCR-009` | Holders | 25% through 35% | 8 |
| `SCR-010` | Volume quality | Buy/sell ratio >=1.8 | 10 |
| `SCR-011` | Volume quality | Ratio >=1.3 and <1.8 | 5 |
| `SCR-012` | Eligibility | Total score must be >=75 after all absolute gates pass. | — |

## 7. Position sizing and exposure

| Rule ID | Rule |
|---|---|
| `RSK-001` | Permitted loss per trade is 0.5% of current dedicated-wallet equity. |
| `RSK-002` | Initial hard-stop distance is 15%. |
| `RSK-003` | Risk-derived size equals permitted loss divided by 15%, normally 3.333333…% of equity. |
| `RSK-004` | Position size is the minimum of risk-derived size, 5% equity, liquidity/price-impact capacity, and remaining exposure capacity. |
| `RSK-005` | Combined open cost exposure must not exceed 10% of equity. |
| `RSK-006` | At least 50% of equity must remain as uncommitted SOL after entry and estimated costs. |
| `RSK-007` | No leverage, borrowing, averaging down, or increase to a losing position. |

Equity uses reconciled balances valued by executable liquidation quotes. If equity cannot be established, no entry is permitted.

## 8. Entry execution gate

| Rule ID | Required condition |
|---|---|
| `ENT-001` | Fresh Jupiter executable quote no older than two seconds at approval and again at signing. |
| `ENT-002` | Entry price impact <=2%. |
| `ENT-003` | Slippage tolerance fixed at 150 basis points. |
| `ENT-004` | Reverse quote covers 100% of expected token output and has price impact <=3%. |
| `ENT-005` | Expected round-trip loss before market movement <=5%. |
| `ENT-006` | Priority fee, tip, and network cost combined <=1% of position value. |
| `ENT-007` | Transaction simulation succeeds against the current block context. |
| `ENT-008` | Exposure and all security rules are recalculated after the final quote. |
| `ENT-009` | Supervised approval expires 15 seconds after issue and is invalid if the eligibility hash changes. |
| `ENT-010` | Any expiry, quote change, failed simulation, or failed submission requires a new quote and gate evaluation. |

## 9. Successful entry

| Rule ID | Required condition |
|---|---|
| `EXE-001` | Transaction has confirmed status and no on-chain error. |
| `EXE-002` | Reconciled token balance increased and SOL balance decreased. |
| `EXE-003` | Actual token quantity, SOL expenditure, fees, and tips are known. |
| `EXE-004` | Realised entry price is calculated from balance changes. |
| `EXE-005` | Actual received amount is not below the transaction’s minimum output. |
| `EXE-006` | A signature without these facts is not a successful entry. |

## 10. Standard exits

Percentages apply to the remaining reconciled token quantity at evaluation unless stated as a tranche of original quantity.

| Rule ID | Trigger | Action |
|---|---|---|
| `EXT-001` | Executable value reaches 15% below realised cost basis before partial exits | Sell 100% remaining |
| `EXT-002` | Executable return reaches +25% | Sell 40% of original quantity once |
| `EXT-003` | Executable return reaches +50% | Sell 30% of original quantity once |
| `EXT-004` | After first profit target, executable value falls 15% from highest recorded executable value | Sell 100% remaining |
| `EXT-005` | Six hours after confirmed entry and executable return remains below +10% | Sell 100% remaining |
| `EXT-006` | 24 hours after confirmed entry | Sell 100% remaining |

If several triggers occur together, emergency exit wins; then full standard exit; then the highest unsatisfied profit target. Partial fills are reconciled and remaining rules continue against actual quantity.

## 11. Emergency exits

| Rule ID | Trigger |
|---|---|
| `EMG-001` | Liquidity falls at least 20% within 10 minutes. |
| `EMG-002` | Liquidity falls below $50,000. |
| `EMG-003` | Developer/related wallets sell at least 10% of their combined holdings within 15 minutes. |
| `EMG-004` | Originating Tier A wallet sells at least 50% of its confirmed position. |
| `EMG-005` | Both confirming Tier B wallets each sell at least 30% of their confirmed positions. |
| `EMG-006` | A dangerous authority, program, extension, or blacklisted relationship is newly detected. |
| `EMG-007` | Full-position sell price impact exceeds 8% and worsens on three consecutive quotes. |
| `EMG-008` | Unexplained token or SOL balance discrepancy is detected. |
| `EMG-009` | Required market data is unavailable for 60 seconds while a position is open. |
| `EMG-010` | Primary/Helius and independent fallback chain access are both unavailable for 30 seconds. |

Emergency action is a full exit request. It bypasses profit/timing rules but still requires a fresh valid quote, valid signed transaction, and on-chain confirmation. If execution is impossible, retry rules and critical alerts apply.

## 12. Failed-exit handling

| Rule ID | Rule |
|---|---|
| `RET-001` | First failure: refresh blockhash, quote, and priority-fee estimate; resubmit. |
| `RET-002` | Second failure: raise priority by one approved tier; rebuild and resubmit. |
| `RET-003` | Third failure: use independent fallback RPC submission. |
| `RET-004` | No more than three seconds between the first five automatic attempts. |
| `RET-005` | After five failures, retry every 10 seconds and issue critical Telegram alerts until confirmed, operator intervention, or the chain makes the asset unavailable. |
| `RET-006` | Never mark closed until reconciled on-chain balances prove closure. |

## 13. Circuit breakers

| Rule ID | Block new entries when |
|---|---|
| `CBR-001` | Daily realised loss reaches 2% of UTC-day starting equity. |
| `CBR-002` | Daily realised plus executable unrealised loss reaches 3%. |
| `CBR-003` | Rolling seven-day drawdown reaches 6%. |
| `CBR-004` | Drawdown from wallet high-water mark reaches 8%. |
| `CBR-005` | Three consecutive closed losing trades occur. |
| `CBR-006` | Two reconciliation failures occur within rolling 24 hours. |
| `CBR-007` | Any unauthorized transaction is detected. |
| `CBR-008` | Required authoritative sources disagree materially for more than 60 seconds. |

Positions remain monitored and protective exits remain enabled. `RESUME` cannot clear security, reconciliation, unauthorized-transaction, or drawdown locks.

## 14. Operating modes and promotion

| Mode | Entry capability | Minimum promotion evidence |
|---|---|---|
| Historical | Event replay only | 500 qualifying signals; positive net expectancy; profit factor >=1.3; max drawdown <=10% |
| Observation | Signals/rejections only | 14 consecutive days; >=100 signals; no unresolved identity/order failures |
| Shadow | Real quotes/simulation; no positions | 100 complete quoted round trips |
| Paper | Simulated accounting using live quotes | 200 closed trades over >=30 days; positive expectancy; PF >=1.3; drawdown <=10%; >=98% complete records; zero false closures |
| Supervised live | Human-approved entry; automatic protective exit | 50 closed low-value trades; no unauthorized or false state; costs within assumptions |
| Limited auto | Restricted automatic entry | 100 automated live trades; positive expectancy; no unresolved reconciliation or exposure breach |
| Full auto | Approved automatic execution | 250 total live trades; positive expectancy; proven recovery, emergency liquidation, security, runbook, and restore |

Promotion is a recorded operator decision after generated evidence passes every gate. It never occurs automatically.

## 15. Telegram controls

Permitted commands are `STATUS`, `POSITIONS`, `CANDIDATES`, `APPROVE`, `REJECT`, `PAUSE`, `RESUME`, `CLOSE`, `CLOSE_ALL`, and `EMERGENCY_STOP`. Only allowlisted users/chats are accepted. Mutating commands require an expiring nonce and are idempotent. Telegram never stores or displays private keys.

## 16. Version control of rules

Every evaluation stores strategy version, permanent rule ID, actual value, threshold, unit, evidence, and time. Numerical change creates a new strategy version; historical records are never recalculated in place. Rule IDs are never reused for a different meaning. Removed rules remain reserved.

## 17. Approval gate

Approval locks `strategy-v1.0.0`. It does not authorize live trading. Repository creation and dependency installation become eligible only after `SYSTEM_SCHEMA.md`, this document, and `CHANGELOG.md` are approved and the operator explicitly authorizes initialization.

## Revision history

| Version | Date | Change | Reason |
|---|---|---|---|
| 1.0.0 | 2026-08-03 | Converted the approved numerical workflow into permanent deterministic rules and resolved boundary semantics | Complete the pre-code strategy gate |
