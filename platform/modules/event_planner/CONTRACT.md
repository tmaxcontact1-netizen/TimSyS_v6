# Event Planner contract

Event Planner is a composition module. It owns no event, calendar, people, operational, safety or financial records. Event Record supplies immutable identity and lifecycle; every constituent retains authority over its own data and workflow.

The module reads records linked with `subject_component=event_record`, `subject_type=event`, and the Event Record's immutable `event_code`. Calendar linkage uses the Event Record reference or Calendar's source contract. Readiness is advisory and fully explainable: it reports evidence, blockers and recommended actions but never approves, publishes, completes or changes an owning component's record.

Required planning areas are universal. Conditional areas are selected transparently from event type and existing linked records. A component becoming unavailable degrades its area to `unavailable`; it does not corrupt the event.
