# Execution MVP — local build report

4 October 2026. Built following authorisation to proceed from the reviewed Layer 3 design. No release, deployment or production database migration was performed. Existing uncommitted MemeCoin’Ed work was preserved.

## Delivered

Principal’Ed → Organisation → Execution, with Portfolio, Overview, Tasks, Planning, Timeline, Dependency Wheel, My Work and History.

- Work Instances with planning, activation, closure, cancellation, reopening, lead, optional academic year, explicit school timezone, target date and retrospective.
- Tasks with role/person distinction, optional dates and phases, evidence requirements, lifecycle actions and immutable command history.
- Same-instance dependency DAG, completion consequences, explicit waivers, removal history, cycle detection, revision conflict detection and idempotent retries.
- Decision approval/return cycles, explicit revision deliverables, blockers and milestone contributions.
- Shared backend readiness calculation; no view writes Ready or changes governance merely by rendering a record.
- Reopening preserves downstream progress and flags exceptions. Cancellation never satisfies a prerequisite. Milestone achievement is reviewed when contributing work reopens.
- Pinned Document evidence and Layer 1 responsibility context. Draft/inferred context remains visibly provisional and permission-filtered; source inspection returns to the selected task.
- Ordinary staff access without Builder permission. The canonical external-account → local-user-anchor → staff bridge is resolved explicitly. Managers with staff-write permission can link their own account through My Work; existing bindings cannot be silently reassigned.
- Responsive Wheel, SVG Timeline with direct dependencies/date markers, fit/day/week/month ranges, unscheduled-work access, and paged task/Portfolio/My Work lists. Context selection survives navigation and reload.

## Implementation decisions

The new module is separate from existing Tasks. It uses the platform’s JSON-record storage convention: one revisioned aggregate per Work Instance, append-only activity with before/after snapshots, and committed command receipts. This is a deliberate physical-storage adjustment to the design ERD, not a second execution model. Stable entity IDs, transactions and shared projections are preserved. Full audit snapshots increase storage with instance size; retention/compaction needs separate assessment before broad rollout.

The module is routable and available in Builder’s module list. It does not declare an intelligence component because the current component certification requires operational Insights; this build keeps the explicit no-Insights boundary.

Role-only work stays in the lead’s queue until a person is assigned. Provisional Layer 1 context requires governance permission and never grants authority. The supplied design brief still begins at section 683; this implementation follows the reviewed design package rather than claiming reconciliation with unseen sections 1–682.

## Verification

Passed:

- 24 tests across five focused suites: Execution domain/service tests, real HTTP registration/migration tests, existing Builder baseline and Layer 1 graph/symmetry regression tests.
- Real browser run against the built application and an isolated SQLite database: administrator identity binding through UI, 20-task branching Wheel, explicit decision approval, mixed Ready/Waiting/Upcoming/Blocked outcomes, UI task creation, Timeline, narrow-screen layout, non-admin My Work completion, reload and persisted state after backend shutdown.
- Launcher production build. Vite retains a large-chunk warning; the build succeeds.
- Repository GUI-practice audit and whitespace checks.
- Synthetic engine checks at 100, 500 and 2,000 tasks. Maximum observed projection times: approximately 2.3, 9.9 and 142.3 ms respectively; maximum engine mutation times approximately 2.3, 8.3 and 99.0 ms. These exclude SQLite audit persistence, network and browser rendering and are not full production load certification.

Browser evidence: [result](../diagnostics/execution-e2e-J1UKEg/result.json), [Wheel](../diagnostics/execution-e2e-J1UKEg/wheel.png), [Timeline](../diagnostics/execution-e2e-J1UKEg/timeline.png), [staff action](../diagnostics/execution-e2e-J1UKEg/staff-work.png), [narrow screen](../diagnostics/execution-e2e-J1UKEg/mobile.png). Engine timing details: [scale measurements](../diagnostics/execution-scale.json).

Tests used synthetic in-memory or isolated on-disk databases. No production responsibilities, connections, sources or execution records were imported, approved, modified or populated. No Layer 2 functionality was added.

## Operating notes

Once released and installed, open Organisation → Execution → New Work Instance, choose the lead and school timezone, add tasks and prerequisites, then activate the plan. My Work requires a unique account/staff binding. An administrator can use Link my staff record for their own identity; other users need authorised canonical account setup and Execution read/write permissions. Leads can manage shared work even without a personal binding.

Clone/templates, resource optimisation, full network graph, AI recommendations, exact-time scheduling, external calendars and realtime notifications remain deferred as specified in the MVP design. A school pilot, full assistive-technology audit and broad production-volume testing have not been performed.

See [module contract](../platform/modules/execution/CONTRACT.md) for endpoints, permissions, persistence and domain semantics. Repeatable verification scripts are [browser E2E](../scripts/execution-e2e.cjs) and [engine scale](../scripts/execution-scale.cjs); the browser runner accepts `PLAYWRIGHT_MODULE` and requires an installed Edge browser.

## October 2026 usability pass

The task interface now follows the norms in `EXECUTION_UX_NORMS.md`: My Work first, Projects, a task list by default, and one selected task detail. Handoffs, project settings and activity remain available through More. No API, stored states, database schema or production records changed.

Validation: 15 Execution unit/HTTP tests, production UI build and an isolated real-browser flow covering setup, task creation, selection, approvals, mixed dependency outcomes, staff completion, persistence and narrow layouts. Screenshots were reviewed for the task list, detail, draft setup and mobile presentation. Release archives receive launcher extraction and installed-runtime verification before publication. Synthetic fixtures are confined to diagnostics databases.
