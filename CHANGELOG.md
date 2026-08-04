# Memecoined Changelog

All material file touches are recorded here. Dates use UTC. Entries identify the file, change, reason, and authorization state.

## Unreleased — Phase 2 deterministic domain core

### 2026-08-04

| File                                 | Change                                                                                                                            | Reason                                                                                  | Status                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| `package.json`                       | Locked project metadata, native ESM, runtime engines, and build/typecheck/test/format scripts                                     | Activate the approved toolchain contract                                                | Authorized by operator |
| `package-lock.json`                  | Synchronized root package metadata with `package.json`                                                                            | Preserve reproducible installation                                                      | Authorized by operator |
| `tsconfig.json`                      | Added strict NodeNext/ES2024 compiler and emission contract                                                                       | Enforce deterministic, type-safe production compilation                                 | Authorized by operator |
| `.prettierrc.json`                   | Added deterministic formatting rules                                                                                              | Activate the approved formatter and remove the empty-config startup failure             | Authorized by operator |
| `src/domain/shared/types.ts`         | Added branded identities, time, quantities, decimal values, providers, results, and validated constructors                        | Establish provider-neutral domain primitives without floating-point financial values    | Authorized by operator |
| `src/domain/shared/errors.ts`        | Added stable domain error codes and invariant/transition errors                                                                   | Give invalid domain operations explicit machine-readable failures                       | Authorized by operator |
| `src/domain/shared/evidence.ts`      | Added immutable evidence references, measurements, and rule results                                                               | Ensure every later rule can retain its source and reason                                | Authorized by operator |
| `src/domain/shared/state-machine.ts` | Added immutable generic transition tables and guarded transitions                                                                 | Prevent aggregates from accepting undeclared state changes                              | Authorized by operator |
| `src/domain/token/token.ts`          | Added validated canonical Solana mint identity, token-program classification, and immutable token invariants                      | Establish mint-address identity before any provider-derived token metadata is evaluated | Authorized by operator |
| `src/domain/token/security.ts`       | Added fail-closed evaluation for SEC-001–004, SEC-008, SEC-010, and SEC-015 with exact evidence and boundaries                    | Implement the approved deterministic token-security subset                              | Authorized by operator |
| `tests/unit/token-security.test.ts`  | Added identity, malformed-input, authority, program, extension, holder-boundary, missing-data, and immutability tests             | Prove every implemented token-security decision at its approved boundaries              | Authorized by operator |
| `vitest.config.ts`                   | Activated the Node test environment and explicit inventory of implemented test suites                                             | Run executable tests while excluding mapped future-phase placeholders until implemented | Authorized by operator |
| `src/domain/market/model.ts`         | Added immutable, validated normalized market snapshots                                                                            | Establish provider-neutral market facts for deterministic evaluation                    | Authorized by operator |
| `src/domain/market/momentum.ts`      | Added UNI-001–004, SEC-005–007/011–012, and MOM-001–010 evaluations                                                               | Implement approved market eligibility, rejection, and momentum boundaries               | Authorized by operator |
| `tests/unit/momentum.test.ts`        | Added missing-data, invariant, numerical-boundary, zero-sell, and immutability tests                                              | Prove deterministic fail-closed market decisions                                        | Authorized by operator |
| `src/domain/portfolio/model.ts`      | Added immutable validated portfolio snapshots for reconciled equity, exposure, reserve, capacity, and entry state                 | Establish provider-neutral facts for deterministic portfolio entry decisions            | Authorized by operator |
| `src/domain/portfolio/sizing.ts`     | Added UNI-005–007 and RSK-001–007 qualification, exact risk sizing, capacity caps, reserve enforcement, and fail-closed decisions | Implement approved portfolio entry and sizing rules                                     | Authorized by operator |
| `tests/unit/position-sizing.test.ts` | Added sizing arithmetic, cap selection, exposure/reserve, re-entry, prohibition, missing-data, and immutability tests             | Prove deterministic portfolio decisions at every approved boundary                      | Authorized by operator |
| `vitest.config.ts`                   | Added the implemented position-sizing suite to the executable test inventory                                                      | Include the new domain slice without activating future placeholders                     | Authorized by operator |
| `src/domain/trading/quote.ts`        | Added immutable executable quotes, expiring approval bindings, and deterministic ENT-001–010 evaluation                           | Implement final quote, cost, simulation, recalculation, and supervised approval gates   | Authorized by operator |
| `tests/unit/quote.test.ts`           | Added quote invariants, exact threshold, freshness, binding, simulation, fail-closed, renewal, and immutability tests             | Prove deterministic entry-gate behavior at every approved boundary                      | Authorized by operator |
| `vitest.config.ts`                   | Added the implemented quote suite to the executable test inventory                                                                | Include the entry-gate slice without activating future placeholders                     | Authorized by operator |

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
