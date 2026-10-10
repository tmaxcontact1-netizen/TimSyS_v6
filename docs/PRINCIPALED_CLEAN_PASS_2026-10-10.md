# Principal'Ed clean working pass

The user explicitly requested all Principal'Ed records be cleared, including the imported datasets, rather than retaining the seven JDs or manually created school records.

## Installed data reset

Completed 10 October 2026 using `scripts/reset-principaled.py`. The script previews by default; actual deletion requires `--apply`. It is not a migration, startup action, or part of the published update. Installing an update will never repeat this reset.

Removed 14,472 rows from the installed Principal'Ed data scope: 18 students, 16 staff, seven document records/versions, 2,814 governed records and 2,981 revisions, one execution instance and its activity/receipts, plus corresponding audit, withdrawal, event, world-model and intelligence records. Seven original document files were removed from the working store after their recovery copies were verified.

Recovery location, excluded from Git: `diagnostics/principaled-clean-pass-recovery-20261010/`. It contains a SQLite online backup, copied original document bytes and machine-readable reset plan/result. Do not treat those recovery files as current application records. Recovery must be coordinated with any work created after the reset; do not blindly replace a shared database later.

Login identity, module assignments, system schemas/migrations, required calendar layers/settings, permission policies and controlled operational reason/type definitions were preserved. Other application scopes were preserved. The reset checked referential integrity and compared preserved records before committing. Automatic technical telemetry may continue accumulating; it is not injected school data.

## Runtime and interface changes

- Removed the organisational/synthetic dataset switch and fixture checkbox from Nervous Breakdown. Its workspace displays organisational records only.
- The working runtime rejects synthetic (`is_fixture`) imports, including validation requests, with `TEST_DATA_NOT_ALLOWED`. Isolated automated tests retain fixture support under `NODE_ENV=test`.
- Added a shared selector that searches and pages through actual authorised records. Typed search text cannot become a selected identifier. Empty lists and load errors are explicit; there are no fabricated fallback records.
- Attendance roster entry now selects named students, including across result pages, instead of requiring pasted identifiers.
- Programme owners, scheduler staff/room/equipment eligibility and student movement-rule selection use live records.
- Event links in venue/resource reservations, transport, catering, finance, safety and contingency forms select actual events. Owner selection in event, finance, safety and contingency forms uses staff records.
- Tasks, approval requests, ownership and communications use a record-type and named-record selector for supported links. Existing links outside that selector's catalogue are retained until deliberately changed.
- Governed imports, source revisions, draft review, actual lifecycle states and ordinary form hint text remain. These are working capabilities, not test data. Stable identifiers remain in exports and provenance where they are necessary.

## Verification

- Four reset tests: dry-run non-mutation, scoped deletion with recovery, preservation of other apps/configuration, refusal of cross-app dependencies, and rollback on missing source-file backup (four tests covering these behaviours).
- Eighteen Nervous Breakdown HTTP integration tests passed, including production fixture rejection and unchanged governance/round-trip behaviour.
- Isolated browser pass verified empty school data on startup, removal of fixture controls, roster selection across pages and persistence through the real endpoint, task-to-event named selection, and venue event selection. No browser errors.
- Existing platform-wide usability browser regression passed: navigation, forms, retained drafts, controlled save failure, mobile navigation and specialist workspaces.
- Launcher production build passed. Existing bundle-size advisory remains.

This is a clean-data and input-hardening pass. It does not establish that the platform-wide workflow redesign in the benchmark document has been implemented, nor that every specialist workflow has undergone a new end-to-end audit. Remaining technical configuration fields and specialist interactions must be assessed in that platform-wide design pass; they have not been relabelled as completed work here.
