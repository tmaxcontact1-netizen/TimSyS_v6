# Memecoined Project Map

**Status:** Approved  
**Version:** 1.1.0
**Date:** 2026-08-10
**Scope:** Complete planned repository inventory before dependency, schema, or code authorization

## 1. Architectural boundary

Memecoined will be one TypeScript application with a deterministic domain core, a PostgreSQL persistence layer, provider adapters, background workers, a Telegram operator interface, offline evaluation/reporting tools, and a local read-only paper-trading dashboard.

The repository will not contain:

- A remotely exposed, mutating, or live-execution web interface.
- Multiple deployable microservices.
- Provider-specific logic inside the domain core.
- Private keys, API keys, database contents, captured personal data, or unsanitized provider responses.
- GMGN execution code.
- Direct Raydium or Meteora swap construction in v1.

Runtime dependency direction is fixed:

`entrypoints/workers -> application -> domain`

`infrastructure -> application ports + domain contracts`

`domain -> no infrastructure or provider modules`

Cross-module imports that violate this direction are prohibited.

## 2. Top-level directory structure

| Path                  | Purpose                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/docs`               | Approved specifications, operating documentation, and generated references                                                                                 |
| `/config`             | Non-secret configuration templates and validation definitions                                                                                              |
| `/migrations`         | Ordered PostgreSQL schema migrations                                                                                                                       |
| `/src/domain`         | Deterministic strategy rules, financial calculations, entities, and state machines                                                                         |
| `/src/application`    | Use cases, orchestration, ports, and normalized provider-independent contracts                                                                             |
| `/src/infrastructure` | Database, provider, security, clock, logging, and reporting implementations                                                                                |
| `/src/entrypoints`    | Process composition and executable entrypoints                                                                                                             |
| `/src/workers`        | Scheduled and continuous runtime workflows                                                                                                                 |
| `/scripts`            | Operator-run maintenance and proof commands                                                                                                                |
| `/frontend`           | Dependency-free local paper dashboard assets, including responsive navigation, browser-local display and panel preferences, watchlist, and portfolio views |
| `/tests`              | Unit, contract, integration, replay, recovery, failure, and security tests                                                                                 |
| `/fixtures`           | Sanitized immutable test inputs                                                                                                                            |

## 3. Repository-root files

| File                       | Language                 | Purpose                                                                              | Imports                              | Imported by                          | External dependencies             |
| -------------------------- | ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------ | --------------------------------- |
| `/README.md`               | Markdown                 | Repository entrypoint, supported operating modes, setup sequence, and document index | Links to `/docs/*`                   | Operator/developer only              | None                              |
| `/package.json`            | JSON                     | Package identity, exact scripts, engines, and dependency declarations                | None                                 | Node.js and package manager          | Node.js; package manager          |
| `/package-lock.json`       | JSON                     | Reproducible dependency lock                                                         | `/package.json`                      | Package manager and CI               | npm                               |
| `/tsconfig.json`           | JSON                     | TypeScript compiler contract                                                         | None                                 | TypeScript, test runner, build tools | TypeScript                        |
| `/eslint.config.js`        | JavaScript               | Static-analysis and import-boundary rules                                            | `/tsconfig.json`                     | ESLint                               | ESLint; TypeScript ESLint plugins |
| `/.prettierrc.json`        | JSON                     | Formatting contract                                                                  | None                                 | Prettier                             | Prettier                          |
| `/.gitignore`              | Text                     | Excludes secrets, generated output, local state, logs, coverage, and dependencies    | None                                 | Git                                  | None                              |
| `/.env.example`            | dotenv template          | Documents required runtime variable names with inert placeholders                    | `/config/defaults.json` conceptually | Operator only                        | None                              |
| `/vitest.config.ts`        | TypeScript configuration | Test projects, timeouts, coverage, and fixture setup                                 | `/tsconfig.json`, `/tests/setup.ts`  | Vitest                               | Vitest                            |
| `/docker-compose.test.yml` | YAML                     | Disposable PostgreSQL environment for integration tests only                         | None                                 | Test scripts                         | Docker; PostgreSQL image          |

## 4. Specification and operating documents

The first two files already exist outside the future repository in the pre-code workspace and will be copied into `/docs` only when repository initialization is authorized.

| File                              | Language | Purpose                                                                                         | Imports                                                                | Imported by                                         | External dependencies |
| --------------------------------- | -------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- | --------------------- |
| `/docs/SERVICE_CONTRACTS.md`      | Markdown | Approved authority, acceptance, and failure contracts for external services                     | Official provider references                                           | Project map, schema, adapters, tests                | None                  |
| `/docs/PROJECT_MAP.md`            | Markdown | Authoritative inventory and dependency direction for every planned file                         | `/docs/SERVICE_CONTRACTS.md`; approved build plan                      | All later specifications and implementation reviews | None                  |
| `/docs/DEPENDENCY_MANIFEST.md`    | Markdown | Exact packages, versions, installation commands, runtimes, accounts, and manual proofs          | `/docs/PROJECT_MAP.md`; `/docs/SERVICE_CONTRACTS.md`                   | `/package.json`; setup validation                   | None                  |
| `/docs/SYSTEM_SCHEMA.md`          | Markdown | Tables, types, contracts, state machines, errors, logging, tests, and naming rules              | Approved strategy; service contracts; project map; dependency manifest | Migrations and all source modules                   | None                  |
| `/docs/STRATEGY_SPECIFICATION.md` | Markdown | Approved numerical strategy with permanent rule IDs and resolved boundaries                     | Strategy Specification v1.0; `/docs/SERVICE_CONTRACTS.md`              | Domain rules and rule tests                         | None                  |
| `/docs/CHANGELOG.md`              | Markdown | Records every repository file touch, reason, and approved change set                            | Git history and approved work                                          | Operator/developer only                             | None                  |
| `/docs/OPERATIONS_RUNBOOK.md`     | Markdown | Start, stop, pause, recovery, provider outage, key rotation, and incident procedures            | System schema; service contracts                                       | Operator only                                       | None                  |
| `/docs/PROMOTION_GATES.md`        | Markdown | Evidence required to move between observation, shadow, paper, and live modes                    | Strategy specification; generated reports                              | Operator and promotion evaluator                    | None                  |
| `/docs/SECURITY_MODEL.md`         | Markdown | Secret boundaries, threat model, wallet isolation, command authorization, and incident response | Service contracts; system schema                                       | Security tests and operator                         | None                  |

## 5. Configuration files

| File                                    | Language | Purpose                                                                                       | Imports                                        | Imported by                                                                   | External dependencies |
| --------------------------------------- | -------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- | --------------------- |
| `/config/defaults.json`                 | JSON     | Safe non-secret defaults for timeouts, freshness, retry ceilings, and disabled operating mode | None                                           | `/src/infrastructure/config/load-config.ts`                                   | None                  |
| `/config/providers.example.json`        | JSON     | Provider endpoint and plan-limit template without secrets                                     | None                                           | Operator; config loader in local development                                  | None                  |
| `/config/strategy-v1.json`              | JSON     | Machine-readable values corresponding exactly to approved strategy rule IDs                   | `/docs/STRATEGY_SPECIFICATION.md` conceptually | `/src/infrastructure/config/load-strategy.ts`; replay and runtime composition | None                  |
| `/config/wallet-watchlist.example.json` | JSON     | Input format for explicitly approved wallet candidates; contains no private keys              | `/docs/SYSTEM_SCHEMA.md` conceptually          | Wallet research import script                                                 | None                  |

## 6. Database migrations

Migrations are immutable after application to any shared environment. Corrections require a new numbered migration.

| File                                | Language | Purpose                                                                                          | Imports | Imported by          | External dependencies |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------ | ------- | -------------------- | --------------------- |
| `/migrations/0001_extensions.sql`   | SQL      | Required PostgreSQL extensions and database prerequisites                                        | None    | Migration runner     | PostgreSQL            |
| `/migrations/0002_reference.sql`    | SQL      | Strategy versions, rules, providers, tokens, pools, wallets, and wallet relationships            | `0001`  | Later migrations     | PostgreSQL            |
| `/migrations/0003_observations.sql` | SQL      | Raw/normalized market, balance, transaction, wallet-activity, and provider-health observations   | `0002`  | Later migrations     | PostgreSQL            |
| `/migrations/0004_decisions.sql`    | SQL      | Candidates, evaluations, scores, signals, rejections, and approval requests                      | `0003`  | Later migrations     | PostgreSQL            |
| `/migrations/0005_trading.sql`      | SQL      | Quotes, simulations, orders, attempts, transactions, positions, lots, exits, and reconciliations | `0004`  | Later migrations     | PostgreSQL            |
| `/migrations/0006_operations.sql`   | SQL      | Operator commands, circuit breakers, locks, jobs, audit events, and system health                | `0005`  | Runtime repositories | PostgreSQL            |
| `/migrations/0007_reporting.sql`    | SQL      | Read-only reporting views and promotion metrics                                                  | `0006`  | Reporting queries    | PostgreSQL            |

## 7. Domain foundation

Files in `/src/domain` may import only other domain files. They may not import Node.js I/O modules, database clients, provider SDKs, environment variables, or logging implementations.

| File                                  | Language   | Purpose                                                                                               | Imports                                                               | Imported by                                                  | External dependencies                 |
| ------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `/src/domain/shared/types.ts`         | TypeScript | Branded IDs, timestamps, slots, basis points, raw quantities, decimals, percentages, and result types | None                                                                  | All domain modules; application contracts                    | Decimal arithmetic library types only |
| `/src/domain/shared/errors.ts`        | TypeScript | Domain error codes and invariant violations                                                           | `/src/domain/shared/types.ts`                                         | All domain modules; error mapper                             | None                                  |
| `/src/domain/shared/evidence.ts`      | TypeScript | Immutable evidence references and rule-result structure                                               | `/src/domain/shared/types.ts`                                         | Security, wallet, candidate, portfolio, and position modules | None                                  |
| `/src/domain/shared/state-machine.ts` | TypeScript | Generic transition validation primitives                                                              | `/src/domain/shared/types.ts`, `/src/domain/shared/errors.ts`         | Candidate, order, position, and breaker state machines       | None                                  |
| `/src/domain/token/token.ts`          | TypeScript | Canonical Solana mint identity and token invariants                                                   | Shared types/errors                                                   | Token security; application contracts                        | None                                  |
| `/src/domain/token/security.ts`       | TypeScript | Absolute token-security rejection rules                                                               | Token; shared evidence/types                                          | Candidate evaluator; token-security tests                    | None                                  |
| `/src/domain/wallet/model.ts`         | TypeScript | Wallet profile, trade history, relationships, and confidence model                                    | Shared types/evidence                                                 | Wallet classifier; application contracts                     | None                                  |
| `/src/domain/wallet/performance.ts`   | TypeScript | Realized-return, win-rate, profit-factor, drawdown, and holding-period calculations                   | Wallet model; shared types                                            | Wallet classifier; evaluation reports                        | Decimal arithmetic library            |
| `/src/domain/wallet/classifier.ts`    | TypeScript | Tier eligibility, independence, disqualification, and confirmation rules                              | Wallet model/performance; shared evidence                             | Candidate evaluator; wallet tests                            | None                                  |
| `/src/domain/market/model.ts`         | TypeScript | Normalized pool, liquidity, volume, transaction, and executable-price facts                           | Shared types                                                          | Momentum; candidate evaluator; application contracts         | None                                  |
| `/src/domain/market/momentum.ts`      | TypeScript | Numerical market-momentum gates                                                                       | Market model; shared evidence                                         | Candidate evaluator; momentum tests                          | Decimal arithmetic library            |
| `/src/domain/candidate/model.ts`      | TypeScript | Candidate aggregate, provenance, lifecycle, and deduplication key                                     | Token; market model; wallet model; shared types/state machine         | Candidate evaluator and application services                 | None                                  |
| `/src/domain/candidate/scoring.ts`    | TypeScript | Entry-score calculation and component breakdown                                                       | Candidate model; shared evidence                                      | Candidate evaluator; scoring tests                           | Decimal arithmetic library            |
| `/src/domain/candidate/evaluator.ts`  | TypeScript | Ordered security, wallet, market, score, and quote-gate decision                                      | Token security; wallet classifier; momentum; scoring; candidate model | Evaluate-candidate use case; replay engine                   | None                                  |
| `/src/domain/portfolio/model.ts`      | TypeScript | Equity, exposure, daily state, high-water mark, and open-position view                                | Shared types                                                          | Sizing; breakers; application contracts                      | None                                  |
| `/src/domain/portfolio/sizing.ts`     | TypeScript | Risk-derived position size and exposure constraints                                                   | Portfolio model; shared evidence                                      | Entry planner; sizing tests                                  | Decimal arithmetic library            |
| `/src/domain/portfolio/breakers.ts`   | TypeScript | Portfolio circuit-breaker conditions and lock rules                                                   | Portfolio model; shared state machine/evidence                        | Risk monitor; command handling; breaker tests                | None                                  |
| `/src/domain/trading/quote.ts`        | TypeScript | Executable quote acceptance and round-trip cost rules                                                 | Market model; shared types/evidence                                   | Entry planner; exit planner; application contracts           | Decimal arithmetic library            |
| `/src/domain/trading/order.ts`        | TypeScript | Order lifecycle and submission-attempt state machine                                                  | Quote; shared state machine/types                                     | Execution use cases and repositories                         | None                                  |
| `/src/domain/trading/position.ts`     | TypeScript | Position, lots, partial exits, realized/unrealized accounting, and lifecycle                          | Order; portfolio model; shared state machine/types                    | Position monitor; reconciliation; reports                    | Decimal arithmetic library            |
| `/src/domain/trading/exits.ts`        | TypeScript | Standard, emergency, time, target, and trailing exit evaluation                                       | Position; quote; shared evidence                                      | Position monitor; replay engine                              | Decimal arithmetic library            |

## 8. Application contracts and ports

Application ports define all infrastructure capabilities. Provider and database implementations conform to these files; domain modules never import them.

| File                                         | Language   | Purpose                                                                                                 | Imports                                         | Imported by                                                      | External dependencies |
| -------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| `/src/application/contracts/observations.ts` | TypeScript | Provider-independent observation structures fixed by service contracts                                  | Domain shared/token/market/wallet types         | Ports, adapters, ingest services, repositories                   | None                  |
| `/src/application/contracts/commands.ts`     | TypeScript | Telegram-neutral operator command and result structures                                                 | Domain IDs, breaker/order/position states       | Command service; Telegram adapter                                | None                  |
| `/src/application/contracts/events.ts`       | TypeScript | Internal durable event envelope and event names                                                         | Domain shared types                             | Application services, workers, audit repository                  | None                  |
| `/src/application/contracts/reports.ts`      | TypeScript | Evaluation, trading, health, and promotion report structures                                            | Domain portfolio/position/wallet types          | Reporting service and renderers                                  | None                  |
| `/src/application/ports/chain.ts`            | TypeScript | Reads accounts, balances, transactions, holders, slots, and confirmation; submits fallback transactions | Observation contracts                           | Solana adapter; intelligence, execution, reconciliation services | None                  |
| `/src/application/ports/stream.ts`           | TypeScript | Subscribes to wallet, signature, and account events with gap/reconnect signaling                        | Observation contracts                           | Helius adapter; observation workers                              | None                  |
| `/src/application/ports/market.ts`           | TypeScript | Discovers pools and supplies normalized market observations                                             | Observation contracts                           | DexScreener/Birdeye/GMGN adapters; discovery services            | None                  |
| `/src/application/ports/swap.ts`             | TypeScript | Quotes, constructs, and simulates swaps without signing                                                 | Quote/order domain types; observation contracts | Jupiter adapter; entry/exit services                             | None                  |
| `/src/application/ports/signer.ts`           | TypeScript | Obtains public identity and signs an approved transaction payload locally                               | Order domain types                              | Local signer; execution service                                  | None                  |
| `/src/application/ports/operator.ts`         | TypeScript | Receives authenticated commands and emits operator alerts                                               | Command contracts                               | Telegram adapter; command and alert services                     | None                  |
| `/src/application/ports/repositories.ts`     | TypeScript | Transactional persistence interfaces for every aggregate and observation domain                         | Domain models; application contracts            | PostgreSQL repositories; all stateful services                   | None                  |
| `/src/application/ports/runtime.ts`          | TypeScript | Clock, ID generation, logger, metrics, secret access, and process-lock contracts                        | Domain shared types                             | Infrastructure implementations; all application services         | None                  |

## 9. Application services

| File                                               | Language   | Purpose                                                                                         | Imports                                                                                 | Imported by                                         | External dependencies |
| -------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------- |
| `/src/application/services/token-intelligence.ts`  | TypeScript | Builds authoritative token identity, authority, extension, holder, pool, and developer evidence | Chain/market ports; token domain; repositories; runtime port                            | Candidate pipeline; intelligence worker             | None                  |
| `/src/application/services/wallet-intelligence.ts` | TypeScript | Reconstructs wallet swaps, funding, relationships, performance, and tiers                       | Chain port; wallet domain; repositories; runtime port                                   | Candidate pipeline; wallet research script/worker   | None                  |
| `/src/application/services/discovery.ts`           | TypeScript | Normalizes candidate hints, resolves canonical mint, and deduplicates active candidates         | Market/stream ports; candidate domain; repositories; runtime port                       | Discovery worker; channel ingestion                 | None                  |
| `/src/application/services/candidate-pipeline.ts`  | TypeScript | Orchestrates complete reevaluation and persists every rule outcome                              | Token/wallet intelligence; candidate evaluator; swap port; repositories; runtime port   | Candidate worker; replay service                    | None                  |
| `/src/application/services/entry-planner.ts`       | TypeScript | Produces a quote-validated, risk-sized approval request                                         | Swap port; quote/sizing/breaker domains; repositories; runtime port                     | Candidate pipeline; command service                 | None                  |
| `/src/application/services/execution.ts`           | TypeScript | Constructs, validates, signs, submits, confirms, and records entry/exit attempts                | Chain/swap/signer ports; order/position domains; repositories; runtime port             | Command service; position monitor; execution worker | None                  |
| `/src/application/services/position-monitor.ts`    | TypeScript | Evaluates executable-price exits and initiates protective actions                               | Swap/chain ports; position/exits domains; repositories; execution service; runtime port | Position worker                                     | None                  |
| `/src/application/services/reconciliation.ts`      | TypeScript | Rebuilds actual wallet state from confirmed balances and transactions                           | Chain port; position/order domains; repositories; runtime port                          | Reconciliation worker; startup recovery             | None                  |
| `/src/application/services/risk-monitor.ts`        | TypeScript | Calculates portfolio state, applies circuit breakers, and controls entry locks                  | Portfolio domains; repositories; operator port; runtime port                            | Risk worker; command service; entry planner         | None                  |
| `/src/application/services/operator-commands.ts`   | TypeScript | Validates durable commands, approvals, pause/resume, closures, and emergency stop               | Operator port; command contracts; execution/risk services; repositories; runtime port   | Telegram entrypoint/worker                          | None                  |
| `/src/application/services/health.ts`              | TypeScript | Aggregates provider/process health and applies source-disagreement/data-loss actions            | Provider observations; repositories; risk/operator ports; runtime port                  | Health worker; status command                       | None                  |
| `/src/application/services/replay.ts`              | TypeScript | Replays timestamped events without future leakage using the same domain decisions               | Candidate pipeline; exit/risk domains; repositories; runtime clock                      | Historical evaluation script/tests                  | None                  |
| `/src/application/services/reporting.ts`           | TypeScript | Produces performance, audit-completeness, and promotion-gate reports                            | Report contracts; repositories; runtime port                                            | Report scripts; Telegram status summaries           | None                  |

## 10. Infrastructure: configuration, runtime, and security

| File                                                    | Language   | Purpose                                                                                                    | Imports                                         | Imported by                              | External dependencies                                                   |
| ------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| `/src/infrastructure/config/load-config.ts`             | TypeScript | Loads environment and JSON configuration, validates mode and provider settings, and exposes no raw secrets | Runtime port; `/config/defaults.json`           | Composition root; scripts                | Schema-validation library; Node.js filesystem/process                   |
| `/src/infrastructure/config/load-strategy.ts`           | TypeScript | Validates strategy JSON against approved rule IDs and produces immutable domain settings                   | Domain shared types; `/config/strategy-v1.json` | Composition root; replay script          | Schema-validation library; Node.js filesystem                           |
| `/src/infrastructure/runtime/system-clock.ts`           | TypeScript | Production clock implementation                                                                            | Runtime port                                    | Composition root                         | None                                                                    |
| `/src/infrastructure/runtime/id-generator.ts`           | TypeScript | Sortable unique ID generation                                                                              | Runtime port                                    | Composition root                         | UUID/ULID library                                                       |
| `/src/infrastructure/runtime/logger.ts`                 | TypeScript | Structured redacted logging with correlation IDs                                                           | Runtime port; config                            | Composition root                         | Structured logging library                                              |
| `/src/infrastructure/runtime/metrics.ts`                | TypeScript | In-process health and latency metrics without a dashboard                                                  | Runtime port                                    | Composition root; health service         | Metrics library or standard implementation fixed in dependency manifest |
| `/src/infrastructure/security/secret-provider.ts`       | TypeScript | Reads allowlisted runtime secrets and prevents serialization/logging                                       | Runtime port; config                            | Provider adapters; signer                | Node.js process environment                                             |
| `/src/infrastructure/security/local-signer.ts`          | TypeScript | Loads the dedicated wallet secret at runtime and signs only validated Solana transactions                  | Signer port; secret provider; order domain      | Composition root                         | Solana transaction library                                              |
| `/src/infrastructure/security/redaction.ts`             | TypeScript | Central secret, token, phone, and payload redaction rules                                                  | Config types                                    | Logger; error mapper; fixtures sanitizer | None                                                                    |
| `/src/infrastructure/security/transaction-inspector.ts` | TypeScript | Rejects unknown signers, programs, transfers, and fee recipients before signing                            | Order/quote domains; config                     | Jupiter adapter; execution service       | Solana transaction library                                              |

## 11. Infrastructure: persistence

| File                                              | Language   | Purpose                                                                                                             | Imports                                                       | Imported by                                    | External dependencies                 |
| ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------- |
| `/src/infrastructure/database/pool.ts`            | TypeScript | PostgreSQL connection pool and transaction boundary                                                                 | Config; runtime logger                                        | Repositories; migration runner; health service | PostgreSQL client                     |
| `/src/infrastructure/database/migrations.ts`      | TypeScript | Applies ordered migrations with checksum verification and lock protection                                           | Database pool; runtime logger; `/migrations/*.sql`            | Migration script; startup validation           | PostgreSQL client; Node.js filesystem |
| `/src/infrastructure/database/repositories.ts`    | TypeScript | Implements all application repository ports with explicit transactional methods                                     | Repository ports; database pool; domain/application contracts | Composition root                               | PostgreSQL client                     |
| `/src/infrastructure/database/event-store.ts`     | TypeScript | Appends immutable audit/domain events and reads replay streams                                                      | Events contract; database pool                                | Repositories; replay/reporting services        | PostgreSQL client                     |
| `/src/infrastructure/database/job-store.ts`       | TypeScript | Claims durable jobs, records leases/attempts, and recovers abandoned work                                           | Database pool; runtime port                                   | Workers and startup recovery                   | PostgreSQL client                     |
| `/src/infrastructure/database/paper-dashboard.ts` | TypeScript | Reads bounded paper portfolio, token lifecycle, realized book-equity history, and unresolved worker-alert snapshots | Database pool; paper schema                                   | Local dashboard entrypoint                     | PostgreSQL client                     |

## 12. Infrastructure: Solana, Helius, and Jupiter

| File                                                         | Language   | Purpose                                                                                                | Imports                                                               | Imported by                                               | External dependencies                  |
| ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `/src/infrastructure/providers/solana/rpc-client.ts`         | TypeScript | Primary/fallback JSON-RPC reads, confirmation, simulation, and fallback submission                     | Chain port; observation contracts; config/runtime/security            | Solana chain adapter                                      | HTTP client; Solana RPC types          |
| `/src/infrastructure/providers/solana/account-decoder.ts`    | TypeScript | Exact mint, token account, Token-2022 extension, and raw account decoding                              | Token domain; observation contracts                                   | Solana chain adapter; token intelligence                  | Solana token libraries                 |
| `/src/infrastructure/providers/solana/transaction-parser.ts` | TypeScript | Raw transaction and balance-delta reconstruction without treating transfers as swaps                   | Observation contracts; wallet domain                                  | Solana chain adapter; wallet intelligence; reconciliation | Solana transaction library             |
| `/src/infrastructure/providers/solana/chain-adapter.ts`      | TypeScript | Implements the chain port using RPC, decoders, parsers, and independent-provider comparison            | Chain port; RPC client; decoder; parser                               | Composition root                                          | Solana libraries                       |
| `/src/infrastructure/providers/helius/client.ts`             | TypeScript | Helius HTTP RPC, priority-fee, Sender, and enhanced-transaction client                                 | Config/runtime/security; observation contracts                        | Helius stream/submission adapter                          | HTTP client; WebSocket client          |
| `/src/infrastructure/providers/helius/stream-adapter.ts`     | TypeScript | Implements stream subscriptions, heartbeat, resubscription, gap reporting, and reconciliation triggers | Stream port; Helius client; repositories/runtime                      | Composition root; stream tests                            | WebSocket client                       |
| `/src/infrastructure/providers/helius/submission-adapter.ts` | TypeScript | Sender submission and acknowledgement only; never declares execution success                           | Helius client; order domain; runtime                                  | Execution service composition                             | None beyond Helius client dependencies |
| `/src/infrastructure/providers/jupiter/client.ts`            | TypeScript | Supported Jupiter API family transport, authentication, and response validation                        | Config/runtime/security                                               | Jupiter adapter                                           | HTTP client; schema-validation library |
| `/src/infrastructure/providers/jupiter/adapter.ts`           | TypeScript | Implements swap port for quote, construction, simulation input, and response normalization             | Swap port; Jupiter client; transaction inspector; quote/order domains | Composition root                                          | Solana transaction library             |

## 13. Infrastructure: discovery and operator providers

| File                                                        | Language   | Purpose                                                                                         | Imports                                                                 | Imported by                                   | External dependencies                                   |
| ----------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `/src/infrastructure/providers/dexscreener/adapter.ts`      | TypeScript | DexScreener discovery and normalized pair-market observations with deterministic pool selection | Market port; observation contracts; config/runtime                      | Composition root                              | HTTP client; schema-validation library                  |
| `/src/infrastructure/providers/birdeye/adapter.ts`          | TypeScript | Optional cross-check and historical market adapter                                              | Market port; observation contracts; config/runtime/security             | Composition root when enabled                 | HTTP client; schema-validation library                  |
| `/src/infrastructure/providers/gmgn/adapter.ts`             | TypeScript | Optional documented Cooperation API discovery adapter; omitted when access is absent            | Market port; observation contracts; config/runtime/security             | Composition root when enabled                 | HTTP client; schema-validation library                  |
| `/src/infrastructure/providers/telegram/bot-adapter.ts`     | TypeScript | Authenticated command intake, durable update-offset handling, and alert delivery                | Operator port; command contracts; config/runtime/security; repositories | Telegram entrypoint; operator command service | Telegram Bot API library or HTTP client                 |
| `/src/infrastructure/providers/telegram/channel-adapter.ts` | TypeScript | Optional explicitly configured channel message ingestion as untrusted candidate evidence        | Observation contracts; discovery service; config/runtime; repositories  | Discovery worker when enabled                 | Telegram client capability fixed in dependency manifest |

## 14. Infrastructure: reporting

| File                                                 | Language   | Purpose                                                    | Imports                     | Imported by               | External dependencies |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------- | --------------------------- | ------------------------- | --------------------- |
| `/src/infrastructure/reporting/json-renderer.ts`     | TypeScript | Machine-readable immutable evaluation and incident reports | Report contracts; redaction | Reporting scripts/service | Node.js filesystem    |
| `/src/infrastructure/reporting/csv-renderer.ts`      | TypeScript | Tabular signal, rejection, trade, and performance exports  | Report contracts; redaction | Reporting scripts/service | CSV library           |
| `/src/infrastructure/reporting/markdown-renderer.ts` | TypeScript | Human-readable promotion and audit reports                 | Report contracts; redaction | Reporting scripts/service | None                  |

## 15. Entrypoints and workers

Only `/src/entrypoints/composition.ts` may instantiate concrete infrastructure. Workers receive already-constructed application services.

| File                                    | Language   | Purpose                                                                                                                                                                         | Imports                                                                    | Imported by                              | External dependencies                            |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| `/src/entrypoints/composition.ts`       | TypeScript | Validates mode, composes all ports/adapters/services, and structurally omits live execution when disabled                                                                       | All config/runtime/database/provider implementations; application services | All executable entrypoints and scripts   | Dependency-injection pattern without a framework |
| `/src/entrypoints/main.ts`              | TypeScript | Starts migrations check, recovery, workers, health handling, and graceful shutdown                                                                                              | Composition; worker supervisor                                             | Production process                       | Node.js runtime                                  |
| `/src/entrypoints/telegram.ts`          | TypeScript | Starts the configured Telegram update mechanism and command processing                                                                                                          | Composition; Telegram adapter; operator service                            | Production process when Telegram enabled | Telegram transport dependency                    |
| `/src/entrypoints/dashboard.ts`         | TypeScript | Serves local read-only paper summary, detail, alerts, fixed-range performance, and validated token-lifecycle snapshots for portfolio, allocation, watchlist, and sortable views | Runtime config; database readiness; paper reporting and detail projections | Operator-started local dashboard process | Node.js native HTTP server                       |
| `/src/workers/supervisor.ts`            | TypeScript | Starts, stops, restarts, and observes approved workers without hiding fatal failures                                                                                            | Runtime ports; job store; all worker factories                             | Main entrypoint                          | None                                             |
| `/src/workers/discovery-worker.ts`      | TypeScript | Runs provider and tracked-wallet candidate discovery                                                                                                                            | Discovery service; market/stream ports; job store/runtime                  | Supervisor                               | None                                             |
| `/src/workers/candidate-worker.ts`      | TypeScript | Claims candidates and performs complete versioned evaluation                                                                                                                    | Candidate pipeline; job store/runtime                                      | Supervisor                               | None                                             |
| `/src/workers/position-worker.ts`       | TypeScript | Refreshes executable exit quotes and evaluates open positions                                                                                                                   | Position monitor; job store/runtime                                        | Supervisor                               | None                                             |
| `/src/workers/reconciliation-worker.ts` | TypeScript | Periodically and event-triggeredly reconciles balances and transactions                                                                                                         | Reconciliation service; job store/runtime                                  | Supervisor                               | None                                             |
| `/src/workers/risk-worker.ts`           | TypeScript | Recalculates exposure, drawdown, losses, and entry locks                                                                                                                        | Risk monitor; job store/runtime                                            | Supervisor                               | None                                             |
| `/src/workers/health-worker.ts`         | TypeScript | Checks providers, detects disagreements/timeouts, and emits alerts                                                                                                              | Health service; job store/runtime                                          | Supervisor                               | None                                             |

## 16. Operator scripts

Scripts import the composition root or narrowly scoped infrastructure. They do not contain independent business logic.

| File                                    | Language   | Purpose                                                                              | Imports                                                   | Imported by             | External dependencies                 |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------- | ------------------------------------- |
| `/scripts/verify-environment.ts`        | TypeScript | Confirms runtime, configuration, provider accounts, database, and safe disabled mode | Config loader; provider clients; database pool; redaction | Package script/operator | Runtime dependencies already declared |
| `/scripts/migrate.ts`                   | TypeScript | Applies or verifies database migrations                                              | Config; database pool/migrations                          | Package script/operator | PostgreSQL client                     |
| `/scripts/import-wallet-watchlist.ts`   | TypeScript | Validates wallet research inputs and creates non-trusted research records            | Config; wallet intelligence; repositories                 | Package script/operator | None beyond runtime dependencies      |
| `/scripts/run-historical-evaluation.ts` | TypeScript | Executes deterministic historical replay for one strategy version                    | Composition; replay/reporting services                    | Package script/operator | None beyond runtime dependencies      |
| `/scripts/generate-report.ts`           | TypeScript | Produces named JSON/CSV/Markdown reports from stored evidence                        | Composition; reporting service/renderers                  | Package script/operator | None beyond runtime dependencies      |
| `/scripts/reconcile-now.ts`             | TypeScript | Runs a foreground full-wallet reconciliation without opening trades                  | Composition; reconciliation service                       | Package script/operator | None beyond runtime dependencies      |
| `/scripts/emergency-stop.ts`            | TypeScript | Applies the durable emergency lock when Telegram is unavailable                      | Composition; risk/operator services                       | Package script/operator | None beyond runtime dependencies      |
| `/scripts/sanitize-fixture.ts`          | TypeScript | Removes secrets and personal data before a provider response enters `/fixtures`      | Redaction; config                                         | Developer only          | Node.js filesystem                    |

## 17. Test support and fixtures

| File                                     | Language   | Purpose                                                                           | Imports                                    | Imported by                      | External dependencies                                |
| ---------------------------------------- | ---------- | --------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------- | ---------------------------------------------------- |
| `/tests/setup.ts`                        | TypeScript | Global deterministic test defaults and prohibition of unintended network access   | Test helpers                               | Vitest config                    | Vitest                                               |
| `/tests/helpers/builders.ts`             | TypeScript | Valid domain object builders with explicit override support                       | Domain and application contracts           | All tests                        | None                                                 |
| `/tests/helpers/fake-clock.ts`           | TypeScript | Controllable runtime clock                                                        | Runtime port; domain types                 | Unit/replay/integration tests    | None                                                 |
| `/tests/helpers/fake-ports.ts`           | TypeScript | Deterministic chain, stream, market, swap, signer, operator, and repository fakes | Application ports/contracts                | Application tests                | None                                                 |
| `/tests/helpers/database.ts`             | TypeScript | Disposable database lifecycle, migration, cleanup, and transaction assertions     | Database pool/migrations                   | Integration/recovery tests       | PostgreSQL client; test container or Docker contract |
| `/fixtures/providers/solana/*.json`      | JSON       | Sanitized valid/error RPC and decoded-account fixtures                            | Captured approved service proofs           | Solana contract tests            | None                                                 |
| `/fixtures/providers/helius/*.json`      | JSON       | Sanitized stream, fee, Sender, enhanced transaction, and failure fixtures         | Captured approved service proofs           | Helius contract tests            | None                                                 |
| `/fixtures/providers/jupiter/*.json`     | JSON       | Sanitized quote, swap, error, and schema-drift fixtures                           | Captured approved service proofs           | Jupiter contract tests           | None                                                 |
| `/fixtures/providers/dexscreener/*.json` | JSON       | Sanitized pair, missing-index, limit, and malformed fixtures                      | Captured approved service proofs           | DexScreener contract tests       | None                                                 |
| `/fixtures/providers/birdeye/*.json`     | JSON       | Optional sanitized success, unavailable, and throttled fixtures                   | Captured approved service proofs           | Birdeye contract tests           | None                                                 |
| `/fixtures/providers/gmgn/*.json`        | JSON       | Optional documented-API fixtures only                                             | Captured approved service proofs           | GMGN contract tests              | None                                                 |
| `/fixtures/providers/telegram/*.json`    | JSON       | Sanitized authorized, unauthorized, duplicate, edited, and expired updates        | Synthetic/captured approved service proofs | Telegram contract/security tests | None                                                 |
| `/fixtures/replay/*.jsonl`               | JSON Lines | Timestamp-ordered historical/recovery event streams with known outcomes           | Sanitized historical inputs                | Replay and end-to-end tests      | None                                                 |

## 18. Test files

Test filenames mirror the production module they verify. Adding a production module requires its mapped tests before the same change set is complete.

| File                                             | Language   | Purpose                                                                           | Imports                                                | Imported by   | External dependencies                              |
| ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------- | -------------------------------------------------- |
| `/tests/unit/token-security.test.ts`             | TypeScript | Every token rejection rule and boundary                                           | Token security; builders                               | Test runner   | Vitest                                             |
| `/tests/unit/wallet-performance.test.ts`         | TypeScript | Realized trade reconstruction metrics and decimal boundaries                      | Wallet performance; builders                           | Test runner   | Vitest                                             |
| `/tests/unit/wallet-classifier.test.ts`          | TypeScript | Tier, independence, funding, coordination, and disqualification rules             | Wallet classifier; builders                            | Test runner   | Vitest                                             |
| `/tests/unit/momentum.test.ts`                   | TypeScript | Every momentum threshold and stale/missing case                                   | Momentum; builders                                     | Test runner   | Vitest                                             |
| `/tests/unit/candidate-scoring.test.ts`          | TypeScript | Score components, threshold boundaries, and absolute rejections                   | Candidate scoring/evaluator; builders                  | Test runner   | Vitest                                             |
| `/tests/unit/position-sizing.test.ts`            | TypeScript | Risk, exposure, SOL reserve, and no-average-down rules                            | Portfolio sizing; builders                             | Test runner   | Vitest                                             |
| `/tests/unit/quote.test.ts`                      | TypeScript | Quote age, amounts, impact, slippage, and round-trip limits                       | Trading quote; builders/fake clock                     | Test runner   | Vitest                                             |
| `/tests/unit/order-state.test.ts`                | TypeScript | Allowed/forbidden submission transitions and retries                              | Trading order; builders                                | Test runner   | Vitest                                             |
| `/tests/unit/position-exits.test.ts`             | TypeScript | Stops, targets, trailing, time, emergency, partial-lot accounting                 | Trading position/exits; builders                       | Test runner   | Vitest                                             |
| `/tests/unit/circuit-breakers.test.ts`           | TypeScript | Daily, rolling, high-water, sequence, security, and reconciliation locks          | Portfolio breakers; builders                           | Test runner   | Vitest                                             |
| `/tests/contract/solana.test.ts`                 | TypeScript | RPC schemas, decoding, confirmations, fallback disagreement, and parsing          | Solana adapter; fixtures                               | Test runner   | Vitest                                             |
| `/tests/contract/helius.test.ts`                 | TypeScript | Stream heartbeat/gaps, fees, Sender acknowledgement, limits, and drift            | Helius adapters; fixtures                              | Test runner   | Vitest                                             |
| `/tests/contract/jupiter.test.ts`                | TypeScript | Quote/construction schemas, mismatch rejection, expiry, and inspection            | Jupiter adapter; fixtures                              | Test runner   | Vitest                                             |
| `/tests/contract/dexscreener.test.ts`            | TypeScript | Pool selection, null fields, rate limits, and malformed data                      | DexScreener adapter; fixtures                          | Test runner   | Vitest                                             |
| `/tests/contract/optional-market.test.ts`        | TypeScript | Birdeye/GMGN absence, disablement, and non-authoritative behavior                 | Optional adapters; fixtures                            | Test runner   | Vitest                                             |
| `/tests/contract/telegram.test.ts`               | TypeScript | Update/command schemas, allowlists, nonce, expiry, idempotency, and channel hints | Telegram adapters; fixtures                            | Test runner   | Vitest                                             |
| `/tests/integration/candidate-pipeline.test.ts`  | TypeScript | Discovery-to-signal/rejection with stored evidence and deduplication              | Application services; fake ports/database              | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/integration/execution.test.ts`           | TypeScript | Quote-to-confirmed-balance entry/exit and failure escalation                      | Execution/reconciliation services; fake ports/database | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/integration/persistence.test.ts`         | TypeScript | Empty migration, constraints, atomicity, audit immutability, and event order      | Database modules/helpers                               | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/integration/restart-recovery.test.ts`    | TypeScript | Recovery of pending orders, open positions, leases, commands, and locks           | Composition/services/database/helpers                  | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/replay/no-lookahead.test.ts`             | TypeScript | Proves future events cannot affect earlier decisions                              | Replay service; replay fixtures/fake clock             | Test runner   | Vitest                                             |
| `/tests/replay/determinism.test.ts`              | TypeScript | Proves identical versioned inputs produce identical decisions/reports             | Replay service; replay fixtures                        | Test runner   | Vitest                                             |
| `/tests/failure/provider-outages.test.ts`        | TypeScript | RPC, Helius, Jupiter, discovery, and Telegram outage behavior                     | Services; fake ports/fake clock                        | Test runner   | Vitest                                             |
| `/tests/failure/reconciliation.test.ts`          | TypeScript | Missing, duplicate, contradictory, and unauthorized balance/transaction cases     | Reconciliation/risk services; fake ports/database      | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/security/secrets.test.ts`                | TypeScript | Proves secrets do not enter logs, database, reports, fixtures, or Telegram        | Config/security/reporting/provider modules             | Test runner   | Vitest                                             |
| `/tests/security/transaction-inspection.test.ts` | TypeScript | Unknown signers/programs/transfers/fee recipients are rejected                    | Transaction inspector; Jupiter fixtures                | Test runner   | Vitest                                             |
| `/tests/e2e/observation.test.ts`                 | TypeScript | Full no-position observation workflow                                             | Composition with fixture adapters/database             | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/e2e/shadow.test.ts`                      | TypeScript | Complete quoted round trip without balance mutation or signing                    | Composition with fixture adapters/database             | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/e2e/paper.test.ts`                       | TypeScript | Paper balance, lots, partial exits, breakers, restart, and reports                | Composition with fixture adapters/database             | Test runner   | Vitest; PostgreSQL                                 |
| `/tests/e2e/live-low-value.test.ts`              | TypeScript | Explicitly gated manual mainnet proof; excluded from normal test runs             | Production composition and operator approval           | Operator only | Real provider accounts; dedicated low-value wallet |

## 19. Generated paths

These paths are runtime/build output and are excluded from Git. They are not source files and are never imported.

| Path         | Contents                                          |
| ------------ | ------------------------------------------------- |
| `/dist/`     | Compiled JavaScript and source maps               |
| `/coverage/` | Test coverage output                              |
| `/reports/`  | Generated JSON, CSV, and Markdown reports         |
| `/logs/`     | Local structured logs when file output is enabled |
| `/tmp/`      | Replaceable temporary runtime files               |

## 20. External dependency families

Exact package names and versions remain reserved for `DEPENDENCY_MANIFEST.md`; no package installation is authorized by this map.

| Family               | Required capability                                        | Consuming files                          |
| -------------------- | ---------------------------------------------------------- | ---------------------------------------- |
| Node.js runtime      | Supported TypeScript application runtime                   | All executable TypeScript files          |
| TypeScript toolchain | Compilation and type checking                              | All TypeScript files                     |
| Test runner/coverage | Unit through end-to-end testing                            | `/tests/*`; `/vitest.config.ts`          |
| PostgreSQL           | Durable state, audit, recovery, reporting                  | `/migrations/*`; database infrastructure |
| PostgreSQL client    | Typed parameterized queries and transactions               | Database infrastructure and tests        |
| Schema validation    | Runtime validation of configuration and provider responses | Config and provider clients              |
| Decimal arithmetic   | Exact non-floating financial calculation                   | Domain financial modules                 |
| Solana libraries     | Transactions, public keys, token decoding, signing         | Solana/Jupiter/security infrastructure   |
| HTTP transport       | Timeouts, cancellation, headers, and bounded retries       | Provider clients                         |
| WebSocket transport  | Helius/Solana subscriptions and heartbeats                 | Stream infrastructure                    |
| Structured logging   | JSON logs, redaction, correlation, severity                | Runtime logger                           |
| Unique ID generation | Sortable durable identifiers                               | Runtime ID generator                     |
| Telegram transport   | Bot commands/alerts and optional approved channel access   | Telegram infrastructure                  |
| CSV rendering        | Deterministic tabular reports                              | CSV renderer                             |

## 21. Operating-mode composition

| Mode              | Included capabilities                                                                     | Structurally excluded capabilities           |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| `historical`      | Replay, rules, database, reports                                                          | Live providers, Telegram, signer, submission |
| `observation`     | Live read adapters, evaluation, alerts, reports                                           | Paper positions, signer, submission          |
| `shadow`          | Observation plus live quote/simulation/exit tracking                                      | Wallet mutation, signer, submission          |
| `paper`           | Shadow plus simulated balance and position accounting                                     | Local signer, transaction submission         |
| `supervised_live` | Full monitoring, expiring approval, local signing, submission, automatic protective exits | Automatic entries                            |
| `limited_auto`    | Approved restricted automatic entry configuration                                         | Unrestricted automation                      |
| `full_auto`       | Full approved execution after promotion                                                   | None beyond permanent safety rules           |

Mode is startup-validated. A process cannot change itself from a non-live mode into a live mode through Telegram or database state.

## 22. File-count control

Planned authored files:

| Category                             |   Count |
| ------------------------------------ | ------: |
| Root configuration                   |      10 |
| Documentation                        |       9 |
| Configuration templates              |       4 |
| Migrations                           |       7 |
| Domain source                        |      21 |
| Application contracts/ports/services |      25 |
| Infrastructure source                |      32 |
| Entrypoints/workers                  |      10 |
| Operator scripts                     |       8 |
| Test support                         |       5 |
| Test files                           |      30 |
| **Total authored files**             | **161** |

Fixture directories contain variable captured files and are not counted individually. The map favors cohesive files and one deployable application; splitting a mapped file requires an approved project-map change and downstream dependency review.

## 23. Approval consequences

The operator approved the map, the remaining pre-code documents, the dependency installation, and creation of the mapped empty-file infrastructure. Database creation, migrations, provider authentication, and executable implementation remain unauthorized.

## Revision history

| Version | Date       | Change                                                                                                                                        | Reason                                                                                                   |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1.0.1   | 2026-08-04 | Corrected entrypoint/worker subtotal from 9 to 10 and total authored-file count from 160 to 161; recorded approval and scaffold authorization | Inventory contains 3 entrypoints and 7 workers; the prior arithmetic understated the mapped files by one |
| 1.0.0   | 2026-08-03 | Created complete project map from the approved service contracts and build plan                                                               | Lock repository scope and dependency direction before package selection or schema design                 |
