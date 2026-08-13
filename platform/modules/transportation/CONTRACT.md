# Transportation contract

Transportation owns provider, vehicle, journey and passenger-manifest records. Passengers are neutral party references; staff and student profiles are never copied. Journeys link to any consuming subject. Active vehicle windows cannot overlap and active passenger count cannot exceed capacity. Approval remains owned by the approvals component; this component records an approved lifecycle state for composition. Arrived journeys are immutable and withdrawal is reversible only after revalidation.
