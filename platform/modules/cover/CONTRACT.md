# Cover policy and eligibility contract

Cover is an operational component for explainable short-term staffing continuity. It recommends; an authorised human always decides and confirms assignments.

- Teachers form the default candidate pool. Other registered staff and manually entered external candidates are opt-in policy choices.
- Absence, an overlapping commitment, and being outside the working window are immutable eligibility gates, including during emergencies.
- Daily, weekly, and weekly-minute workload caps are configurable. Emergency policy may permit a human override, but the exception remains visible and requires a reason.
- Subject match, low contact load, fair distribution, class continuity, and staff preference are independently weighted advisory evidence.
- Non-contact periods are potential availability, not automatic assignments. Scheduler remains authoritative for timetable commitments.
- Teacher Preferences contributes advisory evidence only and never determines cover.
- Policies are app-scoped, revision-controlled, and retain immutable history.
- Absences are person-level operational facts with full-day, partial-day, multi-day, and open-ended forms. Cancellation never deletes their audit history.
- Published Scheduler placements and their calendar instances are the authoritative source for lesson demand reconciliation. Reconciliation is idempotent.
- Manual demands are allowed for duties or exceptional needs outside the published timetable, but their source and creator remain explicit.
- Absence category may support operations; confidential medical or HR detail is deliberately excluded from cover demands.
- Recommendation runs are immutable snapshots of the demand, policy revision, candidate evidence, exclusions, scores, and emergency state.
- Eligible and excluded candidates are both retained so users can understand scarcity and every non-selection boundary.
- Published Scheduler commitments, overlapping active Cover assignments, and active Cover absences are hard availability evidence. Teacher Preferences remains advisory evidence.
- Ranking never creates an assignment. A recommendation has no operational authority until the separate human-confirmation workflow acts on it.
- Assignment is an explicit authorised-human action. The candidate's live hard constraints are re-evaluated at confirmation time so stale evidence cannot create an unsafe allocation.
- Selecting anyone other than the highest-ranked eligible candidate is a permitted human override and requires a recorded reason. An ineligible candidate cannot be assigned.
- Reassignment, cancellation, and completion never overwrite history: prior assignments are ended and decision records are append-only. Cancellation reopens the demand; completion is permitted only after the cover period ends and closes the demand.
- Rejected recommendations remain part of the immutable recommendation run and gain a separate reasoned decision record.
- Operational analytics aggregate recorded demand, assignment minutes, cover provided, cover needed, class disruption, overrides, reassignments, rejections and completion rates over an explicit bounded period. They never infer absence cause, staff quality, fairness, or educational impact from counts alone.
- Cover consumes published Scheduler commitments but never rewrites or stales the base timetable. Scheduler continues to own the underlying lesson and its scheduled time.
- Cover assignment lifecycle events are operational facts for authorised downstream consumers such as communications, notifications, calendar overlays and future cover workflows. Consumers must preserve the human actor, reason and source demand.
- Intelligence signals declare evidence thresholds, uncertainty and audiences. Repeated demand and workload concentration are review prompts, not causal conclusions or automatic allocations.
- The component supplies health, heartbeat, usage, data-quality, and operational readiness insights under the universal component contract.
