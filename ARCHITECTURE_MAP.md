# TimSyS Architecture Map
Generated: 2026-07-17T08:09:24Z
Generator: Tools/update_architecture_map.sh

This document is auto-generated. Do not edit manually.
Run `bash Tools/update_architecture_map.sh` to regenerate after structural changes.

---

## Project Root

Path: `/home/tmax/TimSyS_v6`


## Root Documents

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `CONTEXT.md` | ✅ | 4117B | 2026-07-17 12:34:29 |
| `ARCHITECTURE_MAP.md` | ✅ | 450B | 2026-07-17 15:09:24 |
| `HANDOVER.md` | ✅ | 10540B | 2026-07-17 12:35:01 |
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
./contracts/log.js
./contracts/validate.js
./data
./engine
./engine/gap-analysis
./engine/gap-analysis/.gitkeep
./engine/recommendation
./engine/recommendation/.gitkeep
./.git
./.gitignore
./HANDOVER.md
./index.js
./jest.config.js
./LEXICON_V6.0.0.md
./migrations
./migrations/000_bootstrap.sql
./migrations/001_initial.sql
./modules
./modules/.gitkeep
./modules/system_health
./modules/system_health/index.js
./modules/system_health/module.json
./modules/user_management
./modules/user_management/index.js
./modules/user_management/migrations
./modules/user_management/migrations/001_users.sql
./modules/user_management/migrations/002_password_resets.sql
./modules/user_management/module.json
./node_modules
./package.json
./package-lock.json
./routes
./routes/.gitkeep
./routes/introspect
./routes/introspect/.gitkeep
./scripts
./scripts/.gitkeep
./shared
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
./shared/services/log.js
./shared/services/metrics.js
./shared/services/session.js
./shared/services/validate.js
./test-results.txt
./tests
./tests/e2e
./tests/e2e/.gitkeep
./tests/integration
./tests/integration/http
./tests/integration/http/auth.test.js
./tests/integration/http/.gitkeep
./tests/integration/staging
./tests/integration/staging/.gitkeep
./tests/integration/staging/pipeline.test.js
./tests/setup.js
./tests/unit
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
| `db.js` | ✅ | 1738B | 2026-07-17 12:18:19 |
| `cache.js` | ✅ | 3439B | 2026-07-17 06:56:18 |
| `auth.js` | ✅ | 2996B | 2026-07-16 23:16:25 |
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
| `resolve.js` | ✅ (shared/pipeline/resolve.js) | 2332B | 2026-07-16 22:32:00 |
| `wire.js` | ✅ (shared/pipeline/wire.js) | 2039B | 2026-07-17 12:28:40 |
| `boot.js` | ✅ (shared/pipeline/boot.js) | 2929B | 2026-07-16 21:52:24 |
| `unstage.js` | ✅ (shared/pipeline/unstage.js) | 3124B | 2026-07-16 21:53:03 |

## Modules

Location: `/modules/`

| Module | Manifest | Index | Migrations | Handlers | Schemas |
|--------|----------|-------|------------|----------|---------|
