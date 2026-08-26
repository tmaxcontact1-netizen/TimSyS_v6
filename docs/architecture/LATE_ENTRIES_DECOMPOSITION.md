# Late Entries and attendance reconciliation

Late Entries is the authoritative operational component for recording a student's arrival after an expected school or class start. Attendance and Classroom Attendance remain authoritative for school-level and subject-period marks. Late Entries supplies an immutable arrival fact, resolves schedule context, proposes attendance changes, and records the authorised human's reconciliation decision.

It does not share state with Student Exits. The two components may appear beside one another for front-office users because both require fast student scanning and clear custody/presence context.

## Invariants

- An arrival is saved even when schedule or attendance context cannot be resolved; unresolved context becomes a visible exception.
- No attendance mark changes without an authorised human confirmation.
- Every policy is versioned and effective-dated. Historical calculations retain the policy version originally applied.
- Tardies remain tardies. An absence-equivalence calculation never deletes or replaces its contributing occurrences.
- School arrival and late-to-class are distinct occurrence types and may use different rules.
- Corrections append compensating history. Arrival facts, attendance changes and threshold decisions are never silently overwritten.
- Frequency is not a finding of misconduct, staff quality, disability, medical need or family disengagement.

## Component boundary

Parts: arrival fact, reason catalogue, policy version, schedule-context resolver, reconciliation proposal, attendance mutation link, equivalence calculation, threshold definition and audit entry.

Operational components: Late Entries, Attendance Policy, Attendance Reconciliation, Attendance Workflow and Attendance Communications.

The future Attendance Management module composes these with Attendance, Classroom Attendance, Scheduler, Student Profile, Staff Profile and Communications.
