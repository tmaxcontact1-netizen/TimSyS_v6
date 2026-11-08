# Observation Studio integration

Updated 2026-11-08. Checkout: `observation-studio-prototype`, branch `feat/observation-studio-prototype`.

## Scope

The supplied Apps Script Studio workflow is now integrated into Principal’Ed. Its specialist TBO and probation screens and domain rules are retained; Google authentication, Drive/Sheets persistence, script locks and transport are replaced with authenticated native routes and transactional storage. Release packaging overlays the reviewed module onto the current published platform and includes the Studio page in the launcher UI. Publishing does not install or restart the app.

Planning → Observations opens the workspace. Linked staff can reach it without Builder administrator permission. Observation access uses the existing staff-to-user identity relationship; names and email text do not grant access.

## Workflow coverage

| Area | Implemented behaviour |
| --- | --- |
| TBO | Structured evidence across the original sections, notes, activity timing, independent observer/row reflection timers, Reflect Together, observer scripts, history, entry removal/restoration, explicit evidence reviews with source fingerprints |
| Probation | Nine-domain rubric, evidence, follow-up, summary, action plan, recommendations, acknowledgements, draft recovery, completion validation, original template snapshots |
| Lifecycle | In Progress → Ready For Reflection → Reflection Complete → Closed; reasoned reopening; no implicit review or approval |
| Scheduling | Separate observation/PD appointments, recommendation preview/commit, calendar/list, rescheduling, appointment-to-observation linking, explicit completion, school timezone/days/hours/candidate times/cycle counts/duration |
| Clashes | Published class occurrences and exceptions, cover assignments, absences, observations and PD; only an explicitly selected teacher lesson may be the lesson observed; an observer’s lesson remains a clash |
| PD | Session planning/delivery, participation, attendance/minutes, deliverables, removal/restoration, evidence timelines and separate human contribution judgments |
| Reporting | Teacher profiles, overview, filters, information views, CSV/JSON exports and original print layouts |
| Exchange | Native saved-revision JSON export for both protocols; import preserves identity/content/template/attribution/history and native assignments; duplicate IDs and invalid staff bindings reject; active timers pause and the exact incoming snapshot is retained |
| Administration | Editable permissions, observer assignment, school settings, versioned template wording; no demo generators or school-specific observer grants |

Staff identities remain in Principal’Ed People. Observation appointments do not modify class or cover schedules. Existing appointments retain their stored duration when the default changes. Conflict checks happen on save and on restoration; this is not an upstream reservation or push-notification service.

## Access policy

| Action | Admin | Assigned observer | Observee |
| --- | --- | --- | --- |
| View | Yes | Yes | Yes |
| Contribute | Yes | Yes | No |
| Reopen | Yes | Yes | Yes |
| Permanently delete | Yes | No | No |

Administrators can change the view/contribute/reopen policy. Admin access and admin-only permanent deletion are invariant. UI controls reflect the policy; server checks are authoritative. Observers can start their assigned appointments. New unassigned visits and cycle creation are admin actions. A PD facilitator or administrator can edit that session and record its human contribution review.

## Persistence and integrity

The module owns settings, observation records, audit, command receipts and versioned Studio stores. The full RPC adapter is `platform/modules/observation_studio/studio-rpc.js`; retained domain rules are in `domain.js`. All writes, cross-record schedule updates, audit entries and retry receipts share one transaction. Revision and field/version checks reject conflicting edits. Stable command IDs are bound to actor and payload hash. Settings are reread under the transaction lock before authorization.

Evidence status is not inferred from blank fields. Changes to reviewed source evidence invalidate its fingerprint-based review. PD attendance, deliverable completion and observed rating patterns are separate. Human contribution judgments require rationale; supported contribution also requires linked observations, application and consideration of other influences. `causation_established` is always false. Ordinal trends are not effect sizes or causal estimates.

Template wording is configurable; stable field/domain identities remain fixed for comparison. Existing observations retain template snapshots. School identity starts blank. The source school name, logos, embedded Word document, original branded form reference, academic year and school-specific introduction/policy wording have been removed. Optional template text may remain blank; generic workflow/rubric labels remain available for configuration. Calendar display retains the original September–August school-year presentation; cycle dates and working patterns are independently configurable.

## Browser host and downloads

`ObservationWorkspace.jsx` hosts the retained Studio screen and forwards only same-origin messages from that frame through Principal’Ed’s authenticated API client. Downloads are created by the parent page, with a persistent retry link, so JSON/CSV downloads are not trapped in an embedded frame. Google login and storage services are not required.

## Verification

See `observation-studio-verification.md` for actual browser coverage and test commands. All data used for verification is synthetic and isolated from installed application databases. No Apps Script records or real school records were migrated. No launcher, Research’Ed, Trade’Ed runtime, updater or installed application was changed.

Release packaging uses `scripts/package-observation-update.mjs`. The one-time `003_enable_existing_installs.sql` migration registers Observations on existing installations while preserving all other module choices. Fresh installations continue through Builder’s complete default list.
