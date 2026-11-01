# Consolidated TimSyS backend ownership

The isolated source consolidates the remaining backend code in one migration. Apps contain UI assets, UI build configuration, declarations and the minimal desktop bootstrap. They do not contain service implementations, repositories, authoritative domain engines, SQL migrations, job workers, provider transports or backend runtime dependencies.

| TimSyS location | Responsibility |
| --- | --- |
| platform/services/wardrobe, photography, styling | Previously completed versioned Dress contracts |
| platform/services/dressed | Remaining planning/rotation, care/lifecycle, wear records, insights/preferences, saved-outfit edits, configuration and CV scaffolding |
| platform/services/researched | All research APIs, repositories, migrations, acquisition/extraction/OCR, analysis/report/export jobs, AI transport, frozen instruments and analysis configurations |
| platform/services/tradeed | Trading worker/dashboard/Telegram entrypoints, repositories, migrations, providers, execution/accounting/risk/recovery and reporting |
| platform/native/desktop | Native supervision, database lifecycle, backup/recovery, AI credential/OAuth transports, updates and OS/window bridges |
| platform/modules | Existing shared/school services; Principal'Ed consumes their pinned HTTP namespace |

The central registry is platform/services/domain-services.json. Backend process manifests resolve under TimSyS. App manifests are frontend-only and contain no processes. The native host supplies the same existing durable data paths, database credentials and image/source roots; resource/code paths change independently.

## Contracts and authorization

Remaining domain HTTP operations use /api/timsys/v1/apps/{app}/backend/1.0.0/… . Each service exposes its contract metadata at that prefix plus /contract; existing central validators and frozen instruments remain authoritative. The transport preserves streaming/uploads/downloads, methods, query strings and domain transactions/job semantics. It does not automatically retry mutations or claim universal exactly-once behavior.

Native service credentials are process-private. Registered app windows receive app-specific HTTP-only SameSite cookies; credentials are not returned to renderer JavaScript. Direct APIs require native authority; cross-origin mutations, wrong versions and unversioned operations are refused. The read-only legacy health endpoint remains for supervision. Research blind-review/focused-workflow checks and trading operator authorization still apply.

Wardrobe, photography and styling retain their strict JSON contracts and durable idempotent commands. The assistant uses their read operations instead of retired Dress endpoints. Research evidence still uses the restricted projection with both evidence and native credentials. School APIs retain JWT/module permissions and require Principal'Ed app scope under the pinned namespace.

## Data continuity

All 99 SQL files—12 Dress, 21 Research and 66 Trade—retain their bytes and hashes. No schema redesign, destructive migration, image transformation, ledger reset or data-root move is part of this change. Research instruments/configuration and OCR data move byte-for-byte. Existing app verification evidence is archived outside executable app packages.

Synthetic PostgreSQL verification applies every historical migration, seeds existing garment/study/project/revision data and original-file bytes, adopts the services, exercises reads and verifies those records, ledgers and file hashes remain unchanged. No live database or original-file root was migrated.

## Build, packaging and updates

Backend packages compile and install runtime dependencies under platform/services. App packages build only frontends. Staging includes central services/native code and excludes dependency junctions/data. Runtime verification follows central manifests and migrations. This architecture change requires a full compatible stage; source-only restaging is blocked.

Bootstrap metadata advances to 1.1.0, and generated releases require that version. It loads the selected compatible TimSyS native host; stale independent-backend bundles cannot override it. App updates containing backend directories or incompatible declarations are held back. The former standalone Research backend release command packages platform and frontend together. Legacy per-app installed/runtime smoke commands now perform the central-topology preflight and do not start validation workers.

Use workspace build/install commands, the ownership audit and scripts/verify-central-layout.mjs on the full staged root. Production TypeScript builds, compiled-entrypoint imports, four Vite builds and authenticated Dress/Research browser checks pass. Main-source integration and a compatible Windows 1.1.0 build are now prepared; packaged Electron smoke checks pass. Signing/publication, installation and live-profile acceptance remain unperformed. See MAIN_SOURCE_INTEGRATION.md.

## Trade'Ed isolation

Only source and synthetic resources change in this isolated directory. The active worker, watchdog, scheduled task, immutable runtime, ports, checkpoints and durable data/log roots remain unchanged. Trading tests use mocks and worker-level connection/subprocess guards. The synthetic dashboard check constructs an HTTP server only; no trading worker, live execution, market provider, Telegram transport or new validation starts.

The initial deployment hold described above was superseded on 1 November 2026 by the user's explicit installation/publication authorization and verified non-interference: the recovered standalone build is installed and activated, with the independent validation worker, watchdog, sealed files, ports and data/log roots retained. See BACKEND_INVENTORY.md and releases/2026.11.1.json for current acceptance. Pre-existing feature limitations, CV scaffolding and the earlier watchdog-policy discrepancy remain separate from source ownership and app-contract migration.
