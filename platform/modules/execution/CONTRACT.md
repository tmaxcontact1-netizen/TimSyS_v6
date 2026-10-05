# Execution — Layer 3 MVP

Principal’Ed → Organisation → Execution. Separate from existing Tasks and formal Layer 1 records. No Layer 2, AI advice, performance scoring, notification-dependent readiness or automatic approvals.

## Access and identity

`admin:execution:read` opens accessible work; `admin:execution:write` allows domain commands; `admin:execution:manage` manages all Work Instances and creates plans. Platform wildcard administrators inherit these permissions. An ordinary staff account must match exactly one active/contract staff record through the canonical `users.external_id → users.id → staff.user_id` bridge (legacy numeric account IDs remain supported). Duplicate, absent, disabled or inactive mappings fail closed. Role labels never grant permission.

My Work offers **Link my staff record** to a manager with staff-write permission. Explicitly selecting their own record creates/reuses the canonical local anchor, saves the binding and appends a global audit entry. It never guesses a staff identity or overwrites another account’s binding. Other accounts must be linked through authorised staff administration; no permissions are added by linking.

The lead and assigned participants may read the whole shared Work Instance, including dependencies and action history. It is a shared-work visibility boundary, not a private per-task notebook. Only its lead or an Execution manager may edit its plan. A participant may act on their own task; the lead/manager may act on behalf of an assignee, with the actual authenticated actor retained. Administrators without a staff binding can manage work but have no personal My Work assignment.

`/execution/availability` allows staff navigation without granting Builder access. New and upgraded installations receive the module assignment once; subsequent Builder disablement is respected. No staff role permissions are automatically escalated.

## API

- `GET /execution/workspace`: scoped Portfolio, active personal work and minimal active staff directory.
- `POST /execution/identity`: link the authenticated manager to an unbound active staff record, with an explicit reason and staff-write permission; repeated identical bindings are no-ops.
- `POST /execution/instances`: title, explicit IANA school timezone, optional lead, description and target date; `command_id` required. Creates Planning only.
- `GET /execution/instances/:id`: one canonical projection and allowed actions.
- `POST /execution/instances/:id/commands`: `{ command_id, expected_revision, type, data }`.
- `GET /execution/instances/:id/preview?task_id=…`: read-only direct completion/approval consequences, identified by snapshot revision.
- `GET /execution/instances/:id/history?before=…`: 50 chronological audit facts per page, newest first.
- `GET /execution/references`: document versions and permitted formal responsibility revisions.
- `GET /execution/instances/:id/context?link_id=…`: pinned formal wording and permitted documentary provenance; no Layer 1 writes.

Commands cover instance update/activate/close/cancel/reopen; task add/update/start/complete/cancel/reopen/reinstate; decision approve/return; blocker add/resolve; phase add; dependency add/waive/remove/reinstate; milestone add/achieve/cancel/reopen/waive; evidence/responsibility linking. The UI supplies stable command IDs and revision guards, displays errors and preserves failed form input. Stale forms require refreshed review.

400 malformed command metadata; 403 forbidden; 404 absent/inaccessible instance; 409 stale revision, cycle/state conflict or concurrent write; 422 domain validation. Failure does not partially save. Idempotency receipts belong to an actor and exact payload; reuse with a different payload fails.

## Canonical storage

The implementation uses the platform’s JSON-record convention rather than the design ERD’s proposed table-per-entity layout. `execution_instances` stores a revisioned aggregate with stable UUIDs for tasks, phases, dependencies, outcomes, blockers, milestones, contribution links and context/evidence links. `execution_activity` is append-only command history with before/after facts; `execution_receipts` records committed retries. Assignment changes are preserved in those audit snapshots. No domain deletion command exists.

One Work Instance is the transaction/concurrency boundary. Snapshot, immutable action history, actual Ready transitions and receipt commit in one SQLite transaction. Conditional revision update prevents lost writes; SQLite serialises writers. Activity and receipt payloads consume storage proportional to the instance size, deliberately retaining history. Large-scale archival/compaction is not implemented; measure storage before a broad rollout.

No per-view writable status. Task lifecycle: open/in_progress/completed/cancelled; Work Instance: planning/active/completed/cancelled. Ready, Waiting, Upcoming, Blocked, overdue and consequences are derived. School-local calendar days are explicit; UTC timestamps record actions. Reads never create activity, and time passing never invents an actor.

Dependencies are same-instance finish-to-start DAG edges; waived edges remain structural, removed edges are historical. Cancellation is not completion. Decisions require explicit current-cycle approval. Return reopens explicitly selected completed prerequisites without reverse edges. Previously progressed successors retain their lifecycle and gain an exception. Restoring prerequisites or explicit waivers resolves exceptions. Reopened milestone contributions put previously achieved milestones back into review. Instance cancellation retains completed work and resolves outstanding flags as cancellation, not successful completion.

Role-only/unassigned tasks are permitted and visible to the lead but are not personally actionable. Dates and responsibility context are optional. Required evidence accepts a concise evidence note or pinned Document version. Provisional responsibility links require governance permission; read projections redact restricted links. Context is not authority. Layer 1, Documents and existing Tasks are never mutated.

## UI and remaining boundaries

Portfolio, Overview, Tasks, Planning, Timeline, Dependency Wheel, My Work and paged History use the same server projection. Selection survives tab navigation and reload through URL parameters. My Work refreshes while visible every 30 seconds and on focus/manual refresh. Own commands immediately refresh projections. Inspection dialogs return to the selected task. Semantic cards/lists and a Tasks table accompany the SVG Timeline. Execution-specific narrow-screen styles leave other modules’ shell unchanged.

Clone/templates, full network graphs, scheduling/resource optimisation, drag scheduling, exact-time dependencies, external calendars and realtime notifications remain deferred as agreed. Timeline offers fit-all, day, week and month ranges and keeps undated tasks available. Out-of-range work is counted explicitly and still contributes to readiness. The module is not registered as an intelligence component: the current component certification mandates operational insights, contrary to this build’s explicit no-Insights boundary. It remains a normal registered, routable platform module and is visible in Builder’s module list.

Tests use synthetic in-memory or isolated on-disk databases only. A successful local build is not publication or proof that an installed desktop app has updated.

## Task deletion

Project leads and Execution managers with write access can use **Delete task** in task details, including on completed/cancelled tasks and closed projects. `task.delete` requires `task_id`, `confirm_delete: true`, an expected revision and an idempotent command ID. The confirmation explains removal of both incoming/outgoing dependencies, task blockers, links, outcomes and milestone contributions. Related working exceptions and revision-target references are also cleaned. Removing a prerequisite can make other tasks ready; it never completes or approves them. Milestones are not automatically achieved and receive a contribution-deletion note. Source documents and Layer 1 records are untouched.

The task is removed from the current aggregate and all working views. There is no UI undo. The existing transactional activity snapshot retains before/after data, actor and revision, and the Activity entry retains the deleted title. Receipt retries are idempotent; stale edits fail. Deletion does not reopen a closed project.

## Project deletion

Project settings exposes **Delete project** to the project lead or an Execution manager with write permission. `instance.delete` requires explicit `confirm_delete: true`, the current revision and an idempotent command ID. It works for draft, active, completed and cancelled projects. The project and all its child work disappear from Projects, My Work and normal direct-read/history/context routes. No work is implicitly completed or approved, and no source documents or Layer 1 records are changed.

A deleted timestamp/actor and lifecycle tombstone retain the aggregate and transactional before/after activity for audit; there is no user-facing restore. Mutations and old deep links cannot reopen it. An exact deletion retry returns its original receipt to the still-authorised lead/manager. Other cached commands cannot resurrect deleted content. Workspace access filtering excludes tombstoned projects before projection.
