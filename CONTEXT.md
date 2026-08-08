# TimSyS v6 Context

## Current State

**As Of:** 2026-08-07  
**Status:** Backend Complete — All Constitution phases (0-12) implemented. Intelligence engine stabilized with end-to-end smoke tests passing. Component composition model operational.

**Platform:** Boots successfully on port 3000. All services, registries, pipeline, migrations, middleware complete.

**Deployment:** Setup wizard enforces policy selection before first boot. Production secrets documented in `deploy/production.env.example`.

---

## Deployment Inventory

### Modules (9 total)

| Module | Type | Components | Migrations | Status |
|--------|------|------------|------------|--------|
| `builder` | standard | ❌ | 0 | Operational |
| `inventory` | registry | ✅ | 1 | Operational |
| `room_registry` | registry | ✅ | 1 | Operational |
| `staff_profile` | profile | ✅ | 0 | Operational |
| `staff_registry` | registry | ✅ | 1 | Operational |
| `student_profile` | profile | ✅ | 0 | Operational |
| `student_registry` | registry | ✅ | 1 | Operational |
| `system_health` | standard | ❌ | 0 | Operational |
| `user_management` | standard | ❌ | 3 | Operational |

### Applications (3 scaffolded)

| Application | Status |
|-------------|--------|
| `competeed` | ✅ Ready |
| `principaled` | ✅ Ready |
| `sanctifyed` | ✅ Ready |

---

## Completed Work

### Core Infrastructure
- ✅ 7 contracts (frozen — `CONSTITUTION_V6.0.md`, `LEXICON_V6.0.0.md`)
- ✅ 12 services + intelligence package (5 sub-modules)
- ✅ 8 registries (includes `componentRegistry.js`, `componentScanner.js`)
- ✅ 7-stage staging pipeline
- ✅ 8 database migrations (15 total tables)
- ✅ JWT sessions with `sessionId` payload
- ✅ Password change prompts + `passwordChangeRequired.js` middleware
- ✅ Targeted token revocation (no wildcard for password changes)
- ✅ Refresh token rotation
- ✅ Rate limiting (SQLite-backed)
- ✅ CSRF protection
- ✅ Graceful shutdown
- ✅ Non-blocking input sanitization

### Intelligence Engine
- ✅ Metadata storage (entity tagging, classification, confidence scoring)
- ✅ Insights synthesis (DB-backed aggregation via `functionRegistry`)
- ✅ Logic rule evaluation (9 operators, dot notation, priority scoring)
- ✅ Entity name canonicalization (strips module prefix)
- ✅ Smoke test verification (6 tests, 29% metadata coverage, 4 of 14 entities tracked)

### Component Composition Model
- ✅ `componentRegistry.js` — Component registration with type tracking
- ✅ `componentScanner.js` — Discovers components from `component.json`
- ✅ 6 registry/profile components operational
- ✅ Standard modules unchanged (no `component.json`)

### CLI Tools
- ✅ `migrate.js` — list, run, rollback
- ✅ `scaffold.js` — generate new module
- ✅ `builder.js` — new, inspect, recommend, complete
- ✅ `setup-wizard.js` — enforced policy selection

### Endpoints
- ✅ Authentication: login, logout, refresh, me, change-password, forgot/reset
- ✅ User management: CRUD, password resets
- ✅ Registry endpoints: students, staff, rooms, inventory (CRUD + metadata)
- ✅ System health: introspection, discovery, audit, staging
- ✅ Builder endpoints: dashboard, analysis, templates, recommendations

### Testing
- ✅ 181+ unit + integration tests (all passing)
- ✅ 6 smoke tests (all passing)
- ✅ Per-suite DB isolation
- ✅ Dynamic port allocation
- ✅ Test helper (`createTestServer()`, `adminLogin()`)
- ✅ `TEST_PROTOCOL.md` — standardized testing requirements

### Operational Tooling
- ✅ Migration CLI
- ✅ Backup script (`deploy/backup.sh` — VACUUM INTO with retention)
- ✅ Rollback script (`deploy/rollback.sh`)
- ✅ Setup wizard (`deploy/setup-wizard.js`)
- ✅ Session policy enforcement (`config/session-policy.json`)
- ✅ Architecture map generator (`platform/Tools/update_architecture_map.sh`)

---

## Frozen Document Integrity

Store these hashes. Verify after any change. Any mismatch indicates tampering or error.

| Document | SHA-256 |
|----------|---------|
| `CONSTITUTION_V6.0.md` | `ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a` |
| `LEXICON_V6.0.0.md` | `72280c5fb7d90fa8245139f35b9340016e0fe0d072bf799bd2ea85360e167b45` |

---

## How To Run

bash
Start platform

cd ~/TimSyS_v6/platform && node index.js
Run tests

cd ~/TimSyS_v6/platform && npx jest --verbose
Run all smoke tests

bash tests/intelligence.smoke.sh bash tests/student.endpoint_smoke.sh bash tests/staff.endpoint_smoke.sh bash tests/room.endpoint_smoke.sh bash tests/inventory.endpoint_smoke.sh bash tests/profile.endpoint_smoke.sh
Regenerate architecture map

bash ~/TimSyS_v6/platform/Tools/update_architecture_map.sh
Fresh database

rm -rf ~/TimSyS_v6/platform/data/ && mkdir -p ~/TimSyS_v6/platform/data && chmod 755 ~/TimSyS_v6/platform/data bash ~/TimSyS_v6/platform/scripts/cli/migrate.js run

---

## Lessons Learned

### JWT Token Collision
**Problem:** Login immediately after password change produced identical JWT, causing 401 due to wildcard revocation.  
**Solution:** Include `sessionId` in JWT payload.  
**Prevention:** Always include unique session identifier when supporting concurrent sessions.

### Wildcard Token Revocation
**Problem:** `forceLogout()` inserts wildcard `*` with no expiry, permanently blocks ALL future tokens.  
**Solution:** Use `destroyUserSessions()` + `revokeToken()` for password changes. Reserve `forceLogout()` for lockout.  
**Prevention:** Understand blast radius before using wildcard operations.

### Test Flakiness
**Problem:** Tests passed in isolation but failed when run together.  
**Cause:** Shared process state across Jest suites.  
**Solution:** Per-suite DB isolation, dynamic port allocation.  
**Prevention:** Design tests independently, avoid mutable global state.

### Intelligence Service Placeholder
**Problem:** Initial intelligence service had placeholder methods returning sample data.  
**Lesson:** Structure early, implement business logic when consuming modules exist.

### Metadata Storage Silent Failures
**Problem:** Fire-and-forget `storeMetadata()` calls swallowed errors.  
**Solution:** `await` + `try/catch` + `ctx.log.error()` to surface failures.

### Entity Name Mapping
**Problem:** Module prefixes in function names produced garbage entity types.  
**Solution:** Strip module prefix, use explicit mapping table for canonical types.

---

## Open Decisions

1. **Rate limiting at scale:** Multi-instance deployment strategy. Redis or shared DB needed for >1 instance.
2. **Dynamic unstaging:** Full runtime unstage without restart. Cache invalidation + route table update.
3. **Permission migration:** Convert remaining modules from inline `checkPerm()` to declarative `permissions` arrays.
4. **Additional components:** `medical_referrals`, `attendance`, `professional_development` — as needed for app suite.

---

## Documentation Protocol

- Update `HANDOVER.md` at end of each session
- Regenerate `ARCHITECTURE_MAP.md` before commits
- Append new decisions to `DECISIONS.md` (maintain chronology)
- Verify frozen document hashes after any modification
- Commit message format: `{phase_title} — {short_description}`

---

## Session History

- **Session 1 (2026-07-16)** — Repository setup, Constitution/Lexicon, stubs
- **Session 2 (2026-07-17)** — DB service rewrite, migration runner, test isolation
- **Session 4 (2026-07-17)** — JWT session token fix
- **Session 5 (2026-07-18)** — Password change prompts, targeted revocation
- **Session 6 (2026-07-18)** — Intelligence service architecture
- **Session 7 (2026-07-18)** — Intelligence logic implementation
- **Session 8 (2026-07-18)** — Tier 5 (rate limiting, migrations, scaffolding)
- **Session 9 (2026-07-19)** — Tier 6 (gap analysis, recommendation engines)
- **Session 10 (2026-07-19)** — Builder CLI + module
- **Session 11 (2026-07-19)** — Deferred Tier 1 (shutdown, validation)
- **Session 12 (2026-07-19)** — Authorization middleware failure + rollback
- **Session 13 (2026-07-19)** — Technical debt cleanup
- **Session 14 (2026-07-20)** — Route permissions, staging endpoints, refresh tokens
- **Session 15 (2026-08-06)** — Component composition model
- **Session 16 (2026-08-07)** — Intelligence engine stabilization

---

**Last Updated:** 2026-08-07  
**Maintainer:** Tim

**As Of:** 2026-08-08
**Status:** Intelligence Engine fully implemented — all 8 stages operational.

### New Modules (9 → 18 total)

| Module | Type | Endpoints | Tables | Status |
|--------|------|-----------|--------|--------|
| `knowledge_store` | standard | 7 | `knowledge_documents` | ✅ Operational |
| `snapshot_service` | standard | 5 | `snapshots` | ✅ Operational |
| `auto_rules` | standard | 5 | `auto_rules` | ✅ Operational |
| `notification` | standard | 6 | `notifications` | ✅ Operational (was stub) |
| `relationship_registry` | standard | 6 | `relationships` | ✅ Operational |
| `event_store` | standard | 5 | `event_store` | ✅ Operational |
| `decision_log` | standard | 5 | `decision_log` | ✅ Operational |

### What Was Built

- **Event Store** — Temporal event persistence with channel-based querying
- **Decision Log** — Administrative action recording with rationale tracking
- **Profile Aggregation** — `student_profile` and `staff_profile` now aggregate identity, contacts, certifications, decisions, and events at read-time
- **Relationship Registry** — Entity relationship mapping (teacher_of, parent_of, etc.) with CRUD and entity-based lookups
- **Knowledge Store** — Policy/procedure/precedent repository with versioning, search, and archiving
- **Snapshot Service** — Periodic metric synthesis across 7 source tables, trend tracking via run IDs
- **Auto-Rule Generation** — Pattern mining across event_store, decision_log, snapshots, and relationships. 4 analyzers: threshold, frequency, trend, correlation. Confidence-scored suggestions with lifecycle (suggested → approved → active)
- **Notification Pipeline** — Role-targeted notifications with read/unread lifecycle. Subscribes to auto_rules, snapshot, and knowledge events automatically

### Cross-Module Event Flow

Full event-driven pipeline operational:

Data capture (events/decisions) → Snapshots → Pattern analysis → Rule suggestions → Notifications

### Platform Stats

- **Modules booted:** 18
- **Total endpoints:** 39 (new intelligence modules)
- **New tables:** 7
- **Service injection:** `ctx.decisionLog`, `ctx.eventStore` injected into all module contexts via `platform/index.js`

### Session History Update

- **Session 17 (2026-08-08)** — Intelligence Engine Stages 5–8: Knowledge Store, Snapshot Service, Auto-Rule Generation, Notification Pipeline. Backend intelligence engine complete.
---

## Session 17 Addendum — 2026-08-08: CSV Import Infrastructure

**As Of:** 2026-08-08
**Status:** CSV import operational for 4 registries.

### New Service

- `platform/shared/services/csv_parser.js` — Native CSV parser with header normalization and column mapping. No external dependencies.

### New Endpoints

| Endpoint | Module | Status |
|----------|--------|--------|
| `POST /api/students/import` | student_registry | ✅ Operational |
| `POST /api/staff/import` | staff_registry | ✅ Operational |
| `POST /api/rooms/import` | room_registry | ✅ Operational |
| `POST /api/inventory/import` | inventory | ✅ Operational |

### Import Pattern

- Platform layer: `csv_parser.js` handles raw parsing, quoting/escaping, and header normalization (lowercase + strip non-alphanumeric).
- Module layer: Each registry defines its own column map (variant → schema column) and INSERT logic. Duplicate detection via unique field check (student_id, staff_id, room_number, item_number).
- Transport: CSV sent as JSON body `{ "csv": "..." }`. No multipart/form-data, no file upload middleware, no external dependencies.
