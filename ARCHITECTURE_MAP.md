# TimSyS Architecture Map
Generated: 2026-07-19T04:51:24Z
Generator: Tools/update_architecture_map.sh

This document is auto-generated. Do not edit manually.
Run `bash Tools/update_architecture_map.sh` to regenerate after structural changes.

---

## Project Root

Path: `/home/tmax/TimSyS_v6`


## Root Documents

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `CONTEXT.md` | ✅ | 10520B | 2026-07-19 11:51:16 |
| `ARCHITECTURE_MAP.md` | ✅ | 451B | 2026-07-19 11:51:24 |
| `HANDOVER.md` | ✅ | 17613B | 2026-07-19 11:51:16 |
| `CONSTITUTION_V6.0.md` | ✅ | 18712B | 2026-07-17 12:34:40 |
| `LEXICON_V6.0.0.md` | ✅ | 10787B | 2026-07-17 12:34:51 |

## Directory Tree

```
(tree command not available — using find)
.
./ARCHITECTURE_MAP.md
./CONSTITUTION_V6.0.md
./CONTEXT.md
./contracts
./contracts/auth.js
./contracts/cache.js
./contracts/db.js
./contracts/events.js
./contracts/intelligence.js
./contracts/log.js
./contracts/validate.js
./data
./data/timsys.sqlite
./data/timsys.sqlite-shm
./data/timsys.sqlite-wal
./DECISIONS.md
./engine
./engine/gap-analysis
./engine/gap-analysis/calculator.js
./engine/gap-analysis/.gitkeep
./engine/gap-analysis/index.js
./engine/recommendation
./engine/recommendation/analyzer.js
./engine/recommendation/.gitkeep
./engine/recommendation/index.js
./.git
./.gitignore
./HANDOVER.md
./index.js
./jest.config.js
./LEXICON_V6.0.0.md
./migrations
./migrations/000_bootstrap.sql
./migrations/001_initial.sql
./migrations/002_intelligence.sql
./migrations/003_rate_limit.sql
./migrations/004_recommendations.sql
./modules
./modules/builder
./modules/builder/index.js
./modules/builder/migrations
./modules/builder/migrations/.gitkeep
./modules/builder/module.json
./modules/.gitkeep
./modules/system_health
./modules/system_health/index.js
./modules/system_health/module.json
./modules/user_management
./modules/user_management/index.js
./modules/user_management/migrations
./modules/user_management/migrations/001_users.sql
./modules/user_management/migrations/002_password_resets.sql
./modules/user_management/migrations/003_must_change_password.sql
./modules/user_management/module.json
./node_modules
./package.json
./package-lock.json
./routes
./routes/.gitkeep
./routes/introspect
./routes/introspect/.gitkeep
./scripts
./scripts/cli
./scripts/cli/builder.js
./scripts/cli/migrate.js
./scripts/cli/scaffold.js
./scripts/cli/update-package.js
./scripts/.gitkeep
./shared
./shared/middleware
./shared/middleware/passwordChangeRequired.js
./shared/migration-runner.js
./shared/pipeline
./shared/pipeline/boot.js
./shared/pipeline/discover.js
./shared/pipeline/register.js
./shared/pipeline/resolve.js
./shared/pipeline/unstage.js
./shared/pipeline/validate.js
./shared/pipeline/wire.js
./shared/registry
./shared/registry/capabilityRegistry.js
./shared/registry/dependencyGraph.js
./shared/registry/functionRegistry.js
./shared/registry/moduleRegistry.js
./shared/registry/routeRegistry.js
./shared/registry/schemaRegistry.js
./shared/services
./shared/services/audit.js
./shared/services/auth.js
./shared/services/cache.js
./shared/services/db.js
./shared/services/email.js
./shared/services/events.js
./shared/services/intelligence
./shared/services/intelligence/index.js
./shared/services/intelligence/insights.js
./shared/services/intelligence/logic.js
./shared/services/intelligence/metadata.js
./shared/services/intelligence/store.js
./shared/services/log.js
./shared/services/metrics.js
./shared/services/ratelimit.js
./shared/services/session.js
./shared/services/validate.js
./test-results.txt
./tests
./tests/e2e
./tests/e2e/boot-sequence.test.js
./tests/e2e/boot.test.js
./tests/e2e/.gitkeep
./tests/integration
./tests/integration/http
./tests/integration/http/auth.test.js
./tests/integration/http/password-prompt.test.js
./tests/integration/http/security.test.js
./tests/integration/staging
./tests/integration/staging/.gitkeep
./tests/integration/staging/pipeline.test.js
./tests/setup.js
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
./Tools
./Tools/update_architecture_map.sh
```

## Phase 0: Foundation Contracts

Location: `/contracts/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ✅ | 1976B | 2026-07-16 21:04:09 |
| `cache.js` | ✅ | 1540B | 2026-07-16 21:04:27 |
| `auth.js` | ✅ | 3905B | 2026-07-16 21:04:43 |
| `log.js` | ✅ | 1607B | 2026-07-16 21:04:56 |
| `validate.js` | ✅ | 1275B | 2026-07-16 21:05:07 |
| `events.js` | ✅ | 1876B | 2026-07-16 21:05:19 |

## Phase 1.1: Persistence / Service Layer

Location: `/shared/services/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ✅ | 1840B | 2026-07-17 16:23:17 |
| `cache.js` | ✅ | 3439B | 2026-07-17 06:56:18 |
| `auth.js` | ✅ | 3095B | 2026-07-18 12:39:45 |
| `log.js` | ✅ | 1103B | 2026-07-16 21:39:58 |
| `validate.js` | ✅ | 1493B | 2026-07-16 21:40:14 |
| `events.js` | ✅ | 2263B | 2026-07-16 21:40:26 |
| `session.js` | ✅ | 2717B | 2026-07-16 21:39:15 |
| `audit.js` | ✅ | 2248B | 2026-07-16 21:39:29 |
| `metrics.js` | ✅ | 4338B | 2026-07-16 21:39:45 |

## Phase 1.2: Registry Layer

Location: `/shared/registry/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `moduleRegistry.js` | ✅ | 2842B | 2026-07-16 21:47:26 |
| `schemaRegistry.js` | ✅ | 2353B | 2026-07-16 21:43:03 |
| `routeRegistry.js` | ✅ | 2635B | 2026-07-16 21:43:26 |
| `functionRegistry.js` | ✅ | 2575B | 2026-07-16 21:43:47 |
| `capabilityRegistry.js` | ✅ | 2879B | 2026-07-16 21:45:09 |
| `dependencyGraph.js` | ✅ | 4410B | 2026-07-16 21:45:25 |

## Phase 1.3: Staging Pipeline

Location: `/shared/pipeline/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `discover.js` | ✅ (shared/pipeline/discover.js) | 1225B | 2026-07-16 21:49:40 |
| `validate.js` | ✅ (shared/pipeline/validate.js) | 3803B | 2026-07-17 12:19:29 |
| `register.js` | ✅ (shared/pipeline/register.js) | 2848B | 2026-07-17 12:25:26 |
| `resolve.js` | ✅ (shared/pipeline/resolve.js) | 2350B | 2026-07-18 16:07:29 |
| `wire.js` | ✅ (shared/pipeline/wire.js) | 2084B | 2026-07-18 16:06:16 |
| `boot.js` | ✅ (shared/pipeline/boot.js) | 2929B | 2026-07-16 21:52:24 |
| `unstage.js` | ✅ (shared/pipeline/unstage.js) | 3124B | 2026-07-16 21:53:03 |

## Modules

Location: `/modules/`

| Module | Manifest | Index | Migrations | Handlers | Schemas |
|--------|----------|-------|------------|----------|---------|
