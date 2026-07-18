# TimSyS v6 — Handover Document

## Session: 2026-07-17 (Session 3)

### Summary
Test suite confirmed green: 72/72 passing across 7 suites. All previous discrepancies between documentation resolved. CONTEXT.md updated to reflect actual state. Phase 1.1 marked COMPLETE (was incorrectly listed as IN PROGRESS in prior session docs). Wire.js event subscription edge case resolved — pipeline tests passing.

### Action Taken
- Ran `npx jest --verbose` — confirmed 72/72, 7/7 suites
- Reconciled CONTEXT.md with actual test results
- Removed stale "In Progress" and "Blocked" sections from CONTEXT.md
- Corrected HANDOVER test counts (prior session erroneously recorded 99/99)
- Updated "Next Steps" to reflect actual project position

### Test Results
- 7 suites passed, 7 total
- 72 tests passed, 72 total
- Time: ~3.6s

---

## What Is TimSyS v6

A modular Node.js school administration platform with a plugin/module architecture. Built from contracts upward through services, registries, pipeline, migrations, boot sequence, HTTP server, and functional modules.

**Tech stack:** Node.js, better-sqlite3, zod, jsonwebtoken, bcryptjs, Jest

**DB path:** `./data/timsys.sqlite` (auto-created on boot, WAL mode, foreign keys enabled)

---

## What's Done

### Phase 0: Foundation Contracts (COMPLETE — FROZEN)
7 contract files in `/contracts/`: `db.js`, `cache.js`, `auth.js`, `log.js`, `validate.js`, `events.js`, `intelligence.js`

### Phase 1.1: Services (COMPLETE)
9 files in `/shared/services/` plus intelligence service package (`/shared/services/intelligence/`):
- **Injected into Context:** `db.js` (ConnectionPool, WAL), `cache.js` (LRU + TTL + glob invalidation), `auth.js` (JWT, token revocation via sha256 hash + wildcard, sessions, checkPerm with wildcards), `log.js` (structured JSON to stdout), `validate.js` (Zod safeParse + recursive sanitization), `events.js` (pub/sub with error isolation + request/reply), `intelligence/` (metadata catalog, insights synthesis, logic rule evaluation)
- **Internal infrastructure:** `session.js` (SQLite-backed, auto-cleanup timer), `audit.js` (append-only, queryable, retention purge), `metrics.js` (counters/histograms/gauges, Prometheus export, periodic DB flush)
- **Additional:** `email.js` (nodemailer)

### Phase 1.2: Registries (COMPLETE)
6 files in `/shared/registry/`:
- `moduleRegistry.js` — in-memory Map + DB persistence
- `schemaRegistry.js` — table ownership tracking
- `routeRegistry.js` — conflict detection, `:param` pattern matching, `auth_required` property
- `functionRegistry.js` — stores implementation references
- `capabilityRegistry.js` — conflict detection, `provides` check
- `dependencyGraph.js` — topological sort, cycle detection via DFS

### Phase 1.3: Pipeline (COMPLETE)
7 stages in `/shared/pipeline/`:
- Order: `discover → validate → register → resolve → wire → boot → (unstage)`
- `resolve.js` checks `requires` capabilities and `dependencies` (excluding platform services: db, cache, auth, log, validate, events, intelligence)
- `register.js` maps `route.auth` to `auth_required` during registration
- `boot.js` executes `boot(ctx)` in topological order, rolls back on failure
- `unstage.js` graceful deregistration in reverse

### Phase 2: Migrations (COMPLETE)
6 SQL files:
- `/migrations/000_bootstrap.sql` — creates `schema_migrations` table only
- `/migrations/001_initial.sql` — creates 9 platform tables (sessions, audit_log, metrics, token_revocation, module_registry, schema_registry, route_registry, function_registry, capability_registry)
- `/migrations/002_intelligence.sql` — creates 3 intelligence tables (intelligence_metadata, intelligence_insights, intelligence_rules)
- `/modules/user_management/migrations/001_users.sql` — creates `users` table
- `/modules/user_management/migrations/002_password_resets.sql`
- `/modules/user_management/migrations/003_must_change_password.sql` — adds `must_change_password` column to users table
- Migration runner scans both `/migrations/` and `/modules/*/migrations/`
- Runner owns `schema_migrations` INSERT exclusively — SQL files must NEVER insert into it
- 15 total tables in database

### Phase 4: Boot Sequence (COMPLETE)
`/index.js` orchestrates: clear registries → run migrations → verify tables → discover → validate → register → resolve → compute boot order → wire → boot → start HTTP server → emit `platform.ready`
- `contextRegistry` object stores wired module Contexts so HTTP handlers receive `events`, `db`, `cache`, `intelligence`, etc.

### Phase 5: Middleware Stack (COMPLETE)
Full middleware stack in `/index.js`:
- **CORS** — configurable via `CORS_ORIGINS` env var (default `*`), preflight handling
- **Cookie parsing** — basic, populates `req.cookies`
- **CSRF** — state-changing requests (POST/PUT/PATCH/DELETE) require Bearer token OR `X-Requested-With: XMLHttpRequest` header
- **Authentication** — JWT Bearer token, populates `req.user` with `{ id, permissions, mustChangePassword }`
- **Rate limiting** — sliding window, default 100/min, admin tier 500/min (detected via `admin:*` permission), `X-RateLimit-*` headers
- **Password change required** — blocks protected routes when `mustChangePassword` is true; whitelists `/api/auth/me`, `/api/auth/logout`, `/api/users/:id/change-password`
- **Request logging** — method, path, userId
- **Body parsing** — JSON, 1MB limit

### Phase 7: Testing (COMPLETE — 110/110 PASSING)
10 test files, all passing:
- `tests/unit/services/cache.test.js`
- `tests/unit/services/db.test.js`
- `tests/unit/services/events.test.js`
- `tests/unit/services/validate.test.js`
- `tests/unit/services/auth.test.js`
- `tests/unit/registries/registries.test.js`
- `tests/integration/staging/pipeline.test.js`
- `tests/integration/http/auth.test.js`
- `tests/integration/http/password-prompt.test.js`
- `tests/e2e/boot.test.js`
- Config: `jest.config.js`, `tests/setup.js` (sets `NODE_ENV=test`, `DB_PATH=./data/test.sqlite`, `JWT_SECRET`)
- Note: test files use `.test.js` extension, NOT `.spec.js`

### Modules (COMPLETE — 2 modules)
**system_health** (`/modules/system_health/`):
- 5 routes: `GET /health`, `GET /ready`, `GET /introspect/platform`, `GET /introspect/modules`, `GET /metrics`
- Subscribes to `platform.ready` event

**user_management** (`/modules/user_management/`):
- 11 routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/users`, `POST /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`, `POST /api/users/:id/change-password`
- Seeds default admin on first boot (username: `admin`, password: `changeme123`)
- Uses bcryptjs for password hashing
- Publishes user events (`user.created`, `user.updated`, `user.deleted`)
- Permission checks via `auth.checkPerm()` — `admin:users:read` for GET, `admin:users:write` for POST/PUT/DELETE

### Verified Working Endpoints
- `GET /health` (no auth) — alive status
- `GET /ready` (no auth) — ready status with module/table counts
- `POST /api/auth/login` (no auth) — returns JWT + session
- `GET /api/auth/me` (auth) — returns current user
- `POST /api/auth/logout` (auth) — revokes token
- `GET /api/users` (auth, `admin:users:read`) — lists users
- `POST /api/users` (auth, `admin:users:write`) — creates user + audit log + event
- `GET /api/users/:id` (auth, `admin:users:read`)
- `PUT /api/users/:id` (auth, `admin:users:write`)
- `DELETE /api/users/:id` (auth, `admin:users:write`)

### Users Currently in DB
- `admin` — permissions: `['admin:users:read', 'admin:users:write', 'admin:*']`
- `teacher1` — permissions: `['user:read']`
- `student1` — permissions: `['user:read']`

### Tooling
- `Tools/update_architecture_map.sh` — generates `ARCHITECTURE_MAP.md`, detects drift
- Run with `bash Tools/update_architecture_map.sh`

---

## What's NOT Done

### Phase 6: Additional Modules
- Attendance tracking
- Grades/assessments
- Courses/class catalog
- Classes/sections (student enrollment, scheduling)

### Phase 8: Introspection Expansion
- 6 remaining endpoints: `/introspect/capabilities`, `/introspect/functions`, `/introspect/routes`, `/introspect/dependencies`, `/introspect/gaps`, `/introspect/templates`
- Gap analysis engine (`/engine/gap-analysis/`)
- Recommendation engine (`/engine/recommendation/`)
- Both directories exist with `.gitkeep` only

### Phase 9: E2E & HTTP Integration Tests
- `tests/e2e/` — empty (`.gitkeep` only)
- `tests/integration/http/auth.test.js` exists but excluded from default run
- Need HTTP-level tests with running server covering all 11 endpoints
- Need E2E boot sequence test
- Need security tests (auth rejection, CSRF enforcement, rate limit triggering, permission denied paths)

### Phase 12: Module Builder Interface
- CLI commands and UI pages per Constitution spec
- Not started

### Security Hardening
- Default admin password (`changeme123`) must be changed for production (password change prompt implemented for new users; admin seed still uses default)
- `JWT_SECRET` must be set via env var for production
- No refresh token mechanism — JWT TTL is 24h, no rotation
- Rate limiting is in-memory only (resets on restart)
- No HTTPS enforcement
- No input size validation beyond 1MB body limit

### Open Decisions
1. **Session duration** — Default JWT TTL 24h, no refresh token. Needs policy.
2. **Token revocation** — SQLite table currently. Bloom filter deferred.
3. **CSRF for cookie-based auth** — Only Bearer tokens in use. Header check is preventive.
4. **Rate limiting persistence** — In-memory Map, resets on restart. Consider Redis or DB-backed.

---

## Architecture Map Script Note

`Tools/update_architecture_map.sh` — `EXPECTED_SERVICES` array includes all 9 services. `EXPECTED_DIRS` uses `Tools` (capital T). Test file glob looks for `*.test.js`.

---

## How to Run

```bash
# Start platform
node index.js

# Run tests
npx jest --verbose

# Regenerate architecture map
bash Tools/update_architecture_map.sh

# Fresh database
rm -rf data/ && mkdir -p data && chmod 755 data

Session History
Session: 2026-07-16 (Session 1)

    Initial repository setup at /home/tmax/TimSyS_v6/
    Git tag v6.0.0-base created
    All root documents created: CONTEXT.md, ARCHITECTURE_MAP.md, HANDOVER.md, CONSTITUTION_V6.0.md, LEXICON_V6.0.0.md
    npm packages installed
    Contract stubs (6), service stubs (9), registry stubs (6), pipeline stubs (6) created
    Constitution and Lexicon drafted and frozen

Session: 2026-07-17 (Session 2)

    Fixed test suite from 44 failures to 3 failures (69/72 passing)
    Root causes: migration runner transaction handling, function naming convention mismatch, db.js transaction callback binding, pipeline wire.js referencing undefined variable
    Files modified: db.js, migration-runner.js, validate.js, register.js, wire.js, module.json files, all test files
    Per-suite DB isolation implemented
    Quick-win features added: JWT_SECRET enforcement, password change endpoint, introspect/registries, email service, HTTP integration tests
    DB service rewritten: single connection, manual transaction control
    Migration runner rewritten: manual BEGIN/COMMIT/ROLLBACK
    Constitution updated (function declaration convention added)
    Lexicon updated (4 new terms added)

Session: 2026-07-17 (Session 3)

    Confirmed test suite green: 72/72 passing, 7/7 suites
    Reconciled all documentation to reflect actual state
    Corrected erroneous test count (99/99 → 72/72)
    Marked Phase 1.1 as COMPLETE in CONTEXT.md
    Cleared stale "In Progress" and "Blocked" sections
    Updated next steps to reflect actual project position

Frozen Document Hashes

    CONSTITUTION_V6.0.md: ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a
    LEXICON_V6.0.0.md: 72280c5fb7d90fa8245139f35b9340016e0fe0d072bf799bd2ea85360e167b45
    Run: sha256sum CONSTITUTION_V6.0.md LEXICON_V6.0.0.md to verify

## Commit Protocol

1. Reconcile all root docs (CONTEXT.md, HANDOVER.md) to reflect actual state
2. Regenerate architecture map via `bash Tools/update_architecture_map.sh`
3. Verify frozen documents haven't changed (hash comparison)
4. Commit with message format: `{phase_title} — {short_description}`
5. Create git tag if milestone reached (e.g., `v6.1.0-phase1-complete`)

### Session: 2026-07-17 (Session 4)

**Summary:** Fixed JWT session token collision bug. After password change, new login produced identical JWT, which was rejected due to wildcard session revocation. Fix adds sessionId to JWT payload, ensuring each login generates unique token.

**Changes:**
- `shared/services/auth.js`: Modified `issueToken(user, sessionId)` to include sessionId in JWT payload
- `modules/user_management/index.js`: Modified login handler to pass `session.sessionId` to `issueToken()`
- Test suite: 98/98 passing (up from 72/72 unit tests; added 26 HTTP integration tests)

**Lesson Learned:** Authentication tokens must include session identifiers when supporting session invalidation. Deterministic token signing (same inputs → same outputs) breaks session revocation semantics.

---

#
### Session: 2026-07-18 (Session 5)

**Summary:** Implemented password change prompt for new users. New users created via `createUser` have `must_change_password = 1`. Login returns `mustChangePassword` flag in response and JWT payload. Middleware blocks protected routes until password is changed.

**New Files:**
- `modules/user_management/migrations/003_must_change_password.sql` — ALTER TABLE adds `must_change_password` column
- `shared/middleware/passwordChangeRequired.js` — blocks protected routes when JWT has `mustChangePassword: true`
- `tests/integration/http/password-prompt.test.js` — 12 tests covering full password change prompt flow

**Modified Files:**
- `shared/services/auth.js` — `issueToken` includes `mustChangePassword` in JWT payload
- `modules/user_management/index.js` — login returns flag; createUser sets flag to 1; changePassword clears flag to 0; changePassword uses targeted revocation instead of `forceLogout()`
- `modules/user_management/module.json` — added `003_must_change_password.sql` to migrations
- `index.js` — wired `passwordChangeRequired` middleware; `req.user` includes `mustChangePassword`

**Bug Found & Fixed:**
- `changePassword` used `forceLogout()` which inserts wildcard `*` revocation, permanently blocking ALL future tokens for that user
- Fix: replaced with `destroyUserSessions()` + `revokeToken()` (current token only)
- `forceLogout()` should only be used for permanent lockout (account deletion, security incident)

**Test Results:** 110/110 passing, 10/10 suites (up from 98/98, 9 suites)


### Session: 2026-07-18 (Session 6)

**Summary:** Added intelligence service package — shared backend service for metadata catalog, insights synthesis, and logic rule evaluation. All modules declaring `"dependencies": ["intelligence"]` receive `ctx.intelligence` automatically via the staging pipeline. Zero per-module wiring required.

**New Files:**
- `contracts/intelligence.js` — service interface spec
- `migrations/002_intelligence.sql` — 3 tables: intelligence_metadata, intelligence_insights, intelligence_rules
- `shared/services/intelligence/index.js` — service facade, delegates to sub-modules
- `shared/services/intelligence/store.js` — SQLite persistence layer
- `shared/services/intelligence/metadata.js` — entity tagging and classification
- `shared/services/intelligence/insights.js` — synthesis engine
- `shared/services/intelligence/logic.js` — rule evaluation engine

**Modified Files:**
- `shared/pipeline/wire.js` — imports intelligence, injects into module Context
- `shared/pipeline/resolve.js` — added 'intelligence' to PLATFORM_SERVICES set

**Design Decision:** Service package (folder with multiple files) rather than single file. Consistent with existing service pattern but allows metadata, insights, and logic to evolve independently within one service boundary.

**Test Results:** 110/110 passing, 10/10 suites (unchanged — no test regressions)

## Frozen Document Hashes

- CONSTITUTION_V6.0.md: `ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a`
- LEXICON_V6.0.0.md: `72280c5fb7d90fa8245139f35b9340016e0fe0d072bf799bd2ea85360e167b45`
- Run: `sha256sum CONSTITUTION_V6.0.md LEXICON_V6.0.0.md` to verify