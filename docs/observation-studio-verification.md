# Observation Studio verification — 2026-11-08

## Automated checks

23 unit/domain checks passed:

- Initial and editable access policy; unrelated-account denial; admin-only permanent deletion.
- Evidence, review history and observee reopening.
- Idempotent retries, command collisions, stale edits and rollback on audit failure.
- Settings revisions and retained template snapshots.
- Classes, cover, absences, calendar exceptions and explicit observed-lesson exemption.
- School timezone and skipped/repeated daylight-saving times.
- TBO evidence, shared/personal timers, evidence reviews and complete lifecycle.
- Probation completion validation and acknowledgements.
- Read-only cycle preview, scheduled visit linking and atomic schedule completion.
- PD delivery, attendance, removal/restoration and rejection of seed operations.
- Exact incoming import snapshot, identity, assignments, timer history and duplicate rejection.
- Lesson-only edits rechecked against availability.
- Human contribution requirements, authorization and preservation across attendance edits.
- Configured cycle counts and retained appointment duration.
- Restoration rejected and rolled back when a new class commitment clashes.
- Fresh templates have blank school identity/year/policy text, no school branding or embedded branded assets, and permit saving optional text as blank.

One full-platform HTTP integration test passed: module registration, native CRUD, full Studio RPC response envelope, non-admin access discovery, validation errors and authenticated routes. Total: **24 passing automated tests**.

Production Vite build passed. Existing bundle-size advisory remains; no build errors. All retained inline script blocks parse.

Commands:

```powershell
node --test platform/modules/observation_studio/full-workflow.test.cjs apps/principaled/src/dashboard/widgets/observation-time.test.mjs
node --test platform/modules/observation_studio/http.test.cjs
node apps/principaled/node_modules/vite/bin/vite.js build apps/principaled --config apps/principaled/vite.config.js --configLoader runner
```

## Browser acceptance performed

Full Principal’Ed UI, isolated SQLite database and localhost test host; synthetic teacher, observer and administrator only.

- Navigated Planning → Observations.
- Created TBO; saved evidence; reloaded and verified retained wording.
- Started a row reflection timer; reloaded and verified it resumed; stopped it and logged 1.6 minutes.
- Saved Reflect Together text and an explicit evidence review linked to captured evidence.
- Advanced a TBO to Ready For Reflection.
- Created probation review; saved rating/evidence/follow-up; reopened it and verified content.
- Previewed and saved four scheduled visits; changed an appointment to 10:30; checked classes/cover; saved it; started its linked observation; captured evidence; marked it ready and verified the scheduler showed one completed appointment.
- Created a delivered PD session; recorded attendance, minutes and completed deliverable; checked overlaps; saved it.
- Opened teacher profile and PD evidence timeline; saved an insufficient-evidence human contribution judgment and verified the success message.
- Signed in as the observee: navigated to Observations without Builder administration, opened a visit, verified evidence input was disabled, reopened with a reason, and verified contribution remained read-only.
- Saved the school’s usual observation duration.
- Saved template version 2; reopened an existing probation review and verified its original title/template remained intact.
- Exported probation JSON through the parent application; downloaded the file and checked its actual JSON content, identity, evidence and assignments.
- Uploaded the same export through the browser and verified duplicate identity rejection with no replacement.
- Uploaded a separate synthetic import fixture; verified it opened with retained rubric/evidence and the fixture subject.
- Opened the combined Overview; verified filters and report controls rendered with no browser console errors.

The native print action was exercised, but its system dialog blocked the embedded browser automation. It was dismissed/recovered; **an actual PDF file or physical print was not verified**. The original print layouts remain implemented. Installed-launcher print/PDF smoke testing remains a release check; no installed app was updated for this task.

## Isolation

Trade’Ed’s saved watchdog state was stale; actual recorded worker/watchdog PIDs were absent on inspection. Development, HTTP and browser tests used this separate checkout, localhost ports and a separate test database. No installed services were stopped, restarted, published or updated. Synthetic acceptance data is not production data and is not loaded by application startup.

The isolated browser host was stopped and its synthetic database/input fixtures were removed after verification. Screenshots and machine-readable results remain in `verification/observation-browser/`.

After the branding-removal instruction, a fresh browser database showed zero observations. A new probation form rendered without the source school name, logo, year or embedded school document, and produced no browser console errors. The test host and synthetic database were removed again afterward.

Release preparation additionally verifies existing-install registration and packages the Studio static page with the launcher UI. The extracted platform archive is booted against a disposable database and the real installed updater compatibility gates validate both archives. Per-release results are attached to the GitHub release.
