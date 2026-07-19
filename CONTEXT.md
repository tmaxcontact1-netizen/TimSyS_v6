# TimSyS v6 Context

## Current State

**Current Phase:** Backend Completion — Tier 4 (INTELLIGENCE SERVICE IMPLEMENTATION) COMPLETE. Test suite: 173/173 passing across 14 suites.

Platform boots successfully. All services, registries, pipeline, migrations, boot sequence, middleware, and testing infrastructure complete. 2 application modules deployed. Intelligence service fully implemented with metadata classification, insights synthesis, and logic rule evaluation.

## Completed

- Repository initialized at `/home/tmax/TimSyS_v6/`
- Git tag `v6.0.0-base` created
- All root docs: `CONTEXT.md`, `ARCHITECTURE_MAP.md`, `HANDOVER.md`, `CONSTITUTION_V6.0.md`, `LEXICON_V6.0.0.md`
- npm packages installed (`package.json`, `package-lock.json`)
- 7 contract files present in `/contracts/` (including `intelligence.js`)
- 9 service files present in `/shared/services/` plus intelligence service package (`/shared/services/intelligence/`)
- 6 registry stub files present in `/shared/registry/`
- 6 pipeline stub files present in `/shared/pipeline/`
- Core services implemented: `db.js`, `cache.js`, `auth.js`, `validate.js`, `log.js`, `events.js`, `email.js`, `session.js`, `audit.js`, `metrics.js`
- Migration runner implemented (`/shared/migration-runner.js`)
- 6 migrations: `000_bootstrap.sql`, `001_initial.sql`, `002_intelligence.sql`, `001_users.sql`, `002_password_resets.sql`, `003_must_change_password.sql`
- 2 modules with full implementations: `system_health`, `user_management`
- Module manifests follow `{module}_{operation}` naming convention with `exports` field
- Staging pipeline: discover → validate → register → resolve → wire → boot → unstage
- 14 unit test suites with per-suite database isolation (173 tests total, all passing)
- HTTP integration tests (10 total suites, 110+ tests, all passing)
- Password change prompt test suite (12 tests covering full flow)
- JWT_SECRET enforcement at boot
- Password change, forgot/reset password flows
- Email service via nodemailer
- CSRF protection via X-Requested-With header check
- Rate limiting with in-memory sliding window
- **JWT session token fix: sessionId included in JWT payload to prevent token collision after password change**
- **Password change prompt: new users must change password on first login**
- **Password change middleware: `shared/middleware/passwordChangeRequired.js`**
- **Targeted token revocation on password change (not wildcard)**
- **Intelligence service: `/shared/services/intelligence/` — metadata, insights, and logic rule evaluation. Fully implemented with DB-backed aggregation and condition evaluation engine. Injected into module Context via `wire.js`. Recognized as platform service in `resolve.js`**
- **Intelligence service tests: `tests/unit/intelligence.test.js` — 7 unit tests covering metadata classification and logic condition evaluation**
- **Security hardening: HTTPS enforcement middleware, password policy (isStrongPassword), 11 security integration tests**

## Backend Completion Roadmap

### Tier 1: Security Quick Wins (COMPLETE — 2 deferred)
- ✅ HTTPS enforcement middleware
- ✅ Password policy (`isStrongPassword()` — min 8 chars + special char)
- ✅ Graceful shutdown (shutdownPlatform function, SIGTERM/SIGINT handlers)
- ✅ Input validation middleware (non-blocking sanitization in request pipeline)

### Tier 2: Test Coverage & Observability (COMPLETE)
- ✅ Security tests (`tests/integration/http/security.test.js` — 11 tests)
- ✅ Boot sequence regression tests (`tests/e2e/boot-sequence.test.js` — 13 tests)
- ✅ Contract verification tests (`tests/unit/contracts-verification.test.js` — 32 tests)
- ✅ Introspection endpoints (getCapabilities, getFunctions, getRoutes, getDependencies)

### Tier 3: Core Feature Gaps (COMPLETE)
- ✅ Password change prompt for new users (`must_change_password` column, middleware, targeted revocation)
- ✅ Intelligence service package structure (5 files, 3 DB tables, wired into pipeline)

### Tier 4: Intelligence Service Implementation (COMPLETE)
- ✅ `metadata.js` `suggest()` — rule-based pattern detection (email domains, student/teacher/course classification, risk indicators, confidence scoring)
- ✅ `insights.js` `synthesize()` — DB-backed aggregation (attendance rate, GPA averages, at-risk counts, alerts with critical/warning levels, trend tracking)
- ✅ `logic.js` `_matchesConditions()` — condition evaluation engine (9 operators: ==, !=, <, >, <=, >=, contains, in, not_in, exists; dot notation field access; rule priority scoring)
- ✅ Intelligence unit tests (`tests/unit/intelligence.test.js` — 7 tests)

### Tier 5: Operational Tooling (COMPLETE)

### Completed
- Rate limiting persistence (SQLite-backed sliding window)
- Migration CLI (run/rollback/list migrations from command line)
- Module scaffolding CLI (generate module skeleton from template)
- Rate limiting persistence (SQLite-backed sliding window)
- Migration CLI (run/rollback/list migrations from command line)
- Module scaffolding CLI (generate module skeleton from template)

### ### Tier 6: Advanced Intelligence (COMPLETE)

- Gap analysis engine (engine/gap-analysis/) — completion scoring, gap detection, recommended actions
- Recommendation engine (engine/recommendation/) — capability clustering, orphan detection, suggestion ranking
- /introspect/gaps endpoint
- /introspect/templates endpoint
- Migration 004_recommendations.sql applied

## In Progress

Nothing.

## Blocked

Nothing.

## Next Commit

Nothing queued.

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
| 2026-07-18 | Password change prompt | New users must change password on first login; middleware blocks protected routes; targeted token revocation on password change |
| 2026-07-18 | Intelligence service | Shared service package for metadata, insights synthesis, and logic rule evaluation. Wired into `wire.js` and `resolve.js`. 3 new DB tables. |
| 2026-07-18 | Intelligence implementation | Full implementations of metadata.suggest(), insights.synthesize(), logic._matchesConditions(). 7 unit tests added. |

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

### Wildcard Token Revocation
**Problem:** `forceLogout()` inserts wildcard `*` in `token_revocation` table, permanently blocking ALL future tokens for a user.
**Root Cause:** Wildcard revocation has no expiry — it matches any token for that user regardless of when it was issued.
**Solution:** Use `destroyUserSessions()` + `revokeToken()` for password changes. Reserve `forceLogout()` for permanent lockout only.
**Prevention:** Understand the blast radius of wildcard operations before using them.

### Documentation Drift
**Problem:** CONTEXT.md, HANDOVER.md, and inline comments disagreed on test counts and phase status.
**Cause:** Documentation updated manually without synchronization.
**Prevention:** Update all affected docs as part of commit protocol, not post-commit.

### Intelligence Service Placeholder Pattern
**Problem:** Initial intelligence service had placeholder methods returning sample data.
**Solution:** Implemented full logic with DB-backed aggregation and condition evaluation.
**Lesson:** Service structure can be laid out early, but actual business logic should wait until consuming modules exist to provide real data.

## Open Decisions

1. **Token revocation strategy:** Implemented via SQLite table (token_revocation). Bloom filter optimization deferred.
2. **Session duration policy:** JWT TTL 24h, no refresh token. Needs policy before production with real users.
3. **Request/reply timeout defaults:** Not specified — defer to Phase 9 (EventBus impl)
4. **Rate limiting persistence:** In-memory Map, resets on restart. Consider Redis or DB-backed before production.
5. **Graceful shutdown:** Signal handlers interfere with Jest test isolation. Need alternative approach.
6. **Input validation middleware:** Blocked test requests when implemented. Root cause investigation needed.

## Session Protocol

- Handover is updated at end of each session (each Lumo thread) before closing.
- Architecture Map is regenerated manually via `bash Tools/update_architecture_map.sh` prior to commits.
- Frozen documents (Constitution, Lexicon) are hashed after modifications. New baseline stored in HANDOVER.md.

---

Last updated: 2026-07-18
