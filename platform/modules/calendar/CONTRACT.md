# Calendar component contract

Calendar owns the platform's reusable scheduling surface. It answers what is placed in time, when it occurs, and who can see it.

It owns calendar entries, layers, recurrence and occurrence generation, visibility, internal/outward projection, calendar presentation settings, academic-year boundaries, and rollover.

It does not own event records, participants, tasks, rooms, equipment, transport, catering, medical workflows, risk, safeguarding, contingency, budgets, purchasing, approvals, documents, communications, or evaluation.

Producing components link records through `source_component`, `source_record_id`, and `source_type`. Calendar may display and navigate that link, but the producer remains authoritative for its workflow. Direct calendar entries have no source link.

Dates are stored as ISO instants and presented with January–December month names. Initial setup explicitly defines calendar-year and academic-year start and end dates.

Only internal entries contribute calendar evidence to intelligence. Outward projections are publications of those entries, not separate evidence.
