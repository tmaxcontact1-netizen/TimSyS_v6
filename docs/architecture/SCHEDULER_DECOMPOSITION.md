# Scheduler decomposition and contract boundaries

Scheduler is a constraint-driven placement module responsible for **when**. Programme Manager will own teaching-group composition and eligibility; Staff and Student registries own people; Rooms owns places; Inventory owns resources; Calendar owns instructional dates; Cover will own daily disruption.

Scheduler supports whole-school or scoped projects, independent section day structures, generic 1–N week cycles, reusable period templates, day-specific bell schedules, half days, multi-campus travel, shared staff and resources, controlled overlaps, and configurable scheduling philosophy.

## Frozen provider contracts

- Programme Manager provides versioned teaching requirements, teaching-group references, frequencies, durations, and eligible staff/room/resource identifiers.
- Teacher Preferences provides versioned availability and preference records. Each record states whether it is contractual, preferred, discouraged, or conditional.
- Calendar provides instructional dates, closures, half days, and special-day substitutions.
- Rooms and Inventory provide eligibility and availability; Scheduler requests provisional and published reservations through their contracts.
- Scheduler publishes immutable versioned scheduled-lesson events.
- Gradebook consumes teaching-group lifecycle and scheduled context; lessons never create separate Gradebooks.
- Cover consumes published schedule versions and daily exceptions without editing the published timetable.

## Decision contract

Rules are hard, soft, or advisory. Hard rules determine feasibility. Soft rules produce weighted optimization penalties. Advisory rules produce visible warnings without blocking placement. Every generated or manually edited placement must retain the rules evaluated, accepted compromises, exact blockers, and ranked remedies. No trade-off is silent.

This phase deliberately introduces no Scheduler persistence or solver implementation. Contract stability precedes tables, algorithms, and UI.
