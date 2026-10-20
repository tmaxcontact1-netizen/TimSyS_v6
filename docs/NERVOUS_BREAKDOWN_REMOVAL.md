# Nervous Breakdown removal — 20 October 2026

The former Layer 1 responsibility model is retired. The remaining navigation destination displays only “Nervous Breakdown” and “No responsibility model is currently installed.”

## Scope and inventory

Removed the backend model, validators, ontology vocabulary/import contract implementation, analytical gap overlay, all eight model API routes, model-specific governance and import/export handlers, intelligence component, 2D/3D/List renderers, spatial layout worker, trails, inspector and model-specific fixtures/tests. Removed the exclusively used Three.js dependency. Execution keeps tasks, projects, dependencies, decisions and document/note evidence; only its obsolete responsibility-link integration was removed.

Retained shared people/roles, documents, ownership, governance/audit services, Execution and other modules. Historical documentation under `docs/nervous-breakdown` and the original SQL migration are historical only, with no runtime import path. Git history was not rewritten. The retirement migration drops the old tables/view; it refuses a different installation with nonempty model tables rather than deleting unreviewed shared-source data.

The active database audit found **zero** JDs/documents/document versions, source statements, responsibilities, ontology terms, connections (including documentary companions and inferred connections), unresolved handoffs, revisions, graph/spatial records or world projections. These had already been cleared before this task. No analytical records were deleted in this operation.

## Active-store cleanup

Dropped `nb_governed_records`, `nb_revisions` and `nb_records`.

| Owned records removed | Count |
|---|---:|
| Schema registrations | 2 |
| Function registrations (including obsolete Execution context handler) | 9 |
| Capability registrations | 3 |
| Route registrations (including obsolete Execution context route) | 9 |
| Intelligence component registration | 1 |
| Old module registration | 1 |
| Model-specific request/usage telemetry | 73,724 |
| Model metric points | 9 |
| Model metric definition | 1 |

Removed only the Nervous Breakdown member from nine shared provider-run summaries and the obsolete dependencies/routes/functions from Execution's cached manifest. Other records were fingerprinted across the transaction and verified unchanged. Empty navigation assignment remains; the new module registers no model APIs or capabilities.

Verified recovery backup:
`C:\Users\tmaxc\AppData\Roaming\timsys-launcher\backups\platform\nb-retirement-20261020\before-retirement.sqlite`

SHA-256: `f4cb8f64391de6625f3db39f7fb793630d5275ee02fcb3562627f7afd8d7f875`.

SQLite online backup includes committed WAL content. Backup and final store passed integrity checks and foreign-key checks. Full transaction report is beside the backup as `result.json`. No in-app recovery route was added.

## Verification

- Execution, retirement, migration-upgrade and boot regressions: 26 tests passed across the final relevant runs. The boot regression's stale count was corrected to include the already-existing Execution module.
- Production launcher/Principal'Ed build passed (existing large-chunk advisory only).
- Browser acceptance passed against both source and final packaged platform, with isolated databases and zero page errors. Empty destination and 404 on the retired workspace API verified.
- Connected workflows passed: event planning, attendance selection, linked tasks, venue booking, catering, finance, safeguarding, grade report review/publication and document upload retry.
- Post-removal source search finds only the empty destination/navigation, retirement checks/migrations and historical documentation; no active old renderer or model API remains.
- No JDs or replacement model were imported. All test school records stayed in disposable isolated databases.

## Release and isolation

Release: **2026.10.20.1**. The package uses the installed `48f4a31f458de2c1ac1548d8` platform as its verified snapshot baseline, preserving the later isolation repair absent from the older published platform zip. Unchanged files were copied and hashed; modified backend files were checked against the reviewed source base. Only the obsolete import-size branch was removed from the otherwise-preserved platform entry point.

The update replaces platform and launcher UI bundles. The latest Research'Ed bundle remains unchanged; other installed application bundles remain untouched. Package manifest and verification evidence are under `dist-updates/nb-retirement-2026.10.20.1`.

Trade'Ed changed from failed/stopped to an active independent run during this work. The active-store command stopped at that transition before deletion. Before proceeding, worker 24216 → watchdog 21380 → scheduled owner 24120 → Windows service ancestry was verified, excluding Launcher. Ports 18860/18861 and runtime/data/log paths under `tradeed-validation` are separate. Heartbeats were healthy and the incident log showed only startup events. This task did not restart, stop or modify any Trade'Ed process or files.

Publishing does not install the update into an already-running desktop session. No live app was restarted by this task.

**No replacement responsibility model was designed, created, seeded, or imported.**
