# Memecoined Changelog

## Unreleased — TimSyS supervised-child boundary

### 2026-08-11

| File                                             | Change                                                                 | Reason                                                                            | Status                 |
| ------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------- |
| `timsys.app.json`                                | Declared isolated worker, dashboard, readiness, and shutdown lifecycle | Give TimSyS a narrow machine-readable launcher contract                           | Authorized by operator |
| `.env.example`                                   | Added the explicit application-root variable                           | Support relocation beneath `TimSyS_v6/apps` without storing credentials in source | Authorized by operator |
| `src/infrastructure/runtime/application-root.ts` | Added absolute managed-root resolution with standalone fallback        | Remove install-asset dependence on the caller's working directory                 | Authorized by operator |
| `scripts/migrate.ts`                             | Resolved migration files from the application root                     | Keep migrations correct after relocation and launcher-managed startup             | Authorized by operator |
| `src/entrypoints/dashboard.ts`                   | Added readiness response, relocatable assets, and graceful termination | Enable TimSyS health monitoring and bounded child-process shutdown                | Authorized by operator |
| `tests/unit/application-root.test.ts`            | Added managed, standalone, and invalid-root coverage                   | Prove relocation behavior                                                         | Authorized by operator |
| `tests/integration/paper-dashboard.test.ts`      | Added readiness route and method-boundary coverage                     | Prove the launcher health contract is read-only                                   | Authorized by operator |
| `vitest.config.ts`                               | Registered the application-root suite                                  | Include relocation behavior in every repository gate                              | Authorized by operator |
| `CHANGELOG.md`                                   | Recorded the supervised-child boundary                                 | Maintain the required file-touch audit                                            | Authorized by operator |

## Unreleased — Durable operational-safety facts

- Persisted immutable reconciliation-failure events instead of relying on mutable latest-error state.
- Added restart-safe provider-disagreement intervals with explicit resolution evidence.
- Added PostgreSQL reconstruction sources for rolling failures and continuous disagreement duration.
- Added migration 0026 and focused persistence coverage.

## Unreleased — Durable portfolio operational safety authority

- Added immutable, hash-verified operational safety observations.
- Bound exposure, executable downside, reconciliation failures, and provider disagreement to one instant.
- Rejected missing, duplicated, postdated, mismatched, or tampered authority.
- Added migration 0025 and restart-safe PostgreSQL reconstruction coverage.

## Unreleased — Durable tracked-wallet observations

- Added live Helius acquisition polling for qualified Tier A and Tier B wallets.
- Persisted immutable raw token/native deltas without inventing USD valuation.
- Advanced polling cursors atomically with deduplicated purchase evidence.
- Added migration 0019 and provider, authority-binding, rollback, and collection coverage.

## Unreleased — Durable trusted-wallet authority

- Implemented evidence-backed wallet qualification for Tiers A, B, C, and ineligible wallets.
- Enforced independent, fresh, retained, sufficiently sized, price-bounded purchase confirmation.
- Added immutable qualification and candidate-confirmation persistence in migration 0018.
- Registered the previously empty wallet performance and classifier suites.

## Unreleased — Durable candidate evaluation work

- Added transactional evaluation-job leasing with candidate identity hydration.
- Bound evaluation completion to the active lease owner.
- Returned evidence-acquisition failures to the durable queue without evaluating partial facts.
- Added claim, validation, retry, and lease-bound completion coverage.

## Unreleased — Durable entry submission

- Bound inspection and signing to the prepared wallet, transaction, block height, and fee authority.
- Persisted deterministic signed authority before the external submission side effect.
- Atomically recorded acknowledgement, completed signing work, and scheduled reconciliation.
- Added migration 0017 and ordering, fail-closed, external-failure, and rollback coverage.

## Unreleased — Durable entry preparation

- Enforced the complete entry quote gate before signing authority.
- Atomically persisted gate evidence, prepared buy orders, plan state, and signing work.
- Added migration 0016 and approval, rejection, binding, and rollback coverage.

## Unreleased — Durable risk approval

### 2026-08-04

| File                                                   | Change                                                             | Reason                                                                               | Status                 |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------- |
| `src/domain/portfolio/breakers.ts`                     | Added deterministic CBR-001–008 evaluation and lock classification | Block new entries on loss, drawdown, reconciliation, security, or authority failures | Authorized by operator |
| `src/application/services/risk-monitor.ts`             | Composed synchronized sizing and circuit-breaker decisions         | Require one coherent risk instant before approval                                    | Authorized by operator |
| `src/application/services/entry-planner.ts`            | Added risk assessment persistence orchestration                    | Keep domain policy independent of PostgreSQL                                         | Authorized by operator |
| `src/application/ports/repositories.ts`                | Added atomic risk decision contract                                | Bind approval, sizing, and follow-up scheduling                                      | Authorized by operator |
| `src/infrastructure/database/candidate-evaluations.ts` | Scheduled risk evaluation after eligible signals                   | Continue the durable acquisition pipeline                                            | Authorized by operator |
| `src/infrastructure/database/risk-decisions.ts`        | Added transactional approval/rejection persistence                 | Prevent partial entry authorization                                                  | Authorized by operator |
| `src/workers/risk-worker.ts`                           | Added bounded deterministic risk cycles                            | Process claimable signals without unbounded work                                     | Authorized by operator |
| `migrations/0015_risk_decisions.sql`                   | Added risk decisions and entry plans                               | Preserve exact sizing and approval authority                                         | Authorized by operator |
| `tests/unit/circuit-breakers.test.ts`                  | Added threshold, clear-state, and fail-closed coverage             | Prove all eight breaker boundaries                                                   | Authorized by operator |
| `tests/integration/risk-pipeline.test.ts`              | Added approval, rejection, chronology, and rollback coverage       | Prove atomic risk-to-entry handoff                                                   | Authorized by operator |
| `vitest.config.ts`                                     | Activated risk suites                                              | Include risk authorization in every gate                                             | Authorized by operator |
| `CHANGELOG.md`                                         | Recorded durable risk approval work                                | Maintain the required file-touch audit                                               | Authorized by operator |

## Unreleased — Durable candidate evaluation

### 2026-08-04

| File                                                   | Change                                                            | Reason                                                        | Status                 |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| `src/domain/candidate/scoring.ts`                      | Added deterministic SCR-001–012 component scoring                 | Apply the approved non-overlapping 95-point score model       | Authorized by operator |
| `src/domain/candidate/evaluator.ts`                    | Added ordered security, market, and score aggregation             | Prevent score points from overriding any failed absolute gate | Authorized by operator |
| `src/application/ports/repositories.ts`                | Added atomic candidate-evaluation persistence contract            | Keep evidence, score, outcome, and job completion indivisible | Authorized by operator |
| `src/application/services/candidate-pipeline.ts`       | Added evaluate-and-persist orchestration                          | Connect normalized candidate facts to a durable decision      | Authorized by operator |
| `src/infrastructure/database/candidate-evaluations.ts` | Added transactional decision, signal, and rejection persistence   | Preserve append-only evidence and terminal state atomically   | Authorized by operator |
| `src/workers/candidate-worker.ts`                      | Added bounded deterministic candidate-evaluation cycles           | Establish the acquisition evaluation worker boundary          | Authorized by operator |
| `migrations/0014_candidate_evaluations.sql`            | Added rule evaluation, score, signal, and rejection tables        | Persist versioned acquisition decisions                       | Authorized by operator |
| `tests/unit/candidate-scoring.test.ts`                 | Added maximum, boundary, missing-data, and invalid-input coverage | Prove scoring is deterministic and fail-closed                | Authorized by operator |
| `vitest.config.ts`                                     | Registered the candidate-scoring suite                            | Keep the explicit test inventory complete                     | Authorized by operator |
| `CHANGELOG.md`                                         | Recorded the durable candidate-evaluation batch                   | Preserve file-touch history                                   | Authorized by operator |

## Unreleased — Durable candidate discovery

### 2026-08-04

| File                                                 | Change                                                                  | Reason                                                | Status                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------- |
| `src/domain/candidate/model.ts`                      | Added canonical discovered-candidate identity and provenance invariants | Establish the acquisition aggregate boundary          | Authorized by operator |
| `src/application/ports/repositories.ts`              | Added atomic candidate-discovery persistence contract                   | Keep identity, provenance, and scheduling indivisible | Authorized by operator |
| `src/application/services/discovery.ts`              | Added normalized, window-bound candidate discovery                      | Deduplicate retries without losing sources            | Authorized by operator |
| `src/workers/discovery-worker.ts`                    | Added bounded deterministic discovery cycles                            | Create a controlled acquisition worker boundary       | Authorized by operator |
| `src/infrastructure/database/candidate-discovery.ts` | Added transactional PostgreSQL discovery persistence                    | Prevent candidates without evaluation work            | Authorized by operator |
| `migrations/0013_candidate_discovery.sql`            | Added candidate and candidate-source tables                             | Persist acquisition identity and provenance           | Authorized by operator |
| `tests/integration/candidate-discovery.test.ts`      | Added validation, orchestration, commit, and rollback coverage          | Prove the discovery boundary fails closed             | Authorized by operator |
| `vitest.config.ts`                                   | Registered the candidate-discovery suite                                | Keep the explicit test inventory complete             | Authorized by operator |
| `CHANGELOG.md`                                       | Recorded the discovery batch                                            | Preserve file-touch history                           | Authorized by operator |

## Unreleased — Immediate position supervision

### 2026-08-04

| File                                          | Change                                                                    | Reason                                                                                | Status                 |
| --------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------- |
| `src/infrastructure/database/repositories.ts` | Scheduled newly initialized position checkpoints as immediately available | Ensure every atomically opened position enters the supervisor's durable polling queue | Authorized by operator |
| `tests/integration/persistence.test.ts`       | Required the initial checkpoint job to be available rather than completed | Prove position opening cannot silently terminate supervision before its first cycle   | Authorized by operator |
| `CHANGELOG.md`                                | Recorded the immediate position-supervision correction                    | Preserve the required file-touch history                                              | Authorized by operator |

## Unreleased — Atomic position opening

### 2026-08-04

| File                                                         | Change                                                                            | Reason                                                                                        | Status                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| `src/application/ports/repositories.ts`                      | Added the position-opening persistence contract                                   | Require every new runtime checkpoint to carry its immutable entry authority                   | Authorized by operator |
| `src/infrastructure/database/runtime-authority-baselines.ts` | Exposed validated canonical baseline preparation                                  | Reuse one content-addressing contract inside standalone capture and transactional opening     | Authorized by operator |
| `src/infrastructure/database/repositories.ts`                | Made context, authority baseline, and initial checkpoint creation one transaction | Eliminate a crash window in which an opened position could exist without monitoring authority | Authorized by operator |
| `tests/integration/persistence.test.ts`                      | Added atomic opening, persisted identity, content hash, and rollback coverage     | Prove incomplete position openings cannot commit                                              | Authorized by operator |
| `CHANGELOG.md`                                               | Recorded the atomic position-opening slice                                        | Preserve the required file-touch history                                                      | Authorized by operator |

## Unreleased — Runtime authority baseline capture

### 2026-08-04

| File                                                         | Change                                                            | Reason                                                                                     | Status                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------- |
| `src/application/ports/runtime-authority-inputs.ts`          | Added the immutable authority-baseline sink contract              | Expose baseline capture without coupling entry orchestration to PostgreSQL                 | Authorized by operator |
| `src/infrastructure/database/runtime-authority-baselines.ts` | Added validated, content-addressed, idempotent baseline capture   | Make the existing immutable baseline schema writable without permitting conflicting replay | Authorized by operator |
| `tests/integration/runtime-authority-baselines.test.ts`      | Added capture, replay, conflict, chronology, and round-trip tests | Prove baseline persistence fails closed                                                    | Authorized by operator |
| `vitest.config.ts`                                           | Activated baseline persistence tests                              | Include the new boundary in every repository gate                                          | Authorized by operator |
| `CHANGELOG.md`                                               | Recorded the baseline-capture slice                               | Preserve the required file-touch history                                                   | Authorized by operator |

## Unreleased — Atomic migration history

### 2026-08-04

| File                                           | Change                                                                             | Reason                                                                             | Status                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| `scripts/migrate.ts`                           | Made the runner own the transaction around each migration body and checksum record | Eliminate the crash window between schema commit and migration-history persistence | Authorized by operator |
| `tests/integration/migrations.test.ts`         | Added atomic body-and-history ordering coverage                                    | Prove migration history commits with its schema change                             | Authorized by operator |
| `tests/integration/production-startup.test.ts` | Extended the ready-schema fixture through migration `0010`                         | Keep production lifecycle coverage aligned with the runtime readiness contract     | Authorized by operator |
| `CHANGELOG.md`                                 | Recorded the atomic migration correction                                           | Preserve the required file-touch history                                           | Authorized by operator |

## Unreleased — Checkpoint-bound fact publishing

### 2026-08-04

| File                                                | Change                                                                                                                | Reason                                                                             | Status                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------- |
| `src/infrastructure/database/runtime-facts.ts`      | Added transactional, revision-checked fact publication with immutable observation provenance                          | Prevent stale, future-dated, cross-position, or untraceable facts reaching workers | Authorized by operator |
| `tests/integration/runtime-fact-publishing.test.ts` | Added successful publication, stale revision, missing provenance, duplicate evidence, conflict, and rollback coverage | Prove snapshot publication is atomic and fail-closed                               | Authorized by operator |
| `vitest.config.ts`                                  | Activated runtime-fact publishing tests                                                                               | Run the publication contract in every full gate                                    | Authorized by operator |
| `CHANGELOG.md`                                      | Recorded the fact-publishing slice                                                                                    | Preserve the required file-touch history                                           | Authorized by operator |

## Unreleased — Immutable position observations

### 2026-08-04

| File                                                   | Change                                                                    | Reason                                                                     | Status                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------- |
| `migrations/0010_position_observations.sql`            | Added append-only position observations and runtime-fact provenance links | Establish durable upstream evidence before derived snapshots are published | Authorized by operator |
| `src/infrastructure/database/position-observations.ts` | Added canonical, content-addressed, idempotent observation ingestion      | Reject mutated replays and non-JSON evidence                               | Authorized by operator |
| `src/infrastructure/database/migrations.ts`            | Required observation and provenance tables at runtime startup             | Prevent workers starting against an incomplete evidence schema             | Authorized by operator |
| `tests/integration/observation-ingestion.test.ts`      | Added canonicalization, replay, conflict, and malformed-payload coverage  | Prove the observation boundary is immutable and fail-closed                | Authorized by operator |
| `vitest.config.ts`                                     | Activated observation-ingestion tests                                     | Run the new persistence contract in every full gate                        | Authorized by operator |
| `CHANGELOG.md`                                         | Recorded the observation-ingestion slice                                  | Preserve the required file-touch history                                   | Authorized by operator |

## Unreleased — Migration execution tooling

### 2026-08-04

| File                                   | Change                                                                                     | Reason                                                                                 | Status                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ---------------------- |
| `scripts/migrate.ts`                   | Added ordered checksum-bound migration execution under an exclusive database advisory lock | Apply forward migrations with separate authority and reject gaps or modified history   | Authorized by operator |
| `tests/integration/migrations.test.ts` | Added sequence, reserved-slot, checksum-drift, and lock-release coverage                   | Prove migration execution fails closed while retaining approved empty historical slots | Authorized by operator |
| `package.json`                         | Added the `npm run migrate` command                                                        | Expose the migration entrypoint without granting schema authority to runtime startup   | Authorized by operator |
| `CHANGELOG.md`                         | Recorded the migration tooling slice                                                       | Preserve the required file-touch history                                               | Authorized by operator |

All material file touches are recorded here. Dates use UTC. Entries identify the file, change, reason, and authorization state.

## Unreleased — Runtime implementation

### 2026-08-04

| File                                                                                                                                                 | Change                                                                                                                    | Reason                                                                                                 | Status                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- |
| `src/infrastructure/config/load-config.ts`; `tests/security/startup-config.test.ts`; `vitest.config.ts`                                              | Added strict, mode-aware runtime parsing, credential minimization tests, and suite activation                             | Prevent partial or secret-leaking startup configuration                                                | Authorized by operator |
| `src/infrastructure/database/pool.ts`; `src/infrastructure/database/migrations.ts`; `tests/integration/startup-database.test.ts`; `vitest.config.ts` | Added bounded TLS pool construction and read-only runtime schema readiness verification                                   | Fail startup before workers when connectivity or required migrations are absent                        | Authorized by operator |
| `src/entrypoints/composition.ts`; `src/entrypoints/main.ts`; `tests/integration/production-startup.test.ts`; `vitest.config.ts`                      | Composed the completed position runtime and added schema-first startup, cooperative signals, and guaranteed pool shutdown | Make the durable position subsystem process-ready without claiming unfinished adapters are operational | Authorized by operator |

## Unreleased — Phase 2 deterministic domain core

### 2026-08-04

| File                                         | Change                                                                    | Reason                                                        | Status                 |
| -------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| `src/workers/supervisor.ts`                  | Added startup-first polling, abort-driven shutdown, and fatal propagation | Run durable jobs continuously without hiding invariant faults | Authorized by operator |
| `src/infrastructure/runtime/system-clock.ts` | Added system time and abort-aware scheduling waits                        | Make production polling responsive to graceful shutdown       | Authorized by operator |
| `tests/integration/supervisor.test.ts`       | Added recovery-once, repeated polling, fatal, shutdown, and bound tests   | Prove supervisor lifecycle and failure behavior               | Authorized by operator |
| `vitest.config.ts`                           | Activated the supervisor integration suite                                | Include continuous job operation in every gate                | Authorized by operator |
| `CHANGELOG.md`                               | Recorded continuous supervision and graceful shutdown                     | Maintain the required file-touch audit                        | Authorized by operator |

| File                                               | Change                                                                            | Reason                                                          | Status                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| `src/application/ports/runtime.ts`                 | Added durable due-job and startup-recovery contracts plus successful rescheduling | Separate queue enumeration from exclusive worker ownership      | Authorized by operator |
| `src/infrastructure/database/job-store.ts`         | Added due-job queries, expired-lease reclamation, and non-terminal rescheduling   | Recover abandoned work and keep active positions scheduled      | Authorized by operator |
| `src/workers/reconciliation-worker.ts`             | Rescheduled successful active positions at deterministic monitoring intervals     | Prevent successful cycles from permanently removing active work | Authorized by operator |
| `src/workers/supervisor.ts`                        | Added bounded startup recovery and deterministic due-position batch execution     | Establish the durable job-runner boundary                       | Authorized by operator |
| `tests/integration/job-runner.test.ts`             | Added recovery, stable-order, duplicate, and batch-boundary tests                 | Prove scheduling fails closed before worker execution           | Authorized by operator |
| `tests/integration/reconciliation-locking.test.ts` | Added due-query, abandoned-lease, and successful-reschedule database tests        | Prove queue state changes preserve ownership rules              | Authorized by operator |
| `tests/failure/reconciliation-retry.test.ts`       | Extended the fake job store with the successful rescheduling contract             | Keep retry policy tests aligned with the runtime port           | Authorized by operator |
| `vitest.config.ts`                                 | Activated the durable job-runner integration suite                                | Include scheduling and startup recovery in every gate           | Authorized by operator |
| `CHANGELOG.md`                                     | Recorded durable scheduling and startup-recovery work                             | Maintain the required file-touch audit                          | Authorized by operator |

| File                                               | Change                                                                                   | Reason                                                             | Status                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------- |
| `src/application/ports/runtime.ts`                 | Added reconciliation lease, retry-failure, job-store, and critical-escalation contracts  | Keep retry policy independent of PostgreSQL and operator delivery  | Authorized by operator |
| `src/application/services/position-monitor.ts`     | Classified unresolved reconciliation outcomes                                            | Prevent finalized failures from being retried as pending evidence  | Authorized by operator |
| `src/workers/reconciliation-worker.ts`             | Added exclusive cycles, deterministic retry scheduling, terminal failure, and escalation | Prevent concurrent reconciliation and endless automatic retries    | Authorized by operator |
| `src/infrastructure/database/job-store.ts`         | Added session advisory locking and durable retry/failure state                           | Preserve crash-safe ownership across checkpoint writes             | Authorized by operator |
| `migrations/0008_reconciliation_jobs.sql`          | Added paired durable job error metadata                                                  | Retain the exact reason for retry or escalation                    | Authorized by operator |
| `tests/failure/reconciliation-retry.test.ts`       | Added lock, backoff, terminal, ordering, and unknown-failure tests                       | Prove retry orchestration fails closed                             | Authorized by operator |
| `tests/failure/reconciliation.test.ts`             | Asserted pending, balance-mismatch, and on-chain-failure classifications                 | Bind retryability to authoritative reconciliation evidence         | Authorized by operator |
| `tests/integration/reconciliation-locking.test.ts` | Added PostgreSQL session-lock, scheduling, and conflict-release tests                    | Prove one worker owns reconciliation and locks are always released | Authorized by operator |
| `vitest.config.ts`                                 | Activated retry and locking suites                                                       | Include reconciliation recovery in every repository gate           | Authorized by operator |
| `CHANGELOG.md`                                     | Recorded failed-exit retry, escalation, and locking slice                                | Maintain the required file-touch audit                             | Authorized by operator |

| File                                                        | Change                                                                                    | Reason                                                               | Status                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------- |
| `src/application/contracts/observations.ts`                 | Added normalized confirmed-transaction and raw wallet-delta evidence                      | Keep reconciliation independent of RPC-native payloads               | Authorized by operator |
| `src/application/ports/chain.ts`                            | Added authoritative transaction-observation port                                          | Separate confirmation reads from balance reads                       | Authorized by operator |
| `src/application/ports/repositories.ts`                     | Required acknowledged runtime state in action acknowledgement                             | Persist the submitted signature atomically with dispatch completion  | Authorized by operator |
| `src/application/ports/runtime.ts`                          | Added reconciliation facts and submission-receipt dispatch contracts                      | Supply exact durable reconciliation authority                        | Authorized by operator |
| `src/application/services/execution.ts`                     | Returned and replayed exact Sender receipts from durable dispatch                         | Preserve submission identity without claiming confirmation           | Authorized by operator |
| `src/application/services/position-monitor.ts`              | Bound acknowledged submission metadata into pending exits                                 | Make confirmation restart-safe                                       | Authorized by operator |
| `src/application/services/reconciliation.ts`                | Added confirmed-transaction and post-balance reconciliation assembly                      | Close positions only from authoritative matching deltas              | Authorized by operator |
| `src/infrastructure/database/repositories.ts`               | Atomically persisted acknowledged runtime state and cleared pending delivery              | Prevent signature loss between submission and confirmation           | Authorized by operator |
| `src/infrastructure/providers/solana/transaction-parser.ts` | Added dual-RPC status, transaction, wallet-delta, fee, and allowlisted-tip reconstruction | Reject malformed, mismatched, or contradictory confirmation evidence | Authorized by operator |
| `src/workers/position-worker.ts`                            | Recorded submission receipt before acknowledging dispatch                                 | Preserve exact crash-recovery sequencing                             | Authorized by operator |
| `src/workers/reconciliation-worker.ts`                      | Added durable reconciliation worker cycle                                                 | Run reconciliation through the existing checkpoint protocol          | Authorized by operator |
| `tests/contract/solana.test.ts`                             | Added confirmation, pending, disagreement, signature, delta, and tip tests                | Prove the raw Solana confirmation boundary fails closed              | Authorized by operator |
| `tests/failure/reconciliation.test.ts`                      | Added closure, pending, failure, outage, and balance-mismatch tests                       | Prove signatures alone cannot close positions                        | Authorized by operator |
| `tests/integration/persistence.test.ts`                     | Covered acknowledged runtime-state persistence                                            | Prove acknowledgement retains durable state                          | Authorized by operator |
| `tests/integration/restart-recovery.test.ts`                | Covered durable submission receipt retention                                              | Prove restart recovery retains the exact signature                   | Authorized by operator |
| `vitest.config.ts`                                          | Activated reconciliation failure suite                                                    | Include reconciliation authority in every gate                       | Authorized by operator |
| `CHANGELOG.md`                                              | Recorded transaction confirmation and reconciliation slice                                | Maintain the required file-touch audit                               | Authorized by operator |

| File                                                        | Change                                                                                                            | Reason                                                                               | Status                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| `src/application/ports/signer.ts`                           | Added inspection, local-signing, signed-transaction, receipt, and submission contracts                            | Keep secret-bearing execution behind provider-independent authority boundaries       | Authorized by operator |
| `src/application/ports/runtime.ts`                          | Added current-chain authority and dispatcher dependency contracts                                                 | Supply signing-time freshness and block-height facts without infrastructure imports  | Authorized by operator |
| `src/application/services/execution.ts`                     | Added durable submit-exit dispatch through inspection, signer identity, local signing, and Sender acknowledgement | Execute only the exact checkpointed transaction and preserve idempotent crash replay | Authorized by operator |
| `src/application/services/position-monitor.ts`              | Retained the accepted quote timestamp in the durable execution action                                             | Recheck the two-second quote limit at signing rather than only at evaluation         | Authorized by operator |
| `src/infrastructure/security/transaction-inspector.ts`      | Added fingerprint, expiry, signer, fee-payer, program, fee, and asset-transfer enforcement                        | Reject altered or unauthorized Jupiter transactions before secret-key use            | Authorized by operator |
| `src/infrastructure/security/local-signer.ts`               | Added exact-wallet local Ed25519 signing with canonical Solana transaction encoding                               | Ensure private signing material never reaches a provider                             | Authorized by operator |
| `src/infrastructure/providers/helius/client.ts`             | Added Sender transport response and explicit submission-failure contracts                                         | Separate transport behavior from submission policy                                   | Authorized by operator |
| `src/infrastructure/providers/helius/submission-adapter.ts` | Added exact-signature Sender acknowledgement and delivery collision protection                                    | Make repeated delivery safe without treating acknowledgement as confirmation         | Authorized by operator |
| `tests/security/transaction-inspection.test.ts`             | Added tampering, expiry, signer, program, fee, transfer, and real cryptographic signing tests                     | Prove the pre-signing trust boundary fails closed                                    | Authorized by operator |
| `tests/contract/helius.test.ts`                             | Added acknowledgement, deduplication, collision, malformed, mismatch, and outage tests                            | Prove Sender remains an idempotent submission-only authority                         | Authorized by operator |
| `tests/integration/execution.test.ts`                       | Added the durable execution quote timestamp fixture                                                               | Exercise signing-time freshness retention                                            | Authorized by operator |
| `tests/integration/position-worker.test.ts`                 | Added the durable execution quote timestamp fixture                                                               | Prove checkpoint actions retain signing authority context                            | Authorized by operator |
| `vitest.config.ts`                                          | Activated Helius submission and transaction-security suites                                                       | Include signing and submission boundaries in every repository gate                   | Authorized by operator |
| `CHANGELOG.md`                                              | Recorded the inspected local-signing and submission slice                                                         | Maintain the required file-touch audit                                               | Authorized by operator |

| File                                           | Change                                                                                                      | Reason                                                                                        | Status                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| `src/application/ports/runtime.ts`             | Added persisted monitoring-fact and chronology contracts for concrete position-step acquisition             | Separate authoritative historical inputs from live provider observations                      | Authorized by operator |
| `src/application/services/execution.ts`        | Added deterministic market, chain, quote, construction, and simulation assembly into position runtime steps | Supply the worker with exact evidence-bound executable observations while failing closed      | Authorized by operator |
| `src/application/services/position-monitor.ts` | Bound the exact simulated transaction payload and validity context into durable submit-exit actions         | Preserve executable identity across checkpointing, dispatch retries, and process restarts     | Authorized by operator |
| `tests/integration/execution.test.ts`          | Added exact prepared-transaction action binding coverage                                                    | Prove exit intents retain the transaction that was quoted and simulated                       | Authorized by operator |
| `tests/integration/position-worker.test.ts`    | Added prepared transaction fixtures to durable worker transitions                                           | Exercise checkpoint serialization of the complete executable action                           | Authorized by operator |
| `tests/integration/restart-recovery.test.ts`   | Added chronology, evidence, balance-discrepancy, provider-failure, simulation, and worker integration tests | Prove adapter output reaches durable orchestration without partial or unbound runtime actions | Authorized by operator |
| `vitest.config.ts`                             | Activated the assembled position-runtime integration suite                                                  | Include concrete provider-to-worker composition in every verification run                     | Authorized by operator |
| `CHANGELOG.md`                                 | Recorded the executable position-runtime assembly slice                                                     | Maintain the required file-touch audit                                                        | Authorized by operator |

| File                                              | Change                                                                                                     | Reason                                                                                 | Status                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------- |
| `src/application/ports/swap.ts`                   | Added provider-independent exact-input quote, construction, simulation, result, and failure contracts      | Isolate executable swap acquisition from provider-native payloads                      | Authorized by operator |
| `src/infrastructure/providers/jupiter/client.ts`  | Added authenticated Swap API v1 transport with explicit HTTP and network-failure classification            | Keep supported Jupiter transport and retry semantics behind one strict boundary        | Authorized by operator |
| `src/infrastructure/providers/jupiter/adapter.ts` | Added exact quote validation, deterministic identity, exact construction binding, and RPC simulation       | Supply immutable executable quotes and simulated transactions without trusting Jupiter | Authorized by operator |
| `tests/contract/jupiter.test.ts`                  | Added quote, schema, status, identity, construction, tampering, transaction, and simulation contract tests | Prove the Jupiter boundary fails closed and preserves exact execution intent           | Authorized by operator |
| `vitest.config.ts`                                | Activated the Jupiter provider contract suite                                                              | Include executable swap acquisition in every verification run                          | Authorized by operator |
| `CHANGELOG.md`                                    | Recorded the deterministic Jupiter adapter slice                                                           | Maintain the required file-touch audit                                                 | Authorized by operator |

| File                                                   | Change                                                                                         | Reason                                                                                | Status                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------- |
| `src/application/contracts/observations.ts`            | Added normalized market/chain observation, trace, identity, result, and failure contracts      | Prevent provider-native data and ambiguous failures from reaching strategy logic      | Authorized by operator |
| `src/application/ports/market.ts`                      | Added provider-independent primary-pool observation port                                       | Isolate market acquisition from application and domain code                           | Authorized by operator |
| `src/application/ports/chain.ts`                       | Added provider-independent authoritative balance observation port                              | Isolate chain acquisition and fallback behavior from position logic                   | Authorized by operator |
| `src/infrastructure/providers/dexscreener/adapter.ts`  | Added schema-validated token-pair lookup, deterministic pool selection, and evidence tracing   | Supply secondary market evidence without trusting response order or missing values    | Authorized by operator |
| `src/infrastructure/providers/solana/rpc-client.ts`    | Added strict JSON-RPC request/response and transport failure boundary                          | Reject malformed RPC envelopes and distinguish retryable transport failures           | Authorized by operator |
| `src/infrastructure/providers/solana/chain-adapter.ts` | Added confirmed balance normalization, fallback reads, agreement checks, and evidence tracing  | Supply authoritative integer balances while rejecting contradictory providers         | Authorized by operator |
| `tests/contract/dexscreener.test.ts`                   | Added selection, null, failure, malformed, timestamp, hashing, and immutability contract tests | Prove DexScreener responses are normalized deterministically and fail closed          | Authorized by operator |
| `tests/contract/solana.test.ts`                        | Added agreement, fallback, total-outage, malformed, integer, slot, and evidence contract tests | Prove chain balance observations preserve authority and provider-failure distinctions | Authorized by operator |
| `vitest.config.ts`                                     | Activated DexScreener and Solana contract suites                                               | Include provider contract boundaries in every verification run                        | Authorized by operator |
| `CHANGELOG.md`                                         | Recorded the market and chain observation adapter slice                                        | Maintain the required file-touch audit                                                | Authorized by operator |

| File                                          | Change                                                                           | Reason                                                      | Status                 |
| --------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------- |
| `migrations/0006_operations.sql`              | Added durable jobs and append-only audit events                                  | Provide the worker persistence substrate                    | Authorized by operator |
| `src/infrastructure/database/repositories.ts` | Added transactional PostgreSQL position checkpoint persistence                   | Make worker recovery durable and compare-and-swap protected | Authorized by operator |
| `tests/integration/persistence.test.ts`       | Added serialization, atomicity, rollback, concurrency, and acknowledgement tests | Prove persistence fails closed                              | Authorized by operator |
| `vitest.config.ts`                            | Activated the persistence integration suite                                      | Include persistence in every verification run               | Authorized by operator |

| File                                        | Change                                                                                                              | Reason                                                                                             | Status                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| `src/application/ports/repositories.ts`     | Added compare-and-swap position checkpoint, atomic transition, event, pending-action, and acknowledgement contracts | Prevent split persistence and duplicate concurrent advancement                                     | Authorized by operator |
| `src/application/ports/runtime.ts`          | Added deterministic step-source and idempotent action-dispatch contracts                                            | Isolate provider acquisition and external effects from the pure runtime                            | Authorized by operator |
| `src/workers/position-worker.ts`            | Added checkpoint-first worker execution, pending-action recovery, dispatch acknowledgement, and validation          | Connect the pure position runtime to durable persistence and provider adapters without unsafe gaps | Authorized by operator |
| `tests/integration/position-worker.test.ts` | Added atomicity, concurrency, crash-recovery, duplicate-dispatch, and corrupt-checkpoint tests                      | Prove the worker resumes safely across each persistence and dispatch boundary                      | Authorized by operator |
| `vitest.config.ts`                          | Activated the deterministic position-worker integration suite                                                       | Include the worker boundary in every verification run                                              | Authorized by operator |

| File                                           | Change                                                                                 | Reason                                                                                        | Status                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| `src/application/services/position-monitor.ts` | Added a pure, restart-safe monitoring and exit orchestration cycle                     | Connect exit evidence, intent creation, reconciliation, and position events deterministically | Authorized by operator |
| `src/domain/trading/position.ts`               | Added an explicit continuation reconciliation target                                   | Preserve an unsatisfied profit target after a partial fill                                    | Authorized by operator |
| `tests/integration/execution.test.ts`          | Added orchestration, precedence, idempotency, restart, partial-fill, and closure tests | Prove the connected runtime boundary is fail-closed                                           | Authorized by operator |
| `vitest.config.ts`                             | Activated the orchestration integration suite                                          | Include runtime orchestration in every verification run                                       | Authorized by operator |

| File                                     | Change                                                                                                                                 | Reason                                                                                   | Status                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------- |
| `src/domain/trading/order.ts`            | Added deterministic standard-exit intent binding, two-second quote gate, rule/amount validation, and generic reconciled sell execution | Execute EXT-001–006 decisions without weakening emergency execution or balance authority | Authorized by operator |
| `tests/unit/standard-execution.test.ts`  | Added standard full/partial exit, quote boundary, binding, partial-fill, and reconciliation tests                                      | Prove standard exit execution is deterministic and fail-closed                           | Authorized by operator |
| `tests/unit/emergency-execution.test.ts` | Asserted requested-amount completion for emergency partial and full fills                                                              | Preserve emergency behavior through the shared reconciled sell evaluator                 | Authorized by operator |
| `vitest.config.ts`                       | Activated the standard-execution unit suite                                                                                            | Include the new execution slice in every test run                                        | Authorized by operator |

| File                                     | Change                                                                                                                                              | Reason                                                                                                  | Status                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| `package.json`                           | Locked project metadata, native ESM, runtime engines, and build/typecheck/test/format scripts                                                       | Activate the approved toolchain contract                                                                | Authorized by operator |
| `package-lock.json`                      | Synchronized root package metadata with `package.json`                                                                                              | Preserve reproducible installation                                                                      | Authorized by operator |
| `tsconfig.json`                          | Added strict NodeNext/ES2024 compiler and emission contract                                                                                         | Enforce deterministic, type-safe production compilation                                                 | Authorized by operator |
| `.prettierrc.json`                       | Added deterministic formatting rules                                                                                                                | Activate the approved formatter and remove the empty-config startup failure                             | Authorized by operator |
| `src/domain/shared/types.ts`             | Added branded identities, time, quantities, decimal values, providers, results, and validated constructors                                          | Establish provider-neutral domain primitives without floating-point financial values                    | Authorized by operator |
| `src/domain/shared/errors.ts`            | Added stable domain error codes and invariant/transition errors                                                                                     | Give invalid domain operations explicit machine-readable failures                                       | Authorized by operator |
| `src/domain/shared/evidence.ts`          | Added immutable evidence references, measurements, and rule results                                                                                 | Ensure every later rule can retain its source and reason                                                | Authorized by operator |
| `src/domain/shared/state-machine.ts`     | Added immutable generic transition tables and guarded transitions                                                                                   | Prevent aggregates from accepting undeclared state changes                                              | Authorized by operator |
| `src/domain/token/token.ts`              | Added validated canonical Solana mint identity, token-program classification, and immutable token invariants                                        | Establish mint-address identity before any provider-derived token metadata is evaluated                 | Authorized by operator |
| `src/domain/token/security.ts`           | Added fail-closed evaluation for SEC-001–004, SEC-008, SEC-010, and SEC-015 with exact evidence and boundaries                                      | Implement the approved deterministic token-security subset                                              | Authorized by operator |
| `tests/unit/token-security.test.ts`      | Added identity, malformed-input, authority, program, extension, holder-boundary, missing-data, and immutability tests                               | Prove every implemented token-security decision at its approved boundaries                              | Authorized by operator |
| `vitest.config.ts`                       | Activated the Node test environment and explicit inventory of implemented test suites                                                               | Run executable tests while excluding mapped future-phase placeholders until implemented                 | Authorized by operator |
| `src/domain/market/model.ts`             | Added immutable, validated normalized market snapshots                                                                                              | Establish provider-neutral market facts for deterministic evaluation                                    | Authorized by operator |
| `src/domain/market/momentum.ts`          | Added UNI-001–004, SEC-005–007/011–012, and MOM-001–010 evaluations                                                                                 | Implement approved market eligibility, rejection, and momentum boundaries                               | Authorized by operator |
| `tests/unit/momentum.test.ts`            | Added missing-data, invariant, numerical-boundary, zero-sell, and immutability tests                                                                | Prove deterministic fail-closed market decisions                                                        | Authorized by operator |
| `src/domain/portfolio/model.ts`          | Added immutable validated portfolio snapshots for reconciled equity, exposure, reserve, capacity, and entry state                                   | Establish provider-neutral facts for deterministic portfolio entry decisions                            | Authorized by operator |
| `src/domain/portfolio/sizing.ts`         | Added UNI-005–007 and RSK-001–007 qualification, exact risk sizing, capacity caps, reserve enforcement, and fail-closed decisions                   | Implement approved portfolio entry and sizing rules                                                     | Authorized by operator |
| `tests/unit/position-sizing.test.ts`     | Added sizing arithmetic, cap selection, exposure/reserve, re-entry, prohibition, missing-data, and immutability tests                               | Prove deterministic portfolio decisions at every approved boundary                                      | Authorized by operator |
| `vitest.config.ts`                       | Added the implemented position-sizing suite to the executable test inventory                                                                        | Include the new domain slice without activating future placeholders                                     | Authorized by operator |
| `src/domain/trading/quote.ts`            | Added immutable executable quotes, expiring approval bindings, and deterministic ENT-001–010 evaluation                                             | Implement final quote, cost, simulation, recalculation, and supervised approval gates                   | Authorized by operator |
| `tests/unit/quote.test.ts`               | Added quote invariants, exact threshold, freshness, binding, simulation, fail-closed, renewal, and immutability tests                               | Prove deterministic entry-gate behavior at every approved boundary                                      | Authorized by operator |
| `vitest.config.ts`                       | Added the implemented quote suite to the executable test inventory                                                                                  | Include the entry-gate slice without activating future placeholders                                     | Authorized by operator |
| `src/domain/trading/order.ts`            | Added immutable order and submission-attempt lifecycles plus deterministic EXE-001–006 reconciliation evaluation                                    | Prevent signatures, retries, or unreconciled balances from being treated as successful execution        | Authorized by operator |
| `tests/unit/order-state.test.ts`         | Added transition, retry, idempotency-binding, confirmation, reconciliation, boundary, and immutability tests                                        | Prove restart-safe order behavior and successful-entry requirements                                     | Authorized by operator |
| `vitest.config.ts`                       | Added the implemented order-state suite to the executable test inventory                                                                            | Include the order lifecycle without activating future placeholders                                      | Authorized by operator |
| `src/domain/trading/position.ts`         | Added validated restoration, reconciled position/lot lifecycle, executable peaks, proportional partial-exit accounting, and zero-balance closure    | Preserve restart-safe position state and prevent false closure                                          | Authorized by operator |
| `src/domain/trading/exits.ts`            | Added deterministic EXT-001–006 evaluation, trigger priority, original-quantity tranches, and emergency precedence                                  | Implement the approved standard exit strategy against executable values                                 | Authorized by operator |
| `tests/unit/position-exits.test.ts`      | Added lifecycle, accounting, threshold, priority, timing, trailing, evidence, and closure tests                                                     | Prove deterministic exit decisions and reconciled position mutation                                     | Authorized by operator |
| `vitest.config.ts`                       | Added the implemented position-exit suite to the executable test inventory                                                                          | Include the position lifecycle without activating future placeholders                                   | Authorized by operator |
| `src/domain/trading/position.ts`         | Added versioned position events, idempotent event application, validated lifecycle checkpoints, and deterministic replay                            | Complete the missing event/reducer/replay layer without changing reconciled position arithmetic         | Authorized by operator |
| `tests/replay/determinism.test.ts`       | Added event identity, ordering, replay-equivalence, duplicate, checkpoint, and restart-continuation tests                                           | Prove live processing, replay, and restored continuation produce identical position state               | Authorized by operator |
| `vitest.config.ts`                       | Added the implemented position replay suite to the executable test inventory                                                                        | Include deterministic lifecycle proof without activating other future placeholders                      | Authorized by operator |
| `src/domain/trading/exits.ts`            | Replaced the opaque emergency flag with deterministic EMG-001–010 monitoring facts, outage durations, evidence results, recomputation, and priority | Make every emergency exit request reproducible from explicit observed state and reject forged decisions | Authorized by operator |
| `tests/unit/emergency-exits.test.ts`     | Added wallet-sale, liquidity, security, impact-sequence, outage, unknown-data, invariant, and immutability tests                                    | Prove all emergency monitoring thresholds and fail-closed evidence outcomes                             | Authorized by operator |
| `tests/unit/position-exits.test.ts`      | Bound standard-exit evaluation to the explicit emergency decision at the same evaluation instant                                                    | Preserve deterministic emergency precedence without accepting an unexplained boolean                    | Authorized by operator |
| `vitest.config.ts`                       | Added the implemented emergency-exit suite to the executable test inventory                                                                         | Include emergency monitoring without activating future placeholders                                     | Authorized by operator |
| `src/domain/trading/order.ts`            | Added emergency full-exit intent binding, retry escalation, and authoritative exit reconciliation                                                   | Execute emergency decisions without treating submission or confirmation as closure                      | Authorized by operator |
| `src/domain/trading/position.ts`         | Allowed reconciled partial fills of full-exit requests to remain active                                                                             | Continue emergency liquidation against actual remaining quantity                                        | Authorized by operator |
| `tests/unit/emergency-execution.test.ts` | Added binding, retry, failure, partial-fill, signature, and zero-balance closure tests                                                              | Prove deterministic emergency execution and safe reconciliation                                         | Authorized by operator |
| `tests/unit/position-exits.test.ts`      | Corrected full-exit partial-fill expectation to preserve the reconciled remaining position                                                          | Align lifecycle tests with the approved partial-fill continuation rule                                  | Authorized by operator |
| `vitest.config.ts`                       | Added the emergency-execution suite to the executable test inventory                                                                                | Include the implemented execution slice                                                                 | Authorized by operator |

## Unreleased — Pre-code specification

### 2026-08-04

| File                     | Change                                                                                                                                                                      | Reason                                                                                                            | Status                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `PROJECT_MAP.md`         | Released version `1.0.1`: corrected entrypoint/worker subtotal from 9 to 10 and authored-file total from 160 to 161; recorded approval and scaffold authorization           | Pre-scaffold audit counted 3 entrypoints and 7 workers, exposing a one-file arithmetic error                      | Approved by operator                |
| `scaffold.sh`            | Created guarded, idempotent repository scaffold generator for all 161 mapped authored files and fixture directories                                                         | Create the authorized empty-file infrastructure without overwriting installed package files or approved documents | Approved by operator                |
| `DEPENDENCY_MANIFEST.md` | Released version `1.0.1`: replaced incompatible `typescript@7.0.2` with `typescript@6.0.3`; retained `typescript-eslint@8.66.0`; updated status, date, and revision history | The approved versions could not satisfy the `typescript-eslint` peer requirement `typescript >=4.8.4 <6.1.0`      | Approved by operator                |
| `CHANGELOG.md`           | Recorded dependency-manifest correction                                                                                                                                     | Maintain the required record for every file touch                                                                 | Corrected by operator authorization |

### 2026-08-03

| File                        | Change                                                                                                               | Reason                                                                   | Status                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `SERVICE_CONTRACTS.md`      | Created provider authority, interface, acceptance, failure, and fallback contracts                                   | Establish viable external-service workflow before architecture           | Approved by operator                                                                                 |
| `PROJECT_MAP.md`            | Created complete 160-file planned repository inventory and dependency direction                                      | Lock scope, file responsibilities, and import boundaries before code     | Approved by operator                                                                                 |
| `DEPENDENCY_MANIFEST.md`    | Created exact runtimes, packages, versions, accounts, environment variables, installation, and verification contract | Lock reproducible execution requirements before installation             | Approved by operator as part of request to complete the remaining documents and install dependencies |
| `SYSTEM_SCHEMA.md`          | Created database tables, runtime structures, state machines, errors, logging, testing, and naming contract           | Lock data and behavioural invariants before migrations or source code    | Proposed for approval                                                                                |
| `STRATEGY_SPECIFICATION.md` | Created `strategy-v1.0.0` with permanent rule IDs and resolved threshold semantics                                   | Prevent implementation from reinterpreting the approved trading workflow | Proposed for approval                                                                                |
| `CHANGELOG.md`              | Created running record and entered every specification file touch                                                    | Satisfy mandatory maintenance protocol before repository initialization  | Proposed for approval                                                                                |

## Changelog rules

- Update this file in the same change set as every file touch.
- Record created, modified, moved, renamed, or deleted files individually.
- State the concrete change and reason; do not use generic entries such as “updates.”
- Coupled files appear in the same dated entry.
- Released entries use semantic version headings.
- Historical entries are append-only except correction of a factual recording error, which itself requires a new correction entry.
