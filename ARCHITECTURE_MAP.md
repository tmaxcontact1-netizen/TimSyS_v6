# TimSyS Architecture Map
Generated: 2026-08-09T19:54:39Z
Generator: platform/Tools/update_architecture_map.py (Discovery-Based)

This document is auto-generated. Do not edit manually.
# To run bash /home/tmax/TimSyS_v6/platform/Tools/update_architecture_map.sh

---

## Project Root

Path: `/home/tmax/TimSyS_v6`
Platform Location: `/home/tmax/TimSyS_v6/platform`

## Root Documents

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `CONTEXT.md` | ✅ | 11903B | 2026-08-08 15:58:23 |
| `ARCHITECTURE_MAP.md` | ✅ | 14418B | 2026-08-08 16:31:01 |
| `HANDOVER.md` | ✅ | 14394B | 2026-08-08 15:58:23 |
| `CONSTITUTION_V6.0.md` | ✅ | 24775B | 2026-08-08 15:58:23 |
| `LEXICON_V6.0.0.md` | ✅ | 19944B | 2026-08-08 15:58:23 |

## Directory Tree

```
.
  .gitignore
  ARCHITECTURE_MAP.md
  CONSTITUTION_V6.0.md
  CONTEXT.md
  DECISIONS.md
  HANDOVER.md
  LEXICON_V6.0.0.md
  TEST_PROTOCOL.md
  json
  os
./packages
./packages/timsys-client
    package.json
./packages/timsys-client/src
./data
./config
./apps
./apps/competeed
    package.json
./apps/competeed/src
./apps/competeed/src/api
./apps/competeed/src/pages
./apps/competeed/public
./apps/principaled
    package.json
./apps/principaled/src
./apps/principaled/src/api
        client.js
./apps/principaled/src/dashboard
        Index.jsx
./apps/principaled/src/dashboard/widgets
          AttendanceWidget.jsx
          InventoryWidget.jsx
          ModuleSelectorWidget.jsx
          ModuleStatusWidget.jsx
          NotificationsWidget.jsx
          OverviewWidget.jsx
          RoomsWidget.jsx
          StaffProfileWidget.jsx
          StaffWidget.jsx
          StudentProfileWidget.jsx
./apps/principaled/src/components
./apps/principaled/src/pages
./apps/principaled/public
./apps/memecoined
    .env
    index.html
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
./apps/memecoined/src
      App.jsx
      index.jsx
      styles.css
./apps/memecoined/src/utils
./apps/memecoined/src/store
        authStore.js
        tradingStore.js
./apps/memecoined/src/api
        auth.js
        base.js
./apps/memecoined/src/components
        CoinList.jsx
        Portfolio.jsx
        TradingDashboard.jsx
./apps/memecoined/src/pages
        DashboardPage.jsx
        LoginPage.jsx
./apps/memecoined/public
./apps/memecoined/public/assets
./apps/launcher
    .env
    README.md
    index.html
    package-lock.json
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
./apps/launcher/src
      App.jsx
      App.jsx.bak
      index.jsx
      styles.css
./apps/launcher/src/utils
        formatDate.js
        permissions.js
        sseClient.js
./apps/launcher/src/Layout
./apps/launcher/src/store
        appStore.js
        authStore.js
        connectionStore.js
        settingsStore.js
./apps/launcher/src/Dashboard
./apps/launcher/src/Splash
./apps/launcher/src/Launcher
./apps/launcher/src/registry
        appComponents.jsx
./apps/launcher/src/api
        apps.js
        auth.js
        base.js
        builder.js
        stream.js
./apps/launcher/src/components
        ErrorBoundary.jsx
./apps/launcher/src/components/Layout
          MainLayout.jsx
./apps/launcher/src/components/Dashboard
          IntelligencePanel.jsx
          Tile.jsx
          TileGrid.jsx
./apps/launcher/src/components/Splash
          AppSplash.jsx
          PlatformCheck.jsx
./apps/launcher/src/components/Launcher
          AppSelector.jsx
          UserMenu.jsx
./apps/launcher/src/pages
        AppDashboard.jsx
        AppSelectorPage.jsx
        LoginPage.jsx
        ModulePortalPage.jsx
        ModuleSelectorPage.jsx
        PrincipalEdPage.jsx
./apps/launcher/electron
      main.js
      preload.js
      tray.js
./apps/launcher/public
      index.html
./apps/launcher/public/assets
./apps/sanctifyed
    package.json
./apps/sanctifyed/src
./apps/sanctifyed/src/api
./apps/sanctifyed/src/pages
./apps/sanctifyed/public
./tests
  builder.test.js
  intelligence.smoke.sh
  inventory.endpoint_smoke.sh
  profile.endpoint_smoke.sh
  room.endpoint_smoke.sh
  setup.js
  smoke-test.js
  staff.endpoint_smoke.sh
  student.endpoint_smoke.sh
./tests/integration
./tests/integration/staging
      .gitkeep
      pipeline.test.js
./tests/integration/http
      auth.test.js
      password-prompt.test.js
      refresh-token.test.js
      security.test.js
      staging.test.js
./tests/e2e
    .gitkeep
    boot-sequence.test.js
    boot.test.js
./tests/helpers
    test-server.js
./tests/unit
    contracts-verification.test.js
    intelligence.test.js
./tests/unit/registries
      .gitkeep
      registries.test.js
./tests/unit/services
      .gitkeep
      auth.test.js
      cache.test.js
      db.test.js
      events.test.js
      validate.test.js
./platform
  V
  index.js
  jest.config.js
  package-lock.json
  package.json
  test-results-builder.txt
./platform/shared
    migration-runner.js
./platform/shared/pipeline
      boot.js
      discover.js
      register.js
      resolve.js
      unstage.js
      validate.js
      wire.js
./platform/shared/registry
      capabilityRegistry.js
      componentRegistry.js
      componentScanner.js
      dependencyGraph.js
      functionRegistry.js
      moduleRegistry.js
      routeRegistry.js
      schemaRegistry.js
./platform/shared/middleware
      passwordChangeRequired.js
      visibilityCheck.js
./platform/shared/services
      audit.js
      auth.js
      cache.js
      csv_parser.js
      db.js
      email.js
      events.js
      log.js
      metrics.js
      ratelimit.js
./platform/shared/services/relationship_registry
        index.js
./platform/shared/services/visibilityFilter
        index.js
./platform/shared/services/snapshot
        index.js
./platform/shared/services/decision_log
        index.js
./platform/shared/services/knowledge_store
        index.js
./platform/shared/services/event_store
        index.js
./platform/shared/services/auto_rules
        index.js
./platform/shared/services/notification
        index.js
./platform/shared/services/intelligence
        index.js
        insights.js
        logic.js
        metadata.js
        store.js
./platform/data
    timsys.db
    timsys.sqlite
    timsys.sqlite-shm
    timsys.sqlite-wal
./platform/modules
    .gitkeep
./platform/modules/relationship_registry
      index.js
      module.json
./platform/modules/relationship_registry/migrations
        .gitkeep
        001_relationships.sql
./platform/modules/decision_log
      index.js
      module.json
./platform/modules/decision_log/migrations
        .gitkeep
        001_decision_log.sql
./platform/modules/student_profile
      component.json
      index.js
      module.json
./platform/modules/staff_profile
      component.json
      index.js
      module.json
./platform/modules/system_health
      index.js
      module.json
      module.json.bak
./platform/modules/system_health/handlers
        staging.js
./platform/modules/knowledge_store
      index.js
      module.json
./platform/modules/knowledge_store/migrations
        .gitkeep
        001_knowledge.sql
./platform/modules/event_store
      index.js
      module.json
./platform/modules/event_store/migrations
        .gitkeep
        001_event_store.sql
./platform/modules/user_management
      index.js
      module.json
./platform/modules/user_management/migrations
        001_users.sql
        002_password_resets.sql
        003_must_change_password.sql
./platform/modules/builder
      assembler.js
      composer.js
      index.js
      module.json
      templates.js
./platform/modules/builder/migrations
        .gitkeep
./platform/modules/test_composite
      index.js
      module.json
./platform/modules/test_composite/migrations
        .gitkeep
./platform/modules/insight_management
      index.js
      module.json
./platform/modules/auto_rules
      index.js
      module.json
./platform/modules/auto_rules/migrations
        001_auto_rules.sql
./platform/modules/snapshot_service
      index.js
      module.json
./platform/modules/snapshot_service/migrations
        001_snapshots.sql
./platform/modules/room_registry
      component.json
      index.js
      module.json
./platform/modules/room_registry/migrations
        001_rooms.sql
./platform/modules/notification
      index.js
      module.json
./platform/modules/notification/migrations
        .gitkeep
        001_notifications.sql
./platform/modules/student_registry
      component.json
      index.js
      module.json
./platform/modules/student_registry/migrations
        .gitkeep
        001_students.sql
./platform/modules/app_registry
      component.json
      index.js
      module.json
./platform/modules/app_registry/migrations
        001_apps.sql
        002_user_settings.sql
        003_modules_config.sql
        004_app_modules.sql
./platform/modules/intelligence
      index.js
      module.json
./platform/modules/intelligence/migrations
        .gitkeep
./platform/modules/staff_registry
      component.json
      index.js
      module.json
./platform/modules/staff_registry/migrations
        .gitkeep
        001_staff.sql
./platform/modules/inventory
      component.json
      index.js
      module.json
./platform/modules/inventory/migrations
        001_inventory.sql
./platform/config
    session-policy.json
./platform/routes
    .gitkeep
./platform/routes/introspect
      .gitkeep
./platform/Tools
    spawn_app.sh
    update_architecture_map.py
    update_architecture_map.sh
./platform/contracts
    auth.js
    auto_rules.js
    cache.js
    db.js
    decision_log.js
    event_store.js
    events.js
    intelligence.js
    knowledge_store.js
    log.js
./platform/engine
./platform/engine/recommendation
      .gitkeep
      analyzer.js
      index.js
./platform/engine/gap-analysis
      .gitkeep
      calculator.js
      index.js
./platform/scripts
    .gitkeep
./platform/scripts/cli
      builder.js
      migrate.js
      scaffold.js
      update-package.js
./platform/deploy
    backup.sh
    migrate.sh
    production.env.example
    rollback.sh
    setup-wizard.js
./platform/migrations
    000_bootstrap.sql
    001_initial.sql
    002_intelligence.sql
    003_rate_limit.sql
    004_recommendations.sql
    005_route_permissions.sql
    006_refresh_tokens.sql
    007_builder.sql
```

## Phase 0: Foundation Contracts

Location: `/platform/contracts/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `auth.js` | ✅ | 3905B | 2026-07-16 17:04:43 |
| `auto_rules.js` | ✅ | 0B | 2026-08-08 08:58:29 |
| `cache.js` | ✅ | 1540B | 2026-07-16 17:04:27 |
| `db.js` | ✅ | 1976B | 2026-07-16 17:04:09 |
| `decision_log.js` | ✅ | 2372B | 2026-08-08 10:06:53 |
| `event_store.js` | ✅ | 2414B | 2026-08-08 09:25:44 |
| `events.js` | ✅ | 1876B | 2026-07-16 17:05:19 |
| `intelligence.js` | ✅ | 2202B | 2026-07-18 12:00:55 |
| `knowledge_store.js` | ✅ | 0B | 2026-08-08 08:58:29 |
| `log.js` | ✅ | 1607B | 2026-07-16 17:04:56 |
| `notification.js` | ✅ | 0B | 2026-08-08 08:58:29 |
| `relationship_registry.js` | ✅ | 0B | 2026-08-08 08:58:29 |
| `snapshot.js` | ✅ | 0B | 2026-08-08 08:58:29 |
| `validate.js` | ✅ | 1275B | 2026-07-16 17:05:07 |

## Phase 1.1: Persistence / Service Layer

Location: `/platform/shared/services/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `audit.js` | ✅ | 2375B | 2026-08-07 17:41:05 |
| `auth.js` | ✅ | 3609B | 2026-07-20 11:28:06 |
| `cache.js` | ✅ | 3439B | 2026-07-17 02:56:18 |
| `csv_parser.js` | ✅ | 2765B | 2026-08-08 14:22:26 |
| `db.js` | ✅ | 1840B | 2026-07-17 12:23:17 |
| `email.js` | ✅ | 1672B | 2026-07-17 07:10:32 |
| `events.js` | ✅ | 2522B | 2026-08-08 09:25:34 |
| `log.js` | ✅ | 1103B | 2026-07-16 17:39:58 |
| `metrics.js` | ✅ | 4338B | 2026-07-16 17:39:45 |
| `ratelimit.js` | ✅ | 1500B | 2026-07-18 19:45:41 |
| `refresh.js` | ✅ | 4318B | 2026-07-20 16:27:38 |
| `session.js` | ✅ | 2717B | 2026-07-16 17:39:15 |
| `sse.js` | ✅ | 2748B | 2026-08-08 19:08:00 |
| `validate.js` | ✅ | 1493B | 2026-07-16 17:40:14 |

### Intelligence Service Package

Location: `/platform/shared/services/intelligence/`

| File | Exists | Size |
| ------ | ------ | ------ |
| `index.js` | ✅ | 960B |
| `insights.js` | ✅ | 9907B |
| `logic.js` | ✅ | 4729B |
| `metadata.js` | ✅ | 3592B |
| `store.js` | ✅ | 6237B |

## Phase 1.2: Registry Layer

Location: `/platform/shared/registry/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `capabilityRegistry.js` | ✅ | 2879B | 2026-07-16 17:45:09 |
| `componentRegistry.js` | ✅ | 3735B | 2026-08-06 20:46:46 |
| `componentScanner.js` | ✅ | 5067B | 2026-08-06 21:12:43 |
| `dependencyGraph.js` | ✅ | 4410B | 2026-07-16 17:45:25 |
| `functionRegistry.js` | ✅ | 2575B | 2026-07-16 17:43:47 |
| `moduleRegistry.js` | ✅ | 2842B | 2026-07-16 17:47:26 |
| `routeRegistry.js` | ✅ | 2131B | 2026-07-20 06:47:58 |
| `schemaRegistry.js` | ✅ | 2353B | 2026-07-16 17:43:03 |

## Phase 1.3: Staging Pipeline

Location: `/platform/shared/pipeline/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `boot.js` | ✅ | 3184B | 2026-08-06 21:13:12 |
| `discover.js` | ✅ | 1225B | 2026-07-16 17:49:40 |
| `register.js` | ✅ | 2760B | 2026-07-20 06:47:36 |
| `resolve.js` | ✅ | 2350B | 2026-07-18 12:07:29 |
| `unstage.js` | ✅ | 3124B | 2026-07-16 17:53:03 |
| `validate.js` | ✅ | 3803B | 2026-07-17 08:19:29 |
| `wire.js` | ✅ | 2347B | 2026-08-07 22:37:11 |

## Phase 5: HTTP Middleware

Location: `/platform/shared/middleware/`

| File | Exists | Size |
| ------ | ------ | ------ |
| `passwordChangeRequired.js` | ✅ | 1017B |
| `visibilityCheck.js` | ✅ | 3244B |

## Modules

Location: `/platform/modules/`

| Module | Manifest | Index | Component | Migrations | Type |
| ------ | -------- | ----- | --------- | ------------ | ---- |
| `app_registry` | ✅ | ✅ | ✅ | 4 | standard |
| `auto_rules` | ✅ | ✅ | ❌ | 1 | standard |
| `builder` | ✅ | ✅ | ❌ | 0 | standard |
| `decision_log` | ✅ | ✅ | ❌ | 1 | standard |
| `event_store` | ✅ | ✅ | ❌ | 1 | standard |
| `insight_management` | ✅ | ✅ | ❌ | 0 | standard |
| `intelligence` | ✅ | ✅ | ❌ | 0 | standard |
| `inventory` | ✅ | ✅ | ✅ | 1 | registry |
| `knowledge_store` | ✅ | ✅ | ❌ | 1 | standard |
| `notification` | ✅ | ✅ | ❌ | 1 | standard |
| `relationship_registry` | ✅ | ✅ | ❌ | 1 | registry |
| `room_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `snapshot_service` | ✅ | ✅ | ❌ | 1 | standard |
| `staff_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `staff_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `student_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `student_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `system_health` | ✅ | ✅ | ❌ | 0 | standard |
| `test_composite` | ✅ | ✅ | ❌ | 0 | standard |
| `user_management` | ✅ | ✅ | ❌ | 3 | standard |

## CLI Tools

Location: `/platform/scripts/cli/`

| File | Exists | Purpose |
| ------ | ------ | ------- |
| `builder.js` | ✅ | App assembly |
| `migrate.js` | ✅ | Database migrations |
| `scaffold.js` | ✅ | Module generation |
| `update-package.js` | ✅ | (other) |

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

- `timsys.db` (32768B)
- `timsys.sqlite` (4599808B)
- `timsys.sqlite-shm` (32768B)
- `timsys.sqlite-wal` (4161232B)

## Applications

| Application | Status |
| ------------ | ------ |
| `competeed` | ✅ Ready |
| `launcher` | ✅ Ready |
| `memecoined` | ✅ Ready |
| `principaled` | ✅ Ready |
| `sanctifyed` | ✅ Ready |

---

## Drift Detection

### Expected vs Found Discrepancies

- **Contracts extra (not expected):** auto_rules.js, decision_log.js, event_store.js, knowledge_store.js, notification.js, relationship_registry.js, snapshot.js

- **Services extra (not expected):** csv_parser.js, sse.js

- ✅ All expected registries present, no extras.

- ✅ All expected pipeline files present, no extras.

### Expected Platform Directories

- ✅ `/platform/contracts/`
- ✅ `/platform/shared/services/`
- ✅ `/platform/shared/registry/`
- ✅ `/platform/shared/pipeline/`
- ✅ `/platform/modules/`
- ❌ MISSING DIR: `/platform/tests/`
- ✅ `/platform/Tools/`
- ✅ `/platform/data/`
- ✅ `/platform/routes/`
- ✅ `/platform/engine/gap-analysis/`
- ✅ `/platform/engine/recommendation/`

### Frozen Document Integrity

- CONSTITUTION_V6.0.md SHA256: `47f46e3944bb142d5aa17f116d81d2bb00a6d49f069409987e88b9441a34b253`
- LEXICON_V6.0.0.md SHA256: `9d99e326a693b61f168d922a0b557b488c2f6577c93d9d202efa28de4b4f0ad6`
- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.

### Summary

- ⚠️ **Drift detected.** Compare against Constitution/Context for discrepancies.

---
End of Architecture Map.