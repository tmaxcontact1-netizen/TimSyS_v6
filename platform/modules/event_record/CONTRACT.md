# Event Record contract

Event Record owns the stable identity and lifecycle of an event. It does not own calendar publication, tasks, approvals, invitations, attendance, venues, resources, transport, catering, safety, contingency or finance. Those components link to the event using `subject_component=event_record`, `subject_type=event`, and the immutable `event_code`. `public_candidate` is eligibility metadata, never publication. Calendar remains the publishing authority. Completed records are immutable; cancellation and withdrawal preserve history.
