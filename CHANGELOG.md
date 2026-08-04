# Memecoined Changelog

All material file touches are recorded here. Dates use UTC. Entries identify the file, change, reason, and authorization state.

## Unreleased — Pre-code specification

### 2026-08-04

| File | Change | Reason | Status |
|---|---|---|---|
| `PROJECT_MAP.md` | Released version `1.0.1`: corrected entrypoint/worker subtotal from 9 to 10 and authored-file total from 160 to 161; recorded approval and scaffold authorization | Pre-scaffold audit counted 3 entrypoints and 7 workers, exposing a one-file arithmetic error | Approved by operator |
| `scaffold.sh` | Created guarded, idempotent repository scaffold generator for all 161 mapped authored files and fixture directories | Create the authorized empty-file infrastructure without overwriting installed package files or approved documents | Approved by operator |
| `DEPENDENCY_MANIFEST.md` | Released version `1.0.1`: replaced incompatible `typescript@7.0.2` with `typescript@6.0.3`; retained `typescript-eslint@8.66.0`; updated status, date, and revision history | The approved versions could not satisfy the `typescript-eslint` peer requirement `typescript >=4.8.4 <6.1.0` | Approved by operator |
| `CHANGELOG.md` | Recorded dependency-manifest correction | Maintain the required record for every file touch | Corrected by operator authorization |

### 2026-08-03

| File | Change | Reason | Status |
|---|---|---|---|
| `SERVICE_CONTRACTS.md` | Created provider authority, interface, acceptance, failure, and fallback contracts | Establish viable external-service workflow before architecture | Approved by operator |
| `PROJECT_MAP.md` | Created complete 160-file planned repository inventory and dependency direction | Lock scope, file responsibilities, and import boundaries before code | Approved by operator |
| `DEPENDENCY_MANIFEST.md` | Created exact runtimes, packages, versions, accounts, environment variables, installation, and verification contract | Lock reproducible execution requirements before installation | Approved by operator as part of request to complete the remaining documents and install dependencies |
| `SYSTEM_SCHEMA.md` | Created database tables, runtime structures, state machines, errors, logging, testing, and naming contract | Lock data and behavioural invariants before migrations or source code | Proposed for approval |
| `STRATEGY_SPECIFICATION.md` | Created `strategy-v1.0.0` with permanent rule IDs and resolved threshold semantics | Prevent implementation from reinterpreting the approved trading workflow | Proposed for approval |
| `CHANGELOG.md` | Created running record and entered every specification file touch | Satisfy mandatory maintenance protocol before repository initialization | Proposed for approval |

## Changelog rules

- Update this file in the same change set as every file touch.
- Record created, modified, moved, renamed, or deleted files individually.
- State the concrete change and reason; do not use generic entries such as “updates.”
- Coupled files appear in the same dated entry.
- Released entries use semantic version headings.
- Historical entries are append-only except correction of a factual recording error, which itself requires a new correction entry.
