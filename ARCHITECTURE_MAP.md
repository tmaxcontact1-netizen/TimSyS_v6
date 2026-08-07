# TimSyS Architecture Map
Generated: 2026-08-07T09:17:04Z
Generator: Tools/update_architecture_map.sh

This document is auto-generated. Do not edit manually.
Run `bash Tools/update_architecture_map.sh` to regenerate after structural changes.

---

## Project Root

Path: `/home/tmax/TimSyS_v6`


## Root Documents

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `CONTEXT.md` | ✅ | 10870B | 2026-07-20 18:26:38 |
| `ARCHITECTURE_MAP.md` | ✅ | 451B | 2026-08-07 12:17:04 |
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
./data/timsys.sqlite
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
./tests/setup.js
./tests/smoke-test.js
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

Location: `/contracts/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ❌ MISSING | - | - |
| `cache.js` | ❌ MISSING | - | - |
| `auth.js` | ❌ MISSING | - | - |
| `log.js` | ❌ MISSING | - | - |
| `validate.js` | ❌ MISSING | - | - |
| `events.js` | ❌ MISSING | - | - |

## Phase 1.1: Persistence / Service Layer

Location: `/shared/services/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ❌ MISSING | - | - |
| `cache.js` | ❌ MISSING | - | - |
| `auth.js` | ❌ MISSING | - | - |
| `log.js` | ❌ MISSING | - | - |
| `validate.js` | ❌ MISSING | - | - |
| `events.js` | ❌ MISSING | - | - |
| `session.js` | ❌ MISSING | - | - |
| `audit.js` | ❌ MISSING | - | - |
| `metrics.js` | ❌ MISSING | - | - |

## Phase 1.2: Registry Layer

Location: `/shared/registry/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `moduleRegistry.js` | ❌ MISSING | - | - |
| `schemaRegistry.js` | ❌ MISSING | - | - |
| `routeRegistry.js` | ❌ MISSING | - | - |
| `functionRegistry.js` | ❌ MISSING | - | - |
| `capabilityRegistry.js` | ❌ MISSING | - | - |
| `dependencyGraph.js` | ❌ MISSING | - | - |

## Phase 1.3: Staging Pipeline

Location: `NOT FOUND`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `discover.js` | ❌ MISSING | - | - |
| `validate.js` | ❌ MISSING | - | - |
| `register.js` | ❌ MISSING | - | - |
| `resolve.js` | ❌ MISSING | - | - |
| `wire.js` | ❌ MISSING | - | - |
| `boot.js` | ❌ MISSING | - | - |
| `unstage.js` | ❌ MISSING | - | - |

## Modules

Location: `/modules/`

Directory does not exist.

## Phase 7: Testing Layer

- `/tests/unit/services/` — 5 test file(s)
- `/tests/unit/registries/` — 1 test file(s)
- `/tests/integration/staging/` — 1 test file(s)
- `/tests/integration/http/` — 5 test file(s)
- `/tests/e2e/` — 2 test file(s)

## Tools

Directory does not exist.

## Phase 10-11: Engine Layers

**`/engine/gap-analysis/`** — Does not exist
**`/engine/recommendation/`** — Does not exist

## Phase 5: HTTP / Routes

Directory does not exist.

## Data Layer

- `timsys.sqlite` (348160B)

---

## Drift Detection

### Expected Directories

- ❌ MISSING DIR: `/contracts/`
- ❌ MISSING DIR: `/shared/services/`
- ❌ MISSING DIR: `/shared/registry/`
- ❌ MISSING DIR: `/shared/pipeline/`
- ❌ MISSING DIR: `/modules/`
- ❌ MISSING DIR: `/Tools/`
- ❌ MISSING DIR: `/routes/`
- ❌ MISSING DIR: `/engine/gap-analysis/`
- ❌ MISSING DIR: `/engine/recommendation/`

### Frozen Document Integrity

- CONSTITUTION_V6.0.md SHA256: `ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a`
- LEXICON_V6.0.0.md SHA256: `72280c5fb7d90fa8245139f35b9340016e0fe0d072bf799bd2ea85360e167b45`
- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.

### Contract Freeze Status

- Contracts present: 0/6
- Status: 6 contract file(s) missing.

---
End of Architecture Map.
