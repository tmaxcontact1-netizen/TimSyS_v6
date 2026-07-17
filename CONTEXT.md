# TimSyS v6 Context

## Current State

**Current Phase:** Phase 1.1 — COMPLETE. All infrastructure layers shipped. Test suite: 98/98 passing.

Platform boots successfully. All services, registries, pipeline, migrations, boot sequence, middleware, and testing infrastructure complete. 2 application modules deployed. JWT session token collision bug fixed.

## Completed

- Repository initialized at `/home/tmax/TimSyS_v6/`
- Git tag `v6.0.0-base` created
- All root docs: `CONTEXT.md`, `ARCHITECTURE_MAP.md`, `HANDOVER.md`, `CONSTITUTION_V6.0.md`, `LEXICON_V6.0.0.md`
- npm packages installed (`package.json`, `package-lock.json`)
- 6 contract stub files present in `/contracts/`
- 9 service stub files present in `/shared/services/`
- 6 registry stub files present in `/shared/registry/`
- 6 pipeline stub files present in `/shared/pipeline/`
- Core services implemented: `db.js`, `cache.js`, `auth.js`, `validate.js`, `log.js`, `events.js`, `email.js`, `session.js`, `audit.js`, `metrics.js`
- Migration runner implemented (`/shared/migration-runner.js`)
- 4 migrations: `000_bootstrap.sql`, `001_initial.sql`, `001_users.sql`, `002_password_resets.sql`
- 2 modules with full implementations: `system_health`, `user_management`
- Module manifests follow `{module}_{operation}` naming convention with `exports` field
- Staging pipeline: discover → validate → register → resolve → wire → boot → unstage
- 7 unit test suites with per-suite database isolation
- HTTP integration tests (9 suites, 98 total tests, all passing)
- JWT_SECRET enforcement at boot
- Password change, forgot/reset password flows
- Email service via nodemailer
- CSRF protection via X-Requested-With header check
- Rate limiting with in-memory sliding window
- **JWT session token fix: sessionId included in JWT payload to prevent token collision after password change**

## In Progress

Nothing.

## Blocked

Nothing.

## Next Commit

1. Regenerate architecture map via `bash Tools/update_architecture_map.sh`
2. Verify frozen documents unchanged (hash comparison)
3. Update CONTEXT.md, HANDOVER.md, DECISIONS.md
4. Commit with message: `Fix: Include sessionId in JWT payload to prevent token collision after password change`
5. Tag milestone: `v6.1.0-jwt-session-fix`

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
| 2026-07-17 | JWT session fix | Added sessionId to JWT payload to prevent token collision after password change |

## Lessons Learned

### JWT Token Collision Bug
**Problem:** Login immediately after password change produced identical JWT, causing 401 due to wildcard revocation.
**Root Cause:** `issueToken()` only used `userId` and `permissions` in payload. Same credentials → same signed token.
**Solution:** Include `sessionId` in JWT payload. Each login creates new session, new token.
**Prevention:** Always include unique session identifier in authentication tokens when supporting concurrent sessions and session invalidation.

### Test Flakiness
**Problem:** Tests passed in isolation but failed when run together.
**Cause:** Shared process state across Jest suites (auth service singleton, JWT_SECRET caching).
**Solution:** Run test suites separately or reset module cache between suites with `jest.resetModules()`.
**Prevention:** Design tests to be independent and avoid relying on mutable global state.

### Documentation Drift
**Problem:** CONTEXT.md, HANDOVER.md, and inline comments disagreed on test counts and phase status.
**Cause:** Documentation updated manually without synchronization.
**Prevention:** Update all affected docs as part of commit protocol, not post-commit.

## Open Decisions

1. **Token revocation strategy:** Implemented via SQLite table (token_revocation). Bloom filter optimization deferred.
2. **Session duration policy:** JWT TTL 24h, no refresh token. Needs policy before production with real users.
3. **Request/reply timeout defaults:** Not specified — defer to Phase 9 (EventBus impl)
4. **Rate limiting persistence:** In-memory Map, resets on restart. Consider Redis or DB-backed before production.

## Session Protocol

- Handover is updated at end of each session (each Lumo thread) before closing.
- Architecture Map is regenerated manually via `bash Tools/update_architecture_map.sh` prior to commits.
- Frozen documents (Constitution, Lexicon) are hashed after modifications. New baseline stored in HANDOVER.md.

---

Last updated: 2026-07-17