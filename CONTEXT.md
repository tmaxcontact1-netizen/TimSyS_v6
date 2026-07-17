# TimSyS v6 Context

## Current State

**Current Phase:** Phase 1.1 — Core Services Implementation (IN PROGRESS)

Platform boots successfully. 6/7 test suites passing (72 tests, 69 passing). Pipeline staging lifecycle functional. Remaining failure is in staging pipeline integration test (event subscription wiring edge case).

## Completed

- Repository initialized at `/home/tmax/TimSyS_v6/`
- Git tag `v6.0.0-base` created
- All root docs: `CONTEXT.md`, `ARCHITECTURE_MAP.md`, `HANDOVER.md`, `CONSTITUTION_V6.0.md`, `LEXICON_V6.0.0.md`
- npm packages installed (`package.json`, `package-lock.json`)
- 6 contract stub files present in `/contracts/`
- 9 service stub files present in `/shared/services/`
- 6 registry stub files present in `/shared/registry/`
- 6 pipeline stub files present in `/shared/pipeline/`
- Core services implemented: `db.js`, `cache.js`, `auth.js`, `validate.js`, `log.js`, `events.js`, `email.js`
- Migration runner implemented (`/shared/migration-runner.js`)
- 4 migrations: `000_bootstrap.sql`, `001_initial.sql`, `001_users.sql`, `002_password_resets.sql`
- 2 modules with full implementations: `system_health`, `user_management`
- Module manifests follow `{module}_{operation}` naming convention with `exports` field
- Staging pipeline: discover → validate → register → resolve → wire → unstage
- 7 test suites with per-suite database isolation
- JWT_SECRET enforcement at boot
- Password change, forgot/reset password flows
- Email service via nodemailer
- HTTP integration tests (excluded from default run)

## In Progress

- Staging pipeline integration test: 3 failing tests in wire/unstage/full-pipeline (event subscription edge case)

## Blocked

None.

## Next Commit

1. Fix remaining 3 staging pipeline test failures
2. Update this CONTEXT.md to mark Phase 1.1 services as COMPLETE
3. Proceed to Phase 1.2: Implement remaining services and module business logic
4. Commit with message: `Phase 1.1 — core services complete, test suite green`

## Recent Changes

| Date | Commit/Change | Description |
|------|---------------|-------------|
| 2026-07-16 | v6.0.0-base | Initial repository setup with all stubs |
| 2026-07-16 | Constitution update | Pipeline path corrected to /shared/pipeline/, 9 services listed, auth revocation added, EventBus request/reply added, FunctionRegistry scope clarified |
| 2026-07-16 | Tooling | Architecture map generator script added |
| 2026-07-17 | Quick-win features | JWT_SECRET enforcement, password change endpoint, introspect/registries, email service, HTTP integration tests |
| 2026-07-17 | Test isolation | Per-suite DB_PATH to prevent SQLite lock conflicts |
| 2026-07-17 | DB service rewrite | Single connection, manual transaction control, getConnection/exec/scalar methods |
| 2026-07-17 | Migration runner rewrite | Manual BEGIN/COMMIT/ROLLBACK, proper error surfacing |
| 2026-07-17 | Validate.js fix | Uses func.exports for export lookup, func.name for naming convention |
| 2026-07-17 | Register.js fix | Functions registered by func.name, implementation looked up via func.exports |
| 2026-07-17 | Wire.js fix | Uses registered.exports for event handler lookup |
| 2026-07-17 | Module manifests | name field follows {module}_{operation}, exports field maps to actual export key |

## Open Decisions

1. **Token revocation strategy:** Implemented via SQLite table (token_revocation). Bloom filter optimization deferred.
2. **Session duration policy:** Handover updated at end of each session before closing thread.
3. **Request/reply timeout defaults:** Not specified — defer to Phase 9 (EventBus impl)
4. **Event subscription in wire step:** on_{channel} handler lookup uses registered.exports; need to verify this is the correct pattern for production modules

## Session Protocol

- Handover is updated at end of each session (each Lumo thread) before closing.
- Architecture Map is regenerated manually via `bash Tools/update_architecture_map.sh` prior to commits.
- Frozen documents (Constitution, Lexicon) are hashed after modifications. New baseline stored in HANDOVER.md.

---

Last updated: 2026-07-17
