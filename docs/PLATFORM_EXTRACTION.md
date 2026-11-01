# TimSyS Platform Extraction

## Required hosting boundary — 31 October 2026

Tim's instruction is authoritative: all backend services must be located in and hosted by TimSyS. Applications consume TimSyS through explicit contracts; applications must not host their own backend components. This requirement supersedes the earlier guidance allowing app-owned backend implementations below. It is a target architecture, not a claim that the migration is complete.

TimSyS hosts both shared infrastructure and domain-specific services. Domain-specific services retain separate names, schemas, permissions, rules and tests inside TimSyS; central hosting does not require making trading, research, wardrobe or school rules generic. Application data remains isolated by domain/app and user. Central hosting does not imply merging PostgreSQL into SQLite or combining unrelated data stores.

Apps contain presentation, navigation, user interaction and contract clients. They do not open database connections, run migrations, host HTTP/data APIs, execute background jobs, call AI/market/acquisition providers, or own authoritative server-side rules. Those implementations move to TimSyS. A proxy, common SDK, shared launcher or a moved folder alone does not satisfy this boundary if the app still owns and starts its backend.

TimSyS may supervise separate backend worker processes for workload isolation, including Python/native processing. Their source, configuration, lifecycle, persistence and contracts belong to TimSyS rather than an app bundle. The launcher retains native window/OS integration bridges; backend orchestration, provider transport, persistence and recovery logic currently in the launcher require explicit relocation/review. OS-protected secret access can remain a minimal native bridge with no domain/service logic.

## Contract requirements

Every app-to-TimSyS contract must declare its version, namespace, request/response/error schemas, caller identity, app/user scope, permissions, limits, timeout/cancellation, idempotency and revision semantics. Job contracts add durable identity, status, leases, retries, checkpoints and recovery behavior. Evidence contracts add source identifiers, content hashes, provenance and human-decision boundaries. Streaming/pagination and health/version compatibility must be explicit where applicable. Provider credentials and direct database access do not cross into the app UI.

## Migration controls

1. Inventory existing backend implementations and their public/data contracts; record source fingerprints and current verification results.
2. Specify TimSyS service contracts and ownership. Add compatibility/authorization tests before changing the app call path.
3. Relocate implementations with schema/data provenance intact; preserve domain isolation, record IDs, decision history, configuration hashes and recovery checkpoints. Avoid dual writers.
4. Verify real request -> orchestrator -> persistence -> response paths and negative cases, cold recovery and rollback with isolated data. Verify the app can operate with no app-hosted backend process or direct DB/provider access.
5. Cut over only after the applicable release/validation authorization. Retire app server entrypoints, migrations, backend dependencies and launcher backend-start paths after compatibility and rollback verification.

Trade'Ed's active validation must retain its current immutable runtime, ancestry, ports and data/log paths. Its services may be inspected and migration contracts designed now; no active runtime cutover, new live validation or publication is authorized by this inventory task. The isolation standing order remains in force.

Current evidence and migration backlog: [Backend inventory](BACKEND_INVENTORY.md).

## Earlier extraction guidance (historical; hosting allowance superseded)

The earlier architecture assigned domain-neutral execution and governance to TimSyS and domain implementations to apps. The following inventory explains the existing implementation; it must not be used to authorize new app-hosted services.

## Platform-owned contracts

- supervised application identity and health;
- evidence and provenance envelopes;
- deterministic rule outcomes;
- insight lifecycle and action links;
- durable job identity, leasing and retry state;
- provider observations and freshness;
- audit events and human confirmation;
- UI and launcher lifecycle.

## Application-owned implementations

Trade'Ed retains market providers, wallets, strategies, risk, paper/live execution and trading decisions. Dress'Ed retains garments, images, styling knowledge, ensembles, wardrobe planning and lifecycle decisions. Databases remain isolated by application.

Compatibility adapters may project domain records into TimSyS contracts during migration. They must not weaken domain invariants or create a runtime dependency on Principal'Ed. Adapters alone do not complete the required hosting migration.
