# Foundation decisions

## Ownership

Dress'Ed is hosted by TimSyS but owns its PostgreSQL schema, private image repository, CV service, domain events, rule sets, fingerprints, decisions, planner state, and lifecycle history. Principal'Ed and MemeCoin'Ed are references, not runtime dependencies.

## Processes

The intended packaged application has three supervised local processes:

1. a TypeScript API serving the responsive UI and application use cases;
2. a TypeScript worker executing durable background work;
3. a Python CV service performing deterministic local image processing.

The CV service has no direct database authority. It receives bounded image-analysis requests and returns versioned measurements. TypeScript validates and persists accepted results.

## Persistence

Dress'Ed uses an isolated PostgreSQL database/schema. Migrations are forward-only, ordered, transactional, and checksum-audited. Significant relational state must not be hidden in JSON. Versioned fingerprint, rule configuration, evidence, and explanation payloads may use JSONB where their schemas are independently versioned.

## Images

Original images are immutable. Corrected images, thumbnails, masks, and other derivatives are separately identified and linked to their source. Database records store identity, hashes, provenance, and paths relative to the configured private storage root. Runtime paths must never be accepted directly from API clients.

## Identity and time

Domain IDs are UUIDs generated behind an injected port. Time is supplied through an injected clock. Historical records use UTC ISO-8601 timestamps. Tests use explicit IDs and clocks.

## Versioning

The following evolve independently and must be persisted with their outputs:

- database migration version;
- CV contract version;
- calibration algorithm version;
- fingerprint schema and algorithm versions;
- styling rule-set version;
- explanation-template version;
- planner-policy version.

Historical results are append-only. Reprocessing or rescoring creates another version.

## Jobs and failure handling

Long-running image, fingerprint, compatibility, rescoring, planner, reconciliation, and insight work uses durable PostgreSQL jobs. Work is idempotent by a stable idempotency key. Leases expire and may be recovered. Retries are bounded, backoff is explicit, and terminal failures remain visible. No exception is swallowed and no failed work is silently discarded.

## Privacy

Images and purchase records remain on user-controlled storage. Logs redact credentials, authorization values, database URLs, private paths, and image content. Dress'Ed introduces no telemetry or third-party image upload.

## Reuse

TimSyS launcher, registration, contracts, identity, audit, health, notifications, dependency graph, and UI standards are consumed through platform contracts. Small generic UI/runtime utilities may be copied with provenance. School and trading domain code is not imported.

## Phase boundary

This foundation defines infrastructure contracts only. It deliberately contains no garment tables, image algorithms, styling rules, outfit generation, planner logic, lifecycle workflows, or wardrobe insights.

Phase 1 adds only the supervised application heartbeat: launcher registration, isolated-schema migration, health/application endpoints, the standard TimSyS navigation shell, and Windows runtime staging. Launcher access is the current desktop access boundary; no Dress'Ed data or mutation endpoint exists in this phase.
