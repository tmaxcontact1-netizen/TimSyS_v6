# TimSyS Architecture Map
Generated: 2026-07-16T13:51:19Z
Generator: Tools/update_architecture_map.sh

This document is auto-generated. Do not edit manually.
Run `bash Tools/update_architecture_map.sh` to regenerate after structural changes.

---

## Project Root

Path: `/home/tmax/TimSyS_v6`


## Root Documents

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `CONTEXT.md` | ✅ | 2458B | 2026-07-16 20:50:01 |
| `ARCHITECTURE_MAP.md` | ✅ | 450B | 2026-07-16 20:51:19 |
| `HANDOVER.md` | ✅ | 0B | 2026-07-16 10:11:52 |
| `CONSTITUTION_V6.0.md` | ✅ | 18712B | 2026-07-16 20:44:30 |
| `LEXICON_V6.0.0.md` | ✅ | 9588B | 2026-07-16 10:22:03 |

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
./data/.gitkeep
./engine
./engine/gap-analysis
./engine/gap-analysis/.gitkeep
./engine/recommendation
./engine/recommendation/.gitkeep
./.git
./.gitignore
./HANDOVER.md
./LEXICON_V6.0.0.md
./migrations
./modules
./modules/.gitkeep
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
./shared/pipeline
./shared/pipeline/boot.js
./shared/pipeline/discover.js
./shared/pipeline/register.js
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
./shared/services/events.js
./shared/services/log.js
./shared/services/metrics.js
./shared/services/session.js
./shared/services/validate.js
./tests
./tests/e2e
./tests/e2e/.gitkeep
./tests/integration
./tests/integration/http
./tests/integration/http/.gitkeep
./tests/integration/staging
./tests/integration/staging/.gitkeep
./tests/unit
./tests/unit/registries
./tests/unit/registries/.gitkeep
./tests/unit/services
./tests/unit/services/.gitkeep
./Tools
./Tools/update_architecture_map.sh
```

## Phase 0: Foundation Contracts

Location: `/contracts/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ✅ | 1602B | 2026-07-16 11:00:36 |
| `cache.js` | ✅ | 1009B | 2026-07-16 11:00:36 |
| `auth.js` | ✅ | 2634B | 2026-07-16 20:38:18 |
| `log.js` | ✅ | 1592B | 2026-07-16 11:00:36 |
| `validate.js` | ✅ | 895B | 2026-07-16 11:00:36 |
| `events.js` | ✅ | 1142B | 2026-07-16 20:38:28 |

## Phase 1.1: Persistence / Service Layer

Location: `/shared/services/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `db.js` | ✅ | 0B | 2026-07-16 20:31:32 |
| `cache.js` | ✅ | 0B | 2026-07-16 20:31:28 |
| `session.js` | ✅ | 0B | 2026-07-16 10:42:32 |
| `audit.js` | ✅ | 0B | 2026-07-16 10:42:32 |
| `metrics.js` | ✅ | 0B | 2026-07-16 10:42:32 |

- ⚠️ UNEXPECTED: `auth.js` in /shared/services/
- ⚠️ UNEXPECTED: `events.js` in /shared/services/
- ⚠️ UNEXPECTED: `log.js` in /shared/services/
- ⚠️ UNEXPECTED: `validate.js` in /shared/services/

## Phase 1.2: Registry Layer

Location: `/shared/registry/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `moduleRegistry.js` | ✅ | 0B | 2026-07-16 10:42:32 |
| `schemaRegistry.js` | ✅ | 0B | 2026-07-16 10:42:32 |
| `routeRegistry.js` | ✅ | 0B | 2026-07-16 10:42:32 |
| `functionRegistry.js` | ✅ | 0B | 2026-07-16 10:42:32 |
| `capabilityRegistry.js` | ✅ | 0B | 2026-07-16 10:42:32 |
| `dependencyGraph.js` | ✅ | 0B | 2026-07-16 10:42:32 |

## Phase 1.3: Staging Pipeline

Location: `/shared/pipeline/`

| File | Exists | Size | Last Modified |
|------|--------|------|---------------|
| `discover.js` | ✅ (shared/pipeline/discover.js) | 0B | 2026-07-16 10:42:32 |
| `validate.js` | ✅ (shared/pipeline/validate.js) | 0B | 2026-07-16 10:42:32 |
| `register.js` | ✅ (shared/pipeline/register.js) | 0B | 2026-07-16 10:42:32 |
| `wire.js` | ✅ (shared/pipeline/wire.js) | 0B | 2026-07-16 10:42:32 |
| `boot.js` | ✅ (shared/pipeline/boot.js) | 0B | 2026-07-16 10:42:32 |
| `unstage.js` | ✅ (shared/pipeline/unstage.js) | 0B | 2026-07-16 10:42:32 |

## Modules

Location: `/modules/`

No modules staged.

## Phase 7: Testing Layer

- `/tests/unit/services/` — 0 spec file(s)
- `/tests/unit/registries/` — 0 spec file(s)
- `/tests/integration/staging/` — 0 spec file(s)
- `/tests/integration/http/` — 0 spec file(s)
- `/tests/e2e/` — 0 spec file(s)

## Scripts

- `.gitkeep`

## Phase 10-11: Engine Layers

**`/engine/gap-analysis/`**
- `.gitkeep`
**`/engine/recommendation/`**
- `.gitkeep`

## Phase 5: HTTP / Routes

No route files found.

## Data Layer

- `.gitkeep` (0B)

---

## Drift Detection

### Expected Directories

- ✅ All expected directories present.

### Frozen Document Integrity

- CONSTITUTION_V6.0.md SHA256: `ac631344f0e1a60edded3ac0b084504218f55172b1c31dce9e37c67b0d519e7a`
- LEXICON_V6.0.0.md SHA256: `65315362e4979c0ee3199a23f9e2678713b5f6e590aa98966420628e70d385ef`
- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.

### Pipeline Path Consistency

- ℹ️ Pipeline at `/shared/pipeline/`. Constitution specifies `/pipeline/`. Update one or the other.

### Contract Freeze Status

