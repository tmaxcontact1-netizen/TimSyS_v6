# Memecoined System Schema

**Status:** Proposed for approval  
**Version:** 1.0.0  
**Date:** 2026-08-03  
**Scope:** Authoritative database, runtime contract, state-machine, error, logging, testing, and naming specification

## 1. Authority

This schema implements `SERVICE_CONTRACTS.md`, `PROJECT_MAP.md`, `DEPENDENCY_MANIFEST.md`, and `STRATEGY_SPECIFICATION.md`. Source code, migrations, configuration, fixtures, reports, and tests must conform to it. A schema change requires approval, downstream-impact review, and a changelog entry before implementation.

Precedence: safety invariants and on-chain facts; this schema; strategy rules; service contracts; project map; implementation.

## 2. Global data rules

- PostgreSQL 18.4, UTF-8, UTC, `scram-sha-256`.
- Extension: `pgcrypto` only, used for `gen_random_uuid()`.
- Primary keys: UUID v4 named `id` unless the table is immutable reference data.
- All timestamps: `timestamptz`, stored in UTC, named `*_at`.
- Solana addresses: validated base58 text, canonical case, never used as display labels.
- Signatures: validated base58 text and unique where final on-chain identity is required.
- Raw SOL/token amounts: `numeric(78,0)` atomic units; never floating point.
- Fiat, ratios, prices, percentages, fees, and calculated quantities: `numeric(38,18)` unless a narrower integer unit is explicitly defined.
- Basis points: integer named `*_bps`; durations: integer named `*_ms` or `*_seconds`.
- Provider payloads are retained only when sanitized and bounded. Secrets are never stored.
- Mutable rows carry `created_at`, `updated_at`, and integer `version` for optimistic concurrency.
- Append-only tables reject update/delete for the runtime role.
- Every provider-derived fact records provider, source timestamp, ingestion timestamp, freshness status, and evidence reference.
- Unknown data remains unknown. It is never converted to zero, false, success, or an estimated value.

## 3. Identifier types

| Type                                               | Representation                   | Rule                                                                            |
| -------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `TokenId`, `PoolId`, `WalletId`                    | UUID                             | Internal identity only                                                          |
| `MintAddress`, `WalletAddress`                     | branded string                   | Valid Solana address                                                            |
| `CandidateId`, `SignalId`, `OrderId`, `PositionId` | UUID                             | Globally unique                                                                 |
| `StrategyVersionId`                                | text                             | `strategy-vMAJOR.MINOR.PATCH`                                                   |
| `RuleId`                                           | text                             | Permanent ID from strategy specification                                        |
| `ProviderId`                                       | text enum                        | `solana_rpc`, `helius`, `jupiter`, `dexscreener`, `gmgn`, `birdeye`, `telegram` |
| `EvidenceId`, `AuditEventId`                       | UUID                             | Immutable reference                                                             |
| `SolanaSlot`                                       | decimal integer                  | Non-negative                                                                    |
| `RawAmount`                                        | decimal integer                  | Non-negative atomic units                                                       |
| `DecimalValue`                                     | decimal string/runtime `Decimal` | No JavaScript `number` for financial values                                     |

## 4. Enumerations

| Enum                 | Values                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `operating_mode`     | `historical`, `observation`, `shadow`, `paper`, `supervised_live`, `limited_auto`, `full_auto`                                       |
| `candidate_state`    | `discovered`, `normalizing`, `evaluating`, `rejected`, `eligible`, `approval_pending`, `expired`, `converted`                        |
| `signal_state`       | `created`, `approval_pending`, `approved`, `rejected`, `expired`, `order_created`, `cancelled`                                       |
| `order_side`         | `buy`, `sell`                                                                                                                        |
| `order_state`        | `planned`, `quoted`, `simulated`, `approved`, `signing`, `submitted`, `confirming`, `confirmed`, `reconciled`, `failed`, `cancelled` |
| `position_state`     | `pending_entry`, `open`, `partially_closed`, `exit_pending`, `closed`, `reconciliation_locked`                                       |
| `breaker_state`      | `clear`, `triggered`, `locked`, `cleared`                                                                                            |
| `evaluation_outcome` | `pass`, `fail`, `unknown`, `not_applicable`                                                                                          |
| `severity`           | `debug`, `info`, `warn`, `error`, `fatal`                                                                                            |
| `health_state`       | `healthy`, `degraded`, `unavailable`, `recovering`                                                                                   |
| `command_state`      | `received`, `authenticated`, `rejected`, `accepted`, `executing`, `completed`, `failed`, `expired`                                   |

## 5. Database tables

### 5.1 Reference and intelligence

| Table                          | Required columns                                                                                                                                           | Constraints and purpose                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `strategy_versions`            | `id`, `content_hash`, `status`, `effective_at`, `created_at`                                                                                               | Immutable approved strategy versions; one active version per mode |
| `strategy_rules`               | `strategy_version_id`, `rule_id`, `category`, `description`, `parameters_json`                                                                             | Composite PK; every evaluation cites one row                      |
| `providers`                    | `id`, `role`, `authoritative_for_json`, `enabled_modes_json`                                                                                               | Immutable provider authority registry                             |
| `tokens`                       | `id`, `mint_address`, `token_program`, `decimals`, `first_seen_at`, `created_at`, `updated_at`, `version`                                                  | Unique mint address                                               |
| `pools`                        | `id`, `pool_address`, `token_id`, `quote_mint_address`, `venue`, `created_slot`, `created_at_chain`, timestamps/version                                    | Unique pool address; SOL quote only in v1                         |
| `wallets`                      | `id`, `address`, `classification`, `confidence`, `blacklisted_at`, timestamps/version                                                                      | Unique address                                                    |
| `wallet_relationships`         | `id`, `wallet_id`, `related_wallet_id`, `relationship_type`, `confidence`, `evidence_id`, `valid_from`, `valid_to`                                         | No self-edge; canonical ordered uniqueness                        |
| `wallet_trades`                | `id`, `wallet_id`, `token_id`, `entry_signature`, `exit_signature`, raw quantities, realised values, `opened_at`, `closed_at`, `confidence`, `evidence_id` | Completed trade requires verifiable entry and exit                |
| `wallet_performance_snapshots` | `id`, `wallet_id`, `as_of`, counts, win rate, profit factor, median return, drawdown, holding period, `tier`, `evidence_id`                                | Append-only                                                       |

### 5.2 Observations

| Table                                  | Required columns                                                                                                                               | Constraints and purpose                                                                |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `evidence`                             | `id`, `provider_id`, `evidence_type`, `source_key`, `source_observed_at`, `ingested_at`, `slot`, `content_hash`, `sanitized_payload_json`      | Append-only; unique provider/source/content tuple                                      |
| `market_snapshots`                     | `id`, `pool_id`, price, liquidity, market cap, FDV, volumes, buy/sell counts, unique buyers, high price, `observed_at`, `evidence_id`          | Append-only                                                                            |
| `token_security_snapshots`             | `id`, `token_id`, authorities, program/extensions, holder concentration, developer holdings, liquidity condition, `observed_at`, `evidence_id` | Append-only; unknown fields nullable                                                   |
| `balance_observations`                 | `id`, `wallet_id`, `mint_address`, `raw_amount`, `slot`, `commitment`, `observed_at`, `evidence_id`                                            | Append-only                                                                            |
| `chain_transactions`                   | `id`, `signature`, `slot`, `block_time`, `confirmation_status`, `err_json`, `fee_raw`, `evidence_id`                                           | Signature unique                                                                       |
| `wallet_activity_observations`         | `id`, `wallet_id`, `token_id`, `activity_type`, raw quantities, `signature`, `slot`, `observed_at`, `evidence_id`                              | Transfers and swaps remain distinct                                                    |
| `provider_health_events`               | `id`, `provider_id`, `previous_state`, `new_state`, `reason_code`, latency, `occurred_at`, `evidence_id`                                       | Append-only                                                                            |
| `position_runtime_contexts`            | `position_id`, `token_id`, `wallet`, `token_mint`, `settlement_mint`, `created_at`                                                             | Immutable identity binding used by live position collectors                            |
| `position_runtime_authority_snapshots` | `id`, `position_id`, `checkpoint_revision`, `phase`, `authority_kind`, `provider`, `source_key`, `observed_at`, `content_hash`, `payload_json` | One immutable wallet, security, or execution authority snapshot per revision and phase |

### 5.3 Decisions

| Table               | Required columns                                                                                                                           | Constraints and purpose                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `candidates`        | `id`, `token_id`, `active_dedup_key`, `state`, `first_seen_at`, `last_evaluated_at`, `strategy_version_id`, provenance, timestamps/version | One active candidate per mint/strategy window |
| `candidate_sources` | `id`, `candidate_id`, `provider_id`, `source_reference`, `observed_at`, `evidence_id`                                                      | Unique source reference                       |
| `rule_evaluations`  | `id`, `candidate_id`, `rule_id`, `outcome`, actual/threshold values, units, `evaluated_at`, evidence IDs, `evaluation_run_id`              | Append-only; unknown cannot pass              |
| `score_breakdowns`  | `id`, `candidate_id`, component scores, `total_score`, `evaluated_at`, `evaluation_run_id`                                                 | Append-only; maximum 95                       |
| `signals`           | `id`, `candidate_id`, `state`, `strategy_version_id`, `created_at`, `expires_at`, `eligibility_hash`, timestamps/version                   | Eligibility evidence immutable                |
| `rejections`        | `id`, `candidate_id`, `signal_id`, `rule_id`, `reason_code`, `rejected_at`, evidence IDs                                                   | At least one permanent rule ID                |
| `approval_requests` | `id`, `signal_id`, `nonce_hash`, `issued_at`, `expires_at`, `state`, `operator_command_id`, timestamps/version                             | Nonce never stored in plaintext               |

### 5.4 Trading and reconciliation

| Table                 | Required columns                                                                                                                                                          | Constraints and purpose                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `quotes`              | `id`, `provider_id`, `token_id`, `side`, raw input/output, minimum output, price impact, route JSON, `quoted_at`, `expires_at`, `request_hash`, `evidence_id`             | Append-only                                       |
| `simulations`         | `id`, `quote_id`, `succeeded`, units consumed, error code, `simulated_at`, `evidence_id`                                                                                  | Append-only                                       |
| `orders`              | `id`, `signal_id`, `position_id`, `side`, `state`, intended raw amount, quote ID, `mode`, idempotency key, timestamps/version                                             | Unique idempotency key                            |
| `submission_attempts` | `id`, `order_id`, `attempt_number`, route, blockhash, priority fee, tip, signature, result, error code, `submitted_at`, `confirmed_at`                                    | Unique order/attempt number; append-only          |
| `transactions`        | `id`, `order_id`, `signature`, `slot`, status, raw balance deltas, fee, tip, realised price, `confirmed_at`, `reconciled_at`                                              | Signature unique; success requires balance deltas |
| `positions`           | `id`, `token_id`, `entry_order_id`, `state`, raw opened/current amount, raw cost basis, realised P&L, peak executable value, `opened_at`, `closed_at`, timestamps/version | One non-closed position per mint                  |
| `position_lots`       | `id`, `position_id`, `source_transaction_id`, raw acquired/current amounts, raw cost, `opened_at`, `closed_at`                                                            | Quantities sum to position                        |
| `exit_decisions`      | `id`, `position_id`, `rule_id`, action percentage, executable quote ID, `decided_at`, evidence IDs                                                                        | Append-only                                       |
| `reconciliations`     | `id`, `scope`, expected JSON, observed JSON, status, discrepancy code, `started_at`, `completed_at`, evidence IDs                                                         | Unresolved discrepancy creates lock               |

### 5.5 Operations

| Table                    | Required columns                                                                                                                       | Constraints and purpose                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `portfolio_snapshots`    | `id`, `as_of`, starting/current/high-water equity, realised/unrealised P&L, exposure, open count                                       | Append-only                                                         |
| `circuit_breaker_events` | `id`, `rule_id`, `state`, trigger values, `triggered_at`, `cleared_at`, `cleared_by_command_id`                                        | Security/reconciliation/drawdown locks require authorized clearance |
| `operator_commands`      | `id`, Telegram identifiers hashed/redacted as required, command, arguments JSON, nonce hash, `state`, timestamps, result code          | Idempotent; append-only state history via audit                     |
| `jobs`                   | `id`, `job_type`, payload JSON, state, attempts, `available_at`, `lease_owner`, `lease_expires_at`, timestamps/version                 | PostgreSQL durable queue; unique idempotency key                    |
| `audit_events`           | `id`, `occurred_at`, `actor_type`, `actor_id`, `event_type`, `entity_type`, `entity_id`, `cause_id`, before/after hashes, details JSON | Append-only and tamper-evident hash chain per instance              |
| `system_locks`           | `id`, `lock_type`, `scope`, `reason_code`, `acquired_at`, `released_at`, owner                                                         | Unique active lock per type/scope                                   |

## 6. Relationships and invariants

- Candidate → signal → order → transaction → position is traceable without gaps.
- A position opens only after a confirmed transaction and reconciled token/SOL balance changes.
- A position closes only when its on-chain token balance attributable to the position is zero or explicitly reconciled as transferred by an authorized operator action.
- Quotes and simulations are immutable and never reused beyond expiry.
- A failed or unknown rule evaluation cannot create an eligible signal.
- Rejection rules override scores.
- Provider observations never overwrite one another; reconciliation determines authority.
- Every write that changes operational state occurs in one database transaction with its audit event and durable follow-up job.
- Private keys, API keys, bot tokens, plaintext nonces, and complete environment dumps are prohibited in every table.

## 7. Runtime structures

All external inputs are validated by Zod at the infrastructure boundary and mapped into readonly TypeScript structures. Domain structures are provider-neutral. Financial values use `Decimal` or branded atomic-unit strings. Dates cross boundaries as ISO-8601 UTC strings and become immutable instants inside the domain.

Required envelopes:

- `ObservationEnvelope`: provider, source ID, observed/ingested time, slot, freshness, evidence ID, normalized payload.
- `RuleEvaluation`: rule ID, outcome, actual value, threshold, unit, evidence IDs, evaluation time.
- `DomainEvent`: event ID, name, aggregate type/ID, aggregate version, occurred time, cause ID, payload.
- `OperatorCommand`: command ID, authenticated operator ID, command, arguments, nonce hash, received/expiry time.
- `ExecutionResult`: order ID, attempt, signature, confirmation, balance deltas, fees, reconciliation state.
- `Result<T,E>`: explicit success/error union; exceptions do not represent expected business rejection.

## 8. State machines

### Candidate

`discovered → normalizing → evaluating → rejected | eligible → approval_pending → expired | converted`

Reevaluation creates a new evaluation run. It does not rewrite previous results. `rejected` may return to `evaluating` only from a complete new evidence set and while no permanent blacklist applies.

### Order

`planned → quoted → simulated → approved → signing → submitted → confirming → confirmed → reconciled`

Any pre-submission state may become `cancelled`; execution states may become `failed`. A retry creates a submission attempt, not a new order, unless the quote or intended amount changes.

### Position

`pending_entry → open → partially_closed → exit_pending → partially_closed | closed`

Any active state may enter `reconciliation_locked`. Only successful reconciliation returns it to the correct chain-derived state.

### Circuit breaker

`clear → triggered → locked → cleared → clear`

Security, unauthorized-transaction, reconciliation, and drawdown locks cannot be cleared by ordinary `RESUME`.

## 9. Telegram command contracts

Commands are uppercase after parsing. Only allowlisted numeric user and chat IDs are accepted. Each mutating command uses an expiring nonce and idempotency key.

| Command          | Arguments           | Effect                                                  |
| ---------------- | ------------------- | ------------------------------------------------------- |
| `STATUS`         | none                | Read-only system/mode/health summary                    |
| `POSITIONS`      | none                | Read-only reconciled open positions                     |
| `CANDIDATES`     | none                | Read-only active candidates/signals                     |
| `APPROVE`        | `signal_id nonce`   | Approves one unexpired unchanged signal                 |
| `REJECT`         | `signal_id nonce`   | Rejects one pending signal                              |
| `PAUSE`          | `nonce`             | Blocks new entries                                      |
| `RESUME`         | `nonce`             | Clears operator pause only                              |
| `CLOSE`          | `position_id nonce` | Requests full protective exit                           |
| `CLOSE_ALL`      | `nonce`             | Requests exit for every open position                   |
| `EMERGENCY_STOP` | `nonce`             | Locks entries, expires approvals, initiates liquidation |

## 10. Error taxonomy

| Prefix       | Category                                      | Retry rule                                        |
| ------------ | --------------------------------------------- | ------------------------------------------------- |
| `VAL_`       | Input/schema validation                       | No retry without corrected input                  |
| `RULE_`      | Expected strategy rejection                   | No retry until new evidence                       |
| `STALE_`     | Expired/stale observation or quote            | Refresh then reevaluate                           |
| `PROVIDER_`  | Provider failure/rate limit/contract change   | Bounded retry; degrade/lock                       |
| `CHAIN_`     | RPC, confirmation, or on-chain failure        | Bounded route-aware retry                         |
| `EXEC_`      | Construction, signing, simulation, submission | Follow execution escalation                       |
| `DB_`        | Persistence/concurrency/migration             | Roll back; retry only classified transient errors |
| `RECON_`     | Expected/actual state mismatch                | Lock affected scope immediately                   |
| `AUTH_`      | Operator or secret authorization failure      | No retry; security audit                          |
| `CONFIG_`    | Missing/invalid configuration                 | Refuse startup                                    |
| `INVARIANT_` | Impossible internal state                     | Fatal; stop affected worker/mode                  |

Every error has code, safe message, severity, retryability, cause ID, entity context, and redacted structured details. Provider bodies and secrets are not included in messages.

## 11. Logging and audit

- Pino JSON logs to stdout; UTC timestamps; no unstructured console output.
- Required fields: time, level, event, instance ID, mode, correlation ID, cause ID, entity IDs, provider, error code.
- Redact authorization headers, URLs containing keys, database URLs, bot tokens, wallet secret paths where sensitive, transaction signing material, and environment values.
- Logs are operational and disposable; `audit_events` are durable and authoritative.
- Audit every state transition, rule result, approval, command, quote acceptance, signature request, submission, confirmation, balance reconciliation, breaker change, configuration/strategy activation, and migration.
- No token symbol or name substitutes for mint address in audit identity.

## 12. Testing contract

- Framework: Vitest 4.1.10; Testcontainers 12.0.4; PostgreSQL 18.4.
- Unit tests contain no network, clock, random, filesystem, or database access.
- Every numerical rule has below-boundary, exact-boundary, above-boundary, unknown, and malformed tests.
- Provider contract tests use sanitized immutable fixtures and verify rejection of contract drift.
- Integration tests start from an empty database, run all migrations, test transactions/concurrency, and destroy the database.
- Replay tests prove identical ordered events produce identical decisions and records.
- Recovery tests terminate processes at every operational transition and reconstruct state from PostgreSQL/on-chain fixtures.
- Reconciliation tests prove no false open or false closed classification.
- Failure injection covers timeouts, rate limits, malformed responses, stale quotes, reorg/commitment changes, duplicate messages, database serialization errors, and provider disagreement.
- Live tests are separately gated, use a dedicated low-value wallet, and never run through default test commands.
- Minimum coverage: 100% branch coverage for domain rules/state machines; 90% line and branch coverage overall. Coverage never replaces required scenario tests.

## 13. Naming conventions

- Directories/files: lowercase kebab-case; TypeScript source `.ts`; tests `.test.ts`.
- Variables/functions: `camelCase`; types/interfaces/classes: `PascalCase`; constants: `UPPER_SNAKE_CASE` only for true constants.
- Database: lowercase `snake_case`; tables plural; foreign keys `<entity>_id`; booleans start `is_`, `has_`, or `can_`.
- Functions use verb-first names. Predicates start `is`, `has`, `can`, or `should`.
- Ports end `Port`; adapters end `Adapter`; repositories end `Repository`; domain errors end `Error`.
- Events use past tense: `CandidateRejected`, `OrderSubmitted`, `PositionReconciled`.
- No abbreviations except SOL, RPC, HTTP, URL, ID, UTC, PnL in established type names. No provider name appears in domain symbols.
- One exported primary responsibility per file. Barrel files are prohibited.

## 14. Migration and change rules

- Migrations are sequential, transactional where PostgreSQL permits, and immutable after shared use.
- Every migration has forward verification and an explicit recovery procedure; destructive rollback is not assumed.
- Runtime role cannot alter schema or migration history.
- Schema hashes and active strategy version are recorded at startup.
- Any table, enum, state transition, command, error code, naming rule, or financial representation change requires approval and a mapped review of migrations, repositories, ports, services, tests, fixtures, configuration, reports, and operations documents.

## 15. Approval gate

Approval locks the data and behavioural contract. It authorizes creation and approval of the strategy specification and changelog. It does not by itself authorize repository initialization, package installation, database creation, source code, credentials, or live provider access.

## Revision history

| Version | Date       | Change                              | Reason                                   |
| ------- | ---------- | ----------------------------------- | ---------------------------------------- |
| 1.0.0   | 2026-08-03 | Created authoritative system schema | Complete the pre-code specification gate |
