# TimSyS backend inventory — integrated main source

Updated 1 November 2026. Backend source consolidation is installed and activated in TimSyS 1.1.0, recovered-20261031, with Research'Ed 0.10.13 and Dress'Ed 0.3.0. Research's recovered workflow and saved work are visible in the installed app. Earlier baseline and staged-migration reports remain historical evidence. Release acceptance is recorded in releases/2026.11.1.json.

The subsequent main-branch merge retains main's school navigation/task controls, exchange adapter and cumulative update-manifest handling alongside the recovered services. The installed runtime remains the previously accepted release; this source merge performs no installation or live database migration. See MAIN_MERGE_20261101.md for conflict resolution and migration-history reconciliation.

## Ownership

### Q35 integration and compatible release — 6 November 2026

The installed platform component is d8a5ca23338e0149c56308f2. It preserves Research'Ed 2026.11.06.3, the repaired dashboard, isolated Research/Dress database bindings and the existing inspection-only Trade'Ed gateway. Q35 is TimSyS-owned source under platform/services/tradeed-q35 and an independent runtime outside launcher bundles. The registry is platform/services/independent-services.json; its read-only status contract is /api/timsys/v1/services/tradeed-q35/1.0.0.

Q35 live validation remains inactive. No live collection configuration, activation authority or enabled task was installed. The old validation state file is stale; actual workers and protected ports were checked rather than trusting its active flag. Dedicated-account commissioning and actual boot acceptance remain prerequisites for separately authorized live validation. Synthetic cold/recovery and real disposable scheduled-task process-loss tests passed without rebooting the machine.

The compatible update preserves all 176,722 records across 95 PostgreSQL tables and all 61 checked saved school/document SQLite tables. The dashboard repair preserves its JavaScript and adds the missing layout utilities. PostCSS and Tailwind now resolve configuration/content relative to the app, with a build guard against missing dashboard styles. Research source remains authoritative main source; its compiled output matches the installed release exactly.

The earlier standalone installer is superseded. Distribution uses the compatible platform component, repaired UI bundle and independent inactive Q35 kit. No app data, credentials, backups or live validation configuration are published. See releases/2026.11.06.4.json and BACKEND_Q35_RELEASE.md.

| App/component | TimSyS backend destination | App boundary |
| --- | --- | --- |
| Dress'Ed | Existing wardrobe/photography/styling services plus platform/services/dressed for planning, rotation, care, wear records, insights/preferences and outfit edits; CV scaffolding is central too | Frontend and pinned native JSON/HTTP contracts |
| Research'Ed | platform/services/researched: APIs, repositories, migrations, acquisition/extraction/OCR, jobs, AI, exports/reporting, frozen instruments/configuration | Frontend and researched-backend@1.0.0 HTTP contract |
| Trade'Ed / Q35 | Existing inspection-only sandbox gateway; TimSyS owns the independent Q35 host under platform/services/tradeed-q35. Historical general trading source remains unbundled under platform/services/tradeed | Versioned inspection/status contracts; no live validation activation |
| Principal'Ed | Existing platform/modules school/shared services | Frontend and pinned school HTTP namespace; JWT/module/app permissions retained |
| Desktop shell | platform/native/desktop: lifecycle, database manager, backup/recovery, credentials/OAuth/provider probes, updater and OS/window adapters | UI plus minimal bootstrap loading the TimSyS native host |

There is no remaining executable backend source/migration/job/provider implementation in the maintained app packages. Existing per-app verification evidence is archived outside those packages. The ownership audit enforces source placement and rejects app backend dependencies/process manifests. The domain registry is platform/services/domain-services.json.

## Contracts

Wardrobe, photography and styling retain their versioned JSON contracts and durable atomic command receipts. Remaining domain APIs use /api/timsys/v1/apps/{app}/backend/1.0.0/… with process-private native credentials and HTTP-only app sessions. Principal'Ed uses the matching pinned namespace for already-central school routes.

App declarations now report frontend-only ownership. They consume runtime@1.1.0, which reports completed source migration. Runtime@1.0.0 remains available unchanged for compatibility with the historical foundation contract; its old false migration flag is not the current ownership inventory.

See [BACKEND_CONSOLIDATION.md](BACKEND_CONSOLIDATION.md) for authorization, data continuity, packaging/update behavior and cutover boundaries.

## Preservation and verification

The merged services contain 106 SQL files: 13 Dress, 25 Research and 68 Trade. Trade retains both independently published 0066 filenames and their contents, plus a separately recorded 0067 compatibility prerequisite. Existing ledgers from either branch are supported without renaming historical entries. The recovered Research business implementation matches the previously working 0.10.13 release in 63 compiled JavaScript modules; only its HTTP entrypoint has the intended TimSyS hosting adaptation. Data paths, original images/documents, schema identities, frozen instruments and durable job/ledger semantics are retained.

- Recovered-source regression: 1,194 tests pass: platform 625/143 suites, Research 402, Dress 102 and native host 65.
- Earlier isolated trading verification: 818 tests/142 nonempty suites. No new validation worker is started for this release.
- All three production TypeScript builds and compiled-entrypoint imports pass.
- All four production Vite builds pass.
- Recovered Research renderer uses the versioned central contract without browser errors; installed Research opens with its recovered tools and saved work.
- Ownership, dependency-lock and central compiled-layout checks pass.

The recovered installer passed fresh/legacy SQLite and PostgreSQL adoption checks, native module loading and complete embedded-payload verification. Installation preserved the original durable app files, configuration and credentials. Read-only live acceptance matched the pre-installation Research/Dress database hashes and existing school/document records. Evidence is retained locally under verification-local/standalone-installer-20261031-recovered and verification-local/install-publish-20261101. Personal data, backups and diagnostics are excluded from the source commit and release assets.

## Live validation and remaining work

Trade'Ed continues through its independent scheduled-task/watchdog ancestry. Its actual worker/watchdog, heartbeat, incidents, write permissions and 43 sealed files are checked read-only. Its runtime, ports, checkpoints and data/log roots are untouched.

No further per-function backend source moves are pending. This release is distributed through the standalone installer, with no automatic component bundles for the ownership transition. Signing, production feature certification, existing CV scaffolding and the earlier watchdog-policy findings remain separate work. Active Trade validation continues from its sealed runtime, independently of the installed launcher.

## Upgrade compatibility

Legacy on-disk trading directory/database/role identifiers and persisted environment keys are compatibility aliases only. Startup adopts the existing populated directory and database, retains credentials, and normalizes configuration in memory. Conflicting populated roots, conflicting settings, missing credentials or ambiguous database identities stop startup rather than creating a competing empty store. No existing configuration or data is renamed. Six additional native fixture tests and two configuration tests cover adoption and conflict behavior. See MAIN_SOURCE_INTEGRATION.md for build and rollback evidence.
