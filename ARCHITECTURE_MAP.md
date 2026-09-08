# TimSyS Architecture Map
Generated: 2026-09-08T18:10:47Z
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
| `CONTEXT.md` | ✅ | 12401B | 2026-08-12 21:13:27 |
| `ARCHITECTURE_MAP.md` | ✅ | 44595B | 2026-09-08 16:54:00 |
| `HANDOVER.md` | ✅ | 19037B | 2026-09-05 07:54:06 |
| `CONSTITUTION_V6.0.md` | ✅ | 25342B | 2026-08-12 21:11:41 |
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
  package.json
./apps
./apps\dressed
    .env.example
    .gitignore
    README.md
    package-lock.json
    package.json
    pnpm-lock.yaml
    pnpm-workspace.yaml
    timsys.app.json
    tsconfig.json
    vite.config.ts
./apps\dressed\config
      .gitkeep
./apps\dressed\cv_service
      pyproject.toml
./apps\dressed\cv_service\dressed_cv
        __init__.py
        contract.py
./apps\dressed\cv_service\dressed_cv\api
          .gitkeep
./apps\dressed\cv_service\dressed_cv\calibration
          .gitkeep
./apps\dressed\cv_service\dressed_cv\fingerprint
          .gitkeep
./apps\dressed\cv_service\dressed_cv\image_quality
          .gitkeep
./apps\dressed\cv_service\fixtures
        .gitkeep
./apps\dressed\cv_service\tests
        .gitkeep
./apps\dressed\docs
      ARCHITECTURE.md
      CV_CONTRACT.md
      DATABASE_SCHEMA.md
      DECISIONS.md
      ENSEMBLE_ENGINE.md
      FOUNDATION.md
      INSIGHTS.md
      LIFECYCLE.md
      PHOTOGRAPHY.md
      PLANNER_OPTIMISATION.md
./apps\dressed\frontend
      index.html
./apps\dressed\frontend\src
        main.jsx
./apps\dressed\frontend\src\api
          .gitkeep
./apps\dressed\frontend\src\app
          .gitkeep
./apps\dressed\frontend\src\components
          .gitkeep
./apps\dressed\frontend\src\features
          .gitkeep
./apps\dressed\frontend\src\styles
          .gitkeep
          app.css
./apps\dressed\migrations
      .gitkeep
      0000_foundation.sql
      0001_wardrobe_catalogue.sql
      0002_photography.sql
      0003_visual_fingerprint.sql
      0004_styling_rules.sql
      0005_ensemble_engine.sql
      0006_planner.sql
      0007_lifecycle.sql
      0008_insights_refinement.sql
./apps\dressed\scripts
      .gitkeep
      migrate.ts
./apps\dressed\src
      index.ts
./apps\dressed\src\application
./apps\dressed\src\application\contracts
          .gitkeep
          cv.ts
          evidence.ts
          health.ts
          jobs.ts
          platform.ts
./apps\dressed\src\application\ports
          .gitkeep
          cv.ts
          jobs.ts
          runtime.ts
./apps\dressed\src\application\services
          .gitkeep
./apps\dressed\src\domain
./apps\dressed\src\domain\garment
          .gitkeep
          garment.ts
          photography.ts
          visual-fingerprint.ts
./apps\dressed\src\domain\lifecycle
          .gitkeep
./apps\dressed\src\domain\outfit
          .gitkeep
          ensemble-engine.ts
          styling-engine.ts
./apps\dressed\src\domain\planner
          rotation-engine.ts
./apps\dressed\src\domain\planning
          .gitkeep
./apps\dressed\src\domain\shared
          .gitkeep
          errors.ts
          state-machine.ts
          types.ts
./apps\dressed\src\entrypoints
        .gitkeep
        api.ts
./apps\dressed\src\infrastructure
./apps\dressed\src\infrastructure\config
          .gitkeep
          load-config.ts
./apps\dressed\src\infrastructure\database
          .gitkeep
          ensemble-repository.ts
          fingerprint-repository.ts
          insights-repository.ts
          lifecycle-repository.ts
          photography-repository.ts
          planner-repository.ts
          pool.ts
          styling-repository.ts
          wardrobe-repository.ts
./apps\dressed\src\infrastructure\images
          .gitkeep
          image-validation.ts
          private-image-store.ts
          visual-fingerprint-engine.ts
./apps\dressed\src\infrastructure\runtime
          .gitkeep
          application-root.ts
          cv-http-client.ts
          id-generator.ts
          redaction.ts
          system-clock.ts
./apps\dressed\src\workers
        .gitkeep
./apps\dressed\storage
./apps\dressed\storage\derived
        .gitkeep
./apps\dressed\storage\images
        .gitkeep
./apps\dressed\tests
./apps\dressed\tests\contract
        .gitkeep
        cv-contract.test.ts
./apps\dressed\tests\e2e
        .gitkeep
./apps\dressed\tests\fixtures
        .gitkeep
./apps\dressed\tests\integration
        .gitkeep
        api.test.ts
./apps\dressed\tests\replay
        .gitkeep
./apps\dressed\tests\unit
        .gitkeep
        database-pool.test.ts
        ensemble-engine.test.ts
        foundation.test.ts
        garment.test.ts
        photography.test.ts
        platform-contract.test.ts
        rotation-engine.test.ts
        styling-engine.test.ts
        visual-fingerprint.test.ts
./apps\launcher
    README.md
    index.html
    package-lock.json
    package.json
    postcss.config.js
    tailwind.config.js
    vite.config.js
./apps\launcher\.cache
      postgresql-18.4-1-windows-x64-binaries.zip
      postgresql-18.4-1-windows-x64-binaries.zip.sha256
./apps\launcher\.cache\electron
        electron-v43.2.0-win32-x64.zip
./apps\launcher\.cache\electron-builder
./apps\launcher\.cache\electron-builder\nsis
./apps\launcher\.cache\postgres
        StackBuilder_3rd_party_licenses.txt
        commandlinetools_3rd_party_licenses.txt
        pgAdmin_3rd_party_licenses.txt
        pgAdmin_license.txt
        server_license.txt
./apps\launcher\.cache\postgres\bin
          clusterdb.exe
          createdb.exe
          createuser.exe
          dropdb.exe
          dropuser.exe
          ecpg.exe
          icudt77.dll
          icuin77.dll
          icuio77.dll
          icutu77.dll
./apps\launcher\.cache\postgres\doc
          README-pldebugger.md
./apps\launcher\.cache\postgres\include
          autosprintf.h
          ecpg_config.h
          ecpg_informix.h
          ecpgerrno.h
          ecpglib.h
          ecpgtype.h
          gettext-po.h
          gettext.h
          iconv.h
          libcharset.h
./apps\launcher\.cache\postgres\lib
          _int.dll
          amcheck.dll
          auth_delay.dll
          auto_explain.dll
          autoinc.dll
          basebackup_to_shell.dll
          basic_archive.dll
          bloom.dll
          bool_plperl.dll
          btree_gin.dll
./apps\launcher\.cache\postgres\pgAdmin 4
./apps\launcher\.cache\postgres\share
          errcodes.txt
          information_schema.sql
          pg_hba.conf.sample
          pg_ident.conf.sample
          pg_service.conf.sample
          postgres.bki
          postgresql.conf.sample
          psqlrc.sample
          snowball_create.sql
          sql_features.txt
./apps\launcher\.cache\postgres\StackBuilder
./apps\launcher\electron
      ai-credential-vault.cjs
      ai-credential-vault.test.cjs
      local-postgres-manager.cjs
      local-postgres-manager.test.cjs
      main.cjs
      preload.cjs
      runtime-layout.cjs
      runtime-layout.test.cjs
      runtime-recovery.cjs
      runtime-recovery.test.cjs
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
          platform.ts
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
          acquisition-schedule.ts
          candidate-evaluation-work.ts
          candidate-pipeline.ts
          discovery.ts
          entry-planner.ts
          entry-preparation.ts
          entry-submission.ts
          execution-runtime-authority.ts
          execution.ts
          health.ts
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
          acquisition-schedule.ts
          candidate-discovery.ts
          candidate-evaluation-jobs.ts
          candidate-evaluations.ts
          candidate-wallet-confirmations.ts
          dashboard-trading-configurations.ts
          dashboard-watchlists.ts
          entry-preparations.ts
          entry-submissions.ts
          event-store.ts
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
          low-value-trial-gate.ts
          managed-application.ts
          metrics.ts
          provider-readiness.ts
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
        failure-recovery.test.ts
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
        acquisition-schedule.test.ts
        candidate-discovery.test.ts
        candidate-evaluation-facts.test.ts
        candidate-evaluation-work.test.ts
        candidate-pipeline.test.ts
        entry-preparation.test.ts
        entry-submission.test.ts
        execution.test.ts
        job-runner.test.ts
        live-entry-reconciliation.test.ts
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
        dashboard-ui-standards.test.ts
        dashboard-watchlists.test.ts
        emergency-execution.test.ts
        emergency-exits.test.ts
        execution-runtime-authority.test.ts
        live-entry-planning.test.ts
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
./apps\principaled\src\dashboard\components
          CommunicationHistoryConsole.jsx
          EventAttendanceRoster.jsx
          EventAttendanceWorkspace.jsx
          GradebookSetupPanel.jsx
          LateEntryReviewPanel.jsx
          Pagination.jsx
          ProfileEvidenceSections.jsx
          ProfileExtendedEditor.jsx
          ProgrammeSetupWizard.jsx
          RegistryRelatedPanel.jsx
./apps\principaled\src\dashboard\widgets
          ApprovalsWidget.jsx
          BuilderWorkspace.jsx
          CalendarWidget.jsx
          CateringWidget.jsx
          CommunicationsWidget.jsx
          ContingencyWidget.jsx
          CoordinationWidget.jsx
          CoverWidget.jsx
          CsvImportResult.jsx
          DocumentsWidget.jsx
./apps\researched
    .env.example
    .gitignore
    README.md
    eng.traineddata
    package-lock.json
    package.json
    timsys.app.json
    tsconfig.json
    vite.config.ts
    vitest.config.ts
./apps\researched\frontend
      index.html
./apps\researched\frontend\src
        main.jsx
        styles.css
./apps\researched\migrations
      0001_research_core.sql
      0002_source_acquisition.sql
      0003_source_extraction.sql
      0004_evidence_capture.sql
      0005_findings.sql
      0006_reports.sql
      0007_lifecycle_indexes.sql
      0008_discovery_queue.sql
      0009_analysis_plans.sql
      0010_evidence_locators.sql
./apps\researched\scripts
      migrate.ts
./apps\researched\src
./apps\researched\src\application
        ai-analysis.ts
        analysis-export.ts
        analysis-jobs.ts
        cross-source-analysis.ts
        deterministic-analysis.ts
        link-discovery.ts
        reporting.ts
        research-insights.ts
        source-acquisition.ts
        source-extraction.ts
./apps\researched\src\domain
        analysis-results.ts
        analysis.ts
        contracts.ts
        lifecycle.ts
./apps\researched\src\entrypoints
        api.ts
./apps\researched\src\infrastructure
        config.ts
        repository.ts
./apps\researched\tests
      ai-analysis.test.ts
      analysis-export.test.ts
      analysis-jobs.test.ts
      analysis-plan-contract.test.ts
      analysis-results.test.ts
      analysis.test.ts
      api.test.ts
      cross-source-analysis.test.ts
      foundation.test.ts
      lifecycle.test.ts
./apps\shared-ui
    package.json
./apps\shared-ui\react
      index.js
      pagination.jsx
      primitives.jsx
      use-draft.js
      use-unsaved-changes.js
./apps\shared-ui\styles
      timsys-dark.css
./apps\shared-ui\vanilla
      index.js
./build-tools
  npm-metadata.cjs
  npm.cmd
./docs
  PLATFORM_ACCEPTANCE_REPORT_2026-08-29.md
  PLATFORM_EXTRACTION.md
  UI_CAPABILITY_COVERAGE.md
  UI_INTERACTION_STANDARD.md
./docs\architecture
    GRADEBOOK_DECOMPOSITION.md
    LATE_ENTRIES_DECOMPOSITION.md
    SCHEDULER_DECOMPOSITION.md
    STUDENT_EXITS_DECOMPOSITION.md
./packages
./packages\timsys-client
    package.json
./platform
  index.js
  jest.config.js
  package-lock.json
  package.json
  timsys.app.json
./platform\architecture
    event-management-components.json
./platform\config
    session-policy.json
./platform\contracts
    auth.js
    auto_rules.js
    cache.js
    cover.js
    db.js
    decision_log.js
    event_store.js
    events.js
    gradebook.js
    intelligence.js
./platform\data
    contribution-test.sqlite
    decision-full-test.sqlite
    engine-hardening-full.sqlite
    foundation-contract-test.sqlite
    foundation-test-2.sqlite
    foundation-test.sqlite
    historical-final-test.sqlite
    historical-full-test.sqlite
    test_auth.sqlite
    test_auth.sqlite-shm
./platform\data\timsys.sqlite.documents
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
    008_app_composition.sql
    009_world_model.sql
./platform\modules
./platform\modules\academic_commentary
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\academic_commentary\migrations
        001_academic_commentary.sql
./platform\modules\academic_structure
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\academic_structure\migrations
        001_academic_structure.sql
./platform\modules\approvals
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\approvals\migrations
        001_approvals.sql
./platform\modules\assessment_evidence
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\assessment_evidence\migrations
        001_assessment_evidence.sql
./platform\modules\assessment_scales
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\assessment_scales\migrations
        001_assessment_scales.sql
./platform\modules\attendance
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\attendance\migrations
        001_attendance.sql
./platform\modules\audiences
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\audiences\migrations
        001_audiences.sql
./platform\modules\builder
      app-catalog.js
      assembler.js
      composer.js
      index.js
      lifecycle.js
      module.json
      templates.js
      ui-standard.js
./platform\modules\builder\migrations
        .gitkeep
./platform\modules\calendar
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\calendar\migrations
        001_calendar.sql
        002_calendar_entry_contract.sql
        003_calendar_completion.sql
./platform\modules\catering
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\catering\migrations
        001_catering.sql
./platform\modules\classroom_attendance
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\classroom_attendance\migrations
        001_classroom_attendance.sql
        002_late_entry_reconciliation_contract.sql
./platform\modules\communications
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\communications\migrations
        001_communications.sql
./platform\modules\contingency
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\contingency\migrations
        001_contingency.sql
./platform\modules\cover
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\cover\migrations
        001_cover_policy.sql
        002_cover_intake.sql
        003_cover_recommendations.sql
        004_cover_assignments.sql
        005_cover_assignment_overlap_guard.sql
./platform\modules\documents
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\documents\migrations
        001_documents.sql
./platform\modules\evaluation_policies
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\evaluation_policies\migrations
        001_evaluation_policies.sql
        002_policy_assignment_history.sql
./platform\modules\event_planner
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\event_record
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\event_record\migrations
        001_event_record.sql
./platform\modules\financial_planning
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\financial_planning\migrations
        001_financial_planning.sql
./platform\modules\gradebook
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\gradebook_core
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\gradebook_core\migrations
        001_gradebook_core.sql
./platform\modules\gradebook_workspace
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\grade_evaluation
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\grade_evaluation\migrations
        001_grade_evaluation.sql
./platform\modules\grade_reporting
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\grade_reporting\migrations
        001_grade_reporting.sql
./platform\modules\intelligence_center
      index.js
      module.json
./platform\modules\inventory
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\inventory\migrations
        001_inventory.sql
        002_app_scope.sql
./platform\modules\invitations
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\invitations\migrations
        001_invitations.sql
./platform\modules\late_entries
      CONTRACT.md
      access.js
      analytics.js
      component.json
      dashboard.js
      equivalence.js
      hardening.js
      index.js
      intake.js
      module.json
./platform\modules\late_entries\migrations
        001_late_entries_foundation.sql
        002_late_entry_schedule_context.sql
        003_late_entry_reconciliation.sql
        004_late_entry_equivalence.sql
        005_late_entry_threshold_workflows.sql
        006_late_entry_hardening.sql
./platform\modules\learning_behaviours
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\learning_behaviours\migrations
        001_learning_behaviours.sql
./platform\modules\learning_standards
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\learning_standards\migrations
        001_learning_standards.sql
./platform\modules\medical_referrals
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\medical_referrals\migrations
        001_medical_referrals.sql
./platform\modules\ownership
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\ownership\migrations
        001_ownership.sql
./platform\modules\programme_manager
      CONTRACT.md
      allocations.js
      component.json
      decisions.js
      enrolments.js
      identity.js
      index.js
      module.json
      offerings.js
      responses.js
./platform\modules\programme_manager\migrations
        001_programme_foundation.sql
        002_programme_setup.sql
        003_programme_templates.sql
        004_programme_offerings.sql
        005_programme_surveys.sql
        006_programme_responses.sql
        007_identity_reconciliation.sql
        008_allocation_recommendations.sql
        009_allocation_decisions.sql
        010_enrolments_and_attendance_handoffs.sql
./platform\modules\resource_reservations
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\resource_reservations\migrations
        001_resource_reservations.sql
./platform\modules\risk_assessments
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\risk_assessments\migrations
        001_risk_assessments.sql
./platform\modules\room_registry
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\room_registry\migrations
        001_rooms.sql
        002_room_building_text.sql
        003_app_scope.sql
./platform\modules\safeguarding_requirements
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\safeguarding_requirements\migrations
        001_safeguarding_requirements.sql
./platform\modules\scheduler
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\scheduler\migrations
        001_scheduler_setup.sql
        002_scheduler_structures.sql
        003_scheduler_rules.sql
        004_scheduler_requirements.sql
        005_scheduler_versions.sql
        006_scheduler_publication.sql
        007_scheduler_hardening.sql
./platform\modules\school_analytics
      index.js
      module.json
./platform\modules\staff_profile
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\staff_registry
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\staff_registry\migrations
        001_staff.sql
./platform\modules\student_exits
      CONTRACT.md
      access.js
      campus.js
      component.json
      index.js
      insights.js
      module.json
      operations.js
      relationships.js
./platform\modules\student_exits\migrations
        001_student_exits_foundation.sql
        002_student_exits_governance.sql
        003_student_exits_campus_custody.sql
        004_student_exits_relationships.sql
        005_student_exits_operations.sql
./platform\modules\student_profile
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\student_registry
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\student_registry\migrations
        001_students.sql
./platform\modules\system_health
      index.js
      module.json
./platform\modules\tasks
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\tasks\migrations
        001_tasks.sql
./platform\modules\teacher_preferences
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\teacher_preferences\migrations
        001_teacher_preferences.sql
./platform\modules\transportation
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\transportation\migrations
        001_transportation.sql
./platform\modules\venue_bookings
      CONTRACT.md
      component.json
      index.js
      module.json
./platform\modules\venue_bookings\migrations
        001_venue_bookings.sql
./platform\packages
./platform\packages\app-sdk
      index.cjs
      index.d.ts
      index.js
      index.test.cjs
      package.json
./platform\routes
./platform\routes\introspect
      .gitkeep
./platform\scripts
./platform\scripts\cli
      builder.js
      migrate.js
      scaffold.js
      update-package.js
./platform\shared
    migration-runner.js
    schema-contract.js
./platform\shared\contracts
      analysis-engine-result.v1.json
      analysis-engine.v1.json
      application-protocol.v1.json
      application-ui-standard.json
      applicationProtocol.js
      componentContract.js
      domain-events.v1.json
      intelligenceContribution.js
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
      appScope.js
      audit.js
      auth.js
      cache.js
      csv_parser.js
      db.js
      email.js
      events.js
      gradebookAccess.js
      log.js
./platform\shared\services\auto_rules
        index.js
./platform\shared\services\decision_log
        index.js
./platform\shared\services\event_store
        index.js
./platform\shared\services\intelligence
        health.js
        index.js
        logic.js
        metadata.js
        metrics.js
        products.js
        providerRunner.js
        scheduler.js
        store.js
        trendAnalysis.js
./platform\shared\services\intelligence\providers
          component-operations.js
          cover-operations.js
          cross-component.js
          operational-strengths.js
          principal-operations.js
          registry-quality.js
          withdrawal-patterns.js
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
./platform\shared\services\world_model
        backfill.js
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
      cross-component-intelligence.test.js
      data-quality-intelligence.test.js
      decision-outcome-loop.test.js
      engine-operations.test.js
      gradebook-module.test.js
      historical-intelligence.test.js
      insight-visibility.test.js
      intelligence-health.test.js
./platform\tests\helpers
      test-server.js
./platform\tests\integration
./platform\tests\integration\http
        academic-structure.test.js
        approvals.test.js
        assessment-evidence.test.js
        assessment-scales.test.js
        builder-catalogue.test.js
        calendar.test.js
        catering.test.js
        communications.test.js
        contingency.test.js
        coordination.test.js
./platform\tests\integration\staging
        pipeline.test.js
./platform\tests\unit
      admin-app-baseline.test.js
      analysis-engine-contract.test.js
      application-protocol.test.js
      contracts-verification.test.js
      cover-contract.test.js
      gradebook-contract.test.js
      gradebook-hardening.test.js
      independent-app-boundaries.test.js
      intelligence-contribution.test.js
      intelligence.test.js
./platform\tests\unit\registries
        registries.test.js
./platform\tests\unit\services
        auth.test.js
        cache.test.js
        csv-parser.test.js
        db.test.js
        events.test.js
        validate.test.js
./platform\Tools
    spawn_app.sh
    update_architecture_map.py
    update_architecture_map.sh
./scripts
  audit-ui-coverage.mjs
  build-windows-artifacts.mjs
  fetch-postgres.mjs
  preflight.mjs
  prepare-windows-runtime.mjs
  run-memecoined-paper-trial.cjs
  smoke-windows-runtime.cjs
  verify-windows-runtime.mjs
  workspace.mjs
./tools
```

## Phase 0: Foundation Contracts

Location: `/platform/contracts/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `auth.js` | ✅ | 4046B | 2026-08-12 10:37:47 |
| `auto_rules.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `cache.js` | ✅ | 1594B | 2026-08-12 10:37:47 |
| `cover.js` | ✅ | 7442B | 2026-08-14 10:22:33 |
| `db.js` | ✅ | 2039B | 2026-08-12 10:37:47 |
| `decision_log.js` | ✅ | 2462B | 2026-08-12 10:37:47 |
| `event_store.js` | ✅ | 2494B | 2026-08-12 10:37:47 |
| `events.js` | ✅ | 1938B | 2026-08-12 10:37:47 |
| `gradebook.js` | ✅ | 2671B | 2026-08-13 20:31:29 |
| `intelligence.js` | ✅ | 2335B | 2026-08-12 21:10:26 |
| `knowledge_store.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `log.js` | ✅ | 1666B | 2026-08-12 10:37:47 |
| `notification.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `programmeManager.js` | ✅ | 4747B | 2026-08-21 11:00:18 |
| `relationship_registry.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `scheduler.js` | ✅ | 7080B | 2026-08-13 22:25:53 |
| `snapshot.js` | ✅ | 0B | 2026-08-12 10:37:47 |
| `teacherPreferences.js` | ✅ | 3613B | 2026-08-13 23:54:35 |
| `validate.js` | ✅ | 1315B | 2026-08-12 10:37:47 |

## Phase 1.1: Persistence / Service Layer

Location: `/platform/shared/services/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `appScope.js` | ✅ | 604B | 2026-09-05 07:52:25 |
| `audit.js` | ✅ | 2599B | 2026-08-28 22:46:39 |
| `auth.js` | ✅ | 3755B | 2026-08-12 10:37:48 |
| `cache.js` | ✅ | 3603B | 2026-08-12 10:37:48 |
| `csv_parser.js` | ✅ | 4208B | 2026-08-12 23:04:03 |
| `db.js` | ✅ | 2187B | 2026-08-12 12:36:40 |
| `email.js` | ✅ | 1735B | 2026-08-12 10:37:48 |
| `events.js` | ✅ | 2619B | 2026-08-12 10:37:48 |
| `gradebookAccess.js` | ✅ | 1207B | 2026-08-13 21:51:34 |
| `log.js` | ✅ | 1152B | 2026-08-12 10:37:48 |
| `metrics.js` | ✅ | 4611B | 2026-08-28 22:46:38 |
| `ratelimit.js` | ✅ | 1535B | 2026-08-12 10:37:48 |
| `refresh.js` | ✅ | 4472B | 2026-08-12 10:37:48 |
| `reportingPeriods.js` | ✅ | 1244B | 2026-08-13 21:51:35 |
| `session.js` | ✅ | 2957B | 2026-08-28 22:46:41 |
| `sse.js` | ✅ | 2854B | 2026-08-12 10:37:48 |
| `statusActions.js` | ✅ | 7624B | 2026-08-13 12:15:15 |
| `systemHealth.js` | ✅ | 4043B | 2026-08-13 19:27:14 |
| `validate.js` | ✅ | 1558B | 2026-08-12 13:17:56 |

### Intelligence Service Package

Location: `/platform/shared/services/intelligence/`

| File | Exists | Size |
| ------ | ------ | ------ |
| `health.js` | ✅ | 3003B |
| `index.js` | ✅ | 2178B |
| `logic.js` | ✅ | 4897B |
| `metadata.js` | ✅ | 3692B |
| `metrics.js` | ✅ | 1533B |
| `products.js` | ✅ | 6253B |
| `providerRunner.js` | ✅ | 2925B |
| `scheduler.js` | ✅ | 1773B |
| `store.js` | ✅ | 4676B |
| `trendAnalysis.js` | ✅ | 1371B |
| `workflow.js` | ✅ | 8292B |

## Phase 1.2: Registry Layer

Location: `/platform/shared/registry/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `capabilityRegistry.js` | ✅ | 3003B | 2026-08-12 10:37:48 |
| `componentRegistry.js` | ✅ | 4624B | 2026-08-13 19:27:09 |
| `componentScanner.js` | ✅ | 4781B | 2026-08-13 19:36:07 |
| `dependencyGraph.js` | ✅ | 5007B | 2026-08-13 18:32:17 |
| `functionRegistry.js` | ✅ | 2692B | 2026-08-12 10:37:48 |
| `moduleRegistry.js` | ✅ | 3320B | 2026-08-13 19:07:19 |
| `routeRegistry.js` | ✅ | 2212B | 2026-08-12 10:37:48 |
| `schemaRegistry.js` | ✅ | 2455B | 2026-08-12 10:37:48 |

## Phase 1.3: Staging Pipeline

Location: `/platform/shared/pipeline/`

| File | Exists | Size | Last Modified |
| ------ | ------ | ------ | --------------- |
| `boot.js` | ✅ | 3292B | 2026-08-12 10:37:48 |
| `discover.js` | ✅ | 1343B | 2026-08-12 21:08:02 |
| `register.js` | ✅ | 2942B | 2026-08-13 11:48:05 |
| `resolve.js` | ✅ | 2834B | 2026-08-13 18:32:19 |
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
| `academic_commentary` | ✅ | ✅ | ✅ | 1 | academic_operations |
| `academic_structure` | ✅ | ✅ | ✅ | 1 | academic_foundation |
| `approvals` | ✅ | ✅ | ✅ | 1 | workflow |
| `assessment_evidence` | ✅ | ✅ | ✅ | 1 | academic_operations |
| `assessment_scales` | ✅ | ✅ | ✅ | 1 | academic_configuration |
| `attendance` | ✅ | ✅ | ✅ | 1 | participation |
| `audiences` | ✅ | ✅ | ✅ | 1 | people |
| `builder` | ✅ | ✅ | ❌ | 0 | standard |
| `calendar` | ✅ | ✅ | ✅ | 3 | scheduling |
| `catering` | ✅ | ✅ | ✅ | 1 | logistics |
| `classroom_attendance` | ✅ | ✅ | ✅ | 2 | academic_operations |
| `communications` | ✅ | ✅ | ✅ | 1 | communication |
| `contingency` | ✅ | ✅ | ✅ | 1 | resilience |
| `cover` | ✅ | ✅ | ✅ | 5 | operational_component |
| `documents` | ✅ | ✅ | ✅ | 1 | content |
| `evaluation_policies` | ✅ | ✅ | ✅ | 2 | academic_governance |
| `event_planner` | ✅ | ✅ | ✅ | 0 | composite_module |
| `event_record` | ✅ | ✅ | ✅ | 1 | planning_core |
| `financial_planning` | ✅ | ✅ | ✅ | 1 | finance |
| `grade_evaluation` | ✅ | ✅ | ✅ | 1 | academic_evaluation |
| `grade_reporting` | ✅ | ✅ | ✅ | 1 | academic_reporting |
| `gradebook` | ✅ | ✅ | ✅ | 0 | composite_module |
| `gradebook_core` | ✅ | ✅ | ✅ | 1 | academic_operations |
| `gradebook_workspace` | ✅ | ✅ | ✅ | 0 | academic_operations |
| `intelligence_center` | ✅ | ✅ | ❌ | 0 | standard |
| `inventory` | ✅ | ✅ | ✅ | 2 | stuff |
| `invitations` | ✅ | ✅ | ✅ | 1 | people |
| `late_entries` | ✅ | ✅ | ✅ | 6 | operational_component |
| `learning_behaviours` | ✅ | ✅ | ✅ | 1 | academic_operations |
| `learning_standards` | ✅ | ✅ | ✅ | 1 | academic_configuration |
| `medical_referrals` | ✅ | ✅ | ✅ | 1 | health_sensitive |
| `ownership` | ✅ | ✅ | ✅ | 1 | workflow |
| `programme_manager` | ✅ | ✅ | ✅ | 10 | composite_module |
| `resource_reservations` | ✅ | ✅ | ✅ | 1 | stuff |
| `risk_assessments` | ✅ | ✅ | ✅ | 1 | safety |
| `room_registry` | ✅ | ✅ | ✅ | 3 | place |
| `safeguarding_requirements` | ✅ | ✅ | ✅ | 1 | safety_sensitive |
| `scheduler` | ✅ | ✅ | ✅ | 7 | operational_component |
| `school_analytics` | ✅ | ✅ | ❌ | 0 | standard |
| `staff_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `staff_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `student_exits` | ✅ | ✅ | ✅ | 5 | operational_component |
| `student_profile` | ✅ | ✅ | ✅ | 0 | profile |
| `student_registry` | ✅ | ✅ | ✅ | 1 | registry |
| `system_health` | ✅ | ✅ | ❌ | 0 | standard |
| `tasks` | ✅ | ✅ | ✅ | 1 | workflow |
| `teacher_preferences` | ✅ | ✅ | ✅ | 1 | operational_component |
| `transportation` | ✅ | ✅ | ✅ | 1 | logistics |
| `venue_bookings` | ✅ | ✅ | ✅ | 1 | places |

## CLI Tools

Location: `/platform/scripts/cli/`

| File | Exists | Purpose |
| ------ | ------ | ------- |
| `builder.js` | ✅ | App assembly |
| `migrate.js` | ✅ | Database migrations |
| `scaffold.js` | ✅ | Module generation |
| `update-package.js` | ✅ | (other) |

## Phase 7: Testing Layer

- `/tests/unit/services/` — 6 test file(s)
- `/tests/unit/registries/` — 1 test file(s)
- `/tests/integration/staging/` — 1 test file(s)
- `/tests/integration/http/` — 58 test file(s)
- `/tests/e2e/` — 15 test file(s)

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
- `analyzer.js` (5517B)
- `index.js` (1196B)

## Data Layer

- `contribution-test.sqlite` (729088B)
- `decision-full-test.sqlite` (802816B)
- `engine-hardening-full.sqlite` (831488B)
- `foundation-contract-test.sqlite` (684032B)
- `foundation-test-2.sqlite` (724992B)
- `foundation-test.sqlite` (724992B)
- `historical-final-test.sqlite` (774144B)
- `historical-full-test.sqlite` (774144B)
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
- `timsys.sqlite` (3637248B)
- `workspace-full-test.sqlite` (802816B)

## Applications

| Application / package | Kind | Status |
| --------------------- | ---- | ------ |
| `dressed` | application | ✅ Ready |
| `launcher` | application | ✅ Ready |
| `memecoined` | application | ✅ Ready |
| `principaled` | application | ✅ Ready |
| `researched` | application | ✅ Ready |
| `shared-ui` | shared library | ✅ Ready |

---

## Drift Detection

### Expected vs Found Discrepancies

- ✅ All expected contracts present, no extras.

- ✅ All expected services present, no extras.

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

- CONSTITUTION_V6.0.md SHA256: `0867b8d27d8d79bea1efc9711ca01d7f0202b13827741a915157726f861bae4d`
- LEXICON_V6.0.0.md SHA256: `91cdfb6f9a559fb02eede87aa6caaaa108aa52b7571f422274cc6509bff2d93a`
- Store these hashes. Any change indicates a frozen document was modified. Halt and investigate.

### Summary

- ✅ No structural drift detected.

---
End of Architecture Map.