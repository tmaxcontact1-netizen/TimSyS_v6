# Principal’Ed usability update — 7 October 2026

## Result

Principal’Ed now uses a shared school workspace layout: direct page navigation, searchable destinations, breadcrumbs, compact page headings, and records before creation forms. The research and implementation order are recorded in [the usability plan](PRINCIPALED_USABILITY_PLAN.md).

The everyday project flow is **My Work / Projects → choose a project → choose a task → act → return to the same list**. Project settings, activity and handoffs are named destinations. Task properties have separate owner, status and due-date labels. Save/approval buttons name the action. Task and project deletion remain explicit, separate from cancellation, with their existing confirmation and audit semantics.

## Shared interaction rules implemented

- Sidebar links go directly to enabled pages. Find a page (Ctrl/Cmd K) searches names and descriptions, including the Nervous Breakdown name. The mobile Menu exposes the same navigation. Existing permission checks and leave confirmations remain in force.
- Home offers direct work, calendar, approval, student, staff and document destinations. It no longer declares the system ready or treats an empty notification list as proof that no work needs attention.
- Add/Edit reveals a form. Hiding it preserves typed data. Editing a row reveals its form. A successful handler explicitly acknowledges success before the shared form closes and returns focus to its action button. Failures keep the form and inputs available; uncaught form-request failures are shown inline.
- Documents, standalone tasks, approvals, calendar, ownership, communications, venue bookings, resource reservations, catering, transport, risk, safeguarding, contingency, finance, event records and participation pages use this on-demand pattern. Invoked secondary action forms remain immediately available.
- Optional task/message record references sit behind a labelled disclosure. Persistent labels replace disappearing placeholders in the core operational forms. Standalone tasks are named separately from project tasks.
- Students, staff, rooms and inventory retain their existing Add/Edit/detail workflows with the same compact page headings. Check-in/out keeps its quick action visible.
- Specialist responsibility-network, timetable and assessment workflows retain their domain-specific controls within the shared shell. This update does not replace their analytical workflows or turn technical record references into inferred links.

## Verification

- Production Vite build passed. Existing large-bundle advisory remains; it is not a build failure.
- Execution unit and HTTP suites: **21 tests passed**.
- Real authenticated browser execution test: project creation, tasks, ownership, start, decision approval, mixed dependency consequences, staff completion, list/detail return, timeline, handoffs, mobile overflow, cancel/delete confirmations, persisted task/project deletion and reload passed.
- App-wide browser test: document create/edit/reload, controlled HTTP failure preserving input, collapse/reopen retaining draft, unsaved-navigation cancellation, fourteen operational form entry points, four registries, specialist-page navigation, disabled-module filtering, mobile menu and keyboard search.
- Browser tests run against isolated synthetic SQLite files. The save-error case uses one explicitly simulated HTTP failure; all successful document and project persistence checks use the real API.
- Screenshots were inspected at desktop and mobile sizes. No user job descriptions, responsibility mappings, approvals or production application records were changed.

The release verification asset records the exact source commit, bundle hashes, browser results and an installation smoke test using the launcher updater. The existing platform bundle is reused only after checking that platform sources are identical. Other installed application bundle records are preserved.

## Limits

This is a researched implementation and functional verification, not a usability study with school staff. The cross-page test checks shared navigation and form behaviour; it does not claim to retest every specialist business workflow end to end. Mandatory source IDs, approval authority, provenance and governance constraints remain intact.

## Scrolling correction — 7 October 2026

The launcher intentionally sets `body { overflow: hidden }`. The new shell initially omitted a bounded, scrollable content region, clipping long pages including Nervous Breakdown. The shell now fills the viewport and gives its page content the remaining height with `overflow: auto`; navigation and breadcrumbs stay reachable. New page navigation resets the page scroll position. Network renderer input handlers are unchanged.

A dedicated browser regression checks real wheel scrolling in both directions, keyboard access to the bottom, and navigation reset in 2D Network and List at 1440×600 and 390×660. It uses the empty synthetic corpus with advanced filters open to exercise overflow, without importing organisational data.
