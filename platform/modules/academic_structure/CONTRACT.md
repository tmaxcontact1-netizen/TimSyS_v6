# Academic Structure component contract

Academic Structure owns academic years, configurable reporting periods, programmes, subjects, teaching groups, teacher assignments, and student enrolment in those groups. Student Registry and Staff Registry remain authoritative for people; Calendar remains authoritative for general date presentation and scheduling.

Every provider-neutral teaching group is gradebook eligible. A group represents a persistent teaching context, not an individual lesson. Scheduler or another provider may reconcile groups through idempotent `teaching_group.*` events without receiving access to Academic Structure's private tables.

All active assigned teachers have equal operational access. Individual actions remain attributable. Withdrawing a student closes the enrolment interval but preserves its group, evidence, and reporting history. Reporting-period configuration resolves from gradebook to course/subject to programme to school default and is always constrained by the academic year.
