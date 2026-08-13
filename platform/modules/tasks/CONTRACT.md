# Tasks component contract

Tasks records a discrete piece of work, its timing, priority, progress and prerequisite relationships. A task can stand alone or link neutrally to a record owned by another component using `subject_component`, `subject_type` and `subject_id`.

Tasks owns the task record, lifecycle, deadline, priority, dependency graph and transition history. It does not own people, responsibility assignment, approvals, notifications, calendar entries or the linked subject's workflow.

`responsibility_id` is an optional reference to the Ownership component. Tasks remains usable without Ownership, and it never duplicates a responsible party inside the task record.

A `blocks` dependency prevents completion while its prerequisite is incomplete. `related` expresses context only. Self-dependencies, cross-application dependencies and dependency cycles are rejected.

Lifecycle states are `pending`, `in_progress`, `blocked`, `completed` and `withdrawn`. Completing a task records `completed_at`; moving away from completed clears it. Withdrawal is reversible and retained for audit.
