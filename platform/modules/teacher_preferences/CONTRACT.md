# Teacher Preferences contract

Teacher Preferences records ranked, time-bounded advisory evidence about work a staff member would prefer or rather avoid. It never allocates work and never overrides a human decision.

- Preference domains are grade level, subject, elective, activity, and role.
- Qualifications, certifications, demonstrated competence, availability, and contractual eligibility remain separate evidence.
- `prefer` and `avoid` entries become signed advisory weights. Rank and confidence affect strength, not authority.
- `declared_restriction` records a staff declaration. It remains pending until an authorised human confirms or declines it and cannot self-confirm.
- A confirmed restriction may be consumed as eligibility evidence by another component, but the consumer must retain the review provenance and explain its effect.
- Every entry has a stable external identity, effective period, revision, lifecycle status, and immutable supersession lineage.
- Provider records conform to Scheduler's `teacher_preferences` provider boundary and remain soft/advisory unless a separately reviewed restriction contract applies.
- Scheduler ingestion is explicit and human-triggered. It is idempotent, versions every input, and marks unpublished schedules stale only when advisory inputs materially change.
- Readiness insights report staff coverage, lifecycle usage, domain/stance distribution, and pending human reviews; they never convert preferences into decisions.
- The component provides health, heartbeat, usage, data-quality, and operational insights under the universal component contract.
