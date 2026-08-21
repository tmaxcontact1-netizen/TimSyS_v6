# Gradebook Provisioning component contract

Gradebook Provisioning owns the lifecycle of a gradebook instance, not academic evidence or calculations. Exactly one instance is provisioned for every teaching group, regardless of whether the group is expected to use it. The instance identity is stable across lesson, room, timetable, teacher, and enrolment changes.

Academic Structure remains authoritative for the group, assigned teachers, students, academic year, and subject. Closing a group closes entry without deleting the gradebook. Rollover creates new teaching groups and therefore new instances; prior instances remain historical. Reconciliation is idempotent and safe after missed or repeated provider events.
