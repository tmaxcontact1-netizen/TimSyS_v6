# TimSyS Architecture Map
Generated: 2026-08-07T20:31:47Z
Generator: Tools/update_architecture_map.sh

This document is auto-generated. Do not edit manually.
Run `bash Tools/update_architecture_map.sh` to regenerate after structural changes.

---

## Project Root

Path: `/home/tmax/TimSyS_v6`

Platform Location: `/home/tmax/TimSyS_v6/platform`


## Root Documents

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `CONTEXT.md` | ✅ | 10870B | 2026-07-20 18:26:38 |
| `ARCHITECTURE_MAP.md` | ✅ | 503B | 2026-08-07 23:31:47 |
| `HANDOVER.md` | ✅ | 19600B | 2026-08-06 16:10:21 |
| `CONSTITUTION_V6.0.md` | ✅ | 18712B | 2026-07-17 08:34:40 |
| `LEXICON_V6.0.0.md` | ✅ | 10787B | 2026-08-07 12:14:19 |

## Directory Tree

```
(tree command not available — using find)
.
./apps
./apps/competeed
./apps/competeed/package.json
./apps/competeed/public
./apps/competeed/src
./apps/competeed/src/api
./apps/competeed/src/pages
./apps/principaled
./apps/principaled/package.json
./apps/principaled/public
./apps/principaled/src
./apps/principaled/src/api
./apps/principaled/src/components
./apps/principaled/src/pages
./apps/sanctifyed
./apps/sanctifyed/package.json
./apps/sanctifyed/public
./apps/sanctifyed/src
./apps/sanctifyed/src/api
./apps/sanctifyed/src/pages
./ARCHITECTURE_MAP.md
./config
./CONSTITUTION_V6.0.md
./CONTEXT.md
./data
./DECISIONS.md
./.git
./.gitignore
./HANDOVER.md
./LEXICON_V6.0.0.md
./packages
./packages/timsys-client
./packages/timsys-client/package.json
./packages/timsys-client/src
./platform
./platform/config
./platform/config/session-policy.json
./platform/contracts
./platform/contracts/auth.js
./platform/contracts/cache.js
./platform/contracts/db.js
./platform/contracts/events.js
./platform/contracts/intelligence.js
./platform/contracts/log.js
./platform/contracts/validate.js
./platform/data
./platform/data/timsys.sqlite
./platform/deploy
./platform/deploy/backup.sh
./platform/deploy/migrate.sh
./platform/deploy/production.env.example
./platform/deploy/rollback.sh
./platform/deploy/setup-wizard.js
./platform/engine
./platform/engine/gap-analysis
./platform/engine/gap-analysis/calculator.js
./platform/engine/gap-analysis/.gitkeep
./platform/engine/gap-analysis/index.js
./platform/engine/recommendation
./platform/engine/recommendation/analyzer.js
./platform/engine/recommendation/.gitkeep
./platform/engine/recommendation/index.js
./platform/index.js
./platform/jest.config.js
./platform/migrations
./platform/migrations/000_bootstrap.sql
./platform/migrations/001_initial.sql
./platform/migrations/002_intelligence.sql
./platform/migrations/003_rate_limit.sql
./platform/migrations/004_recommendations.sql
./platform/migrations/005_route_permissions.sql
./platform/migrations/006_refresh_tokens.sql
./platform/migrations/007_builder.sql
./platform/modules
./platform/modules/builder
./platform/modules/builder/assembler.js
./platform/modules/builder/composer.js
./platform/modules/builder/index.js
./platform/modules/builder/migrations
./platform/modules/builder/migrations/.gitkeep
./platform/modules/builder/module.json
./platform/modules/builder/templates.js
./platform/modules/.gitkeep
./platform/modules/inventory
./platform/modules/inventory/component.json
./platform/modules/inventory/index.js
./platform/modules/inventory/migrations
./platform/modules/inventory/migrations/001_inventory.sql
./platform/modules/inventory/module.json
./platform/modules/room_registry
./platform/modules/room_registry/component.json
./platform/modules/room_registry/index.js
./platform/modules/room_registry/migrations
./platform/modules/room_registry/migrations/001_rooms.sql
./platform/modules/room_registry/module.json
./platform/modules/staff_profile
./platform/modules/staff_profile/component.json
./platform/modules/staff_profile/index.js
./platform/modules/staff_profile/module.json
./platform/modules/staff_registry
./platform/modules/staff_registry/component.json
./platform/modules/staff_registry/index.js
./platform/modules/staff_registry/migrations
./platform/modules/staff_registry/migrations/001_staff.sql
./platform/modules/staff_registry/migrations/.gitkeep
./platform/modules/staff_registry/module.json
./platform/modules/student_profile
./platform/modules/student_profile/component.json
./platform/modules/student_profile/index.js
./platform/modules/student_profile/module.json
./platform/modules/student_registry
./platform/modules/student_registry/component.json
./platform/modules/student_registry/index.js
./platform/modules/student_registry/migrations
./platform/modules/student_registry/migrations/001_students.sql
./platform/modules/student_registry/migrations/.gitkeep
./platform/modules/student_registry/module.json
./platform/modules/system_health
./platform/modules/system_health/handlers
./platform/modules/system_health/handlers/staging.js
./platform/modules/system_health/index.js
./platform/modules/system_health/module.json
./platform/modules/system_health/module.json.bak
./platform/modules/user_management
./platform/modules/user_management/index.js
./platform/modules/user_management/migrations
./platform/modules/user_management/migrations/001_users.sql
./platform/modules/user_management/migrations/002_password_resets.sql
./platform/modules/user_management/migrations/003_must_change_password.sql
./platform/modules/user_management/module.json
./platform/node_modules
./platform/package.json
./platform/package-lock.json
./platform/routes
./platform/routes/.gitkeep
./platform/routes/introspect
./platform/routes/introspect/.gitkeep
./platform/scripts
./platform/scripts/cli
./platform/scripts/cli/builder.js
./platform/scripts/cli/migrate.js
./platform/scripts/cli/scaffold.js
./platform/scripts/cli/update-package.js
./platform/scripts/.gitkeep
./platform/shared
./platform/shared/middleware
./platform/shared/middleware/passwordChangeRequired.js
./platform/shared/migration-runner.js
./platform/shared/pipeline
./platform/shared/pipeline/boot.js
./platform/shared/pipeline/discover.js
./platform/shared/pipeline/register.js
./platform/shared/pipeline/resolve.js
./platform/shared/pipeline/unstage.js
./platform/shared/pipeline/validate.js
./platform/shared/pipeline/wire.js
./platform/shared/registry
./platform/shared/registry/capabilityRegistry.js
./platform/shared/registry/componentRegistry.js
./platform/shared/registry/componentScanner.js
./platform/shared/registry/dependencyGraph.js
./platform/shared/registry/functionRegistry.js
./platform/shared/registry/moduleRegistry.js
./platform/shared/registry/routeRegistry.js
./platform/shared/registry/schemaRegistry.js
./platform/shared/services
./platform/shared/services/audit.js
./platform/shared/services/auth.js
./platform/shared/services/cache.js
./platform/shared/services/db.js
./platform/shared/services/email.js
./platform/shared/services/events.js
./platform/shared/services/intelligence
./platform/shared/services/intelligence/index.js
./platform/shared/services/intelligence/insights.js
./platform/shared/services/intelligence/logic.js
./platform/shared/services/intelligence/metadata.js
./platform/shared/services/intelligence/store.js
./platform/shared/services/log.js
./platform/shared/services/metrics.js
./platform/shared/services/ratelimit.js
./platform/shared/services/refresh.js
./platform/shared/services/session.js
./platform/shared/services/validate.js
./platform/test-results-builder.txt
./platform/Tools
./platform/Tools/spawn_app.sh
./platform/Tools/update_architecture_map.sh
./TEST_PROTOCOL.md
./test-results.txt
./tests
./tests/builder.test.js
./tests/e2e
./tests/e2e/boot-sequence.test.js
./tests/e2e/boot.test.js
./tests/e2e/.gitkeep
./tests/helpers
./tests/helpers/test-server.js
./tests/integration
./tests/integration/http
./tests/integration/http/auth.test.js
./tests/integration/http/password-prompt.test.js
./tests/integration/http/refresh-token.test.js
./tests/integration/http/security.test.js
./tests/integration/http/staging.test.js
./tests/integration/staging
./tests/integration/staging/.gitkeep
./tests/integration/staging/pipeline.test.js
./tests/intelligence.smoke.sh
./tests/inventory.endpoint_smoke.sh
./tests/profile.endpoint_smoke.sh
./tests/room.endpoint_smoke.sh
./tests/setup.js
./tests/smoke-test.js
./tests/staff.endpoint_smoke.sh
./tests/student.endpoint_smoke.sh
./tests/unit
./tests/unit/contracts-verification.test.js
./tests/unit/intelligence.test.js
./tests/unit/registries
./tests/unit/registries/.gitkeep
./tests/unit/registries/registries.test.js
./tests/unit/services
./tests/unit/services/auth.test.js
./tests/unit/services/cache.test.js
./tests/unit/services/db.test.js
./tests/unit/services/events.test.js
./tests/unit/services/.gitkeep
./tests/unit/services/validate.test.js
```

## Phase 0: Foundation Contracts

Location: `/platform/contracts/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ✅ | 1976B | 2026-07-16 17:04:09 |
| `cache.js` | ✅ | 1540B | 2026-07-16 17:04:27 |
| `auth.js` | ✅ | 3905B | 2026-07-16 17:04:43 |
| `log.js` | ✅ | 1607B | 2026-07-16 17:04:56 |
| `validate.js` | ✅ | 1275B | 2026-07-16 17:05:07 |
| `events.js` | ✅ | 1876B | 2026-07-16 17:05:19 |
| `intelligence.js` | ✅ | 2202B | 2026-07-18 12:00:55 |

## Phase 1.1: Persistence / Service Layer

Location: `/platform/shared/services/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ✅ | 1840B | 2026-07-17 12:23:17 |
| `cache.js` | ✅ | 3439B | 2026-07-17 02:56:18 |
| `auth.js` | ✅ | 3609B | 2026-07-20 11:28:06 |
| `log.js` | ✅ | 1103B | 2026-07-16 17:39:58 |
| `validate.js` | ✅ | 1493B | 2026-07-16 17:40:14 |
| `events.js` | ✅ | 2263B | 2026-07-16 17:40:26 |
| `session.js` | ✅ | 2717B | 2026-07-16 17:39:15 |
| `audit.js` | ✅ | 2375B | 2026-08-07 17:41:05 |
| `metrics.js` | ✅ | 4338B | 2026-07-16 17:39:45 |
| `email.js` | ✅ | 1672B | 2026-07-17 07:10:32 |
| `ratelimit.js` | ✅ | 1500B | 2026-07-18 19:45:41 |
| `refresh.js` | ✅ | 4318B | 2026-07-20 16:27:38 |

### Intelligence Service Package

Location: `/platform/shared/services/intelligence/`

| File | Exists | Size |
|------|--------|------|
| `index.js` | ✅ | 945B |
| `metadata.js` | ✅ | 3592B |
| `insights.js` | ✅ | 9783B |
| `logic.js` | ✅ | 4729B |
| `store.js` | ✅ | 6237B |

## Phase 1.2: Registry Layer

Location: `/platform/shared/registry/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `moduleRegistry.js` | ✅ | 2842B | 2026-07-16 17:47:26 |
| `schemaRegistry.js` | ✅ | 2353B | 2026-07-16 17:43:03 |
| `routeRegistry.js` | ✅ | 2131B | 2026-07-20 06:47:58 |
| `functionRegistry.js` | ✅ | 2575B | 2026-07-16 17:43:47 |
| `capabilityRegistry.js` | ✅ | 2879B | 2026-07-16 17:45:09 |
| `dependencyGraph.js` | ✅ | 4410B | 2026-07-16 17:45:25 |
| `componentRegistry.js` | ✅ | 3735B | 2026-08-06 20:46:46 |
| `componentScanner.js` | ✅ | 5067B | 2026-08-06 21:12:43 |

## Phase 1.3: Staging Pipeline

Location: `/platform/shared/pipeline/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `discover.js` | ✅ | 1225B | 2026-07-16 17:49:40 |
| `validate.js` | ✅ | 3803B | 2026-07-17 08:19:29 |
| `register.js` | ✅ | 2760B | 2026-07-20 06:47:36 |
| `resolve.js` | ✅ | 2350B | 2026-07-18 12:07:29 |
| `wire.js` | ✅ | 2347B | 2026-08-07 22:37:11 |
| `boot.js` | ✅ | 3184B | 2026-08-06 21:13:12 |
| `unstage.js` | ✅ | 3124B | 2026-07-16 17:53:03 |

## Phase 5: HTTP Middleware

Location: `/platform/shared/middleware/`

| File | Exists | Size |
|------|--------|------|
| `passwordChangeRequired.js` | ✅ | 1017B |

## Modules

Location: `/platform/modules/`

| Module | Manifest | Index | Component | Migrations | Type |
|--------|----------|-------|-----------|------------|------|
| `builder` | ✅ | ✅ | ❌ | 0 | standard |
| `inventory` | ✅ | ✅ | ✅ | 1 | registry |
| `room_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `staff_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `staff_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `student_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `student_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `system_health` | ✅ | ✅ | ❌ | 0 | standard |
| `user_management` | ✅ | ✅ | ❌ | 3 | standard |

## CLI Tools

Location: `/platform/scripts/cli/`

| File | Exists | Purpose |
|------|--------|---------|
| `migrate.js` | ✅ | Database migrations |
| `scaffold.js` | ✅ | Module generation |
| `builder.js` | ✅ | App assembly |

## Phase 7: Testing Layer

- `/tests/unit/services/` — 5 test file(s)
- `/tests/unit/registries/` — 1 test file(s)
- `/tests/integration/staging/` — 1 test file(s)
- `/tests/integration/http/` — 5 test file(s)
- `/tests/e2e/` — 2 test file(s)

### Smoke Tests

- `student.endpoint_smoke.sh` ✅
- `staff.endpoint_smoke.sh` ✅
- `room.endpoint_smoke.sh` ✅
- `inventory.endpoint_smoke.sh` ✅
- `intelligence.smoke.sh` ✅
- `profile.endpoint_smoke.sh` ✅

## Phase 10-11: Engine Layers

**`/engine/gap-analysis/`**
- `calculator.js` (6153B)
- `index.js` (737B)
**`/engine/recommendation/`**
- `analyzer.js` (5158B)
- `index.js` (1155B)

## Data Layer

- `timsys.sqlite` (618496B)

## Applications

| Application | Status |
|-------------|--------|
| `competeed` | ✅ Ready |
| `principaled` | ✅ Ready |
| `sanctifyed` | ✅ Ready |

---

## Drift Detection

### Expected Platform Directories

- ❌ MISSING DIR: `/platform/tests/`

### Frozen Document Integrity

- CONSTITUTION_V6.0.md SHA256: `ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a`
- LEXICON_V6.0.0.md SHA256: `72280c5fb7d90fa8245139f35b9340016e0fe0d072bf799bd2ea85360e167b45`
- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.

### Contract Freeze Status

- Contracts present: 7/7
- Status: All contract files exist. Verify they are frozen and signed off.

---
End of Architecture Map.
