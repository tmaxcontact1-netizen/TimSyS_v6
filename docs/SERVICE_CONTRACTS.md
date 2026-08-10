# Memecoined — External Service Contracts

**Document:** `SERVICE_CONTRACTS.md`  
**Status:** Proposed for approval  
**Version:** 1.0.0  
**Verified:** 2026-08-03  
**Scope:** Solana mainnet, read-only through paper-trading stages; supervised live execution only after promotion gates pass.

## 1. Contract rules

1. The canonical token identifier is the Solana mint address. Symbols and names are display data only.
2. Direct Solana account and transaction data are authoritative for token properties, balances, transaction status and reconciliation.
3. Jupiter executable quotes are authoritative only for immediately obtainable swap estimates. Displayed market prices never establish entry or exit value.
4. Helius is the primary Solana infrastructure provider, not the source of trading decisions.
5. DexScreener, GMGN, Birdeye and Telegram-channel data are untrusted discovery or secondary evidence.
6. Provider data is normalized before it reaches strategy logic. Strategy logic never consumes a provider-native response.
7. Every external observation records provider, endpoint or method, request time, response time, source timestamp, normalized timestamp and raw-response reference.
8. Missing, stale, malformed, rate-limited or contradictory data cannot be converted into a positive signal.
9. A provider failure may block new entries. It must never fabricate a position, balance, fill or successful exit.
10. Secrets are supplied at runtime only. They must not appear in source control, databases, logs, Telegram, fixtures or reports.

## 2. Approved service topology

| Service              | Approved role                                                                               | Authority level                                          | Required stage                       | Core dependency                               |
| -------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ | --------------------------------------------- |
| Solana JSON-RPC      | Account state, transaction simulation, balances, blockhashes, signatures and reconciliation | Authoritative                                            | All live-data stages                 | Yes                                           |
| Solana WebSocket     | Account, log and signature change notification                                              | Notification only; RPC confirms state                    | Live observation onward              | Yes                                           |
| Helius RPC/WebSocket | Primary hosted Solana transport and enhanced wallet monitoring                              | Authoritative only when returning canonical chain state  | Live observation onward              | Yes                                           |
| Helius Sender        | Primary live transaction submission                                                         | Submission only; confirmation and balances prove outcome | Human-approved live onward           | Yes for live trading                          |
| Jupiter              | Executable swap quote, route and transaction construction                                   | Authoritative for its own current quote only             | Shadow trading onward                | Yes                                           |
| DexScreener          | Token/pair discovery and public market context                                              | Secondary                                                | Live observation onward              | Yes for initial discovery                     |
| GMGN                 | Manual wallet discovery and optional candidate intelligence                                 | Untrusted/secondary                                      | Research and optional live discovery | No                                            |
| Birdeye              | Optional price, market and security cross-check                                             | Secondary/fallback                                       | Optional                             | No                                            |
| Telegram Bot API     | Alerts, approvals and emergency operator commands                                           | Authoritative only for authenticated operator intent     | Paper trading onward                 | No for strategy; required for supervised live |
| Telegram channels    | Candidate discovery                                                                         | Untrusted                                                | Optional                             | No                                            |

## 3. Solana JSON-RPC and WebSocket

### 3.1 Required interfaces

The system requires standard Solana JSON-RPC methods sufficient to:

- Fetch mint accounts, token accounts and native SOL balances.
- Identify the owning token program.
- Decode mint authority, freeze authority, supply and decimals.
- Decode Token-2022 extensions when encountered and reject the token.
- Fetch recent blockhashes.
- Simulate constructed transactions.
- Submit through the fallback RPC route.
- Query signature status and full confirmed transaction data.
- Reconcile pre- and post-transaction token and SOL balances.

Required WebSocket methods:

- `accountSubscribe` for watched account changes.
- `logsSubscribe` or provider-enhanced transaction filtering for tracked-wallet activity.
- `signatureSubscribe` for low-latency transaction-status notification.
- `programSubscribe` only where a narrowly filtered subscription is viable.

Solana WebSockets use JSON-RPC 2.0 over a persistent `wss://` connection. Notifications contain subscription identifiers and slot context. [Solana WebSocket reference](https://solana.com/docs/rpc/websocket)

### 3.2 Authentication and environment

- Authentication is provider-specific and must be injected through runtime environment variables.
- Mainnet and devnet endpoints must be separate configuration values.
- Public community RPC endpoints are prohibited for production execution.
- A second independent Solana RPC provider is mandatory before live trading.

### 3.3 Data acceptance

- Trading decisions use `confirmed` commitment for current state unless a rule explicitly requires finalized evidence.
- `processed` events may trigger collection but cannot prove a trade or balance change.
- Every WebSocket event must be confirmed through HTTP RPC before it changes durable position state.
- Binary account data that fails exact program-aware decoding is rejected; `jsonParsed` output is not assumed to cover every program or extension.

### 3.4 Failure contract

- WebSocket disconnect: mark streaming degraded, reconnect with bounded exponential backoff and reconcile all tracked accounts.
- Missed-slot or event-gap detection: suspend affected signals and backfill through HTTP RPC.
- Primary RPC timeout or invalid response: retry only idempotent reads, then route to the fallback provider.
- Primary and fallback disagreement: block new entries until a later common observation resolves the disagreement.
- No transaction is marked successful from `sendTransaction`, a signature notification or provider acknowledgement alone.

## 4. Helius

### 4.1 Approved interfaces

- Standard Solana HTTP RPC.
- Standard and enhanced WebSockets.
- `transactionSubscribe` for explicitly tracked wallet/account filters.
- Priority Fee API using the serialized transaction where available.
- Sender for supervised live submission.
- Enhanced transaction parsing may enrich audit data but cannot replace raw transaction and balance reconciliation.

Helius serves standard and enhanced WebSockets from its mainnet and devnet endpoints. Enhanced `transactionSubscribe` can filter included, excluded and required accounts; account lists can contain up to 50,000 addresses. Connections have a documented 10-minute inactivity timer, so the client must send a health ping at least once per minute. [Helius WebSocket overview](https://www.helius.dev/docs/rpc/websocket), [transactionSubscribe](https://www.helius.dev/docs/api-reference/rpc/websocket/transactionsubscribe)

### 4.2 Authentication

- Runtime secret: `HELIUS_API_KEY`.
- The key is passed only to Helius HTTPS/WSS endpoints.
- Separate keys are required for development and production.
- Production-key rotation must not require a build or source change.

### 4.3 Limits and costs

- Plan limits are configuration, not hard-coded assumptions.
- Current documented base limits range from 10 RPC requests/second on Free to 500/second on Professional; enhanced API limits are separate.
- Sender has a documented default limit of 50 transactions/second and consumes no API credits.
- Standard/enhanced WebSocket traffic is credit-metered; enhanced filtered methods require a paid plan.
- Sender Max currently requires a minimum 0.001 SOL tip; SWQOS-only requires 0.000005 SOL. Every Sender transaction also requires a priority fee. [Helius rate limits](https://www.helius.dev/docs/billing/rate-limits), [Helius Sender](https://www.helius.dev/docs/sending-transactions/sender)

### 4.4 Submission contract

- Primary live route: Helius Sender with MEV protection enabled where compatible.
- Cost-controlled route: SWQOS-only may be used when its measured landing performance satisfies the execution SLA.
- Priority fee is calculated from the final serialized transaction through the Priority Fee API.
- Tip plus priority fee plus network cost must satisfy Strategy Specification v1.0 before signing.
- A fresh blockhash and rebuilt Jupiter transaction are required after expiry.
- The system signs locally. Helius never receives the private key.

### 4.5 Failure contract

- HTTP `429`: obey rate-limit response metadata where present; otherwise apply bounded exponential backoff with jitter.
- WebSocket inactivity/disconnect: reconnect, resubscribe and reconcile.
- Sender acknowledgement without confirmed balance changes: keep the order pending.
- Sender failure: rebuild with a fresh quote/blockhash; use the approved retry sequence; fall back to the independent RPC submission route only after the specified threshold.
- Helius and fallback unavailable simultaneously: block entries and initiate the open-position data-loss safety workflow.

## 5. Jupiter

### 5.1 Approved interfaces

Jupiter is used for:

- Exact-input SOL-to-token entry quotes.
- Exact-input token-to-SOL exit and reverse quotes.
- Route plans and price-impact estimates.
- Swap transaction or swap-instruction construction.
- Token metadata only as non-authoritative enrichment.

The implementation must use the currently supported Jupiter API family confirmed during dependency implementation. Legacy and current APIs must not be mixed in one adapter.

### 5.2 Authentication, limits and cost

- Runtime secret: `JUPITER_API_KEY` when required by the selected production endpoint.
- Rate limits are plan-specific and must be represented as deployment configuration.
- Jupiter platform or integrator fees are prohibited unless explicitly recorded in the quote and approved in the execution-cost gate.
- A provider plan change or endpoint deprecation blocks deployment until contract fixtures are recaptured.

### 5.3 Quote acceptance

A quote is accepted only when it contains and passes validation for:

- Requested input mint, output mint and raw integer amount.
- Expected raw output amount.
- Minimum output or sufficient data to derive it exactly.
- Slippage basis points.
- Price-impact estimate.
- Route plan.
- Context slot or equivalent observation context where supplied.
- Quote request and receipt timestamps.

Additional rules:

- Quote age must meet the Strategy Specification at approval and again at signing.
- Entry uses a reverse quote for the expected received quantity.
- Exit rules use executable token-to-SOL quotes, never chart price.
- A missing route, zero output, mismatched mint, excessive impact or unrecognized amount format rejects the quote.
- Values are parsed as decimal-safe integers/decimals; JavaScript floating point is prohibited for financial amounts.

### 5.4 Transaction-construction contract

- Construction input must match the accepted quote exactly.
- The configured trading-wallet public key must be the transaction user.
- Dynamic compute configuration may be accepted only when bounded and auditable.
- The adapter must inspect returned instructions/transaction before signing.
- Unknown signers, unexpected asset transfers, unexpected fee recipients or unauthorized programs reject the transaction.
- Simulation must succeed against the intended RPC environment.

### 5.5 Failure contract

- `4xx` validation failure: do not retry unchanged input.
- `429` or transient `5xx`: bounded retry inside quote-expiry limits.
- Expired quote or blockhash: request a new quote and reconstruct; never patch the old transaction.
- Jupiter unavailable: no new entries. Existing positions remain monitored and produce critical exit-route alerts; the first release has no alternate swap constructor.

Official reference: [Jupiter Developer Documentation](https://dev.jup.ag/)

## 6. DexScreener

### 6.1 Approved interfaces and use

- Pair lookup by chain and pair address.
- Token-pair lookup by Solana mint.
- Token profiles/boosts only as discovery metadata.
- Pair liquidity, volume, transaction counts, price change, FDV and creation time as secondary market observations.

DexScreener documents 300 requests/minute for pair/token-pair endpoints and 60 requests/minute for profile/boost/order endpoints. [DexScreener API reference](https://docs.dexscreener.com/api/reference)

### 6.2 Authentication and cost

- Current public API use requires no project secret for approved endpoints.
- The adapter must support future key/configuration requirements without changing strategy code.
- Paid boosts and promotional status never add strategy score.

### 6.3 Data acceptance

- `chainId` must identify Solana.
- The base or quote token address must match the canonical mint being evaluated.
- Pair address, DEX identifier and pair creation time are recorded.
- The selected primary pool must be chosen by a deterministic internal rule; the first search result is never assumed to be primary.
- Liquidity, FDV and market-cap fields are nullable secondary estimates.
- Source timestamps and local receipt timestamps are required for freshness evaluation.

### 6.4 Failure contract

- `429`: stop the affected discovery lane and honor backoff.
- Missing token/pair: record `NOT_INDEXED`; do not infer zero liquidity or zero volume.
- Contradictory pools or malformed fields: block qualification pending on-chain/Jupiter resolution.
- DexScreener outage: pause DexScreener-originated discovery; Helius tracked-wallet discoveries may continue only if all mandatory market evidence is independently available.

## 7. GMGN

### 7.1 Approved role

GMGN is approved for:

- Manual identification of wallets worth researching.
- Manual token and wallet context.
- Optional candidate discovery after formal API access is obtained.

GMGN is not approved for:

- Core execution.
- Authoritative wallet performance.
- Final price, liquidity, holder or security decisions.
- Authentication through scraped browser sessions.
- Undocumented endpoints, reverse-engineered APIs or automation that violates provider terms.

### 7.2 Interface and access constraint

- Only documented Cooperation APIs may be integrated.
- Trading API integration requires provider cooperation/API access.
- The documented Solana trading API limit is one call per five seconds per API key.
- The documented data-crawling whitelist defaults to one request per second.
- Because access, eligibility and limits are unsuitable for the core real-time path, GMGN remains an optional adapter. [GMGN Solana Trading API](https://docs.gmgn.ai/index/cooperation-api-integrate-gmgn-solana-trading-api), [GMGN data-crawling whitelist](https://docs.gmgn.ai/index/cooperation-api-data-crawling-ip-whitelist)

### 7.3 Data acceptance and failure

- Every wallet and token obtained from GMGN is independently reconstructed from Solana data.
- GMGN labels, PnL and win rate are hints, not trusted values.
- Unavailable access, schema drift, throttling or disagreement cannot block core on-chain monitoring and cannot create a positive signal.
- No API access at implementation time means the GMGN adapter is omitted without changing the core system.

## 8. Birdeye

### 8.1 Approved role

- Optional price/liquidity cross-check.
- Optional historical market-data source for research.
- Optional security/holder enrichment where the selected plan exposes it.
- Never the sole evidence for a trade or position state.

### 8.2 Authentication and limits

- Runtime secret: `BIRDEYE_API_KEY`.
- Requests use `X-API-KEY` and an explicit Solana chain header where required.
- Endpoint availability and rate limits vary by paid package.
- Wallet APIs have stricter documented limits than general market endpoints; the deployed plan must be recorded before enabling the adapter. [Birdeye rate limiting](https://docs.birdeye.so/docs/rate-limiting), [Birdeye data accessibility](https://docs.birdeye.so/docs/data-accessibility-by-packages)

### 8.3 Data acceptance and failure

- Address must equal the canonical mint.
- Null or omitted price means unavailable, never zero.
- Provider timestamps and liquidity context are mandatory for freshness checks.
- `401/403`: disable the adapter and alert configuration failure.
- `429`: obey backoff and do not spill excess demand into retries.
- `5xx`, missing or stale data: mark unavailable; no positive strategy evidence is derived.
- Birdeye may be removed entirely without changing strategy or execution interfaces.

## 9. Telegram Bot API and channel ingestion

### 9.1 Bot role

The Telegram bot provides:

- Candidate and rejection alerts.
- Position and system-health alerts.
- Expiring human approval/rejection.
- Pause, resume, close and emergency-stop commands.

It does not:

- Store or receive private keys.
- Construct or sign swaps.
- Prove transaction success.
- Supply authoritative market data.
- Override locked circuit breakers.

### 9.2 Authentication and transport

- Runtime secret: `TELEGRAM_BOT_TOKEN`.
- Allowed operator and chat identifiers are runtime configuration, not user-supplied command arguments.
- Production uses one configured update mechanism: webhook or long polling, never both.
- Webhook deployment requires HTTPS and a secret-token check.
- Long polling must advance the update offset durably to prevent reprocessing after restart.
- The Bot API documents that `getUpdates` is unavailable while a webhook is configured. [Telegram Bot API](https://core.telegram.org/bots/api)

### 9.3 Command acceptance

A command is accepted only when:

- Sender user ID and chat ID are allowlisted.
- Bot identity and environment match.
- Update ID has not already been processed.
- Command syntax is exact.
- Referenced signal/position exists in the required state.
- Approval nonce matches and has not been used.
- Approval has not expired.
- The command is persisted before its effect is executed.

`RESUME` cannot clear a security, reconciliation, unauthorized-transaction or drawdown lock.

### 9.4 Channel ingestion

- Only explicitly configured public/private channels are read.
- Messages are immutable raw evidence plus parsed candidate hints.
- Mint addresses must be extracted and validated; tickers alone are ignored.
- Deleted/edited messages update provenance but do not erase prior evidence.
- Channel identity or popularity never increases the token’s strategy score in v1.

### 9.5 Failure contract

- Telegram outage: strategy monitoring and protective exits continue; new supervised entries are blocked because approval is unavailable.
- Duplicate update: return the previously recorded command result without repeating the side effect.
- Unauthorized/replayed/expired command: reject, audit and alert according to severity.
- Alert-delivery failure does not change trading state.

## 10. Provider-independent normalized contracts

These are required conceptual boundaries for the later schema; field types and implementation language remain unapproved until `SYSTEM_SCHEMA.md`.

| Contract                    | Required content                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `TokenIdentityObservation`  | Mint, program owner, decimals, authorities, extensions, slot, source                       |
| `BalanceObservation`        | Wallet, asset mint/native SOL, raw amount, slot, commitment, source                        |
| `TransactionObservation`    | Signature, slot, commitment, status, account/token balance deltas, fees                    |
| `MarketObservation`         | Mint, pool, price, liquidity, volume, transactions, source timestamps                      |
| `WalletActivityObservation` | Wallet, signature, mint, interpreted action, raw balance deltas, confidence                |
| `ExecutableQuote`           | Mints, raw amounts, minimum output, slippage, impact, route, timestamps                    |
| `ConstructedTransaction`    | Quote reference, blockhash/expiry, serialized payload hash, required signers, instructions |
| `SubmissionReceipt`         | Order reference, provider, attempt, signature, submission timestamp, acknowledgement only  |
| `OperatorCommand`           | Update ID, sender/chat, command, target, nonce, receipt/expiry, decision                   |
| `ProviderHealthObservation` | Provider, interface, state, latency, failure class, observation time                       |

## 11. Cross-provider decision matrix

| Decision                   | Required evidence                                    | Secondary evidence                  | Blocking condition                                         |
| -------------------------- | ---------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| Canonical token identity   | Solana mint account                                  | Jupiter/DexScreener metadata        | Mint account unavailable or undecodable                    |
| Token security             | Direct Solana program/account decoding               | Birdeye/Helius enrichment           | Any required check unavailable or unsafe                   |
| Tracked-wallet transaction | Raw confirmed Solana transaction and balance deltas  | Helius enhanced parsing, GMGN label | Cannot distinguish swap from transfer                      |
| Market qualification       | DexScreener plus executable Jupiter sellability      | Birdeye                             | Stale/conflicting data or no exit quote                    |
| Entry price/quantity       | Fresh Jupiter quote then confirmed balance deltas    | None                                | Quote expired, simulation failed or balances unconfirmed   |
| Exit value                 | Fresh Jupiter token-to-SOL quote                     | DexScreener/Birdeye context         | No valid route or excessive impact                         |
| Transaction success        | Confirmed Solana transaction and reconciled balances | Helius notification                 | Signature only or unexplained discrepancy                  |
| Operator approval          | Authenticated, unexpired Telegram command            | None                                | Unauthorized, duplicate conflict or locked circuit breaker |

## 12. Service-level operating thresholds

These thresholds are locked for the initial build unless the later schema identifies a direct contradiction with Strategy Specification v1.0.

| Condition                                                 | Required action                                                       |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| Jupiter quote older than 2 seconds at execution gate      | Reject and requote                                                    |
| Telegram approval older than 15 seconds                   | Expire and require new signal quote                                   |
| Helius WebSocket idle approaching 1 minute                | Send health ping                                                      |
| Market data unavailable for 60 seconds with open position | Trigger emergency-exit evaluation and critical alert                  |
| Primary and fallback RPC unavailable for 30 seconds       | Block entries and trigger critical open-position workflow             |
| Source disagreement lasting over 60 seconds               | Disable new entries                                                   |
| DexScreener/Birdeye/GMGN unavailable                      | Remove that source; never substitute invented/last-known current data |
| Telegram unavailable during supervised mode               | Block new entries; continue monitoring and protective exits           |

## 13. Required accounts and pre-implementation proofs

Before provider adapters are authored, the operator must confirm:

- Helius account, selected paid plan and separate development/production API keys.
- Independent fallback Solana RPC account and its published limits.
- Jupiter production API access and selected supported API family.
- Telegram bot token, operator user ID and permitted chat ID.
- Whether GMGN Cooperation API access has actually been granted.
- Whether Birdeye will be purchased; absence is acceptable.

Each enabled provider must pass a manual contract proof that records:

1. Authentication success without exposing the secret.
2. One valid response for every required endpoint/method.
3. One documented or safely induced error response.
4. Observed rate-limit headers/behaviour.
5. Exact response fixture with credentials and personal data removed.
6. Provider terms permitting the intended automated use.

## 14. Approval gate

`PROJECT_MAP.md` may be produced after this document is approved.

No provider adapter, database schema, dependency manifest or executable code is authorized by approval of this document alone.

## Revision history

| Version | Date       | Change                                          | Reason                                                           |
| ------- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| 1.0.0   | 2026-08-03 | Created complete service contracts from scratch | Establish viable external interfaces before architecture or code |

## Local dashboard mutation contract

- The dashboard binds only to `127.0.0.1` and exposes watchlist mutations separately from all trading authority.
- Mutation requests require `PAPER_DASHBOARD_MUTATION_TOKEN`, an exact same-origin header, JSON content type, and a body no larger than 16 KB.
- Trading-configuration CRUD uses the same local mutation boundary, wallet scope, optimistic version checks, bounded JSON body, and immutable audit semantics as watchlists.
- Configuration creation and update accept only explicit bounded integer fields and a versioned strategy identifier. Stored records are drafts and are not consumed by trading runtimes in this phase.
- Configuration deletion requires the expected version and exact current name. Authentication or validation failure occurs before database access.
- Names, UUIDs, Solana mints, expected versions, and destructive confirmations are validated before persistence.
- Create, rename, token membership changes, and deletion write immutable audit facts atomically with the mutation.
- Stale or duplicate changes fail closed; internal database errors are not returned to the browser.

## Guarded paper-control contract

- Paper controls use the dashboard mutation token, exact same-origin check, bounded JSON body, wallet scope, and immutable audit boundary.
- Entry cancellation requires the exact signal identifier and current job version. Only a planned entry with an available, unleased paper job can be cancelled.
- Full-position close requires exact mint confirmation and the exact observed open raw amount. A mismatch or duplicate pending request fails closed.
- Close requests are evaluated through the existing authoritative paper quote, simulated execution, and accounting path. Quote or accounting failure leaves the request pending for retry.
- These routes are available only in the paper dashboard composition and cannot sign, submit, activate a configuration, change mode, or reach live execution adapters.
