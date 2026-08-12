# TimSyS Backend Constitution v6.1

## Core Principle

A module is a self-describing unit. If it declares its schema, capabilities, dependencies, and routes in a standard format, the system wires it automatically. No code edits after deployment.

A component is an atomic building block assembled into modules by the composition model. Components lack independent boot logic — they are wired and booted as part of a parent Module's lifecycle. Components declare their type (`registry`, `profile`) in `component.json`.

---

## PHASE 0: FOUNDATION CONTRACTS

### Deliverable: Shared Service API Specifications

Define the contracts before implementing anything. Modules consume services through these interfaces only. Contracts live in `/platform/contracts/`.

| Service | Contract File | Methods | Notes |
|---------|--------------|---------|-------|
| Database | `db.js` | query(sql, params), exec(sql), scalar(sql, params), transaction(fn), getConnection() | Sync wrapper over better-sqlite3, single connection with manual transaction control |
| Cache | `cache.js` | get(key), set(key, val, ttl), invalidate(pattern), flush() | LRU + glob pattern invalidation |
| Auth | `auth.js` | issueToken(user, sessionId), verifyToken(token), revokeToken(token), revokeAllUserTokens(userId), createSession(userId, payload), getSession(sessId), destroySession(sessId), destroyUserSessions(userId), getActiveSessions(userId), checkPerm(permissions, routePermissions), isPermissionGranted(user, permission) | JWT + session store + wildcard token revocation |
| Logging | `log.js` | info(msg, ctx), warn(msg, ctx), error(msg, ctx), audit(action, userId, meta) | Structured JSON to stdout |
| Validation | `validate.js` | validate(schema, data), sanitize(input) | Zod schemas + recursive sanitization |
| Event Bus | `events.js` | publish(channel, payload), subscribe(channel, handler), unsubscribe(channel, handler), request(channel, payload, timeout) | In-memory pub/sub + request/reply with error isolation |
| Session | `session.js` | (inherited from auth contract) | Session lifecycle management, TTL-based expiration |
| Audit | `audit.js` | logAction(action, userId, entityType, entityId, oldVal, newVal), getLogs(filter, pagination) | Immutable append-only audit log |
| Metrics | `metrics.js` | increment(name, value), histogram(name, duration), gauge(name, value), export() | Counters/histograms/gauges, Prometheus export |
| Email | `email.js` | send(to, subject, html), sendTemplate(template, data) | Nodemailer wrapper |
| Rate Limit | `ratelimit.js` | checkLimit(identifier, tier), recordHit(identifier), reset(identifier) | SQLite-backed sliding window |
| Refresh | `refresh.js` | issueRefreshToken(userId), verifyRefreshToken(token), rotateRefreshToken(oldToken), revokeRefreshToken(token), revokeAllUserRefreshTokens(userId) | Rotation on every use |
| Intelligence | `intelligence.js` | storeMetadata(entityType, entityId, tags, classifications, confidence), suggest(context), synthesize(functionName), evaluateRules(rules, context) | Metadata storage, entity classification, synthesis engine, rule evaluation |

### Output

13 contract files: `db.js`, `cache.js`, `auth.js`, `log.js`, `validate.js`, `events.js`, `session.js`, `audit.js`, `metrics.js`, `email.js`, `ratelimit.js`, `refresh.js`, `intelligence.js`. Each exports interface shape. No implementation yet. Contracts are frozen — modifications require constitutional amendment.

---

## PHASE 1: INFRASTRUCTURE LAYER

### Stage 1.1: Persistence Layer

Build the services that modules will use. Services live in `/platform/shared/services/`.

| File | Responsibility |
|------|----------------|
| `/platform/shared/services/db.js` | Single SQLite connection, manual transaction control, `getConnection/exec/query/scalar` methods |
| `/platform/shared/services/cache.js` | LRU cache (configurable size/TTL), glob pattern invalidation, TTL expiration timer |
| `/platform/shared/services/session.js` | SQLite-backed sessions, auto-cleanup timer, session metadata |
| `/platform/shared/services/audit.js` | Audit log writer, append-only log, paginated retrieval, retention purge |
| `/platform/shared/services/metrics.js` | Counters/histograms/gauges, in-memory aggregation, Prometheus export |
| `/platform/shared/services/auth.js` | JWT issuance/validation, session management, token revocation (specific + wildcard), `checkPerm()` with wildcard permissions |
| `/platform/shared/services/log.js` | Structured JSON logging to stdout |
| `/platform/shared/services/validate.js` | Zod `safeParse`, recursive sanitization |
| `/platform/shared/services/events.js` | EventBus pub/sub, request/reply, error isolation for subscribers |
| `/platform/shared/services/email.js` | Nodemailer wrapper |
| `/platform/shared/services/ratelimit.js` | SQLite-backed sliding window rate limiter, persistent across restarts |
| `/platform/shared/services/refresh.js` | Refresh token issuance, verification, rotation, revocation |
| `/platform/shared/services/intelligence/` | Intelligence service package (5 sub-modules) |

### Intelligence Service Package

Located at `/platform/shared/services/intelligence/`:

| File | Responsibility |
|------|----------------|
| `index.js` | Facade, delegates to sub-modules, injected into Context |
| `store.js` | SQLite persistence for metadata, insights, rules (3 tables) |
| `metadata.js` | Entity tagging and classification, rule-based pattern detection, confidence scoring |
| `insights.js` | Synthesis via `functionRegistry` discovery, DB-backed aggregation, alerts, trends |
| `logic.js` | Rule evaluation engine with 9 operators (`==`, `!=`, `<`, `>`, `<=`, `>=`, `contains`, `in`, `not_in`, `exists`), dot notation field access, priority scoring |

### Schema Migrations

Migrations live in `/platform/migrations/` (platform-level) and `/platform/modules/{moduleName}/migrations/` (module-level). Applied in order during boot. Tracked in `schema_migrations` table. All migrations must be backward compatible — no destructive operations.

Applied migrations: `000_bootstrap.sql` → `007_builder.sql` (8 total, 15 tables)

### Stage 1.2: Registry Layer

Platform-managed stores for tracking registered entities. Live in `/platform/shared/registry/`.

| File | Responsibility |
|------|----------------|
| `/platform/shared/registry/moduleRegistry.js` | Register/deregister Modules, list all, query by capability |
| `/platform/shared/registry/schemaRegistry.js` | Register table ownership, track migrations per module |
| `/platform/shared/registry/routeRegistry.js` | Register HTTP routes, map paths to handlers, conflict detection, `:param` pattern matching |
| `/platform/shared/registry/functionRegistry.js` | Register callable functions, implementation references, route handler mapping |
| `/platform/shared/registry/capabilityRegistry.js` | Register capabilities, conflict detection, `check()` for availability |
| `/platform/shared/registry/dependencyGraph.js` | Track module dependencies, topological sort for boot order, cycle detection via DFS |
| `/platform/shared/registry/componentRegistry.js` | Register Components and their types (`registry`, `profile`, `standard`) |
| `/platform/shared/registry/componentScanner.js` | Discover Components from `component.json` manifests, populate ComponentRegistry |

### Stage 1.3: Staging Pipeline

The plug-and-play mechanism located at `/platform/shared/pipeline/`. Seven sequential stages.

| Component | Responsibility |
|-----------|----------------|
| `/platform/shared/pipeline/discover.js` | Scan `/modules` directory, find `module.json` and `component.json` manifests, parse declarations |
| `/platform/shared/pipeline/validate.js` | Validate Manifests against schema, check required exports, verify dependency availability, detect circular references |
| `/platform/shared/pipeline/register.js` | Register validated Modules/Components through all Registries, map `auth_required` flags, register route permissions |
| `/platform/shared/pipeline/resolve.js` | Resolve dependencies, check required capabilities/dependencies are available, add intelligence to PLATFORM_SERVICES set |
| `/platform/shared/pipeline/wire.js` | Connect routes to handlers, inject services + `functionRegistry` into Context, set up event subscriptions |
| `/platform/shared/pipeline/boot.js` | Execute `boot(ctx)` hooks in topological order, rollback on failure, capture failures, report status |
| `/platform/shared/pipeline/unstage.js` | Gracefully deregister Modules/Components, remove routes, invalidate cache entries, run teardown hooks in reverse order |

---

## PHASE 2: MODULE STANDARD

### Deliverable: The Module Manifest Spec

Every Module must provide this exact structure. **File:** `/platform/modules/{moduleName}/module.json`

json { "name": "{unique_module_id}", "version": "1.0.0", "author": "internal", "dependencies": ["auth", "db", "cache"], "provides": ["capability:read_records", "capability:write_records"], "requires": ["capability:user_management.get_user"], "routes": [ {"path": "/api/users", "method": "GET", "handler": "listUsers", "auth_required": true, "permissions": ["admin:users:read"]}, {"path": "/api/users/:id", "method": "POST", "handler": "createUser", "auth_required": true} ], "functions": [ {"name": "listUsers", "exports": "listUsers", "params": ["filter"], "returns": "UserRecord[]"}, {"name": "createUser", "exports": "createUser", "params": ["data"], "returns": "UserRecord"} ], "schema": { "tables": ["users", "user_sessions"], "migrations": ["migrations/001_users.sql"] }, "events": { "publishes": ["user.created", "user.updated"], "subscribes": ["auth.login_success"] } }
Required Exports

Every Module must export:

    boot(ctx) — Called during staging, receives injected services Context
    teardown(ctx) — Called during unstaging
    All functions declared in module.json.functions

Naming Convention

Functions follow {module}_{operation} (e.g., user_management_listUsers). Module names are lowercase with underscores separating words.
PHASE 2.1: COMPONENT STANDARD
Deliverable: The Component Manifest Spec

Every Component must provide this exact structure. File: /platform/modules/{componentName}/component.json
{
  "name": "{unique_component_id}",
  "type": "registry",
  "version": "1.0.0",
  "provides": ["capability:read_{entity}", "capability:write_{entity}"],
  "functions": [
    {"name": "listEntities", "exports": "listEntities", "params": ["filter"], "returns": "EntityRecord[]"},
    {"name": "createEntity", "exports": "createEntity", "params": ["data"], "returns": "EntityRecord"}
  ],
  "schema": {
    "tables": ["entities"],
    "migrations": ["migrations/001_entities.sql"]
  }
}
Component Types
Type	Behavior	Examples
registry	Provides atomic data storage and CRUD operations for a single entity type	student_registry, staff_registry, room_registry, inventory
profile	Aggregates data from Registry Components at runtime, does not own tables	student_profile, staff_profile
standard	Full Module with independent boot logic (no component.json)	builder, system_health, user_management
PHASE 3: DATABASE SCHEMA DEFINITION
Platform-Level Tables
Table	Columns	Purpose
schema_migrations	id, version, applied_at	Track applied migrations
sessions	session_id, user_id, created_at, expires_at, payload	Active sessions
audit_log	id, timestamp, user_id, action, entity_type, entity_id, old_value, new_value, ip_address	Immutable audit trail
metrics	id, timestamp, metric_name, value, tags	Internal metrics storage
token_revocation	id, token_hash, revoked_at, user_id, reason	Revoked JWT tracking
rate_limit	id, identifier, endpoint, hit_count, window_start	Rate limiting persistence
refresh_tokens	id, token_hash, user_id, created_at, expires_at	Refresh token rotation
intelligence_metadata	id, entity_type, entity_id, tags, classifications, confidence, created_at, updated_at	Metadata storage
intelligence_insights	id, insight_type, summary, metrics, alerts, created_at, ttl	Insights aggregation
intelligence_rules	id, name, conditions, actions, priority, active	Rule definitions
recommendations	id, type, payload, confidence, created_at, ttl	Recommendation storage
route_permissions	id, route_path, route_method, permissions	Route-level permissions
Module-Owned Tables

Each Module owns its tables via migrations. Referenced through schemaRegistry. Examples: users, students, staff, rooms, inventory_items, password_resets, etc.
PHASE 4: BOOT SEQUENCE
Deliverable: Ordered Initialization Protocol
Boot Order

    Clear all Registries (fresh state)
    Run database migrations (platform + module-level, all in order, skip already-applied)
    Verify tables exist, load configuration
    Discover Modules and Components from /modules directory
    Validate all Manifests (module.json + component.json)
    Build dependency graph (Module → Module, Component → Registry)
    Detect circular dependencies (fail immediately if found)
    Compute topological boot order
    Register each Module/Component through all Registries
    Resolve dependencies (verify required capabilities/services available)
    Wire routes to handlers, inject Context with services + functionRegistry
    Execute Module/Component boot hooks in order
    Start HTTP server on configured PORT
    Emit platform.ready event

Failure Handling

    Any failure before step 14 aborts boot with detailed error log
    Any failure during step 12 triggers graceful rollback of already-booted Modules/Components
    Rollback runs unstage.js in reverse order

PHASE 5: HTTP LAYER
Deliverable: REST API Surface
Endpoint Groups
Group	Paths	Auth Required	Permissions
Health	GET /health, GET /ready	No	None
Metrics	GET /metrics	Yes	admin:metrics:read
Audit	GET /audit/logs, GET /audit/logs/:id	Yes	admin:audit:read
Staging	GET /staging/modules, POST /staging/modules, DELETE /staging/modules/{id}	Yes	admin:staging:manage
Discovery	GET /discover/capabilities, GET /discover/functions	Yes	admin:discovery:read
Auth	POST /api/auth/login, POST /api/auth/logout, POST /api/auth/refresh, GET /api/auth/me, POST /api/auth/forgot-password, POST /api/auth/reset-password	Mixed	Varies
User Mgmt	GET/POST/PATCH/DELETE /api/users/*, POST /api/users/:id/change-password	Yes	admin:users:*
Registry	GET/POST/PATCH/DELETE /api/{students,staff,rooms,inventory}/*	Yes	admin:{entity}:*
Introspection	GET /introspect/*	Yes	admin:introspection:read
Builder	GET/POST /builder/*	Yes	admin:builder:*
Middleware Stack (Fixed Order)

    CORS (configured origins only, via CORS_ORIGINS env var)
    Body parsing (JSON limit: 1MB)
    Cookie parser (populates req.cookies)
    CSRF protection (state-changing requests require Bearer token OR X-Requested-With: XMLHttpRequest)
    Authentication (JWT Bearer token, populates req.user with {id, permissions, mustChangePassword})
    Authorization (route-level permission checks via route.permissions, OR logic)
    Password change required middleware (blocks protected routes when must_change_password = true)
    Rate limiting (sliding window, SQLite-backed)
    Input sanitization (non-blocking, sanitizes req.body + req.query)
    Request logging (method, path, userId)

Response Standard
{
  "success": true,
  "data": {},
  "meta": {"timestamp": "ISO8601", "requestId": "..."}
}
Errors
{
  "success": false,
  "error": {"code": "VALIDATION_ERROR", "message": "...", "details": []},
  "meta": {"timestamp": "ISO8601", "requestId": "..."}
}
PHASE 6: REFERENCE IMPLEMENTATIONS
Core Modules

user_management — User accounts, authentication, password management
student_registry — Student records (Component: registry type)
student_profile — Student aggregation (Component: profile type)
staff_registry — Staff records (Component: registry type)
staff_profile — Staff aggregation (Component: profile type)
room_registry — Room management (Component: registry type)
inventory — Item tracking (Component: registry type)
builder — Module scaffolding and gap analysis (Standard Module)
system_health — Platform introspection, staging endpoints (Standard Module)
PHASE 7: TESTING LAYER
Test Coverage Requirements
Test Type	Scope	Minimum Coverage
Unit	Shared services	90%
Unit	Registries	100%
Integration	Module staging pipeline	100%
Integration	HTTP endpoints	85%
E2E	Boot sequence	Critical path 100%
Security	Auth, CSRF, rate limit	100%
Smoke	Endpoints + intelligence	100% (all 6 smoke tests)
Test Infrastructure

    Per-suite SQLite databases (unique DB_PATH)
    Dynamic port allocation (PORT=0)
    Test helper (createTestServer(), adminLogin())
    Parallel execution safe
    platform/tests/helpers/test-server.js — shared infrastructure
    TEST_PROTOCOL.md — mandatory testing standards

Test Locations

    /platform/tests/unit/services/* — Service unit tests
    /platform/tests/unit/registries/* — Registry unit tests
    /platform/tests/integration/staging/* — Pipeline tests
    /platform/tests/integration/http/* — HTTP endpoint tests
    /platform/tests/e2e/* — Boot sequence tests
    /platform/tests/*.sh — Smoke tests

PHASE 8: DEPLOYMENT
Environment Variables
NODE_ENV=production|development|test
PORT=3000
LOG_LEVEL=info|debug|warn|error
DB_PATH=./data/timsys.sqlite
CACHE_MAX_SIZE=10000
CACHE_DEFAULT_TTL=300
JWT_SECRET=<generated>
SESSION_SECRET=<generated>
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
RATE_LIMIT_AUTH=10/min
RATE_LIMIT_API=100/min
RATE_LIMIT_ADMIN=500/min
Setup Wizard

File: deploy/setup-wizard.js

Mandatory first-run CLI that enforces:

    Session duration policy (Secure/Balanced/Extended)
    Backup strategy (Cloud/On-prem + retention schedule)
    Admin identity recording
    Writes config/session-policy.json with SHA-256 integrity hash

Server startup blocked until wizard completes and session-policy.json exists.
Backup Script

File: deploy/backup.sh

    Reads policy from session-policy.json
    Performs VACUUM INTO backups
    Applies retention policy (delete old backups)
    Runs via cron

Health Checks

    GET /health — System alive (200 OK)
    GET /ready — System ready (all registries populated, DB connected, migrations applied, setup wizard complete)

Logging

Structured JSON to stdout. Parseable by log aggregators.
Metrics

Prometheus-compatible /metrics endpoint for scraping.
PHASE 9: INTROSPECTION LAYER
Deliverable: Platform Self-Knowledge APIs
Endpoint	Method	Returns
/introspect/platform	GET	Total modules, components, capabilities, functions, routes, health
/introspect/modules	GET	All staged Modules/Components with metadata
/introspect/capabilities	GET	Filter by name, module, dependency chains
/introspect/functions	GET	Filter by name, signature, required capabilities
/introspect/routes	GET	Filter by path, auth requirement, module origin
/introspect/dependencies	GET	Adjacency list, cycle warnings, boot order
/introspect/gaps	GET	Completion metrics, missing artifacts
/introspect/templates	GET	Recommended Module builds

All queries read from Registries. No direct filesystem access. Caching TTL: 5 minutes.
PHASE 10: GAP ANALYSIS ENGINE
Deliverable: Completion Percentage Calculator
Scoring Formula
Metric	Weight	Thresholds
Capability Coverage	40%	< 25% red, < 50% yellow, ≥ 50% green
Function Completeness	30%	Same
Route Completeness	20%	Same
Schema Completeness	10%	Same
Gap Report Structure
{
  "moduleName": "attendance_tracking",
  "completionScore": 73,
  "status": "yellow",
  "gaps": [
    {"category": "function", "missing": ["recordEntry"], "priority": "high"},
    {"category": "route", "missing": ["POST /api/attendance"], "priority": "medium"}
  ],
  "recommendedActions": [
    "Implement attendance_recordEntry in index.js",
    "Wire route POST /api/attendance to attendance_recordEntry"
  ]
}
Execution

Runs on-demand via API. Results cached for 1 hour.

Files: /platform/engine/gap-analysis/calculator.js, /platform/engine/gap-analysis/index.js
PHASE 11: RECOMMENDATION ENGINE
Deliverable: Buildable Module Suggester
Algorithm

    Scan all Capabilities across all Modules/Components
    Cluster Capabilities by functional area (naming patterns, manifest tags)
    Identify orphan Capabilities (not exposed as Routes)
    Identify partial Modules (Capabilities exist but Routes incomplete)
    Rank suggestions by existing capabilities leveraged, estimated effort, user relevance

Output Structure
{
  "suggestions": [
    {
      "moduleName": "student_portal",
      "confidence": 0.85,
      "existingCapabilities": ["authentication", "profileRead"],
      "missingArtifacts": 4,
      "estimatedEffort": "2-3 days",
      "recommendedNextSteps": [...]
    }
  ]
}
Execution

Runs nightly. Triggers on-demand. Persists to recommendations table.

Files: /platform/engine/recommendation/analyzer.js, /platform/engine/recommendation/index.js
PHASE 12: MODULE BUILDER INTERFACE
CLI Commands
timsys builder new <name>           # Scaffold new Module from template
timsys builder inspect <module>     # Show gap analysis for Module
timsys builder recommend            # Show recommended Module builds
timsys builder complete <module>    # Show remaining work to reach 100%
HTTP Endpoints
Endpoint	Method	Description
/builder/dashboard	GET	Overall platform completion metrics
/builder/new-module	POST	Form to scaffold new Module
/builder/:module/analysis	GET	Detailed gap report
/builder/recommendations	GET	Ranked list of suggested Modules
/builder/templates	GET	Library of Module templates
Builder Logic

The Builder is an Application consuming Introspection, Gap Analysis, and Recommendation APIs. Generates scaffolding code and module.json drafts for human review. Does not modify platform internals directly.
NON-NEGOTIABLE RULES

    No direct database imports. All database access via /platform/shared/services/db.js
    No manual route registration. Routes come from module.json/component.json, wired by /platform/shared/pipeline/register.js and wire.js
    No silent failures. Any validation error aborts boot with full stack trace
    No Module/Component can boot without dependencies available (enforced by DependencyGraph)
    No function without declaration in Manifest (enforced by validation pipeline)
    No route without authentication middleware (except health/discovery endpoints)
    No migration without version number and backward compatibility guarantee
    No Module/Component imports platform internals directly — all access through injected Context
    No inter-module direct calls — all communication through EventBus (pub/sub OR request/reply). functionRegistry maps routes to handlers only.
    No Registry modification outside the staging pipeline
    All 13 contracts must be frozen before any service implementation begins
    Setup wizard must complete before server starts
    Frozen documents (CONSTITUTION, LEXICON) must maintain SHA-256 integrity

VERSION HISTORY
Version	Date	Change
v6.0.0	2026-07-16	Initial freeze — contracts, pipeline, registries
v6.1.0	2026-08-07	Added Component Manifest spec, component composition model, expanded Services (13), expanded Registries (8), expanded Pipeline (7 stages), intelligence stabilization, route permissions, refresh tokens, setup wizard enforcement
WHAT CHANGED FROM V6.0.0
Aspect	v6.0.0	v6.1.0
Services	6 contracts	13 contracts
Registries	6 registries	8 registries (added componentRegistry, componentScanner)
Pipeline stages	5 stages	7 stages (added resolve, unstage)
Module standard	Only module.json	Plus component.json for Components
Component model	Not specified	Registry/Profile/Standard types
Intelligence	Placeholder	Canonical governed provider engine with evidence, uncertainty, lifecycle actions and health checks
Token handling	JWT only	JWT + refresh tokens with rotation
Permissions	Per-handler inline	Declarative route-level permissions
Security	In-memory rate limit	SQLite-backed rate limit
Setup	No enforcement	Mandatory setup wizard
Boot validation	Basic checks	Setup wizard + hash verification
---

## Addendum — Session 17, 2026-08-08: CSV Import Infrastructure

### New Service

| Service | File | Methods | Notes |
|---------|------|---------|-------|
| CSV Parser | `csv_parser.js` | parse(buffer, options), normalizeHeader(header), mapRow(row, columnMap), mapRows(rows, columnMap) | Native JS CSV parser, no external deps. Quoting/escaping handled. Header normalization via lowercase + alphanumeric strip. |

### New Endpoints

| Group | Paths | Auth Required | Permissions |
|-------|-------|---------------|-------------|
| Import | POST /api/students/import, POST /api/staff/import, POST /api/rooms/import, POST /api/inventory/import | Yes | admin:{entity}:write |

### Import Handler Pattern

Each module owns its own import handler. The platform provides `csv_parser.js` (parsing + header normalization). The module provides a column map (header variant → schema column) and insertion logic. No business logic in the parser service.
