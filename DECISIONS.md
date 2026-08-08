# Architectural Decisions

**Last Updated:** 2026-08-07  
**Maintainer:** Tim  

---

## Session 1 — 2026-07-16: Initial Repository Setup

### Repository Structure

**Decision:** Monorepo with platform code under `/platform/`, tests at root `/tests/`, apps under `/apps/`.

**Rationale:** Separates platform infrastructure from application layer. Tests run against platform without coupling to any single app.

**Status:** IMPLEMENTED

### Frozen Documents

**Decision:** `CONSTITUTION_V6.0.md` and `LEXICON_V6.0.0.md` are immutable. Changes require formal amendment.

**Integrity:** Tracked via SHA-256 hashes. Verified at commit time.

**Status:** IMPLEMENTED

---

## Session 2 — 2026-07-17: Foundation Fixes

### DB Service Rewrite

**Decision:** Single SQLite connection with manual transaction control (BEGIN/COMMIT/ROLLBACK).

**Rationale:** Original connection pool caused migration runner transaction issues. Single connection with WAL mode is simpler and sufficient for single-server deployment.

**Status:** IMPLEMENTED

### Migration Runner Rewrite

**Decision:** Manual transaction handling. Runner owns `schema_migrations` INSERT exclusively — SQL files must never insert into it.

**Rationale:** Original auto-transaction wrapper conflicted with multi-statement SQL files.

**Status:** IMPLEMENTED

### Test Suite Isolation

**Decision:** Per-suite SQLite databases with unique `DB_PATH`.

**Rationale:** Prevents database locking conflicts and state bleeding between Jest test suites. Some bugs only manifest under specific test ordering (cross-suite contamination).

**Status:** IMPLEMENTED

### Token Revocation Strategy

**Decision:** SQLite table (`token_revocation`) with wildcard support.

**Rationale:** Simple, fits existing DB infrastructure, supports both token-specific and user-wide revocation.

**Deferred:** Bloom filter optimization for large-scale token validation.

**Status:** IMPLEMENTED

### Recurring Test File Path Bug

**Decision:** Test files under `tests/unit/` must use `../../shared` (not `../../../shared`) for require paths.

**Root Cause:** `tests/unit/` is two levels deep from project root, not three. Recurring across sessions.

**Status:** IMPLEMENTED — standardize require path depth going forward

---

## Session 4 — 2026-07-17: JWT Session Token Collision

**Decision:** Include `sessionId` in JWT payload.

**Problem:** Without session identifier, deterministic JWT signing produces identical tokens for identical user states. Password change triggers wildcard session revocation, new login produces same token, immediately rejected.

**Implementation:** `auth.issueToken(user, sessionId)` accepts sessionId. JWT payload: `{ userId, permissions, sessionId }`. Login handler passes `session.sessionId` to `issueToken`.

**Alternative Considered:** Random nonce in JWT payload. Rejected — sessionId already generated, provides stronger session-linkage.

**Status:** IMPLEMENTED

---

## Session 5 — 2026-07-18: Password Change Prompt

### Forced Password Change for New Users

**Decision:** New users created via `createUser` have `must_change_password = 1`. Login detects flag, includes in JWT payload and API response. Middleware blocks protected routes until changed.

**Whitelisted routes:** `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/users/:id/change-password`

**Status:** IMPLEMENTED

### Targeted vs Wildcard Revocation in Password Change

**Decision:** Use `destroyUserSessions()` + `revokeToken()` (specific token hash) instead of `forceLogout()` (wildcard `*` revocation) for password changes.

**Problem:** `forceLogout()` inserts wildcard `*` record with no expiry. Permanently blocks ALL future tokens for that user, not just existing ones. New tokens issued after password change are immediately rejected.

**Failed Attempt:** Comparing JWT `iat` against `revoked_at` timestamp. Failed because both are in seconds — password change and new login occurred in same second, making comparison unreliable.

**Rule:** `forceLogout()` only for permanent lockout (account deletion, security incident). Password changes require targeted revocation only.

**Status:** IMPLEMENTED

---

## Session 6 — 2026-07-18: Intelligence Service Architecture

### Intelligence as Shared Platform Service

**Decision:** Implement intelligence (metadata, insights, logic) as a shared service package at `/shared/services/intelligence/` rather than standalone engines.

**Rationale:** All modules consume intelligence through the same backend service. Service package allows sub-modules to evolve independently within one boundary. Consistent with existing injection pattern — modules declare `"dependencies": ["intelligence"]` and receive `ctx.intelligence`.

**Structure:** `index.js` (facade), `store.js` (persistence, 3 tables), `metadata.js` (tagging/classification), `insights.js` (synthesis), `logic.js` (rule evaluation)

**Wiring:** `wire.js` injects `intelligence` into context. `resolve.js` adds `intelligence` to `PLATFORM_SERVICES` set so dependency resolution skips it.

**Constitution Deviation:** Phases 10-11 specify `/engine/gap-analysis/` and `/engine/recommendation/` as standalone engines. This consolidates intelligence into a shared service. Gap analysis and recommendation engines later implemented at those paths as consumers of the intelligence service.

**Status:** IMPLEMENTED

---

## Session 7 — 2026-07-18: Intelligence Service Logic

### Metadata Pattern Detection

**Decision:** Rule-based `suggest()` in `metadata.js` — email domain classification (.edu, .gov), student/teacher/course entity classification, grade level categorization. Risk indicators: attendance_rate < 0.75, GPA < 2.0. Confidence scoring: 0.95 (>5 tags), 0.85 (>2 tags), 0.70 (otherwise), 0.50 (none).

**Status:** IMPLEMENTED

### Insights Synthesis

**Decision:** DB-backed aggregation in `insights.js` querying students table. Alert levels: critical (< 0.75 attendance, < 2.0 GPA), warning (< 0.85 attendance). Trend tracking: stable/declining, positive/concerning.

**Status:** IMPLEMENTED (later rewritten to use functionRegistry discovery — see Session 15)

### Logic Condition Evaluation

**Decision:** `_matchesConditions()` in `logic.js` supporting 9 operators (`==`, `!=`, `<`, `>`, `<=`, `>=`, `contains`, `in`, `not_in`, `exists`). Dot notation field access via `_getFieldValue()`. Rule priority scoring and action trigger collection.

**Status:** IMPLEMENTED

---

## Session 8 — 2026-07-18: Tier 5 — Operational Tooling

### Rate Limiting Persistence

**Decision:** SQLite-backed `rate_limit` table.

**Rationale:** Leverages existing DB infrastructure, persists across restarts.

**Note:** Architecture map shows `ratelimit.js` at 1500B. Migration `003_rate_limit.sql` creates the table. `initTable()` call removed from `index.js` in Session 13 to eliminate redundancy with migration.

**Status:** IMPLEMENTED

### Migration CLI

**Decision:** Standalone CLI at `scripts/cli/migrate.js` with commands: list, run, rollback.

**Rationale:** Clean separation from boot runner, preserves test isolation.

**Fix (Session 9):** Rewrote with proper connection lifecycle (open per operation, close after). Previous singleton closed connection before operations could use it.

**Status:** IMPLEMENTED

### Module Scaffolding CLI

**Decision:** Minimal template (module.json, index.js, migrations/.gitkeep).

**Command:** `scaffold:new <module-name>`

**Status:** IMPLEMENTED

---

## Session 9 — 2026-07-19: Tier 6 — Advanced Intelligence

### Gap Analysis Engine

**Decision:** Weighted scoring model — capabilities 40%, functions 30%, routes 20%, schema 10%. Status thresholds: < 25% red, < 50% yellow, ≥ 50% green.

**Files:** `engine/gap-analysis/calculator.js` (6153B), `engine/gap-analysis/index.js` (737B)

**Status:** IMPLEMENTED

### Recommendation Engine

**Decision:** Capability clustering by prefix, orphan detection, partial module detection. Recommendations table with 1-hour TTL.

**Files:** `engine/recommendation/analyzer.js` (5158B), `engine/recommendation/index.js` (1155B)

**Status:** IMPLEMENTED

### New Endpoints

**Decision:** `/introspect/gaps` and `/introspect/templates` added to `system_health` module. Auth-required, consistent with existing introspection pattern.

**Status:** IMPLEMENTED

---

## Session 10 — 2026-07-19: Phase 12 — Module Builder

### Builder CLI

**Decision:** Single binary at `scripts/cli/builder.js` with subcommands: new, inspect, recommend, complete.

**Status:** IMPLEMENTED

### Builder Module

**Decision:** Regular application module at `modules/builder/`. Five endpoints: `/builder/dashboard`, `/builder/new-module`, `/builder/:module/analysis`, `/builder/recommendations`, `/builder/templates`.

**Status:** IMPLEMENTED

---

## Session 11 — 2026-07-19: Deferred Tier 1 Resolution

### Graceful Shutdown

**Decision:** `shutdownPlatform()` in `index.js`. Reverses wired modules, calls `unstage()`, closes DB. Signal handlers (SIGTERM, SIGINT) registered for production only, not in tests. E2E suites call `shutdownPlatform` in `afterAll`.

**Status:** IMPLEMENTED

### Input Validation Middleware

**Decision:** Non-blocking sanitization middleware. Position: after body parsing, before rate limiting. Scope: sanitizes `req.body` and `req.query` using existing `ValidationService.sanitize()`.

**Rationale:** Previous blocking approach rejected 37 test requests. Non-blocking cleans input without rejecting.

**Status:** IMPLEMENTED

---

## Session 12 — 2026-07-19: Authorization Middleware Failure

### Authorization Middleware — FAILED ATTEMPT

**Decision:** Attempted to extract per-handler auth checks into pipeline middleware. Derived permissions from handler name segments.

**Result:** 62 test failures. Handler names (`user_management_listUsers`) don't map to permission strings (`admin:users:read`).

**Rollback:** `git reset --hard v6.7.0-tier1-complete`

**Recommendation:** If revisited, use route-level permission declarations in `module.json` instead of name derivation.

**Status:** ROLLED BACK

### Discovery + Audit Endpoints

**Decision:** Four new endpoints in `system_health`: `/discover/capabilities`, `/discover/functions`, `/audit/logs` (paginated, filterable), `/audit/logs/:id`.

**Status:** IMPLEMENTED

---

## Session 13 — 2026-07-19: Technical Debt

### ratelimit.initTable() Redundancy

**Decision:** Removed `initTable()` call from `index.js`.

**Rationale:** Migration `003_rate_limit.sql` creates the same table. Having both creates race condition risk and violates single-source-of-truth.

**Status:** IMPLEMENTED

### Open Handles Investigation

**Finding:** `jest --detectOpenHandles` — zero leaks. "Force exiting Jest" warning is expected with SQLite WAL mode (file handle keeps process alive). Not a bug.

**Status:** RESOLVED

---

## Session 14 — 2026-07-20: Authorization Middleware + Staging + Refresh Tokens

### Route-Level Permission Declarations

**Decision:** Optional `permissions` array in `module.json` routes. Passed through `register.js` → `routeRegistry` → DB + in-memory Map. Middleware checks `route.permissions` with OR logic. Routes without permissions fall through to handler-level checks (zero breaking changes). `changePassword` retains inline `checkPerm` (contextual: self OR admin).

**Files:** `migrations/005_route_permissions.sql`, `index.js`, `register.js`, `routeRegistry.js`, `user_management/module.json`, `user_management/index.js`, `security.test.js`

**Tests:** 181/181 passing

**Status:** IMPLEMENTED

### Staging HTTP Endpoints

**Decision:** Three endpoints in `system_health`: `GET /staging/modules`, `POST /staging/modules`, `DELETE /staging/modules/{id}`. Pipeline functions exposed via handlers in `handlers/staging.js`.

**Limitation:** Dynamic unstaging limited — restart required for full cleanup.

**Status:** IMPLEMENTED

### Refresh Token Mechanism

**Decision:** Refresh token pattern with rotation on every use.

**Implementation:** Migration `006_refresh_tokens.sql` (SHA-256 hashed tokens). Service `refresh.js` (issue, verify, rotate, revoke). Login returns `accessToken` + `refreshToken`. Logout accepts optional `refreshToken`. Old token revoked on each use.

**Status:** IMPLEMENTED

### Test Protocol Standards

**Decision:** Dynamic port allocation (`PORT=0`) and isolated databases (`test_<suite>.sqlite`) for all integration tests.

**Files:** `TEST_PROTOCOL.md`, `tests/helpers/test-server.js`, `createTestServer()` + `adminLogin()` helpers.

**Tests:** 172/172 → 181/181 passing across 16 suites

**Status:** IMPLEMENTED

### Setup Wizard

**Decision:** Mandatory setup wizard blocks server startup until policy decisions made. `deploy/setup-wizard.js` (interactive CLI), `config/session-policy.json` (immutable with SHA-256 integrity hash).

**Forced selections:** Session duration (Secure/Balanced/Extended), backup strategy (Cloud/On-prem + retention), admin identity.

**Status:** IMPLEMENTED

### Backend Marked Complete

**Rationale:** All Constitution phases (0-12) implemented and verified.

**Status:** All 12 phases complete

---

## Session 15 — 2026-08-06: Component Composition Model

### Architecture Shift — Peer-to-Peer to Composition

**Decision:** Move from peer-to-peer module communication to a component-based composition model. Modules become assemblies of shared atomic components.

**Rationale:** Peer-to-peer coupling made modules difficult to reuse and test independently. Composition model allows registries (student, staff, room, inventory) to be assembled into higher-level applications (incident_reporter, student_profile) without direct coupling.

**Implementation:**
- `componentRegistry.js` (3735B) — Component registration with type tracking
- `componentScanner.js` (5067B) — Discovers components from `component.json` manifests
- Components live in `/platform/modules/` alongside standard modules
- Distinguished by `component.json` manifest (vs `module.json` only)
- Components lack independent boot logic

**Status:** IMPLEMENTED

### Component Types

**Decision:** Three component types: `registry` (atomic data stores), `profile` (runtime aggregators), `standard` (full modules with boot logic).

**Deployed:**
- Registry: `student_registry`, `staff_registry`, `room_registry`, `inventory`
- Profile: `student_profile`, `staff_profile`
- Standard: `builder`, `system_health`, `user_management`

**Status:** IMPLEMENTED

---

## Session 16 — 2026-08-07: Intelligence Engine Stabilization

### functionRegistry Injection in wire.js

**Problem:** Profile modules couldn't access registry functions — `ctx.functionRegistry` was undefined.

**Fix:** `wire.js` now imports and injects `functionRegistry` into module context.

**Status:** IMPLEMENTED

### Metadata Storage — Await + Error Handling

**Problem:** `storeMetadata()` calls in registry `index.js` files were fire-and-forget. Errors were silently swallowed. Student metadata was never stored.

**Fix:** Added `await` on `storeMetadata()` calls with `try/catch` + `ctx.log.error()` to surface failures.

**Files:** `student_registry/index.js`, `staff_registry/index.js`, `room_registry/index.js`, `inventory/index.js`

**Status:** IMPLEMENTED

### Entity Name Extraction in synthesize()

**Problem:** `synthesize()` derived entity type from function name by stripping `_list` suffix. Function names include module prefix (e.g., `student_registry_listStudents`), producing garbage entity types like `student_registryStudents`. Metadata coverage reported 0% because entity types didn't match stored metadata.

**Fix:** Strip module prefix from function name before lookup. Explicit mapping table for canonical entity types:

student_registry:listStudents → student staff_registry:listStaff → staff room_registry:listRooms → room inventory:listItems → item

Fallback: strip `list` prefix, lowercase first char, remove trailing `s`.

**Result:** Entity types now canonical (`student`, `staff`, `room`, `item`). Metadata coverage 29% (4 of 14 entities). Tags (`enrolled_active`) and classifications (`learner`) flowing correctly.

**Status:** IMPLEMENTED

### Smoke Test Verification

**Decision:** Six smoke tests covering all registries + intelligence synthesis.

**Tests:**
- `student.endpoint_smoke.sh` — Student CRUD + metadata ✅
- `staff.endpoint_smoke.sh` — Staff CRUD + metadata ✅
- `room.endpoint_smoke.sh` — Room CRUD + metadata ✅
- `inventory.endpoint_smoke.sh` — Item CRUD + metadata ✅
- `intelligence.smoke.sh` — Synthesis + metadata aggregation ✅
- `profile.endpoint_smoke.sh` — Profile modules ✅

**Latest results (2026-08-07):** All 6 passing. 4 metadata records stored. 29% coverage. Canonical entity names. Tags/classifications flowing.

**Status:** IMPLEMENTED

### Architecture Map Generator Fix

**Problem:** `PROJECT_ROOT` pointed to `$HOME/TimSyS_v6` but all platform files live under `$HOME/TimSyS_v6/platform/`. Every path check resolved against wrong base — sea of ❌ MISSING.

**Fix:** Split into `ROOT_DIR` (for docs) and `PLATFORM_DIR` (for everything else). Updated all path constants.

**Second fix:** `set -euo pipefail` killed script when `find` returned exit code 1 on missing `migrations/` directory (e.g., `staff_profile` has no migrations). Changed to `set -uo pipefail` for the modules loop.

**Status:** IMPLEMENTED

---

## Open Decisions

### Rate Limiting at Scale

**Current:** SQLite-backed sliding window. Resets are persisted.

**Needed:** Multi-instance deployment strategy. Consider Redis or shared DB.

**Priority:** Low (single-server sufficient for current deployment)

### Session Duration Policy

**Current:** Configurable via setup wizard (Secure/Balanced/Extended).

**Needed:** Production testing with real user load.

### Permission Declarations Expansion

**Current:** Route-level `permissions` array in `module.json` for `user_management`. Other modules use inline `checkPerm()`.

**Needed:** Migrate remaining modules to declarative permissions for consistency.

### Dynamic Module Staging

**Current:** `POST /staging/modules` hot-loads. `DELETE /staging/modules/{id}` unstages but requires restart for full cleanup.

**Needed:** Full runtime unstage without restart. Cache invalidation + route table update strategy.

### Additional Components

**Candidates:** `medical_referrals`, `attendance`, `professional_development`

**Priority:** As needed for Principal'Ed app suite

---

## Completion Summary

| Phase | Status | Session |
|-------|--------|---------|
| 0: Contracts | COMPLETE (frozen) | 1 |
| 1.1: Services | COMPLETE | 2 |
| 1.2: Registries | COMPLETE | 1, 15 |
| 1.3: Pipeline | COMPLETE | 2 |
| 2: Migrations | COMPLETE | 2 |
| 4: Boot | COMPLETE | 2 |
| 5: HTTP/Middleware | COMPLETE | 5, 14 |
| 7: Testing | COMPLETE | 2, 14 |
| 10-11: Engines | COMPLETE | 9 |
| 12: Builder | COMPLETE | 10 |
| Component Model | COMPLETE | 15 |
| Intelligence Stable | COMPLETE | 16 |
| Smoke Tests | COMPLETE (6/6) | 16 |

**Backend completion:** 100% (all Constitution phases)  
**Component model:** Operational (6 components, 3 standard modules)  
**Intelligence pipeline:** End-to-end verified  
**Test suite:** 181+ tests + 6 smoke tests, all passing  

---

cat >> /home/tmax/TimSyS_v6/DECISIONS.md << 'EOF'

---

## Session 17 — 2026-08-08: Intelligence Engine Stages 5–8

### Event Store Design

**Decision:** Central temporal event persistence with channel-based querying.

**Implementation:** `event_store` module with 5 CRUD endpoints, publishes events to EventBus on create.

**Injection:** `ctx.eventStore` injected into all module contexts for cross-module event access.

**Status:** IMPLEMENTED

### Decision Log Design

**Decision:** Administrative action recording with rationale tracking.

**Implementation:** `decision_log` module with 5 CRUD endpoints, `meta.newValue` and `meta.oldValue` serialized as JSON strings to avoid SQLite binding errors.

**Injection:** `ctx.decisionLog` injected into all module contexts.

**Status:** IMPLEMENTED

### Profile Aggregation Pattern

**Decision:** Read-time aggregation from registry components via `ctx.functionRegistry` instead of data duplication.

**Rationale:** Profiles (`student_profile`, `staff_profile`) should reflect current state from registries without maintaining stale copies. Query registry functions at read-time.

**Implementation:** `student_profile/index.js` and `staff_profile/index.js` call `ctx.functionRegistry.resolve()` to fetch registry data, then aggregate into unified profile objects.

**Status:** IMPLEMENTED

### Relationship Registry with Event Publishing

**Decision:** Entity relationship mapping with automatic event publication on changes.

**Implementation:** `relationship_registry` module with 6 endpoints, publishes `relationship.created`, `relationship.updated`, `relationship.deleted` events on mutations.

**Audit:** `ctx.audit.action()` calls use correct signature `(action, userId, meta)` with `JSON.stringify()` on all object metadata.

**Status:** IMPLEMENTED

### Knowledge Store Schema

**Decision:** Single `knowledge_documents` table with polymorphic type field instead of separate tables for policies/procedures/precedents.

**Rationale:** All document types share common fields (title, content, status, versioning, authorship). Single table simplifies search and versioning.

**Features:** Category enum (`policy`, `procedure`, `precedent`, `guideline`), status lifecycle (`draft`, `review`, `approved`, `archived`), versioning via `parent_document_id` chain, effective/expiry date enforcement.

**Status:** IMPLEMENTED

### Snapshot Metric Collection

**Decision:** Collect metrics across 7 tables in single run, store with unique `run_id` for trend analysis.

**Implementation:** `snapshot_service/run` triggers `_collectMetrics()` which queries students, staff, relationships, decisions, events, knowledge, inventory tables. Returns 23+ metrics per run.

**Trend Analysis:** `GET /snapshots/trends/:key` retrieves historical values for any metric key across multiple runs.

**Status:** IMPLEMENTED

### Auto-Rule Pattern Mining

**Decision:** 4 specialized analyzers rather than generic rule engine.

**Analyzers:**
1. `_analyzeEventFrequency()` — Threshold rules from event_store channel counts
2. `_analyzeDecisionPatterns()` — Frequency rules from decision_log action counts
3. `_analyzeEnrollmentTrend()` — Trend detection from snapshot `students.total` deltas
4. `_analyzeRelationshipDensity()` — Correlation rules from relationship counts (high/low density)

**Confidence Scoring:** Based on data volume (`cnt / 10`, `values.length / 5`, etc.), capped at 0.95 max.

**Lifecycle:** `suggested` → `approved` → `active` or `suggested` → `rejected` or `archived`.

**Status:** IMPLEMENTED

### Notification Event Subscription Pattern

**Decision:** Boot-time event subscription for automatic notification generation on system events.

**Subscriptions:**
- `auto_rules.analyzed` → Info notification to admins
- `auto_rules.status_changed` → Warning/info depending on new status
- `snapshot.completed` → Info notification with metric count
- `knowledge.archived` → Warning notification

**Role Targeting:** Notifications target `role_target = 'admin'` when no specific user is applicable.

**Status:** IMPLEMENTED

### Route Ordering Rule

**Decision:** Static routes must be registered before parametric routes (`:id`) to prevent parameter capture.

**Problem Encountered:** `/knowledge-documents/search` was captured as `:id` when registered after the parametric route.

**Fix:** Reordered `module.json` routes list so `search` comes before `:id`.

**Status:** IMPLEMENTED

### Boolean to Integer Conversion for SQLite

**Decision:** All boolean fields must be converted to integers (0/1) before database insertion.

**Pattern:** `val === true ? 1 : 0` explicit ternary operators everywhere.

**Reason:** SQLite strict type binding fails on boolean values, only accepts numbers.

**Status:** IMPLEMENTED (across all modules)