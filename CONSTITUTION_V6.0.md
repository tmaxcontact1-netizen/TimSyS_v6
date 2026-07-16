# TimSyS Backend Constitution v6.0

## Core Principle

A module is a self-describing unit. If it declares its schema, capabilities, dependencies, and routes in a standard format, the system wires it automatically. No code edits after deployment.

---

## PHASE 0: FOUNDATION CONTRACTS

### Deliverable: Shared Service API Specifications

Define the contracts before implementing anything. Modules consume services through these interfaces only.

| Service | Contract | Methods | Notes |
|---------|----------|---------|-------|
| Database | DBService | query(sql, params), transaction(fn), poolAcquire(), poolRelease(conn) | Sync wrapper over better-sqlite3 |
| Cache | CacheService | get(key), set(key, val, ttl), invalidate(pattern), flush() | LRU + pattern matching |
| Auth | AuthService | issueToken(user), verifyToken(token), revokeToken(token), revokeAllUserTokens(userId), createSession(userId, payload), getSession(sessId), destroySession(sessId), destroyUserSessions(userId, reason), getActiveSessions(userId), rotateSession(sessId), forceLogout(userId, reason), checkPerm(user, perm) | JWT + session store + revocation |
| Logging | LogService | info(msg, ctx), warn(msg, ctx), error(msg, ctx), audit(action, userId, meta) | Structured JSON logs |
| Validation | ValidationService | validate(schema, data), sanitize(input) | Zod schemas |
| Event Bus | EventBus | publish(channel, payload), subscribe(channel, handler), unsubscribe(channel, handler), request(channel, payload, timeout) | In-memory pub/sub + request/reply |

### Output

One file per service: `/contracts/db.js`, `/contracts/cache.js`, `/contracts/auth.js`, `/contracts/log.js`, `/contracts/validate.js`, `/contracts/events.js`. Each exports interface shape. No implementation yet.

---

## PHASE 1: INFRASTRUCTURE LAYER

### Stage 1.1: Persistence Layer

Build the services that modules will use.

| File | Responsibility |
|------|----------------|
| `/shared/services/db.js` | Connection pool (sync, round-robin), query wrapper, transaction builder |
| `/shared/services/cache.js` | LRU cache (configurable size/ttl), pattern invalidation, redis adapter stub |
| `/shared/services/session.js` | Session store (sqlite-backed), token management, expiry cleanup |
| `/shared/services/audit.js` | Audit log writer, immutable append-only log, retention policy |
| `/shared/services/metrics.js` | Internal metrics (request counts, latencies, errors) |
| `/shared/services/auth.js` | JWT issuance/validation, revocation list, session lifecycle |
| `/shared/services/log.js` | Structured logging, log aggregation interface |
| `/shared/services/validate.js` | Schema validation, input sanitization |
| `/shared/services/events.js` | EventBus pub/sub, request/reply orchestration |

### Schema Migrations

`/migrations/001_initial.sql` through `/migrations/NNN_.sql`. Auto-applied on boot. Track applied migrations in `schema_migrations` table.

### Stage 1.2: Registry Layer

What the system uses to discover and wire components.

| File | Responsibility |
|------|----------------|
| `/shared/registry/moduleRegistry.js` | Register/deregister modules, list all, query by capability |
| `/shared/registry/schemaRegistry.js` | Register table schemas, track migrations, validate schema contracts |
| `/shared/registry/routeRegistry.js` | Register HTTP routes, map paths to handlers, conflict detection |
| `/shared/registry/functionRegistry.js` | Register callable functions, dependency injection for invocations |
| `/shared/registry/capabilityRegistry.js` | Register what each module can do (by name), query by capability |
| `/shared/registry/dependencyGraph.js` | Track module dependencies, compute boot order, detect cycles |

### Stage 1.3: Staging Pipeline

The core plug-and-play mechanism located at `/shared/pipeline/`.

| Component | Responsibility |
|-----------|----------------|
| `/shared/pipeline/discover.js` | Scan `/modules` directory, find module.json manifests, parse declarations |
| `/shared/pipeline/validate.js` | Validate manifest against schema, check required exports, verify dependency availability |
| `/shared/pipeline/register.js` | Register validated module through all registries |
| `/shared/pipeline/wire.js` | Connect routes to handlers, inject dependencies, set up event subscriptions |
| `/shared/pipeline/boot.js` | Execute boot hooks in dependency order, capture failures, report status |
| `/shared/pipeline/unstage.js` | Gracefully deregister module, remove routes, invalidate cache, run teardown hooks |

---

## PHASE 2: MODULE STANDARD

### Deliverable: The Module Manifest Spec

Every module must provide this exact structure.

**File:** `/modules/{moduleName}/module.json`

```json
{
  "name": "{unique_module_id}",
  "version": "1.0.0",
  "author": "internal",
  "dependencies": ["auth", "db", "cache"],
  "provides": ["capability:read_records", "capability:write_records"],
  "requires": ["capability:user_management.get_user"],
  "routes": [
    {"path": "/api/users", "method": "GET", "handler": "listUsers", "auth": true},
    {"path": "/api/users/:id", "method": "POST", "handler": "createUser", "auth": true}
  ],
  "functions": [
    {"name": "getUserById", "exports": "get_user_record", "params": ["userId"], "returns": "UserRecord"}
  ],
  "schema": {
    "tables": ["users", "user_sessions"],
    "migrations": ["migrations/001_users.sql"]
  },
  "events": {
    "publishes": ["user.created", "user.updated"],
    "subscribes": ["auth.login_success"]
  }
}

Required Exports

Every module must export:

    boot(ctx) — Called during staging, receives injected services context
    teardown(ctx) — Called during unstaging
    All functions declared in module.json.functions

Naming Convention

{module}_{operation}. Example: user_getById, user_create, user_update, user_delete.
PHASE 3: DATABASE SCHEMA DEFINITION
Deliverable: Complete Schema Catalog

All tables defined upfront. No implicit schemas.
Table	Columns	PK	Indexes	Purpose
schema_migrations	id, version, applied_at	id	-	Track applied migrations
sessions	session_id, user_id, created_at, expires_at, payload	session_id	user_id, expires_at	Active sessions
audit_log	id, timestamp, user_id, action, entity_type, entity_id, old_value, new_value, ip_address	id	timestamp, user_id, entity_type	Immutable audit trail
metrics	id, timestamp, metric_name, value, tags	id	metric_name, timestamp	Internal metrics storage
token_revocation	id, token_hash, revoked_at, user_id, reason	id	token_hash, user_id	Revoked JWT tracking

(Application tables defined per-module, referenced through schemaRegistry)
Module Schema Standard

Each module's migrations live in /modules/{moduleName}/migrations/. First migration creates the module's primary tables. Subsequent migrations alter/add.
PHASE 4: BOOT SEQUENCE
Deliverable: Ordered Initialization Protocol
Boot Order

    Load shared contracts (Phase 0)
    Initialize services (db, cache, session, audit, metrics, events, auth, log, validate)
    Run database migrations (all, in order, skip already-applied)
    Discover modules in /modules directory
    Validate manifests against schema
    Build dependency graph
    Detect circular dependencies (fail immediately if found)
    Compute topological boot order
    Register each module through all registries
    Wire routes to handlers
    Inject service dependencies into module boot(ctx) calls
    Execute module boot hooks in order
    Start HTTP server
    Emit system.ready event

Failure Handling

Any failure before step 13 aborts boot with detailed error log. Any failure during step 12 triggers graceful rollback of already-booted modules.
PHASE 5: HTTP LAYER
Deliverable: REST API Surface
Endpoint Group	Paths	Auth Required
Health	GET /health, GET /ready	No
Metrics	GET /metrics	Yes (admin)
Audit	GET /audit/logs, GET /audit/logs/:id	Yes (admin)
Staging	GET /staging/modules, POST /staging/modules, DELETE /staging/modules/{id}	Yes (admin)
Discovery	GET /discover/capabilities, GET /discover/functions	Yes
Middleware Stack (in order)

    CORS (configured origins only)
    Body parsing (JSON limit: 1MB)
    Cookie parser
    CSRF protection (skip for API routes with auth header)
    Authentication (JWT or session)
    Authorization (permission check)
    Rate limiting (per-user, configurable tiers)
    Request logging

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

PHASE 6: APPLICATION MODULE TEMPLATE
Deliverable: Reference Implementation

/modules/userManagement/
  ├── module.json
  ├── index.js
  ├── migrations/
  │   └── 001_users.sql
  ├── handlers/
  │   ├── listUsers.js
  │   └── createUser.js
  └── schemas/
      ├── user.json
      └── permissions.json

index.js:

const moduleJson = require('./module.json');
const db = require('../../shared/services/db');
const cache = require('../../shared/services/cache');
const log = require('../../shared/services/log');

module.exports = {
  boot(ctx) {
    log.info('userManagement booting', { module: moduleJson.name });
  },
  
  teardown(ctx) {
    log.info('userManagement tearing down');
  },
  
  get_user_record(userId) {},
  create_user_record(data) {},
  update_user_record(userId, data) {},
  delete_user_record(userId) {},
  list_user_records(filter) {}
};

PHASE 7: TESTING LAYER
Deliverable: Test Coverage Requirements
Test Type	Scope	Minimum Coverage
Unit	Shared services	90%
Unit	Registries	100%
Integration	Module staging pipeline	100%
Integration	HTTP endpoints	85%
E2E	Boot sequence	Critical path 100%
Security	Auth, CSRF, rate limit	100%
Test Files

    /tests/unit/services/*
    /tests/unit/registries/*
    /tests/integration/staging/*
    /tests/integration/http/*
    /tests/e2e/boot.spec.js

PHASE 8: DEPLOYMENT
Deliverable: Production Deployment Specification
Environment Variables

NODE_ENV=production|development|test
PORT=3000
LOG_LEVEL=info|debug|warn|error
DB_PATH=/var/lib/timsys/database.sqlite
CACHE_MAX_SIZE=10000
CACHE_DEFAULT_TTL=300
SESSION_SECRET=<generated>
JWT_SECRET=<generated>
RATE_LIMIT_TIER=default|admin|service

Health Checks

    /health — System alive (return 200)
    /ready — System ready to accept traffic (all registries populated, DB connected, migrations applied)

Logging

Structured JSON to stdout. Parseable by log aggregator.
Metrics

Prometheus-compatible /metrics endpoint for scraping.
PHASE 9: INTROSPECTION LAYER
Deliverable: Platform Self-Knowledge APIs
Endpoint	Method	Description	Returns
/introspect/platform	GET	Full platform state summary	Total modules, capabilities, functions, routes, dependencies, health
/introspect/modules	GET	List all staged modules with metadata	Module name, version, capabilities provided/requires, routes, functions
/introspect/capabilities	GET	Query available capabilities	Filter by name, module, dependency chains
/introspect/functions	GET	Query callable functions	Filter by name, signature, required Capabilities
/introspect/routes	GET	Query HTTP endpoints	Filter by path, auth requirement, module origin
/introspect/dependencies	GET	Visualize dependency graph	Adjacency list, cycle warnings, boot order
/introspect/gaps	GET	Query completion metrics	Per-module capability coverage, missing artifacts
/introspect/templates	GET	Return module templates with gap analysis	Templates at 25%, 50%, 75%, 100% completion states
Data Model

All introspection queries read from Registries. No direct filesystem access. Caching TTL: 5 minutes. Stale data triggers refresh.
PHASE 10: GAP ANALYSIS ENGINE
Deliverable: Completion Percentage Calculator
Input

Target Module Definition (ideal module.json + expected schema + expected routes)
Output

Gap Report with percentage completion and artifact list
Metric	Calculation	Thresholds
Capability Coverage	registered_capabilities / expected_capabilities	< 25% = red, < 50% = yellow, >= 50% = green
Function Completeness	declared_functions_implemented / declared_functions	Same
Route Completeness	wired_routes / declared_routes	Same
Schema Completeness	migrations_applied / migrations_declared	Same
Dependency Availability	dependencies_available / dependencies_declared	Any 0 = blocking
Overall Score	Weighted average (capabilities 40%, functions 30%, routes 20%, schema 10%)	75%+ = "near completion"
Gap Report Structure

{
  "moduleName": "attendance_tracking",
  "completionScore": 73,
  "status": "yellow",
  "gaps": [
    {"category": "function", "missing": ["record_entry"], "priority": "high"},
    {"category": "route", "missing": ["POST /api/attendance"], "priority": "medium"},
    {"category": "migration", "missing": ["003_attendance_details.sql"], "priority": "low"}
  ],
  "recommendedActions": [
    "Implement attendance_recordEntry in index.js",
    "Wire route POST /api/attendance to attendance_recordEntry",
    "Apply migration 003_attendance_details.sql"
  ]
}

Execution

Gap Analysis runs on-demand via API and nightly batch job. Results cached for 1 hour.
PHASE 11: RECOMMENDATION ENGINE
Deliverable: Buildable Module Suggester
Input

Current platform capabilities + user intent (keywords/tags)
Output

Ranked list of suggested Modules with gap analysis
Algorithm

    Scan all available Capabilities across all Modules
    Cluster Capabilities by functional area (identified via naming patterns, Manifest tags, or semantic clustering)
    Identify "orphan" Capabilities (not yet exposed as Routes)
    Identify "partial" Modules (Capabilities exist but Routes incomplete)
    Identify "missing" Modules (capability clusters with no owning Module)
    Rank suggestions by:
        Number of existing Capabilities leveraged
        Estimated effort (gap count x complexity factor)
        User relevance (keyword match, past usage)
        Dependency readiness (no missing prerequisites)

Output Structure

{
  "suggestions": [
    {
      "moduleName": "student_portal",
      "confidence": 0.85,
      "existingCapabilities": ["user_authentication", "profile_read", "schedule_query"],
      "missingArtifacts": 4,
      "estimatedEffort": "2-3 days",
      "recommendedNextSteps": [
        "Create student_portal Module directory",
        "Write module.json declaring 3 capabilities",
        "Implement profile_read handler",
        "Wire 2 routes to exposed functions"
      ]
    }
  ],
  "platformReadiness": {
    "availableCapabilities": 127,
    "stagedModules": 14,
    "orphanCapabilities": 23,
    "averageCompletionRate": 68
  }
}

Execution

Runs nightly. Triggers on-demand via API. Recommendations persisted to recommendations table for audit.
PHASE 12: MODULE BUILDER INTERFACE
Deliverable: Builder UI/CLI Specification
CLI Commands

timsys builder new <name>          # Scaffold new Module from template
timsys builder inspect <module>    # Show gap analysis for Module
timsys builder recommend           # Show recommended Module builds
timsys builder complete <module>   # Show remaining work to reach 100%

UI Pages

    /builder/dashboard — Overall platform completion metrics
    /builder/new-module — Form to scaffold new Module with auto-suggested structure
    /builder/<module>/analysis — Detailed gap report with actionable checklist
    /builder/recommendations — Ranked list of suggested Modules to build
    /builder/templates — Library of Module templates with known completion states

Builder Logic

The Builder is an Application consuming the Introspection, Gap Analysis, and Recommendation APIs. It does not modify platform internals directly. It generates scaffolding code and module.json drafts for human review.
ROADMAP
Week	Phase	Milestone
1	Phase 0	Contracts finalized, reviewed, frozen
2-3	Phase 1	All shared services implemented and tested
4	Phase 1.2-1.3	All registries and staging pipeline complete
5	Phase 2	Module standard documented, template published
6	Phase 3	All base migrations written, verified
7	Phase 4	Boot sequence implemented, tested
8	Phase 5	HTTP layer complete, middleware stack wired
9-10	Phase 6	Core modules rewritten to standard (user, auth, audit)
11	Phase 7	Full test suite passing
12	Phase 8	Production deploy, monitoring live
13-14	Phase 9	Introspection layer complete, APIs live
15-16	Phase 10-11	Gap analysis and recommendation engines operational
17-18	Phase 12	Module builder interface (CLI + UI) delivered
WHAT IS DIFFERENT FROM V5
Problem in V5	Fix in V6
MODULE_MAP hand-coded	Manifest discovery + auto-registration
Direct database_getConnection	All modules consume through ctx.db
Silent safeRequire failures	Validation fails fast with detailed errors
Dual boot sequence	Single ordered boot with dependency resolution
No dependency tracking	DependencyGraph computes boot order
Modules write raw SQL	Generic CRUD through db.query() + schema contracts
Naming inconsistency	Strict {module}_{operation} enforced by validation
No staging pipeline	/shared/pipeline/* handles full lifecycle
Platform spine unused	Application modules register through registries
Circular dependencies undetected	Cycle detection during graph build
No platform self-awareness	Introspection APIs query all registries
No build guidance	Gap analysis + recommendation engine + builder UI
No completion tracking	Gap analysis engine calculates module completion percentages
Inter-module tight coupling	EventBus-only communication (pub/sub + request/reply)
No token revocation	JWT revocation list + session destruction
NON-NEGOTIABLE RULES

    No direct database imports. All database access goes through /shared/services/db.js
    No manual route registration. Routes come from module.json, wired by /shared/pipeline/wire.js
    No silent failures. Any validation error aborts boot with full stack trace
    No module can boot without its dependencies available (enforced by dependencyGraph)
    No function without declaration in module.json (enforced by validation pipeline)
    No route without authentication middleware (except health/discovery endpoints)
    No migration without version number and backward compatibility guarantee
    No module imports platform internals directly — all access through injected Context
    No inter-module direct calls — all communication through EventBus (pub/sub OR request/reply). FunctionRegistry maps routes to handlers only.
    No registry modification outside the staging pipeline
    All 6 contracts must be frozen before any service implementation begins

VERSION HISTORY
Version	Date	Change
v6.0.0	TBD	Initial freeze — all changes consolidated, pipeline path corrected, full auth revocation added

