# Principal’Ed connected workflow release

10 October 2026. Continues the clean working pass; does not reset the database again.

## What changed

- Home starts with people, the school day, teaching/shared work and school information. Today’s calendar is read from the real service. The former unconnected notifications placeholder is removed.
- Event planning groups arrangements into people/dates, practical arrangements, checks/decisions, and work/information. Optional areas remain available. Readiness and approval are explicitly different.
- Event links now use the service’s canonical `event_code`, fixing the numeric-ID selector mismatch. Existing saved references are not migrated or reinterpreted.
- Planning carries the event into new task, ownership, approval, invitation, attendance, logistics, safety, finance, communication and document-link forms, with a visible return path. The banner explicitly identifies that registers can contain other records; it does not pretend they are filtered.
- Student/staff directories open full profiles. Profiles carry the person into relevant operational actions and related work. Destinations remain limited to enabled modules and existing backend permissions.
- Shared named selectors replace additional person/reference inputs in ownership, review stages, recipients, invitations, attendance, absence cover, preferences, task dependencies, finance evidence and booking resources. Rooms and equipment can be searched beyond the first directory page.
- Reservations, transport, catering, budgets, expenditure, risk and medical referral screens expose their existing forward lifecycle actions. Actions require deliberate confirmation; server validation remains authoritative. Safeguarding verification requires operational evidence.
- Gradebooks now support commentary editing/versioning, marking ready, report creation, submission, explicit approval/rejection with reason, resubmission, publication and reading the saved report. Viewing never publishes. Generated commentary is labelled for human review.
- Forms keep entries on failed saves and warn before leaving changed forms. An interrupted initial document upload retries against the newly created document rather than creating another document. Messages can be read before sending.
- Attendance context is presented as readable information instead of a JSON dump. The root-width restriction is overridden only while Principal’Ed is open; small screens now fit the viewport. Nervous Breakdown filters flow beneath its toolbar, preserving access to representation tabs and page scrolling.

## Evidence

`scripts/principaled-connected-workflows-e2e.cjs` boots a separate SQLite database, provisions only isolated test records and uses the real UI and APIs. It checks:

1. Event → task → same event; canonical identity and planner evidence.
2. Room booking creation and explicit confirmation; recognised readiness.
3. Student directory → profile → arrival → same profile.
4. Separate budget submission and approval.
5. Catering request → approval → confirmation → delivery.
6. Safeguarding verification with recorded evidence.
7. Commentary → ready → report draft → rejection/reason → resubmission → approval → explicit publication → saved report.
8. Interrupted document upload, retained identity and successful retry without duplicate creation.
9. Small-screen width, vertical scrolling and absence of browser exceptions.

Existing clean-pass browser verification also checks named selection, pagination, roster creation, stale project recovery and absence of synthetic-data controls. Existing usability verification checks common entry points, forms, failed saves, navigation protection, keyboard/mobile navigation and specialist views. Nervous Breakdown scrolling verification covers wheel and keyboard movement in 2D and List at desktop and narrow widths.

Targeted backend suites: event planner, gradebook workspace and Nervous Breakdown — 27 tests passed. Frontend production build passed; the existing large-bundle advisory remains.

## Boundaries and operating requirements

No working application database was opened for writing or populated during this build. All test records remain in ignored isolated diagnostics directories and are excluded from the release. No dataset import, ontology change, inferred connection approval, or Layer 2/3 construction occurred.

User/team/role/external reference types without a searchable directory remain explicit existing-reference fields; they are not fabricated records. Staff and student selection uses real directories. The calendar picker explains its previous/current/next-year window and the service’s 1,000-occurrence cap. External messaging requires the existing configured delivery service. Recording expenditure as paid does not perform a payment.

These are tested workflows, not a claim of exhaustive certification of every permission, integration, specialist algorithm or school policy. No external messages or actual payments were sent in verification. Other applications’ published bundles are retained by the cumulative release manifest.
