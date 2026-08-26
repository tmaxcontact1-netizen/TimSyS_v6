# Student Exits decomposition

## Boundary

Student Exits is the authoritative operational component for temporary student movement, supervised destination hand-off, and release from campus. It records where responsibility for a student moved, who confirmed that movement, and whether the student returned or the custody transfer was closed.

It is deliberately not a medical, counselling, safeguarding, attendance, or discipline case-management system. Those components own their sensitive or specialist records and may link them to an exit by identifier. A movement record exposes only the minimum operational reason that its viewer is permitted to see.

The existing `medical_referrals` table and `/medical/referrals` API are retained during migration. They currently broker event-planning clearance and are not rewritten or copied into student movement records. A legacy link can associate a referral with an exit without moving restricted clinical content.

## Movement modes

1. `routine` — a short movement where release and return are normally sufficient, such as a bathroom or water request.
2. `destination_handoff` — the destination confirms receipt and release, such as medical, counselling, IT, library, reception, learning support, prayer, or a staff meeting.
3. `campus_release` — an authorised person records custody leaving the school, including the approving and releasing staff and, where applicable, the receiving adult.

The interface presents only the next valid actions. The state model remains explicit underneath so missing arrivals and returns cannot disappear silently.

## Canonical lifecycle

The superset lifecycle is:

`requested -> approved -> checked_out -> received -> returned -> checked_in`

Terminal or exceptional states are `cancelled`, `denied`, and `escalated`. Exit-type workflow configuration selects the stages that apply. Routine exits may use only `checked_out -> returned`; campus release may use `requested -> approved -> checked_out -> received` and then close without a classroom check-in.

Every state change appends a transition. Corrections append compensating history; they never overwrite or delete prior transitions.

## Component relationships

Student Exits consumes stable identifiers and capabilities from:

- Student Registry and Student Profile for identity, section, accommodations, and permission context.
- Staff Registry and Staff Profile for releasing, receiving, approving, and sanctioning people.
- Academic Structure and Scheduler for the expected class, supervising teacher, period, and location.
- Room Manifest for origin and destination identity.
- Classroom Attendance for context only; an exit never changes attendance automatically.
- Medical Referrals, safeguarding, counselling, and future specialist components through restricted links.
- Communications, Approvals, and Documents for notifications, evidence, and governed release workflows.

It publishes movement facts and exceptions. Consumers must not infer diagnosis, misconduct, or absence from an exit.

## Permissions

Permissions are action-specific: request, release, receive, return, check in, cancel, configure, view restricted reasons, authorise campus release, and record custody transfer. Campus release always requires explicit confirmation by an authorised human. The default sanctioning roles are administration and reception/secretarial staff, but the school owns the role mapping.

## Privacy and retention

Operational and restricted reasons are separate fields. General users see the operational label; sensitive detail remains in its source component. Analytics must support exclusions and contextual denominators so disability, medical need, safeguarding engagement, and religious observance are not presented as misconduct.

Routine movement data may have a shorter configurable retention period than campus-custody and safeguarding-linked records.

## Migration strategy

1. Create Student Exits tables alongside existing medical-referral storage.
2. Do not rename, alter, delete, or copy `medical_referrals` rows.
3. Provide an optional one-to-one legacy link from an exit to a medical referral.
4. Keep the existing medical routes and capability names until every consumer has migrated.
5. Register Student Exits as operational only after state, permission, and compatibility tests pass.
6. Retire the old component boundary only in a later explicit migration; retain its specialist data and audit history.
