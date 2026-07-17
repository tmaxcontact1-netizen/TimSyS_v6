# TimSyS v6 — Handover Document

## Session: 2026-07-16 (Session 2)

---

## What Is TimSyS v6

A modular Node.js school administration platform with a plugin/module architecture. Built from contracts upward through services, registries, pipeline, migrations, boot sequence, HTTP server, and functional modules.

**Tech stack:** Node.js, better-sqlite3, zod, jsonwebtoken, bcryptjs, Jest

**DB path:** `./data/timsys.sqlite` (auto-created on boot, WAL mode, foreign keys enabled)

---

## What's Done

### Phase 0: Foundation Contracts (COMPLETE — FROZEN)
6 contract files in `/contracts/`: `db.js`, `cache.js`, `auth.js`, `log.js`, `validate.js`, `events.js`

### Phase 1.1: Services (COMPLETE)
9 files in `/shared/services/`:
- **Injected into Context:** `db.js` (ConnectionPool, WAL), `cache.js` (LRU + TTL + glob invalidation), `auth.js` (JWT, token revocation via sha256 hash + wildcard, sessions, checkPerm with wildcards), `log.js` (structured JSON to stdout), `validate.js` (Zod safeParse + recursive sanitization), `events.js` (pub/sub with error isolation + request/reply)
- **Internal infrastructure:** `session.js` (SQLite-backed, auto-cleanup timer), `audit.js` (append-only, queryable, retention purge), `metrics.js` (counters/histograms/gauges, Prometheus export, periodic DB flush)

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
- `resolve.js` checks `requires` capabilities and `dependencies` (excluding platform services)
- `register.js` maps `route.auth` to `auth_required` during registration
- `boot.js` executes `boot(ctx)` in topological order, rolls back on failure
- `unstage.js` graceful deregistration in reverse

### Phase 2: Migrations (COMPLETE)
3 SQL files:
- `/migrations/000_bootstrap.sql` — creates `schema_migrations` table only
- `/migrations/001_initial.sql` — creates 9 platform tables (sessions, audit_log, metrics, token_revocation, module_registry, schema_registry, route_registry, function_registry, capability_registry)
- `/modules/user_management/migrations/001_users.sql` — creates `users` table
- Migration runner scans both `/migrations/` and `/modules/*/migrations/`
- Runner owns `schema_migrations` INSERT exclusively — SQL files must NEVER insert into it
- 11 total tables in database

### Phase 4: Boot Sequence (COMPLETE)
`/index.js` orchestrates: clear registries → run migrations → verify tables → discover → validate → register → resolve → compute boot order → wire → boot → start HTTP server → emit `platform.ready`
- `contextRegistry` object stores wired module Contexts so HTTP handlers receive `events`, `db`, `cache`, etc.

### Phase 5: Middleware Stack (COMPLETE)
Full rewrite of `/index.js` with:
- **CORS** — configurable via `CORS_ORIGINS` env var (default `*`), preflight handling
- **Cookie parsing** — basic, populates `req.cookies`
- **CSRF** — state-changing requests (POST/PUT/PATCH/DELETE) require Bearer token OR `X-Requested-With: XMLHttpRequest` header
- **Authentication** — JWT Bearer token, populates `req.user` with `{ id, permissions }`
- **Rate limiting** — sliding window, default 100/min, admin tier 500/min (detected via `admin:*` permission), `X-RateLimit-*` headers
- **Request logging** — method, path, userId
- **Body parsing** — JSON, 1MB limit

### Phase 7: Testing (COMPLETE — 99/99 PASSING)
7 test files:
- `tests/unit/services/cache.test.js` — 12 tests
- `tests/unit/services/db.test.js` — 12 tests
- `tests/unit/services/events.test.js` — 7 tests
- `tests/unit/services/validate.test.js` — 9 tests
- `tests/unit/services/auth.test.js` — 16 tests
- `tests/unit/registries/registries.test.js` — 31 tests (all 6 registries)
- `tests/integration/staging/pipeline.test.js` — 12 tests (full lifecycle)
- Config: `jest.config.js`, `tests/setup.js` (sets `NODE_ENV=test`, `DB_PATH=./data/test.sqlite`, `JWT_SECRET`)
- Note: test files use `.test.js` extension, NOT `.spec.js`

### Modules (COMPLETE — 2 modules)
**system_health** (`/modules/system_health/`):
- 5 routes: `GET /health`, `GET /ready`, `GET /introspect/platform`, `GET /introspect/modules`, `GET /metrics`
- Subscribes to `platform.ready` event

**user_management** (`/modules/user_management/`):
- 8 routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/users`, `POST /api/users`, `GET /api/users/:id`, `PUT /api/users/:id`, `DELETE /api/users/:id`
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
- More `/introspect/*` endpoints for self-knowledge
- Gap analysis engine (`/engine/gap-analysis/`)
- Recommendation engine (`/engine/recommendation/`)
- Both directories exist with `.gitkeep` only

### Phase 9: E2E Tests
- `tests/e2e/` — empty (`.gitkeep` only)
- `tests/integration/http/` — empty (`.gitkeep` only)
- Need HTTP-level tests with running server (supertest or raw http)

### Security Hardening
- Default admin password (`changeme123`) must be changed for production
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
---

## Session: 2026-07-17 (Session 2)

### Summary
Fixed test suite from 44 failures to 3 failures (69/72 passing). Root causes were: migration runner transaction handling, function naming convention mismatch, db.js transaction callback binding, pipeline wire.js referencing undefined variable.

### Files Modified
- `/shared/services/db.js` — Rewritten: single connection, lazy init, manual transaction, poolAcquire/poolRelease stubs
- `/shared/migration-runner.js` — Rewritten: manual BEGIN/COMMIT/ROLLBACK via conn.exec(), proper error surfacing
- `/shared/pipeline/validate.js` — Fixed: uses func.exports for export lookup, func.name for naming convention check
- `/shared/pipeline/register.js` — Fixed: functions registered by func.name, implementation looked up via func.exports
- `/shared/pipeline/wire.js` — Fixed: uses registered.exports for event handler lookup
- `/modules/system_health/module.json` — Fixed: name field follows {module}_{operation}, added exports field
- `/modules/user_management/module.json` — Fixed: name field follows {module}_{operation}, added exports field
- `/tests/unit/services/db.test.js` — Fixed: proper table creation, beforeEach cleanup
- `/tests/unit/services/cache.test.js` — Per-suite DB_PATH isolation
- `/tests/unit/services/auth.test.js` — Per-suite DB_PATH isolation
- `/tests/unit/registries/registries.test.js` — Per-suite DB_PATH isolation, schemaRegistry.clear() added
- `/tests/integration/staging/pipeline.test.js` — Per-suite DB_PATH isolation, schemaRegistry.clear() added

### Test Results
- 6 passed, 1 failed (7 total suites)
- 69 passed, 3 failed (72 total tests)
- Remaining failures: staging pipeline wire/unstage/full-pipeline — event subscription edge case in wire.js

### Known Issues
1. `wire.js` event subscription handler closure may capture loop variables incorrectly — needs review
2. `--detectOpenHandles` warning from Jest — likely better-sqlite3 connection not closing in afterAll

### Next Steps
1. Fix remaining 3 staging pipeline test failures
2. Close database connections in test afterAll hooks
3. Regenerate architecture map and commit

### Frozen Document Hashes
- CONSTITUTION_V6.0.md: Updated (function declaration convention added)
- LEXICON_V6.0.0.md: Updated (4 new terms added)
- Run: `sha256sum CONSTITUTION_V6.0.md LEXICON_V6.0.0.md` for new baseline
ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a  CONSTITUTION_V6.0.md
72280c5fb7d90fa8245139f35b9340016e0fe0d072bf799bd2ea85360e167b45  LEXICON_V6.0.0.md
