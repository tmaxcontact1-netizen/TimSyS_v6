

| Registry | Purpose |
|----------|---------|
| `moduleRegistry.js` | Module discovery + DB persistence |
| `schemaRegistry.js` | Table ownership tracking |
| `routeRegistry.js` | Route conflict detection, `:param` pattern matching |
| `functionRegistry.js` | Function implementation references |
| `capabilityRegistry.js` | Capability conflict detection + `check()` |
| `dependencyGraph.js` | Topological sort, cycle detection via DFS |
| `componentRegistry.js` | Component registration (NEW) |
| `componentScanner.js` | Component discovery from `component.json` (NEW) |

**Status:** All registries operational. Component registries added for composition model.

---

### Phase 1.3: Staging Pipeline (COMPLETE)

7-stage pipeline in `/platform/shared/pipeline/`:

**Order:** `discover` → `validate` → `register` → `resolve` → `wire` → `boot` → `(unstage)`

**Key behaviors:**
- `resolve.js` — Checks required capabilities/dependencies (excludes platform services)
- `register.js` — Maps route `auth` to `auth_required` during registration
- `boot.js` — Executes `boot(ctx)` in topological order, rolls back on failure
- `wire.js` — Injects `functionRegistry`, `context` for profile access
- `unstage.js` — Graceful deregistration in reverse order

**Recent fix:** `wire.js` now injects `functionRegistry` into context so profile modules can access registry functions.

---

### Phase 2: Migrations (COMPLETE)

8 SQL migration files:

| File | Tables Created |
|------|----------------|
| `000_bootstrap.sql` | `schema_migrations` only |
| `001_initial.sql` | 9 platform tables (sessions, audit_log, metrics, token_revocation, module_registry, schema_registry, route_registry, function_registry, capability_registry) |
| `002_intelligence.sql` | 3 intelligence tables (intelligence_metadata, intelligence_insights, intelligence_rules) |
| `003_rate_limit.sql` | Rate limit tracking |
| `004_recommendations.sql` | Recommendation storage |
| `005_route_permissions.sql` | Route-level permissions |
| `006_refresh_tokens.sql` | Refresh token table |
| `007_builder.sql` | Builder module tables |

**Module migrations:**
- `user_management/001_users.sql` — Users table
- `user_management/002_password_resets.sql` — Password reset tracking
- `user_management/003_must_change_password.sql` — `must_change_password` column
- `inventory/001_inventory.sql` — Inventory items
- `room_registry/001_rooms.sql` — Rooms
- `staff_registry/001_staff.sql` — Staff records
- `student_registry/001_students.sql` — Students

**Total:** 15 tables in database. Migration runner scans both `/migrations/` and `/modules/*/migrations/`.

---

### Phase 4: Boot Sequence (COMPLETE)

`/platform/index.js` orchestrates:

1. Clear registries
2. Run migrations
3. Verify tables
4. Discover modules/components
5. Validate manifests
6. Register routes/functions/capabilities
7. Resolve dependencies
8. Compute boot order (topological sort)
9. Wire contexts
10. Boot modules
11. Start HTTP server on port 3000
12. Emit `platform.ready` event

**Status:** Boots cleanly, emits ready event.

---

### Phase 5: HTTP Middleware (COMPLETE)

Middleware stack in `/platform/index.js`:

- **CORS** — Configurable via `CORS_ORIGINS` env var
- **Cookie parsing** — Basic, populates `req.cookies`
- **CSRF** — State-changing requests require Bearer token OR `X-Requested-With: XMLHttpRequest`
- **Authentication** — JWT Bearer token, populates `req.user` with `{id, permissions, mustChangePassword}`
- **Rate limiting** — Sliding window (default 100/min, admin 500/min)
- **Password change required** — Blocks protected routes when `must_change_password = true`
- **Request logging** — Method, path, userId
- **Body parsing** — JSON, 1MB limit

**Note:** Per-handler `auth.checkPerm()` pattern works. Moving auth to middleware caused 62 test failures in previous attempt — not recommended.

**Existing middleware:** `/platform/shared/middleware/passwordChangeRequired.js`

---

### Phase 7: Testing (COMPLETE)

Test suite structure in `/platform/tests/`:

| Category | Files | Status |
|----------|-------|--------|
| Unit/services | 5 test files | ✅ |
| Unit/registries | 1 test file | ✅ |
| Integration/staging | 1 test file | ✅ |
| Integration/http | 5 test files | ✅ |
| E2E | 2 test files | ✅ |
| **Smoke tests** | **6 shell scripts** | **✅ ALL PASSING** |

**Smoke tests:**
- `student.endpoint_smoke.sh` — Student CRUD + metadata storage
- `staff.endpoint_smoke.sh` — Staff CRUD + metadata storage
- `room.endpoint_smoke.sh` — Room CRUD + metadata storage
- `inventory.endpoint_smoke.sh` — Item CRUD + metadata storage
- `intelligence.smoke.sh` — Synthesis endpoint + metadata aggregation
- `profile.endpoint_smoke.sh` — Profile modules

**Latest smoke test results (2026-08-07 19:58:05):**
- TEST 1–4: All 4 registries creating entities ✅
- TEST 5: 4 metadata records stored ✅
- TEST 6: Entity names canonical (`student`, `staff`, `room`, `item`), metadata coverage 29% ✅

**Status:** 181+ tests passing across 14+ suites.

---

## Deployed Modules (9 total)

| Module | Type | Manifest | Index | Component | Migrations |
|--------|------|----------|-------|-----------|------------|
| `builder` | standard | ✅ | ✅ | ❌ | 0 |
| `inventory` | registry | ✅ | ✅ | ✅ | 1 |
| `room_registry` | registry | ✅ | ✅ | ✅ | 1 |
| `staff_profile` | profile | ✅ | ✅ | ✅ | 0 |
| `staff_registry` | registry | ✅ | ✅ | ✅ | 1 |
| `student_profile` | profile | ✅ | ✅ | ✅ | 0 |
| `student_registry` | registry | ✅ | ✅ | ✅ | 1 |
| `system_health` | standard | ✅ | ✅ | ❌ | 0 |
| `user_management` | standard | ✅ | ✅ | ❌ | 3 |

**Component modules (have `component.json`):** inventory, room_registry, staff_registry, student_registry, staff_profile, student_profile  
**Standard modules:** builder, system_health, user_management

---

## Intelligence Engine Status

### Working Features

✅ **Metadata storage** — `storeMetadata()` called on registry CRUD operations  
✅ **Entity resolution** — Correctly maps `student_registry_listStudents` → `student`  
✅ **Synthesis** — Aggregates data from all registries via `functionRegistry`  
✅ **Entity count** — 14 total entities discovered, 4 with metadata  
✅ **Coverage** — 29% metadata coverage (4 of 14)  
✅ **Tag/classification flow** — Tags (`enrolled_active`), classifications (`learner`) persisting  
✅ **Smoketest passing** — All 6 smoke tests green

### Recent Fixes

1. **Await on `storeMetadata()`** — Fire-and-forget caused swallowed errors
2. **Try/catch with logging** — Surface metadata storage failures
3. **`functionRegistry` in context** — Profiles couldn't access registry functions
4. **Entity name extraction** — Stripped module prefix from function names

---

## Engine Layers (PHASE 10–11)

### Gap Analysis Engine `/platform/engine/gap-analysis/`

- `calculator.js` (6153B) — Gap calculation logic
- `index.js` (737B) — Service entry point

**Status:** Working code exists. `/introspect/gaps` endpoint not yet implemented.

### Recommendation Engine `/platform/engine/recommendation/`

- `analyzer.js` (5158B) — Recommendation analysis
- `index.js` (1155B) — Service entry point

**Status:** Working code exists. `/introspect/templates` endpoint not yet implemented.

---

## CLI Tools

| Tool | Purpose |
|------|---------|
| `migrate.js` | Database migrations (run/rollback/list) |
| `scaffold.js` | Module generation |
| `builder.js` | App assembly |

All three exist and are functional.

---

## Applications (3 active)

| Application | Status |
|-------------|--------|
| `launcher` | Active desktop shell |
| `principaled` | Active school administration frontend |
| `memecoined` | Active trading application under development |

The launcher and Principal'Ed are Vite/React applications. Memecoined contains its TypeScript services and browser frontend.

---

## Open Issues & Technical Debt

### Critical

1. **Rate limiting persistence** — In-memory Map resets on restart. Needs Redis or SQLite-backed sliding window.
2. **Graceful shutdown** — Signal handlers interfere with Jest. Needs alternative approach.
3. **Input validation middleware** — Previous attempt blocked 37 test requests. Root cause unclear.

### Moderate

4. **Component.json `"type"` field missing** — `builder`, `system_health`, `user_management` lack component manifests. Either add `component.json` or keep as standard modules.
5. **Refresh tokens** — JWT TTL 24h, no rotation mechanism. Policy needed.
6. **Default admin password** — `changeme123` must be changed for production.
7. **Drift detection false positive** — Architecture-map test discovery now targets `/platform/tests/`.

### Deferred

8. **Authorization middleware** — Per-handler `checkPerm()` works. Constitution specifies middleware, but moving to middleware caused failures. Defer until permission scheme clarified.
9. **Dynamic staging endpoints** — Hot-load/unload modules at runtime. Not critical.
10. **Module Builder UI** — CLI commands exist, UI pages not started.

---

## Open Decisions

- **Session duration** — Default JWT TTL 24h, no refresh token. Needs policy.
- **Token revocation** — Currently SQLite table. Bloom filter deferred.
- **CSRF for cookie-based auth** — Only Bearer tokens in use. Header check is preventive.
- **Rate limiting persistence** — In-memory only. Consider Redis or DB-backed.
- **Graceful shutdown** — Needs Jest-compatible approach.
- **Input validation** — Middleware blocked test requests. Investigation needed.
- **Permission declarations** — Consider `permissions` field in `module.json` route declarations instead of deriving from handler names.

---

## Frozen Document Integrity

Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.

| Document | SHA256 |
|----------|--------|
| `CONSTITUTION_V6.0.md` | `ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a` |
| `LEXICON_V6.0.0.md` | `72280c5fb7d90fa8245139f35b9340016e0fe0d072bf799bd2ea85360e167b45` |

Verify: `sha256sum CONSTITUTION_V6.0.md LEXICON_V6.0.0.md`

---

## How To Run

bash
Start platform

cd platform && node index.js
Run tests

cd platform && npx jest --verbose
Run smoke tests

bash platform/tests/intelligence.smoke.sh bash platform/tests/student.endpoint_smoke.sh bash platform/tests/staff.endpoint_smoke.sh bash platform/tests/room.endpoint_smoke.sh bash platform/tests/inventory.endpoint_smoke.sh bash platform/tests/profile.endpoint_smoke.sh
Regenerate architecture map

bash platform/Tools/update_architecture_map.sh
Fresh database

rm -rf platform/data/ && mkdir -p platform/data && chmod 755 platform/data
Run migrations manually

bash platform/scripts/cli/migrate.js run

---

## Commit Protocol

1. Reconcile all root docs (CONTEXT.md, HANDOVER.md, DECISIONS.md) to reflect actual state
2. Regenerate architecture map via `bash Tools/update_architecture_map.sh`
3. Verify frozen documents haven't changed (hash comparison)
4. Commit with message format: `{phase_title} — {short_description}`
5. Create git tag if milestone reached (e.g., `v6.8.0-intelligence-stable`)

---

## Session History (Selected)

- **Session 1 (2026-07-16)** — Initial repository setup, npm packages, stubs, Constitution/Lexicon
- **Session 2 (2026-07-17)** — Fixed 44→3 test failures, quick-win features, DB service rewrite
- **Session 3 (2026-07-17)** — Confirmed green: 72/72 passing
- **Session 4 (2026-07-17)** — JWT session token collision fix
- **Session 5 (2026-07-18)** — Password change prompt for new users
- **Session 6 (2026-07-18)** — Intelligence service package, security tests, boot regression tests
- **Session 7 (2026-07-18)** — Intelligence service logic implementation
- **Session 13 (2026-08-07)** — Intelligence engine stabilization, component composition model, smoke tests green

---

## Architecture Map

Auto-generated. Regenerate after structural changes: `bash Tools/update_architecture_map.sh`

See `ARCHITECTURE_MAP.md` for complete file inventory, sizes, modification times, and drift detection.

---

## Session 17 — 2026-08-08: Intelligence Engine Stages 5–8 Complete

**Modules Added:** 9 new → 18 total

| Module | Purpose | Endpoints | Tables |
|--------|---------|-----------|--------|
| `event_store` | Temporal event persistence | 5 | `event_store` |
| `decision_log` | Admin action recording | 5 | `decision_log` |
| `relationship_registry` | Entity relationship mapping | 6 | `relationships` |
| `knowledge_store` | Policy/procedure/precedent repo | 7 | `knowledge_documents` |
| `snapshot_service` | Periodic metric synthesis | 5 | `snapshots` |
| `auto_rules` | Pattern mining for rule suggestions | 5 | `auto_rules` |
| `notification` | Role-targeted notifications (revised) | 6 | `notifications` |

**Event Flow Complete:**

Events/Decisions → Snapshots → Pattern Analysis → Auto-Rules → Notifications

**Cross-Module Injection:** `ctx.decisionLog` and `ctx.eventStore` injected into all module contexts via `platform/index.js`.

**Critical Fixes:**
- Route ordering (static before parametric)
- Boolean to integer conversion for SQLite
- `ctx.audit.action()` signature correction
- `JSON.stringify()` on all object metadata

**Status:** Intelligence Engine backend complete. All 8 stages operational.

**Document End.**
---

## Session 17 Addendum — 2026-08-08: CSV Import Infrastructure

**New Service:** `platform/shared/services/csv_parser.js` — native CSV parser, no external deps.

**New Endpoints:**

| Endpoint | Module | Status |
|----------|--------|--------|
| `POST /api/students/import` | student_registry | ✅ |
| `POST /api/staff/import` | staff_registry | ✅ |
| `POST /api/rooms/import` | room_registry | ✅ |
| `POST /api/inventory/import` | inventory | ✅ |

**Import pattern:** CSV sent as JSON body `{ "csv": "..." }`. Module owns its column map and INSERT logic. Platform handles parsing and header normalization only. No multer, no file upload middleware, no external dependencies added.

**Files modified:**
- `platform/shared/services/csv_parser.js` (new)
- `platform/modules/{student_registry,staff_registry,room_registry,inventory}/index.js` (added import handlers)
- All 4 `module.json` files (added routes + functions)

**Status:** CSV import operational for all 4 registries. Tested with sample data.

Architecture Changes
1. Module Assignment System (Backend)

Database Schema

    Table: app_modules (app_id, module_name, enabled, created_at, updated_at)
    Stores per-app module assignments with enable/disable state
    All 20 backend modules assigned to principaled initially

API Endpoints (platform/modules/app_registry/index.js)
POST /api/modules/assign          - Assign module to app
DELETE /api/modules/unassign      - Disable module (sets enabled=0, does not delete row)
GET  /api/modules/list-for-app    - Returns only modules assigned to specified app
2. Module Portal UI

Location: apps/launcher/src/pages/ModulePortalPage.jsx

Features:

    Admin-only access (requires admin:* permission)
    App dropdown (hardcoded to principaled — single app remaining)
    Toggle switches for all 20 backend modules
    Real-time enable/disable via API calls
    Persistent state via app_modules table

3. Dynamic Sidebar (Principal'Ed Dashboard)

Location: apps/principaled/src/dashboard/Index.jsx

Behavior:

    Fetches enabled modules on mount: /api/modules/list-for-app?appId=principaled
    Renders sidebar tabs only for enabled modules
    Permission gating: backend modules (14 total) require admin:* permission
    Operational modules (6 total) accessible to all authenticated users

Sidebar Mapping:
Module Type	Count	Examples
Operational	6	Students, Staff, Rooms, Inventory, Student Profiles, Staff Profiles
Backend (Admin-only)	14	App Registry, Auto Rules, Builder, Decision Log, Event Store, Intelligence, etc.
4. Profile Infrastructure
Student Profile Widget

Location: apps/principaled/src/dashboard/widgets/StudentProfileWidget.jsx

Features:

    Search filters: name, grade level, homeroom
    Extended profile display (interests, strengths, goals, medical details, etc.)
    Related data: contacts, enrollment history, metadata
    Insights integration: general (auto-generated) + deep (manual trigger)
    Alert display for medical alerts, flags, risks

Staff Profile Widget

Location: apps/principaled/src/dashboard/widgets/StaffProfileWidget.jsx

Features:

    Search filters: name, department (handles multi-department via comma/semicolon split)
    Extended profile display (professional development, mentorship roles, committees, career goals)
    Certifications list with expiry tracking
    Insights integration (same as student profiles)
    DBS status alerts (expired, expiring soon, disclosed)

Module Status Widget (Dev-Only)

Location: apps/principaled/src/dashboard/widgets/ModuleStatusWidget.jsx

Displays for each backend module:

    Version, route count, function count, dependency count
    Route table (method, path, handler, auth required, permissions)
    Function signatures (exports, params, returns)
    Database tables
    Events (publishes/subscribes)
    Enabled/disabled status badge

Code Statistics
File	Lines	Type
Index.jsx	~380	Modified (layout, widget routing, permission gating)
StudentProfileWidget.jsx	~230	New
StaffProfileWidget.jsx	~250	New
ModuleStatusWidget.jsx	~200	New
Critical Fixes Applied

    Toggle Bug: Changed removeModuleFromApp from DELETE to UPDATE enabled=0 (preserves row, allows re-enable)
    Duplicate Keys: Removed duplicate student_registry/staff_registry entries from MODULE_TO_VIEW (last key overwrites in JS objects)
    Import Paths: Corrected from ../api/client (Index.jsx) vs ../../api/client (widgets)
    Layout Collapse: Added ../principaled/src/**/*.{jsx,tsx} to Tailwind content paths (classes weren't being compiled)

Data Cleanup Executed
-- Removed apps
DELETE FROM apps WHERE app_id IN ('competeed', 'sanctifyed', 'memecoined');

-- Removed their module assignments  
DELETE FROM app_modules WHERE app_id IN ('competeed', 'sanctifyed', 'memecoined');

-- Assigned all 20 modules to principaled
INSERT INTO app_modules (app_id, module_name, enabled) 
VALUES ('principaled', 'student_registry', 1), /* ... 19 more ... */;
Current State

    ✅ Backend: Fully functional (API verified)
    ✅ Frontend: Widgets render, toggles work, sidebar dynamic
    ✅ Permissions: Admin-only backend modules gated correctly
    ⚠️ Tailwind: Hot reload may require hard refresh after config change
    ⚠️ Vite: Restart recommended after tailwind.config.js modification
