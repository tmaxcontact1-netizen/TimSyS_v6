# TimSyS Architecture Map
Generated: 2026-08-12T09:38:36Z
Generator: platform/Tools/update_architecture_map.py (Discovery-Based)

This document is auto-generated. Do not edit manually.
# Run from any directory: python platform/Tools/update_architecture_map.py

---

## Project Root

Path: repository root
Platform Location: `platform/`

## Root Documents

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `CONTEXT.md` | ✅ | 12211B | 2026-08-12 12:29:10 |
| `ARCHITECTURE_MAP.md` | ✅ | 26997B | 2026-08-12 12:30:04 |
| `HANDOVER.md` | ✅ | 19198B | 2026-08-12 12:29:43 |
| `CONSTITUTION_V6.0.md` | ✅ | 25292B | 2026-08-12 12:29:43 |
| `LEXICON_V6.0.0.md` | ✅ | 20246B | 2026-08-12 10:37:47 |

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
./.git
  FETCH_HEAD
  HEAD
  config
  description
  index
  packed-refs
./.git\hooks
    applypatch-msg.sample
    commit-msg.sample
    fsmonitor-watchman.sample
    post-update.sample
    pre-applypatch.sample
    pre-commit.sample
    pre-merge-commit.sample
    pre-push.sample
    pre-rebase.sample
    pre-receive.sample
./.git\info
    exclude
./.git\logs
    HEAD
./.git\logs\refs
./.git\logs\refs\heads
        INTELLIGENCE_INTEGRATION_BASE
        main
./.git\logs\refs\remotes
./.git\logs\refs\remotes\bundle
          INTELLIGENCE_INTEGRATION_BASE
          main
./.git\logs\refs\remotes\origin
          HEAD
./.git\objects
./.git\objects\info
./.git\objects\info\commit-graphs
        commit-graph-chain
        graph-974f672c00d3eb302b7c6d4dd9f8b0ef325a5e61.graph
./.git\objects\pack
      pack-20013ed36290d6e72be453c7db13bca6f9a1ba64.idx
      pack-20013ed36290d6e72be453c7db13bca6f9a1ba64.pack
      pack-20013ed36290d6e72be453c7db13bca6f9a1ba64.rev
./.git\refs
./.git\refs\heads
      INTELLIGENCE_INTEGRATION_BASE
      main
./.git\refs\remotes
./.git\refs\remotes\bundle
        INTELLIGENCE_INTEGRATION_BASE
        main
./.git\refs\remotes\origin
        HEAD
./.git\refs\tags
./apps
./apps\launcher
    README.md
    index.html
    package-lock.json
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
./apps\launcher\electron
      main.cjs
      preload.cjs
      supervised-app-manager.cjs
      supervised-app-manager.test.cjs
      tray.js
./apps\launcher\public
./apps\launcher\src
      App.jsx
      index.jsx
      styles.css
./apps\launcher\src\api
        apps.js
        auth.js
        base.js
        builder.js
        stream.js
./apps\launcher\src\components
        ErrorBoundary.jsx
./apps\launcher\src\components\Dashboard
          IntelligencePanel.jsx
          Tile.jsx
          TileGrid.jsx
./apps\launcher\src\components\Launcher
          AppSelector.jsx
          UserMenu.jsx
./apps\launcher\src\components\Layout
          MainLayout.jsx
./apps\launcher\src\components\Splash
          AppSplash.jsx
          PlatformCheck.jsx
./apps\launcher\src\pages
        AppDashboard.jsx
        AppSelectorPage.jsx
        LoginPage.jsx
        ModulePortalPage.jsx
        ModuleSelectorPage.jsx
        PrincipalEdPage.jsx
./apps\launcher\src\registry
./apps\launcher\src\store
        appStore.js
        authStore.js
        connectionStore.js
        settingsStore.js
./apps\launcher\src\utils
        formatDate.js
        permissions.js
        sseClient.js
./apps\memecoined
    .env.example
    .gitignore
    .prettierrc.json
    README.md
    docker-compose.test.yml
    eslint.config.js
    package-lock.json
    package.json
    timsys.app.json
    tsconfig.json
./apps\memecoined\config
      defaults.json
      providers.example.json
      strategy-v1.json
      wallet-watchlist.example.json
./apps\memecoined\dist
      vitest.config.d.ts
      vitest.config.d.ts.map
      vitest.config.js
      vitest.config.js.map
./apps\memecoined\dist\scripts
        emergency-stop.d.ts
        emergency-stop.d.ts.map
        emergency-stop.js
        emergency-stop.js.map
        generate-report.d.ts
        generate-report.d.ts.map
        generate-report.js
        generate-report.js.map
        import-wallet-watchlist.d.ts
        import-wallet-watchlist.d.ts.map
./apps\memecoined\dist\src
./apps\memecoined\dist\src\application
./apps\memecoined\dist\src\domain
./apps\memecoined\dist\src\entrypoints
          composition.d.ts
          composition.d.ts.map
          composition.js
          composition.js.map
          dashboard.d.ts
          dashboard.d.ts.map
          dashboard.js
          dashboard.js.map
          main.d.ts
          main.d.ts.map
./apps\memecoined\dist\src\infrastructure
./apps\memecoined\dist\src\workers
          candidate-worker.d.ts
          candidate-worker.d.ts.map
          candidate-worker.js
          candidate-worker.js.map
          discovery-worker.d.ts
          discovery-worker.d.ts.map
          discovery-worker.js
          discovery-worker.js.map
          entry-worker.d.ts
          entry-worker.d.ts.map
./apps\memecoined\dist\tests
        setup.d.ts
        setup.d.ts.map
        setup.js
        setup.js.map
./apps\memecoined\dist\tests\contract
          dexscreener.test.d.ts
          dexscreener.test.d.ts.map
          dexscreener.test.js
          dexscreener.test.js.map
          helius-wallet-history.test.d.ts
          helius-wallet-history.test.d.ts.map
          helius-wallet-history.test.js
          helius-wallet-history.test.js.map
          helius-wallet-observations.test.d.ts
          helius-wallet-observations.test.d.ts.map
./apps\memecoined\dist\tests\e2e
          live-low-value.test.d.ts
          live-low-value.test.d.ts.map
          live-low-value.test.js
          live-low-value.test.js.map
          observation.test.d.ts
          observation.test.d.ts.map
          observation.test.js
          observation.test.js.map
          paper.test.d.ts
          paper.test.d.ts.map
./apps\memecoined\dist\tests\failure
          portfolio-production-readiness.test.d.ts
          portfolio-production-readiness.test.d.ts.map
          portfolio-production-readiness.test.js
          portfolio-production-readiness.test.js.map
          provider-outages.test.d.ts
          provider-outages.test.d.ts.map
          provider-outages.test.js
          provider-outages.test.js.map
          reconciliation-retry.test.d.ts
          reconciliation-retry.test.d.ts.map
./apps\memecoined\dist\tests\helpers
          builders.d.ts
          builders.d.ts.map
          builders.js
          builders.js.map
          database.d.ts
          database.d.ts.map
          database.js
          database.js.map
          fake-clock.d.ts
          fake-clock.d.ts.map
./apps\memecoined\dist\tests\integration
          candidate-discovery.test.d.ts
          candidate-discovery.test.d.ts.map
          candidate-discovery.test.js
          candidate-discovery.test.js.map
          candidate-evaluation-facts.test.d.ts
          candidate-evaluation-facts.test.d.ts.map
          candidate-evaluation-facts.test.js
          candidate-evaluation-facts.test.js.map
          candidate-evaluation-work.test.d.ts
          candidate-evaluation-work.test.d.ts.map
./apps\memecoined\dist\tests\replay
          determinism.test.d.ts
          determinism.test.d.ts.map
          determinism.test.js
          determinism.test.js.map
          no-lookahead.test.d.ts
          no-lookahead.test.d.ts.map
          no-lookahead.test.js
          no-lookahead.test.js.map
./apps\memecoined\dist\tests\security
          http-transport.test.d.ts
          http-transport.test.d.ts.map
          http-transport.test.js
          http-transport.test.js.map
          secrets.test.d.ts
          secrets.test.d.ts.map
          secrets.test.js
          secrets.test.js.map
          solana-instruction-parser.test.d.ts
          solana-instruction-parser.test.d.ts.map
./apps\memecoined\dist\tests\unit
          application-root.test.d.ts
          application-root.test.d.ts.map
          application-root.test.js
          application-root.test.js.map
          candidate-scoring.test.d.ts
          candidate-scoring.test.d.ts.map
          candidate-scoring.test.js
          candidate-scoring.test.js.map
          circuit-breakers.test.d.ts
          circuit-breakers.test.d.ts.map
./apps\memecoined\docs
      CHANGELOG.md
      DEPENDENCY_MANIFEST.md
      OPERATIONS_RUNBOOK.md
      PROJECT_MAP.md
      PROMOTION_GATES.md
      SECURITY_MODEL.md
      SERVICE_CONTRACTS.md
      STRATEGY_SPECIFICATION.md
      SYSTEM_SCHEMA.md
./apps\memecoined\frontend
      app.js
      index.html
      styles.css
./apps\memecoined\migrations
      0001_extensions.sql
      0002_reference.sql
      0003_observations.sql
      0004_decisions.sql
      0005_trading.sql
      0006_operations.sql
      0007_reporting.sql
      0008_reconciliation_jobs.sql
      0009_position_runtime_facts.sql
      0010_position_observations.sql
./apps\memecoined\scripts
      emergency-stop.ts
      generate-report.ts
      import-wallet-watchlist.ts
      migrate.ts
      reconcile-now.ts
      run-historical-evaluation.ts
      sanitize-fixture.ts
      verify-environment.ts
./apps\memecoined\src
./apps\memecoined\src\application
./apps\memecoined\src\application\contracts
          commands.ts
          events.ts
          observations.ts
          reports.ts
./apps\memecoined\src\application\ports
          chain.ts
          market.ts
          operator.ts
          repositories.ts
          runtime-authority-inputs.ts
          runtime.ts
          signer.ts
          stream.ts
          swap.ts
./apps\memecoined\src\application\services
          candidate-evaluation-work.ts
          candidate-pipeline.ts
          discovery.ts
          entry-planner.ts
          entry-preparation.ts
          entry-submission.ts
          execution-runtime-authority.ts
          execution.ts
          health.ts
          live-candidate-evaluation-facts.ts
./apps\memecoined\src\domain
./apps\memecoined\src\domain\candidate
          evaluator.ts
          model.ts
          scoring.ts
./apps\memecoined\src\domain\market
          model.ts
          momentum.ts
./apps\memecoined\src\domain\portfolio
          breakers.ts
          model.ts
          sizing.ts
./apps\memecoined\src\domain\shared
          errors.ts
          evidence.ts
          state-machine.ts
          types.ts
./apps\memecoined\src\domain\token
          security.ts
          token.ts
./apps\memecoined\src\domain\trading
          exits.ts
          order.ts
          position.ts
          quote.ts
./apps\memecoined\src\domain\wallet
          classifier.ts
          model.ts
          performance.ts
./apps\memecoined\src\entrypoints
        composition.ts
        dashboard.ts
        main.ts
        providers.ts
        telegram.ts
        worker.ts
./apps\memecoined\src\infrastructure
./apps\memecoined\src\infrastructure\config
          load-config.ts
          load-strategy.ts
./apps\memecoined\src\infrastructure\database
          candidate-discovery.ts
          candidate-evaluation-jobs.ts
          candidate-evaluations.ts
          candidate-wallet-confirmations.ts
          dashboard-trading-configurations.ts
          dashboard-watchlists.ts
          entry-preparations.ts
          entry-submissions.ts
          event-store.ts
          job-store.ts
./apps\memecoined\src\infrastructure\providers
          http-json.ts
./apps\memecoined\src\infrastructure\reporting
          csv-renderer.ts
          json-renderer.ts
          markdown-renderer.ts
./apps\memecoined\src\infrastructure\runtime
          application-root.ts
          escalation.ts
          evidence-id.ts
          id-generator.ts
          logger.ts
          managed-application.ts
          metrics.ts
          system-clock.ts
./apps\memecoined\src\infrastructure\security
          local-signer.ts
          redaction.ts
          secret-provider.ts
          transaction-inspector.ts
./apps\memecoined\src\workers
        candidate-worker.ts
        discovery-worker.ts
        entry-worker.ts
        health-worker.ts
        position-worker.ts
        reconciliation-worker.ts
        risk-worker.ts
        supervisor.ts
./apps\memecoined\tests
      setup.ts
./apps\memecoined\tests\contract
        dexscreener.test.ts
        helius-wallet-history.test.ts
        helius-wallet-observations.test.ts
        helius.test.ts
        jupiter.test.ts
        mint-security.test.ts
        optional-market.test.ts
        provider-clients.test.ts
        solana-wallet-inventory.test.ts
        solana.test.ts
./apps\memecoined\tests\e2e
        live-low-value.test.ts
        observation.test.ts
        paper.test.ts
        shadow.test.ts
./apps\memecoined\tests\failure
        portfolio-production-readiness.test.ts
        provider-outages.test.ts
        reconciliation-retry.test.ts
        reconciliation.test.ts
./apps\memecoined\tests\helpers
        builders.ts
        database.ts
        fake-clock.ts
        fake-ports.ts
./apps\memecoined\tests\integration
        candidate-discovery.test.ts
        candidate-evaluation-facts.test.ts
        candidate-evaluation-work.test.ts
        candidate-pipeline.test.ts
        entry-preparation.test.ts
        entry-submission.test.ts
        execution.test.ts
        job-runner.test.ts
        live-operational-safety-sources.test.ts
        live-portfolio-accounting-observation.test.ts
./apps\memecoined\tests\replay
        determinism.test.ts
        no-lookahead.test.ts
./apps\memecoined\tests\security
        http-transport.test.ts
        secrets.test.ts
        solana-instruction-parser.test.ts
        startup-config.test.ts
        transaction-inspection.test.ts
./apps\memecoined\tests\unit
        application-root.test.ts
        candidate-scoring.test.ts
        circuit-breakers.test.ts
        dashboard-trading-configurations.test.ts
        dashboard-watchlists.test.ts
        emergency-execution.test.ts
        emergency-exits.test.ts
        execution-runtime-authority.test.ts
        managed-application.test.ts
        momentum.test.ts
./apps\principaled
    index.html
    package-lock.json
    package.json
    vite.config.js
./apps\principaled\src
      main.jsx
      styles.css
./apps\principaled\src\api
        client.js
./apps\principaled\src\dashboard
        Index.jsx
./apps\principaled\src\dashboard\widgets
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
./packages
./packages\timsys-client
    package.json
./platform
  index.js
  jest.config.js
  package-lock.json
  package.json
./platform\config
    session-policy.json
./platform\contracts
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
./platform\data
    test_auth.sqlite
    test_auth.sqlite-shm
    test_auth.sqlite-wal
    test_boot_seq.sqlite
    test_boot_seq.sqlite-shm
    test_boot_seq.sqlite-wal
    test_db.sqlite
    test_db.sqlite-shm
    test_db.sqlite-wal
    test_e2e.sqlite
./platform\deploy
    backup.sh
    migrate.sh
    production.env.example
    rollback.sh
    setup-wizard.js
./platform\engine
./platform\engine\gap-analysis
      calculator.js
      index.js
./platform\engine\recommendation
      analyzer.js
      index.js
./platform\frontend
./platform\frontend\dashboard
      index.html
./platform\migrations
    000_bootstrap.sql
    001_initial.sql
    002_intelligence.sql
    003_rate_limit.sql
    004_recommendations.sql
    005_route_permissions.sql
    006_refresh_tokens.sql
    007_builder.sql
./platform\modules
./platform\modules\builder
      assembler.js
      composer.js
      index.js
      module.json
      templates.js
./platform\modules\builder\migrations
        .gitkeep
./platform\modules\inventory
      index.js
      module.json
./platform\modules\inventory\migrations
        001_inventory.sql
./platform\modules\room_registry
      index.js
      module.json
./platform\modules\room_registry\migrations
        001_rooms.sql
./platform\modules\school_analytics
      index.js
      module.json
./platform\modules\staff_profile
      component.json
      index.js
      module.json
./platform\modules\staff_registry
      index.js
      module.json
./platform\modules\staff_registry\migrations
        001_staff.sql
./platform\modules\student_profile
      component.json
      index.js
      module.json
./platform\modules\student_registry
      index.js
      module.json
./platform\modules\student_registry\migrations
        001_students.sql
./platform\routes
./platform\routes\introspect
      .gitkeep
./platform\scripts
    build-registries.js
./platform\scripts\cli
      builder.js
      migrate.js
      scaffold.js
      update-package.js
./platform\shared
    migration-runner.js
./platform\shared\middleware
      passwordChangeRequired.js
      visibilityCheck.js
./platform\shared\pipeline
      boot.js
      discover.js
      register.js
      resolve.js
      unstage.js
      validate.js
      wire.js
./platform\shared\registry
      capabilityRegistry.js
      componentRegistry.js
      componentScanner.js
      dependencyGraph.js
      functionRegistry.js
      moduleRegistry.js
      routeRegistry.js
      schemaRegistry.js
./platform\shared\services
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
./platform\shared\services\auto_rules
        index.js
./platform\shared\services\decision_log
        index.js
./platform\shared\services\event_store
        index.js
./platform\shared\services\intelligence
        index.js
        insights.js
        logic.js
        metadata.js
        store.js
./platform\shared\services\knowledge_store
        index.js
./platform\shared\services\notification
        index.js
./platform\shared\services\relationship_registry
        index.js
./platform\shared\services\snapshot
        index.js
./platform\shared\services\visibilityFilter
        index.js
./platform\tests
    builder.test.js
    intelligence.smoke.sh
    inventory.endpoint_smoke.sh
    profile.endpoint_smoke.sh
    room.endpoint_smoke.sh
    setup.js
    smoke-test.js
    staff.endpoint_smoke.sh
    student.endpoint_smoke.sh
./platform\tests\e2e
      boot-sequence.test.js
      boot.test.js
./platform\tests\helpers
      test-server.js
./platform\tests\integration
./platform\tests\integration\http
        auth.test.js
        password-prompt.test.js
        refresh-token.test.js
        security.test.js
        staging.test.js
./platform\tests\integration\staging
        pipeline.test.js
./platform\tests\unit
      contracts-verification.test.js
      intelligence.test.js
./platform\tests\unit\registries
        registries.test.js
./platform\tests\unit\services
        auth.test.js
        cache.test.js
        db.test.js
        events.test.js
        validate.test.js
./platform\Tools
    spawn_app.sh
    update_architecture_map.py
    update_architecture_map.sh
```

## Phase 0: Foundation Contracts

Location: `/platform/contracts/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `auth.js` | ✅ | 4046B | 2026-08-12 10:37:47 |
| `auto_rules.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `cache.js` | ✅ | 1594B | 2026-08-12 10:37:47 |
| `db.js` | ✅ | 2039B | 2026-08-12 10:37:47 |
| `decision_log.js` | ✅ | 2462B | 2026-08-12 10:37:47 |
| `event_store.js` | ✅ | 2494B | 2026-08-12 10:37:47 |
| `events.js` | ✅ | 1938B | 2026-08-12 10:37:47 |
| `intelligence.js` | ✅ | 2274B | 2026-08-12 10:37:47 |
| `knowledge_store.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `log.js` | ✅ | 1666B | 2026-08-12 10:37:47 |
| `notification.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `relationship_registry.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `snapshot.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `validate.js` | ✅ | 1315B | 2026-08-12 10:37:47 |

## Phase 1.1: Persistence / Service Layer

Location: `/platform/shared/services/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `audit.js` | ✅ | 2469B | 2026-08-12 10:37:48 |
| `auth.js` | ✅ | 3755B | 2026-08-12 10:37:48 |
| `cache.js` | ✅ | 3603B | 2026-08-12 10:37:48 |
| `csv_parser.js` | ✅ | 2882B | 2026-08-12 10:37:48 |
| `db.js` | ✅ | 2187B | 2026-08-12 12:36:40 |
| `email.js` | ✅ | 1735B | 2026-08-12 10:37:48 |
| `events.js` | ✅ | 2619B | 2026-08-12 10:37:48 |
| `log.js` | ✅ | 1152B | 2026-08-12 10:37:48 |
| `metrics.js` | ✅ | 4487B | 2026-08-12 10:37:48 |
| `ratelimit.js` | ✅ | 1535B | 2026-08-12 10:37:48 |
| `refresh.js` | ✅ | 4472B | 2026-08-12 10:37:48 |
| `session.js` | ✅ | 2827B | 2026-08-12 10:37:48 |
| `sse.js` | ✅ | 2854B | 2026-08-12 10:37:48 |
| `statusActions.js` | ✅ | 4569B | 2026-08-12 10:37:48 |
| `validate.js` | ✅ | 1558B | 2026-08-12 10:37:48 |

### Intelligence Service Package

Location: `/platform/shared/services/intelligence/`

| File | Exists | Size |
| ------ | ------ | ------ |
| `index.js` | ✅ | 980B |
| `insights.js` | ✅ | 10158B |
| `logic.js` | ✅ | 4897B |
| `metadata.js` | ✅ | 3692B |
| `store.js` | ✅ | 6408B |

## Phase 1.2: Registry Layer

Location: `/platform/shared/registry/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `capabilityRegistry.js` | ✅ | 3003B | 2026-08-12 10:37:48 |
| `componentRegistry.js` | ✅ | 3856B | 2026-08-12 10:37:48 |
| `componentScanner.js` | ✅ | 4978B | 2026-08-12 10:37:48 |
| `dependencyGraph.js` | ✅ | 4599B | 2026-08-12 10:37:48 |
| `functionRegistry.js` | ✅ | 2692B | 2026-08-12 10:37:48 |
| `moduleRegistry.js` | ✅ | 2974B | 2026-08-12 10:37:48 |
| `routeRegistry.js` | ✅ | 2212B | 2026-08-12 10:37:48 |
| `schemaRegistry.js` | ✅ | 2455B | 2026-08-12 10:37:48 |

## Phase 1.3: Staging Pipeline

Location: `/platform/shared/pipeline/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `boot.js` | ✅ | 3292B | 2026-08-12 10:37:48 |
| `discover.js` | ✅ | 1277B | 2026-08-12 12:22:38 |
| `register.js` | ✅ | 2850B | 2026-08-12 10:37:48 |
| `resolve.js` | ✅ | 2430B | 2026-08-12 10:37:48 |
| `unstage.js` | ✅ | 3234B | 2026-08-12 10:37:48 |
| `validate.js` | ✅ | 3919B | 2026-08-12 10:37:48 |
| `wire.js` | ✅ | 2390B | 2026-08-12 12:35:42 |

## Phase 5: HTTP Middleware

Location: `/platform/shared/middleware/`

| File | Exists | Size |
| ------ | ------ | ------ |
| `passwordChangeRequired.js` | ✅ | 1054B |
| `visibilityCheck.js` | ✅ | 3356B |

## Modules

Location: `/platform/modules/`

| Module | Manifest | Index | Component | Migrations | Type |
| ------ | -------- | ----- | --------- | ------------ | ---- |
| `builder` | ✅ | ✅ | ❌ | 0 | standard |
| `inventory` | ✅ | ✅ | ❌ | 1 | standard |
| `room_registry` | ✅ | ✅ | ❌ | 1 | registry |
| `school_analytics` | ✅ | ✅ | ❌ | 0 | standard |
| `staff_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `staff_registry` | ✅ | ✅ | ❌ | 1 | registry |
| `student_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `student_registry` | ✅ | ✅ | ❌ | 1 | registry |

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
- `calculator.js` (6296B)
- `index.js` (765B)

**`/engine/recommendation/`**
- `analyzer.js` (5322B)
- `index.js` (1196B)

## Data Layer

- `test_auth.sqlite` (565248B)
- `test_auth.sqlite-shm` (32768B)
- `test_auth.sqlite-wal` (4124152B)
- `test_boot_seq.sqlite` (4096B)
- `test_boot_seq.sqlite-shm` (32768B)
- `test_boot_seq.sqlite-wal` (0B)
- `test_db.sqlite` (4096B)
- `test_db.sqlite-shm` (32768B)
- `test_db.sqlite-wal` (976472B)
- `test_e2e.sqlite` (4096B)
- `test_e2e.sqlite-shm` (32768B)
- `test_e2e.sqlite-wal` (0B)
- `test_pipeline.sqlite` (552960B)
- `test_pipeline.sqlite-shm` (32768B)
- `test_pipeline.sqlite-wal` (4128272B)
- `test_pwd_prompt.sqlite` (565248B)
- `test_pwd_prompt.sqlite-shm` (32768B)
- `test_pwd_prompt.sqlite-wal` (4124152B)
- `test_refresh.sqlite` (565248B)
- `test_refresh.sqlite-shm` (32768B)
- `test_refresh.sqlite-wal` (4124152B)
- `test_registries.sqlite` (4096B)
- `test_registries.sqlite-shm` (32768B)
- `test_registries.sqlite-wal` (2418472B)
- `test_staging.sqlite` (565248B)
- `test_staging.sqlite-shm` (32768B)
- `test_staging.sqlite-wal` (4124152B)
- `timsys.db` (32768B)
- `timsys.sqlite` (589824B)
- `timsys.sqlite-shm` (32768B)
- `timsys.sqlite-wal` (0B)

## Applications

| Application | Status |
| ------------ | ------ |
| `launcher` | ✅ Ready |
| `memecoined` | ✅ Ready |
| `principaled` | ✅ Ready |

---

## Drift Detection

### Expected vs Found Discrepancies

- **Contracts extra (not expected):** auto_rules.js, decision_log.js, event_store.js, knowledge_store.js, notification.js, relationship_registry.js, snapshot.js

- **Services extra (not expected):** csv_parser.js, sse.js, statusActions.js

- ✅ All expected registries present, no extras.

- ✅ All expected pipeline files present, no extras.

### Expected Platform Directories

- ✅ `/platform/contracts/`
- ✅ `/platform/shared/services/`
- ✅ `/platform/shared/registry/`
- ✅ `/platform/shared/pipeline/`
- ✅ `/platform/modules/`
- ✅ `/platform/tests/`
- ✅ `/platform/Tools/`
- ✅ `/platform/data/`
- ✅ `/platform/routes/`
- ✅ `/platform/engine/gap-analysis/`
- ✅ `/platform/engine/recommendation/`

### Frozen Document Integrity

- CONSTITUTION_V6.0.md SHA256: `f71e0aaf18abc1c42ca4fc0b31c8b6c9c7f77f7ae1765ff84623e1cfec431fc3`
- LEXICON_V6.0.0.md SHA256: `91cdfb6f9a559fb02eede87aa6caaaa108aa52b7571f422274cc6509bff2d93a`
- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.

### Summary

- ⚠️ **Drift detected.** Compare against Constitution/Context for discrepancies.

---
End of Architecture Map.