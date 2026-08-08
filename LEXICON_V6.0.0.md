# TimSyS Lexicon v6.1.0

**Status:** FROZEN  
**Amended:** 2026-08-07  
**Previous Version:** v6.0.0 (2026-07-17)  
**Amendment Reason:** Reconcile terminology with component composition model, intelligence service stabilization, and expanded registry/pipeline inventory.

This document defines the official vocabulary of the TimSyS platform. All architectural discussions, documentation, and code shall use these terms exactly as defined. Terms not in this Lexicon shall not be used in platform artifacts.

---

## Architecture Terms

### Module

The fundamental deployable unit of the TimSyS platform. A Module is a self-describing directory containing a Manifest, an entry point, handlers, schemas, and migrations. Modules declare their dependencies, capabilities, routes, and events. The platform discovers, validates, registers, and wires Modules automatically. No Module shall be wired through manual code edits.

### Component

An atomic building block assembled into Modules by the composition model. Components live in `/platform/modules/` alongside standard Modules but are distinguished by the presence of a `component.json` manifest. Components lack independent boot logic — they are registered, wired, and booted as part of a parent Module's lifecycle. Components declare their type (`registry`, `profile`) and capabilities in `component.json`. No Component shall be imported directly by another Module. Components are discovered by `componentScanner` and registered in `componentRegistry` during staging.

### Composition Model

The architectural pattern where Modules are assembled from shared atomic Components rather than implementing all behaviour internally. The composition model replaced peer-to-peer module communication. Components provide reusable data access and aggregation logic. Modules wire Components together via the Context object and `functionRegistry`. The composition model is governed by `componentRegistry` and `componentScanner`.

### Manifest

The declaration file (`module.json`) at the root of every Module. The Manifest specifies the Module's name, version, dependencies, capabilities, routes, functions, schema references, and event subscriptions. The Manifest is the sole source of truth for what a Module requires and provides. The platform reads Manifests during discovery. No Module is valid without a Manifest.

### Component Manifest

The declaration file (`component.json`) at the root of every Component. Specifies the Component's name, type (`registry`, `profile`), capabilities, functions, and schema references. Read by `componentScanner` during the discovery stage. No Component is valid without a Component Manifest.

### Service

A shared infrastructure interface exposed by the platform. Services define contracts for how behaviour is requested, not how it is implemented. All Services live in `/shared/services/`. Modules consume Services exclusively through the Context object injected during boot. No Module shall import a Service implementation directly. The platform provides the following Services: DB, Cache, Auth, Log, Validation, EventBus, Session, Audit, Metrics, Email, RateLimit, Refresh, and Intelligence.

### Contract

The interface specification for a Service. A Contract defines method signatures, parameter types, and return types without implementation. Contracts are frozen before implementation begins. No Service implementation may deviate from its Contract. No Module may depend on Service behaviour not defined in its Contract. Contract files live in `/platform/contracts/`.

### Capability

A named unit of behaviour that a Module provides. Capabilities are declared in the Manifest under `provides`. Capabilities are registered in the CapabilityRegistry during staging. Modules may declare `requires` on Capabilities owned by other Modules. The dependency graph enforces that all required Capabilities are available before a Module boots.

### Function

A callable procedure exported by a Module. Every Function is declared in the Manifest under `functions` with its name, parameters, and return type. Functions are registered in the FunctionRegistry during staging. Functions are the sole invocation target for routes and inter-module calls. No Function shall exist without a Manifest declaration. Functions follow the `{module}_{operation}` naming convention.

### Function Exports Pattern

The separation of a function's declared `name` (following `{module}_{operation}` convention) from its `exports` field (mapping to the actual export key in `index.js`). The `name` is used as the registry key and route handler reference. The `exports` field is used by the `register` pipeline step to look up the implementation from the module's exports.

---

## Infrastructure Terms

### Registry

A platform-managed store that tracks registered entities. The platform maintains eight Registries: ModuleRegistry, SchemaRegistry, RouteRegistry, FunctionRegistry, CapabilityRegistry, DependencyGraph, ComponentRegistry, and ComponentScanner. Registries are populated during the staging pipeline and queried throughout the platform lifecycle. No Registry shall be modified outside the staging pipeline.

### ComponentRegistry

The Registry that tracks registered Components and their types. Populated during the staging pipeline by `componentScanner`. Queried by Modules assembling components via the composition model. Lives in `/shared/registry/componentRegistry.js`.

### ComponentScanner

The Registry that discovers Components from `component.json` manifests during the discover stage of the Pipeline. Populates the ComponentRegistry. Lives in `/shared/registry/componentScanner.js`.

### Pipeline

The automated staging mechanism that transforms a Module directory into a running, wired platform component. The Pipeline executes seven sequential stages: Discover, Validate, Register, Resolve, Wire, Boot, and Unstage. The Pipeline is the sole mechanism for bringing a Module into the running platform. No Module enters the platform outside the Pipeline.

### Staging

The act of running a Module through the Pipeline. When a Module is staged, the Pipeline discovers its Manifest, validates its declarations, registers it across all Registries, resolves its dependencies, wires its routes and dependencies, executes its boot hook, and makes it available for runtime use. When a Module is unstaged, the Pipeline reverses this process in order. Staging may be triggered by directory scan at boot or by API call at runtime.

### Context

The dependency object injected into a Module's `boot(ctx)` and `teardown(ctx)` functions. The Context provides access to all Services, the `functionRegistry`, and the Module's own registration metadata. The Context is the sole legal channel through which a Module accesses platform infrastructure. No Module shall import platform internals directly. The Context is constructed by the Wire stage of the Pipeline.

### Migration

A versioned SQL file that creates or alters database schema. Migrations live in `/modules/{moduleName}/migrations/` and `/migrations/` (platform-level). Migrations are numbered sequentially and applied in order during boot. Applied migrations are tracked in the `schema_migrations` table. No Migration shall be skipped. No Migration shall be modified after deployment. Backward compatibility is mandatory.

### Schema

The structural definition of a Module's database tables. Schemas are declared through Migrations and registered in the SchemaRegistry during staging. The SchemaRegistry is the sole authority on what tables exist and who owns them. No Module shall query a table it does not own or declare as a dependency.

---

## HTTP Layer Terms

### Route

An HTTP endpoint declared in a Module's Manifest. Each Route specifies a path, HTTP method, handler reference, authentication requirement, and optional `permissions` array. Routes are registered in the RouteRegistry during staging. The Wire stage connects Routes to their handler Functions. No Route shall be registered through manual code. Path conflicts are detected during validation and fail staging.

### Handler

A Function designated in a Module's Manifest as the target for a Route. Handlers receive the HTTP request and Context, and return a standardised response envelope. Handlers must be declared in the Manifest's `functions` array. No undeclared Function shall serve as a Handler.

### Middleware

A platform-level processing function in the HTTP request chain. Middleware executes before Handlers in a fixed order: CORS, body parsing, cookie parsing, CSRF protection, authentication, authorization, rate limiting, input sanitization, and request logging. Middleware is platform-owned. No Module shall define or modify Middleware. Middleware order is non-negotiable.

---

## Lifecycle Terms

### Boot

The platform initialization sequence executed once at startup. Boot loads contracts, initializes Services, runs migrations, discovers Modules and Components, builds the dependency graph, computes boot order, stages all Modules, wires routes, executes Module boot hooks, and starts the HTTP server. Boot is atomic — any failure before HTTP server start aborts the entire sequence and rolls back.

### Teardown

The graceful shutdown of a staged Module. Teardown executes the Module's `teardown(ctx)` hook, removes its routes from the RouteRegistry, unregisters its functions and capabilities, invalidates its cache entries, and marks it as unstaged in the ModuleRegistry. Teardown is the reverse of staging, executed in reverse dependency order.

### Lifecycle

The sequence of states a Module passes through: Discovered → Validated → Registered → Resolved → Wired → Booted → (Running) → Unstaging → Unstaged. The Pipeline governs transitions between these states. A Module in any pre-Booted state is not accessible to the platform. A Module in Unstaged state retains its files but has no runtime presence.

---

## Runtime Terms

### Event

A notification published through the EventBus. Events are declared in a Module's Manifest under `publishes` and `subscribes`. Events trigger reactions in subscribing Modules but do not own behaviour. The EventBus is the sole legal mechanism for inter-Module communication at runtime. No Module shall directly call another Module's internal code.

### Dependency

A declared requirement that one Module has on another Module's Capability or on a platform Service. Dependencies are declared in the Manifest. The DependencyGraph tracks all Dependencies and enforces availability before boot. Circular Dependencies are detected during graph construction and fail staging immediately. No Module shall import or reference a Module it has not declared as a Dependency.

### Application

A collection of Modules that together deliver end-user functionality. Applications consume platform Services through Context objects and express functionality through Routes and Functions. Applications never directly access platform internals. TimSyS itself is the platform. The school administration system is the first Application built on it.

---

## Component Types

### Registry Component

A Component of type `registry` that provides atomic data storage and CRUD operations for a single entity type (e.g., students, staff, rooms, inventory). Registry Components own their database tables and migrations. They expose Functions via `functionRegistry` that profile components and modules consume. Registry Components store metadata through the Intelligence service on create/update/delete operations.

### Profile Component

A Component of type `profile` that aggregates data from one or more Registry Components at runtime. Profile Components do not own database tables — they query Registry Components via `functionRegistry` lookups through the Context object. Profile Components depend on Registry Components being staged and available.

### Standard Module

A Module without a `component.json` manifest. Standard Modules have independent boot logic, own their routes and migrations, and operate as self-contained units. `builder`, `system_health`, and `user_management` are Standard Modules.

---

## Intelligence Terms

### Intelligence Service

A shared platform Service providing metadata storage, insight synthesis, and rule evaluation. Lives at `/shared/services/intelligence/` as a package of five sub-modules: `index.js` (facade), `store.js` (persistence), `metadata.js` (entity tagging and classification), `insights.js` (synthesis via `functionRegistry` discovery), and `logic.js` (condition evaluation engine). Injected into Module Context via `wire.js`. Recognized as a platform service in `resolve.js` — dependency resolution skips it. Modules declare `"dependencies": ["intelligence"]` to receive `ctx.intelligence`.

### Metadata

Structured tags and classifications attached to entities by the Intelligence Service. Metadata includes entity type, tags array, classifications array, and a confidence score. Stored in the `intelligence_metadata` table. Generated by `metadata.js suggest()` using rule-based pattern detection. Registry Components call `storeMetadata()` on create/update/delete operations.

### Insights

Aggregated analytics derived from Registry Component data. Produced by `insights.js synthesize()` which discovers entity functions via `functionRegistry`, queries each registry, and computes summary metrics, trends, and alerts. Entity types are canonicalized by stripping the module prefix from function names. Insights are stored in the `intelligence_insights` table.

### Introspection

The platform's ability to expose its own state through API endpoints. Introspection queries read from Registries and return structured knowledge about available Modules, Capabilities, Functions, Routes, Dependencies, and Components. Introspection enables self-awareness and gap analysis.

### Gap Analysis

The calculation of completion percentage for a Module by comparing declared requirements against available Capabilities and implemented Functions. Gap Analysis produces a score, identifies missing artifacts, and recommends actions to reach 100% completion. Weighted scoring: capabilities 40%, functions 30%, routes 20%, schema 10%.

### Recommendation Engine

The system that analyzes available Capabilities, identifies orphan or partial Modules, and suggests viable Module builds based on user intent and platform readiness. Recommendations include estimated effort, dependency checks, and next-step instructions.

### Builder

An Application that consumes Introspection, Gap Analysis, and Recommendation APIs to scaffold new Modules and guide developers through completion. The Builder generates scaffolding code and draft Manifests for human review. It does not modify platform internals directly.

---

## Testing Terms

### Test Isolation Pattern

Each test suite sets `process.env.DB_PATH` to a unique file (e.g., `data/test_cache.sqlite`, `data/test_auth.sqlite`) before requiring any modules. This prevents SQLite lock conflicts between test suites. Each suite cleans up its database file in `afterAll`.

### Per-Suite Database Isolation

The practice of assigning each Jest test suite its own SQLite database file, set via `process.env.DB_PATH` before module require. Prevents cross-suite contamination and lock contention.

### Smoke Test

A shell script that exercises a live running platform instance end-to-end. Smoke tests verify HTTP endpoints respond, database operations persist, and intelligence metadata flows correctly. Smoke tests run against a booted platform on port 3000 and are distinct from Jest unit/integration tests.

### Manual Transaction Control

The migration runner uses explicit `BEGIN TRANSACTION` / `COMMIT` / `ROLLBACK` via `conn.exec()` rather than better-sqlite3's `db.transaction()` wrapper. This ensures the original migration error is surfaced, not masked by a secondary rollback error.

---

## Development Order

1. Contract
2. Service
3. Registry
4. Module
5. Manifest
6. Capability
7. Function
8. Migration
9. Schema
10. Pipeline
11. Staging
12. Context
13. Route
14. Handler
15. Middleware
16. Boot
17. Teardown
18. Lifecycle
19. Event
20. Dependency
21. Application
22. Component
23. Composition Model
24. Component Manifest
25. ComponentRegistry
26. ComponentScanner
27. Registry Component
28. Profile Component
29. Standard Module
30. Intelligence Service
31. Metadata
32. Insights
33. Introspection
34. Gap Analysis
35. Recommendation Engine
36. Builder

## Addendum — Session 17, 2026-08-08

The following terms are added to the official vocabulary for Intelligence Engine Stages 5–8.

### Snapshot Run

A single execution of the Snapshot Service that collects metrics across all platform tables. Each run generates a unique `run_id` and persists multiple metric rows. Runs are ordered chronologically and queried for trend analysis.

### Metric Key

A dotted-notation identifier for a collected metric (e.g., `students.total`, `events.by_channel`, `relationships.active`). Used as the lookup key for trend queries across snapshot runs.

### Knowledge Document

A structured record in the Knowledge Store with category (`policy`, `procedure`, `precedent`, `guideline`), status lifecycle (`draft`, `review`, `approved`, `archived`), content, tags, and versioning via parent document chains.

### Auto-Rule

A rule suggestion generated by the Auto-Rule Generation module through pattern mining. Has a condition type (`threshold`, `frequency`, `trend`, `correlation`), confidence score (0.0–1.0), and lifecycle (`suggested` → `approved` → `active`, or `rejected`, `archived`).

### Condition Type

The classification of an Auto-Rule's detection method: `threshold` (value exceeds limit), `frequency` (recurring action count), `trend` (directional change over snapshots), `correlation` (entity relationship density).

### Confidence Score

A float between 0.0 and 1.0 representing the strength of a mined pattern based on data volume and consistency. Higher scores indicate more reliable rule suggestions.

### Role Target

A notification targeting mechanism that delivers notifications to all users with a given role (e.g., `admin`) rather than a specific `user_id`. Used when system events should alert role groups.

### Event Subscription at Boot

The pattern where a Module's `boot(ctx)` function calls `ctx.events.subscribe(channel, handler)` to register listeners for cross-module events. Enables automatic notification generation when other modules publish events.
---

## Addendum — Session 17, 2026-08-08

The following terms are added to the official vocabulary for CSV Import Infrastructure.

### CSV Parser

The platform service at `/shared/services/csv_parser.js` that converts CSV text into arrays of objects. Handles quoted fields, escaped quotes, and configurable delimiters. Provides header normalization and column mapping utilities. No external dependencies. Consumed by module import handlers.

### Column Map

A module-local dictionary that maps normalized CSV header variants to schema column names. Keys are normalized headers (lowercase, non-alphanumeric stripped). Values are the target schema field names. Each module defines its own column map because each module knows its own schema and accepted header variants.

### Header Normalization

The process of converting a CSV header to a canonical form for column map lookup. Implemented as: lowercase the header, then strip all non-alphanumeric characters. So `Student Name`, `studentName`, `STUDENT_NAME` all produce `studentname`.

### Import Handler

A module-level function that receives parsed CSV rows, applies business logic (validation, duplicate detection, insertion), and returns import statistics (`inserted`, `skipped`, `errors`). Each module that accepts CSV data owns its own import handler. The handler uses the CSV Parser service for raw parsing and its own column map for field mapping.
