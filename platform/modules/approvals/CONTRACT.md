# Approval Workflow component contract

Approvals records a request for an explicit decision about a record owned by another component. The subject is referenced by `subject_component`, `subject_type` and `subject_id`; Approvals never copies or mutates the subject.

An approval request contains one or more ordered stages. Each stage names an approver target and a positive-decision quorum. Stages activate sequentially. Any rejection resolves the request as rejected; reaching a stage quorum activates the next stage, or resolves the request as approved when no stages remain.

Recorded decisions are immutable. Corrections require withdrawal and a new approval cycle, preserving the original history. Draft requests may be edited; submitted or resolved requests may not.

Approver targets are declarations (`user`, `staff`, `team`, or `role`). Authentication and route permissions establish who may record a decision. Future identity and delegation policy may further constrain target membership without changing this contract.

Withdrawal retains the request, stages, decisions and audit history. Reinstatement returns it to draft, clears no history, and requires a fresh submission; stages and decisions from the prior cycle are reset only where no decision was recorded. A previously decided cycle must be copied into a new request instead of reinstated.
