# TimSyS v6 Context

## Current Phase

**Phase 1 — COMPLETE. All infrastructure layers shipped. Next: HTTP/E2E integration tests, then Phase 6 application modules.**

Platform boots successfully. 7/7 test suites passing (72 tests, 72 passing). Full staging pipeline lifecycle functional. HTTP middleware stack wired.

## Completed

- Repository initialized at `/home/tmax/TimSyS_v6/`
- Git tag `v6.0.0-base` created
- All root docs: `CONTEXT.md`, `ARCHITECTURE_MAP.md`, `HANDOVER.md`, `CONSTITUTION_V6.0.md`, `LEXICON_V6.0.0.md`
- npm packages installed (`package.json`, `package-lock.json`)

### Phase 0: Foundation Contracts (COMPLETE — FROZEN)
- 6 contract files in `/contracts/`: `db.js`, `cache.js`, `auth.js`, `log.js`, `validate.js`, `events.js`

### Phase 1.1: Services (COMPLETE)
- 9 files in `/shared/services/`:
  - **Injected into Context:** `db.js` (single connection, WAL, manual transaction control), `cache.js` (LRU + TTL + glob invalidation), `auth.js` (JWT, token revocation via sha256 hash + wildcard, sessions, checkPerm with wildcards), `log.js` (structured JSON to stdout), `validate.js` (Zod safeParse + recursive sanitization), `events.js` (pub/sub with error isolation + request/reply)
  - **Internal infrastructure:** `session.js` (SQLite-backed, auto-cleanup timer), `audit.js` (append-only, queryable, retention purge), `metrics.js` (counters/histograms/gauges, Prometheus export, periodic DB flush)
  - **Additional:** `email.js` (nodemailer)

### Phase 1.2: Registries (COMPLETE)
- 6 files in `/shared/registry/`:
  - `moduleRegistry.js` — in-memory Map + DB persistence
  - `schemaRegistry.js` — table ownership tracking
  - `routeRegistry.js` — conflict detection, `:param` pattern matching, `auth_required` property
  - `functionRegistry.js` — stores implementation references
  - `capabilityRegistry.js` — conflict detection, `provides` check
  - `dependencyGraph.js` — topological sort, cycle detection via DFS

### Phase 1.3: Staging Pipeline (COMPLETE)
- 7 stages in `/shared/pipeline/`:
  - Order: `discover → validate → register → resolve → wire → boot → (unstage)`
  - `resolve.js` checks `requires` capabilities and `dependencies` (excluding platform services)
  - `register.js` maps `route.auth` to `auth_required` during registration
  - `boot.js` executes `boot(ctx)` in topological order, rolls back on failure
  - `unstage.js` graceful deregistration in reverse
  - Module manifests follow `{module}_{operation}` naming convention with `exports` field

### Phase 2: Migrations (COMPLETE)
- 4 SQL files:
  - `/migrations/000_bootstrap.sql` — creates `schema_migrations` table only
  - `/migrations/001_initial.sql` — creates 9 platform tables
  - `/modules/user_management/migrations/001_users.sql` — creates `users` table
  - `/modules/user_management/migrations/002_password_resets.sql`
- Migration runner scans both `/migrations/` and `/modules/*/migrations/`
- Runner owns `schema_migrations` INSERT exclusively — SQL files must NEVER insert into it
- 11 total tables in database

### Phase 4: Boot Sequence (COMPLETE)
- `/index.js` orchestrates: clear registries → run migrations → verify tables → discover → validate → register → resolve → compute boot order → wire → boot → start HTTP server → emit `platform.ready`
- `contextRegistry` object stores wired module Contexts so HTTP handlers receive `events`, `db`, `cache`, etc.

### Phase 5: Middleware Stack (COMPLETE)
- **CORS** — configurable via `CORS_ORIGINS` env var (default `*`), preflight handling
- **Cookie parsing** — basic, populates `req.cookies`
- **CSRF** — state-changing requests require Bearer token OR `X-Requested-With: XMLHttpRequest` header
- **Authentication** — JWT Bearer token, populates `req.user` with `{ id, permissions }`
- **Rate limiting** — sliding window, default 100/min, admin tier 500/min (detected via `admin:*` permission), `X-RateLimit-*` headers
- **Request logging** — method, path, userId
- **Body parsing** — JSON, 1MB limit

### Phase 7: Testing (COMPLETE — 72/72 PASSING)
- 7 test suites, all passing
  - `tests/unit/services/cache.test.js`
  - `tests/unit/services/db.test.js`
  - `tests/unit/services/events.test.js`
  - `tests/unit/services/validate.test.js`
  - `tests/unit/services/auth.test.js`
  - `tests/unit/registries/registries.test.js`
  - `tests/integration/staging/pipeline.test.js`
- Config: `jest.config.js`, `tests/setup.js` (sets `NODE_ENV=test`, `DB_PATH=./data/test.sqlite`, `JWT_SECRET`)
- Per-suite DB isolation (unique SQLite file per suite)
- Test files use `.test.js` extension, NOT `.spec.js`
- HTTP integration tests exist (`tests/integration/http/auth.test.js`) but are excluded from default Jest run

### Modules (COMPLETE — 2 modules)
- **system_health** (`/modules/system_health/`):
  - 5 routes: `GET /health`, `GET /ready`, `GET /introspect/platform`, `GET /introspect/modules`, `GET /metrics`
  - Subscribes to `platform.ready` event
- **user_management** (`/modules/user_management/`):
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

## In Progress

Nothing.

## Blocked

Nothing.

## Not Started

### Phase 6: Additional Application Modules
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
- Need E2E boot sequence test (cold start → migrate → discover → stage → HTTP ready → teardown)
- Need security tests (auth rejection, CSRF enforcement, rate limit triggering, permission denied paths)

### Phase 12: Module Builder Interface
- CLI commands and UI pages per Constitution spec
- Not started

## Next Steps

1. Expand HTTP integration tests to cover all 11 endpoints (currently only auth.test.js exists)
2. Write E2E boot sequence test
3. Begin Phase 6: implement `courses` module (first dependency in the chain: courses → classes → attendance → grades)
4. Implement remaining 6 introspection endpoints
5. Implement gap analysis and recommendation engines
6. Implement module builder CLI

## Open Decisions

1. **Token revocation strategy:** Implemented via SQLite table (token_revocation). Bloom filter optimization deferred.
2. **Session duration policy:** Default JWT TTL 24h, no refresh token, no rotation. Needs policy decision before production with real users.
3. **Request/reply timeout defaults:** Not specified — defer to EventBus hardening.
4. **CSRF for cookie-based auth:** Only Bearer tokens in use. Header check is preventive. Still relevant if cookie auth added.
5. **Rate limiting persistence:** In-memory Map, resets on restart. Consider Redis or DB-backed before production.

## Session Protocol

- Handover is updated at end of each session (each Lumo thread) before closing.
- Architecture Map is regenerated manually via `bash Tools/update_architecture_map.sh` prior to commits.
- Frozen documents (Constitution, Lexicon) are hashed after modifications. New baseline stored in HANDOVER.md.

---

Last updated: 2026-07-17