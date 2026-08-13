# Ownership component contract

Ownership answers who is responsible for a record, who contributes, where responsibility was delegated or handed over, and where unresolved responsibility escalates.

Subjects are referenced by `subject_component`, `subject_type`, and `subject_id`. Parties are referenced by `party_type` and `party_id`. The producing component and party registry remain authoritative; Ownership does not copy their records.

Ownership provides assignment, contributor, delegation, handover, escalation, lifecycle and history capabilities. It does not own tasks, approvals, notifications, staff profiles, teams, or the subject's business workflow.

One active or proposed party may hold a given responsibility role for a subject. Handover closes the old responsibility and creates the successor responsibility. Delegation records temporary transfer while preserving the accountable owner. Escalation records use of the configured escalation path.

