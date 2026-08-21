# Scheduler setup contract

The Scheduler owns **when** learning and operational requirements occur. Phase 1 owns only initial setup and scheduling scope selection.

- A setup is unique per app and academic year and is versioned on every save.
- `school` mode schedules the whole school and requires exactly one active school scope.
- `selected` mode permits any active combination of section, programme, grade, and custom scopes.
- Scope references are provider-neutral external identifiers. Later providers may enrich them without changing Scheduler identity.
- Flexible setup answers belong in `configuration`; timetable cycles, periods, constraints, requirements, placements and solver state do not.
- Withdrawn scopes remain auditable and can be reinstated.

## Timetable structures

- A setup has one arbitrary 1–52 week rotation; labels are user-defined.
- Period templates describe reusable lengths such as half, single, double, or block periods.
- Day patterns belong to a scheduling scope and rotation week, so sections may run entirely different days.
- Period instances carry exact times and distinguish instruction, breaks, lunch, assembly, meetings, transitions, and other blocks.
- Structure replacement is atomic. Invalid weeks, inactive scopes, duplicate identities, invalid times, and overlaps are rejected with an explanation.

## Availability and philosophy

- Availability applies through provider-neutral references to staff, rooms, inventory resources, scopes, teaching groups, or locations.
- Available, unavailable, preferred, discouraged, and conditional states may recur within a cycle or apply for a date range.
- Room and resource blocking use the same availability contract; they are not special-case scheduler logic.
- Travel-time relationships express the minimum movement time between locations and may be directional or bidirectional.
- Philosophy is represented as transparent hard, soft, or advisory constraints with a rule type, parameters, weight, and mandatory explanation template.
- Every availability and travel rule requires a human-readable reason. Rule replacement is atomic.

## Requirements and candidate validation

- Requirements describe what must occur and remain independent of any proposed timetable.
- Teaching groups, eligible staff, rooms, resources, and period templates use provider-neutral external identities.
- Candidate validation is read-only with respect to the timetable and always produces a durable, explainable report.
- Structural fit, duration, eligibility, availability, double-booking, occurrence coverage, philosophy, and travel time are evaluated explicitly.
- Hard findings make a candidate set infeasible. Soft findings add weighted penalties. Advisory findings are retained without silently blocking placement.

## Generation and working drafts

- Generation creates separate immutable alternatives and ranks feasibility before score.
- Generated alternatives never overwrite one another; one feasible version may be selected as the working draft.
- Locks protect placements from manual movement and later solver passes.
- Manual overrides are restricted to the working draft, require a reason, create an audit record, and immediately revalidate the complete draft.
- Generation is deterministic for identical inputs and identifies its strategy; later solver implementations may replace the strategy without changing version contracts.

## Approval and publication

- Only a feasible working draft may be submitted; only a submitted version may be approved or rejected; rejection requires a reason.
- Only an approved version may be published. Publication supersedes the previously published version without deleting its audit history.
- Calendar entries are internal, recurring scheduled lessons bounded by the academic year; publication does not expose them on the outward-facing calendar.
- Publication creates missing teaching groups and emits idempotent teaching-group and scheduled-lesson identities, allowing Gradebook provisioning only when the timetable becomes operational.
- Publication links make Calendar and Gradebook side effects traceable and prevent duplication.

## Operational baseline

- All list endpoints cap pages at 50 records; the UI numbers rows across pages and remains horizontally scrollable.
- Readiness insights state whether setup is blocked, being configured, draft-ready, or operational and explain missing structures, requirements, validation failures, or publication state.
- Scheduler is a component: its health, usage, routes, records, dependencies, and operational insights are visible under the universal platform contracts.

## Provider and operational hardening

- Provider records are idempotent upserts keyed by provider, record type, and external identity; provenance, provider version, effective dates, payload hash, and withdrawal state are retained.
- Generated versions freeze and hash the complete input set. Later input changes mark non-operational versions stale and block selection, submission, approval, or publication.
- Schedule lifecycle writes accept an expected revision and reject lost updates.
- Publication uses durable idempotency jobs and traceable progress, and materialises local school times using the setup timezone.

## Programme windows

- Scheduler is the sole authority for programme time and availability.
- Only placements in the currently published schedule whose active requirement declares `programme_window: true` are exposed to Programme Manager.
- Window reads carry the published schedule revision, input revision, scope, cycle position, time, publication link, and a deterministic fingerprint.
- Staff, room, and resource availability is evaluated against registry state, requirement eligibility, explicit Scheduler availability, overlapping published commitments, and recorded cycle load.
- Availability reads are explanatory and paginated. They never allocate an entity or alter the published timetable.
