# Memecoined Dependency Manifest

**Status:** Approved  
**Version:** 1.0.1  
**Date:** 2026-08-04  
**Scope:** Exact runtime, package, service-account, environment, installation, and verification contract before repository initialization

## 1. Authority and constraints

This document implements the approved `SERVICE_CONTRACTS.md` and `PROJECT_MAP.md`.

- No package ranges are permitted in `package.json`.
- `package-lock.json` must be committed and installation must use `npm ci` after initial lock creation.
- The application uses native ECMAScript modules only.
- Production and test code run on the same Node.js major and PostgreSQL major.
- Provider SDKs are prohibited unless listed here.
- Provider HTTP clients use Node.js native `fetch` and `AbortSignal`; no Axios dependency is approved.
- Cryptographic randomness, hashes, UUIDs, timers and environment access use Node.js built-ins.
- No ORM, web framework, job-queue framework, dependency-injection framework or frontend package is approved; the local read-only paper dashboard uses Node.js native HTTP and browser-native HTML, CSS and JavaScript.
- No live credential may appear in source, configuration files, fixtures, logs, reports, tests or version control.

## 2. Required execution environment

| Component      |                       Exact version | Requirement                                      |
| -------------- | ----------------------------------: | ------------------------------------------------ |
| Ubuntu         | 24.04 LTS, current security updates | Development and initial production host baseline |
| Node.js        |                         24.18.1 LTS | Application, scripts and tests                   |
| npm            |                              11.9.0 | Package installation and lockfile generation     |
| PostgreSQL     |                                18.4 | Durable state, audit, recovery and reporting     |
| Docker Engine  |        28.x current patched release | Local disposable integration-test database only  |
| Docker Compose |          v2 current patched release | Invokes `docker-compose.test.yml`                |
| Git            |                       2.43 or newer | Source and change history                        |
| OpenSSL        |                                 3.x | TLS support supplied by Ubuntu/Node.js           |

Runtime architecture: Linux x86-64 or ARM64. Production use on Windows is not approved. Development from Windows requires WSL2 running the Ubuntu baseline.

Node.js 26 is not approved because it is not LTS on the approval date. PostgreSQL 19 beta is not approved for any environment.

## 3. Production dependencies

All versions are exact.

| Package                 |  Version | Approved purpose                                                        | Imported by                                   |
| ----------------------- | -------: | ----------------------------------------------------------------------- | --------------------------------------------- |
| `@solana/kit`           |  `7.0.0` | Solana addresses, RPC types, messages, transactions, signing and codecs | Solana, Jupiter and signing infrastructure    |
| `@solana-program/token` | `0.15.0` | SPL Token and Token-2022 account/instruction decoding                   | Token account decoder and security inspection |
| `csv-stringify`         |  `6.8.2` | Deterministic CSV report output                                         | CSV renderer only                             |
| `decimal.js`            | `10.6.0` | Exact decimal financial calculations                                    | Approved domain financial modules             |
| `grammy`                | `1.45.1` | Telegram Bot API long polling/webhooks, commands and alerts             | Telegram bot and channel adapters             |
| `pg`                    | `8.22.0` | PostgreSQL pools, parameterized queries and transactions                | Database infrastructure and tests             |
| `pino`                  | `10.3.1` | Structured JSON logging and redaction                                   | Runtime logger only                           |
| `ws`                    | `8.21.1` | Helius and Solana WebSocket subscriptions                               | Stream clients only                           |
| `zod`                   |  `4.4.3` | Runtime validation of configuration and provider responses              | Configuration and provider adapters           |

### 3.1 Explicit package exclusions

- `@solana/web3.js`: not approved; Solana Kit is the single transaction/RPC type family.
- `@solana/spl-token`: not approved; token decoding uses `@solana-program/token` with Solana Kit.
- `axios`, `got`, `undici`: not approved; use Node.js native `fetch`.
- `dotenv`: not approved; use Node.js `process.loadEnvFile()` for local development only.
- `telegraf`: not approved; grammY is the single Telegram transport.
- `prisma`, `typeorm`, `sequelize`, `knex`, `drizzle-orm`: not approved; SQL migrations and explicit `pg` repositories are required.
- `bullmq`, `agenda`, `node-cron`: not approved; durable jobs use the PostgreSQL job store and worker loops defined in the project map.
- `express`, `fastify`, `koa`: not approved. The local paper dashboard uses the approved native HTTP server contract; remote exposure, mutation routes and Telegram webhooks require separate approval.
- GMGN, Birdeye, DexScreener, Helius and Jupiter SDK packages: not approved; adapters use documented HTTP/WSS contracts directly.

## 4. Development dependencies

All versions are exact.

| Package                  |   Version | Approved purpose                                                            |
| ------------------------ | --------: | --------------------------------------------------------------------------- |
| `@types/node`            | `24.13.3` | Node.js 24 type declarations                                                |
| `@types/pg`              |  `8.20.3` | PostgreSQL client type declarations                                         |
| `@types/ws`              |  `8.18.1` | WebSocket client type declarations                                          |
| `@vitest/coverage-v8`    |  `4.1.10` | V8 test coverage                                                            |
| `eslint`                 |  `10.8.0` | Static analysis                                                             |
| `eslint-plugin-import-x` |  `4.17.1` | Import validation and dependency-boundary enforcement                       |
| `prettier`               |   `3.9.6` | Deterministic formatting                                                    |
| `testcontainers`         |  `12.0.4` | Disposable PostgreSQL integration-test lifecycle                            |
| `tsx`                    |  `4.23.5` | Execute TypeScript operator scripts during development                      |
| `typescript`             |   `6.0.3` | Strict type checking and production compilation                             |
| `typescript-eslint`      |  `8.66.0` | TypeScript-aware ESLint parser and rules                                    |
| `vitest`                 |  `4.1.10` | Unit, contract, integration, replay, failure, security and end-to-end tests |

No package may be added transitively by direct declaration unless this manifest is revised and approved.

## 5. Exact installation commands

Run only after this manifest, `SYSTEM_SCHEMA.md`, `STRATEGY_SPECIFICATION.md` and the initial `CHANGELOG.md` are approved and repository initialization is explicitly authorized.

From the future repository root:

```bash
npm init -y

npm install --save-exact \
  @solana/kit@7.0.0 \
  @solana-program/token@0.15.0 \
  csv-stringify@6.8.2 \
  decimal.js@10.6.0 \
  grammy@1.45.1 \
  pg@8.22.0 \
  pino@10.3.1 \
  ws@8.21.1 \
  zod@4.4.3

npm install --save-dev --save-exact \
  @types/node@24.13.3 \
  @types/pg@8.20.3 \
  @types/ws@8.18.1 \
  @vitest/coverage-v8@4.1.10 \
  eslint@10.8.0 \
  eslint-plugin-import-x@4.17.1 \
  prettier@3.9.6 \
  testcontainers@12.0.4 \
  tsx@4.23.5 \
  typescript@6.0.3 \
  typescript-eslint@8.66.0 \
  vitest@4.1.10
```

The initial installation must produce `/package-lock.json` with `lockfileVersion: 3`. Subsequent clean installations use:

```bash
npm ci
```

Global installation of TypeScript, tsx, Vitest, ESLint or Prettier is prohibited.

## 6. Package metadata contract

The future `/package.json` must include:

| Field            | Required value |
| ---------------- | -------------- |
| `name`           | `memecoined`   |
| `private`        | `true`         |
| `version`        | `0.1.0`        |
| `type`           | `module`       |
| `engines.node`   | `24.18.1`      |
| `engines.npm`    | `11.9.0`       |
| `packageManager` | `npm@11.9.0`   |

All dependency and development-dependency values must be bare exact versions without `^`, `~`, tags, Git references or URLs.

## 7. TypeScript execution contract

- Module system: native Node.js ESM.
- TypeScript module and resolution mode: `nodenext`.
- Compilation target: `ES2024`.
- Production output: `/dist`.
- Production executes compiled JavaScript with Node.js; `tsx` is prohibited in production.
- Strict type checking is mandatory.
- Type checking and emission are separate commands.
- Relative ESM imports include their emitted `.js` extensions.
- Path aliases are prohibited in v1.
- Experimental decorators and runtime transpiler plugins are prohibited.
- Node.js native TypeScript stripping is not the production build path.

## 8. PostgreSQL contract

- Required server: PostgreSQL 18.4.
- Required encoding: `UTF8`.
- Required timezone: `UTC`.
- Required authentication: `scram-sha-256`.
- Required application role: non-superuser, non-owner, no role creation, no database creation.
- Required migration role: schema owner; separate from the runtime application role.
- Required connection encryption in production: TLS with certificate verification.
- Required production backup: encrypted database backup and tested restore before live-trading eligibility.
- Local integration tests use the exact `postgres:18.4` image reference in `docker-compose.test.yml` and Testcontainers.
- Floating-point PostgreSQL types are prohibited for SOL, token, price, fee, percentage or accounting values.

Extension approval is deferred to `SYSTEM_SCHEMA.md`. Migration `0001_extensions.sql` may enable only extensions explicitly named there.

## 9. Required external accounts

| Account                         | Required stage                    | Requirement                                                                                        |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Primary Solana RPC              | Read-adapter implementation       | Paid mainnet and devnet HTTPS/WSS endpoints                                                        |
| Independent fallback Solana RPC | Before shadow trading             | Different provider and infrastructure from primary                                                 |
| Helius                          | Helius adapter implementation     | Paid plan supporting required enhanced WebSocket methods; separate development and production keys |
| Jupiter                         | Jupiter adapter implementation    | Production API key and confirmed supported API family                                              |
| Telegram Bot                    | Operator-interface implementation | Dedicated bot, operator allowlist and permitted chat                                               |
| GMGN Cooperation API            | Optional                          | Adapter remains disabled unless formal access is granted                                           |
| Birdeye                         | Optional                          | Adapter remains absent or disabled unless a selected paid plan is approved                         |

The trading wallet is not an external service account. It must be a dedicated low-value Solana keypair created for Memecoined and must never reuse a personal treasury wallet.

## 10. Environment variables

Variable names are locked. Required/optional status depends on the startup mode and enabled adapters.

### 10.1 Core runtime

| Variable                 | Secret | Required value/format                                                                            |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------------ |
| `MEMECOINED_ENV`         | No     | `development`, `test` or `production`                                                            |
| `MEMECOINED_MODE`        | No     | `historical`, `observation`, `shadow`, `paper`, `supervised_live`, `limited_auto` or `full_auto` |
| `MEMECOINED_INSTANCE_ID` | No     | Stable deployment identifier                                                                     |
| `MEMECOINED_LOG_LEVEL`   | No     | `debug`, `info`, `warn`, `error` or `fatal`                                                      |
| `MEMECOINED_CONFIG_DIR`  | No     | Absolute path to approved non-secret configuration directory                                     |
| `DATABASE_URL`           | Yes    | PostgreSQL URI; TLS required outside local development/test                                      |
| `DATABASE_MIGRATION_URL` | Yes    | Separate migration-role PostgreSQL URI; migration commands only                                  |

### 10.2 Solana and execution

| Variable                     | Secret | Required value/format                                                         |
| ---------------------------- | ------ | ----------------------------------------------------------------------------- |
| `SOLANA_PRIMARY_RPC_URL`     | Yes    | Primary HTTPS RPC endpoint including provider credential when applicable      |
| `SOLANA_PRIMARY_WSS_URL`     | Yes    | Matching primary WSS endpoint                                                 |
| `SOLANA_FALLBACK_RPC_URL`    | Yes    | Independent HTTPS RPC endpoint                                                |
| `SOLANA_FALLBACK_WSS_URL`    | Yes    | Independent WSS endpoint when enabled                                         |
| `SOLANA_CLUSTER`             | No     | `mainnet-beta` or `devnet`; local/test fixtures use explicit fake adapters    |
| `HELIUS_API_KEY`             | Yes    | Environment-specific Helius key                                               |
| `JUPITER_API_KEY`            | Yes    | Environment-specific Jupiter key                                              |
| `TRADING_WALLET_SECRET_FILE` | Yes    | Absolute path to a permission-restricted secret file; never the secret itself |

### 10.3 Discovery and operator adapters

| Variable                     | Secret | Required value/format                                |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`         | Yes    | Dedicated Bot API token                              |
| `TELEGRAM_OPERATOR_USER_IDS` | No     | Comma-separated numeric allowlist                    |
| `TELEGRAM_ALLOWED_CHAT_IDS`  | No     | Comma-separated numeric allowlist                    |
| `TELEGRAM_WEBHOOK_SECRET`    | Yes    | Required only if webhook transport is later approved |
| `GMGN_API_KEY`               | Yes    | Optional; absent disables GMGN adapter               |
| `BIRDEYE_API_KEY`            | Yes    | Optional; absent disables Birdeye adapter            |

DexScreener requires no secret under the approved public API contract.

### 10.4 Secret handling

- `.env` is permitted only for local development and must be Git-ignored.
- Production secrets must be injected by the host secret mechanism or mounted permission-restricted files.
- Environment variables containing secrets must never be copied into structured configuration objects, logs, reports or exceptions.
- `TRADING_WALLET_SECRET_FILE` must resolve to a regular file owned by the runtime user with mode `0600` or stricter.
- Development and production credentials must be different.
- Credential rotation must require no source or build change.

## 11. Network and endpoint requirements

Outbound TLS access must be limited to the configured provider hosts for:

- Primary and fallback Solana HTTPS/WSS RPC.
- Helius HTTPS/WSS and Sender.
- Jupiter HTTPS.
- DexScreener HTTPS.
- Telegram Bot API HTTPS.
- Optional approved GMGN and Birdeye HTTPS endpoints.

PostgreSQL must not be publicly exposed. The application does not accept public inbound traffic in the initial long-polling deployment. Webhook mode is not enabled until its server and network contract receive schema approval.

## 12. Installation verification

Run after authorized package installation:

```bash
node --version
npm --version
psql --version
docker version
docker compose version
npm ls --depth=0
npm audit --audit-level=high
npx tsc --version
npx vitest --version
npx eslint --version
```

Required results:

- `node --version` returns `v24.18.1`.
- `npm --version` returns `11.9.0`.
- `psql --version` identifies PostgreSQL `18.4`.
- `npm ls --depth=0` reports every package in Sections 3 and 4 at the exact version and reports no missing, invalid or extraneous package.
- `npm audit --audit-level=high` exits successfully with no unresolved high or critical vulnerability.
- TypeScript, Vitest and ESLint versions match Sections 3 and 4.
- Docker can start and remove the disposable PostgreSQL 18.4 test service.

An audit finding is a stop condition. Dependency substitution, downgrading, overrides or audit suppression require an approved manifest revision.

## 13. Provider proof prerequisites

Package installation does not prove provider readiness. Before each adapter is authored, complete the six manual contract proofs required by `SERVICE_CONTRACTS.md` Section 13.

No real secret, wallet address, Telegram identifier, transaction payload or unsanitized provider response may enter a proof fixture.

## 14. Update policy

- Exact versions remain frozen through one validated operating stage.
- Security fixes are handled as explicit dependency changes, not automatic range resolution.
- Every update requires registry verification, compatibility review, lockfile regeneration, full test execution and a changelog entry.
- Solana Kit and `@solana-program/token` must be upgraded together when their peer-dependency contract requires it.
- Vitest and `@vitest/coverage-v8` must always use identical versions.
- Node.js and `@types/node` must remain on the same major version.
- PostgreSQL production, development and integration-test environments must remain on the same major and approved minor version.

## 15. Approval gate

Approval of this document authorizes creation of `SYSTEM_SCHEMA.md` only.

It does not authorize:

- Repository initialization.
- Package installation.
- Creation of `package.json` or `package-lock.json`.
- Database creation or migration.
- Provider-account configuration.
- Source code.

## Revision history

| Version | Date       | Change                                                                                        | Reason                                                                                    |
| ------- | ---------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1.0.1   | 2026-08-04 | Replaced `typescript@7.0.2` with `typescript@6.0.3`                                           | Satisfy the `typescript-eslint@8.66.0` peer dependency requiring TypeScript below `6.1.0` |
| 1.0.0   | 2026-08-03 | Created exact dependency and runtime contract from approved service contracts and project map | Complete the third pre-code specification gate                                            |
