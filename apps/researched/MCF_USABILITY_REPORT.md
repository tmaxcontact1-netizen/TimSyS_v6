# Research’Ed 0.4.0 — MCF usability and lifecycle

The researcher workflow is now **Sources → Prepare → Code → Check → Results**, with Framework separately available. Each step explains its task and next action. Dataset/source/session display names can be changed without changing original identifiers. Coding drafts and the current session survive navigation and reload on the same device.

## Terminology

| Previous interface | Current interface |
| --- | --- |
| Corpus | Sources / dataset |
| Derived records | Prepared source text / individual reviews |
| Analysis units | Text sections |
| Segmentation / UTF-16 offset | Prepare text / place the cursor to split |
| Mapping version | Source preparation; technical version in Details |
| Frozen snapshot | Session uses the text it started with |
| Append researcher decision | Save coding / Save & next |

Technical provenance, original IDs, framework versions, historical decisions and preparation history remain available. The underlying MCF v1.0 instrument is unchanged. Results show 21 competency-level coding counts with evidence links. Documentary representation remains a separate 0–3 observation; no averages or domain/institution rollups were introduced.

## Delete and archive

- Unused datasets, sources and empty sessions can be permanently deleted after confirmation. Safe unused preparation versions can also be removed from History.
- Saved coding or documentary decisions protect the session and dataset. Session references protect sources and all pinned text, including the full population of blind validation samples. Later preparation dependencies and a record’s only text version are protected.
- Protected items offer Archive. Show archived and Restore make them recoverable. Archived datasets/sessions cannot receive coding decisions.
- Deletion removes unused dependent rows and original file bytes, leaving a minimal actor/time/target tombstone. Organisational history is append-only except when its unused parent is permanently deleted. Dependency checks and coding writes share a dataset transaction lock.
- Rename changes presentation labels only. Original filenames, source bytes and analytical IDs remain unchanged.

## Verification

- TypeScript and production Vite build: passed.
- Unit/regression tests: **115 passed across 22 files**.
- Exact staged runtime: **16 MCF integration/browser checks** and **12 existing content-pipeline checks**, all passed.
- Full browser journey covers dataset creation, upload/preview, cursor and keyboard splitting, combine preview, coding, draft reload, Save & next, incomplete/completed coding checks, results/evidence navigation, cancel/delete and archive/restore.
- Tests verify unchanged source bytes and text, fixed session/framework references, append-only decisions, stale-write rejection, reproducible blind samples, unchanged export content apart from export time, protected-history rejection, actual unused-file removal, and available/unavailable documentary states. MCF made **zero AI calls**.
- All databases and test sources were disposable synthetic fixtures. The live database was not opened by tests. Read-only SHA-256 checks found all **15 existing source files unchanged**.

The release verification attachment contains screenshots 01–16 for source review, coding, blind review, documentary observations, compiled-review confirmation, dataset landing, preparation, split preview, Details, Check, Results, Archive, archived datasets and Delete. The installed ZIP receives an additional launcher-update/migration/startup smoke test before publication.

## Files and schema

Migration `0019_mcf_lifecycle.sql` adds organisational lifecycle events, a durable file-cleanup queue and dependency-aware deletion guards. `mcf-lifecycle.ts` implements policy, delete/archive/restore/rename and history. Repository/API changes expose presentation metadata and serialize edits against lifecycle changes. `McfWorkspace.jsx`, `CompiledReviewMapping.jsx`, `LifecycleActions.jsx`, `presentation.js`, `mcf.css` and the app chrome implement the new workflow. The manual/compiled guides, browser verification, presentation tests and release fingerprint checks were updated.

## Limits

Coding progress is a completeness count, not proof of valid research. Reliability thresholds, agreement methods, domain/institution aggregation and machine classification remain unresolved and unimplemented. Blind/manual validation remains available separately from Check.

Drafts are device-local; compiled-review preview edits remain unsaved until confirmation. If the operating system locks a deleted original file, cleanup stays queued and is retried on the next delete operation, with an explicit UI message. Backups and drafts on other devices are not erased. Structural parsing still requires researcher confirmation for ambiguous review boundaries. Researcher names remain local attribution, not authentication.

See [the updated pilot workflow](MCF_MANUAL_GUIDE.md) for operating instructions.
