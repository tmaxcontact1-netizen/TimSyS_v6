# Programme Manager foundation contract

Programme Manager owns programme configuration, generated selection workflows, explainable allocation recommendations, human-confirmed programme enrolments, and programme operations. It never owns student or staff identity and never owns timetable publication.

- Scheduler is authoritative for time and availability. Programme Manager may only configure within a published Scheduler boundary and may only expose staff, rooms, and resources that are available within that boundary.
- A programme window is a published Scheduler placement whose active requirement explicitly declares `programme_window: true`. Draft, generated, validated, submitted, approved, stale, cancelled, or ordinary lesson placements are never exposed as programme windows.
- Availability is evidence captured from the same published schedule version, eligibility declarations, explicit availability rules, registry status, overlapping commitments, and cycle load. Programme Manager does not reproduce or weaken these checks.
- Window and availability fingerprints allow later programme drafts to detect Scheduler changes before configuration or allocation proceeds.
- A scheduling change request may be raised later, but Programme Manager cannot create or publish timetable placements.
- Every programme is app-scoped, academic-year-scoped, revision-controlled, and permanently auditable.
- Creation produces a draft. A draft or configured programme may be revised. Withdrawal preserves its previous state and reinstitution restores that state.
- Configured, active, closed, and archived transitions are declared lifecycle states but are not exposed until their prerequisite setup, scheduling, survey, allocation, and operational contracts exist.
- Allocation is always a recommendation. An authorised human confirms all placements, overrides, and publication actions.
- Parts do not publish health or insights. The Programme Manager operational component publishes universal platform health and operational insights.
- List endpoints return no more than 50 records per page.

## Nested setup

Every programme is configured through an ordered, resumable setup contract: purpose (what), timing (when), location strategy (where), participation (who), and governance (authority). Timing must reference one or more programme windows in a published Scheduler version. Location setup records a strategy and requirements only; it does not reserve rooms or resources. Participation records the intended population shape but does not enrol people. Governance distinguishes submitters, amendment rights, manual editors, and owners.

Setup answers are revision-controlled and fully audited. Completion means all five sections contain valid answers; it does not activate a programme. An authorised human must explicitly confirm the completed setup with a reason. Confirmation revalidates the Scheduler fingerprints and moves the programme to `configured`. Editing a confirmed setup reopens the programme as a draft until it is confirmed again.

## Templates and defaults

Templates are optional defaults, never hidden decisions. The platform supplies a small set of read-only system frameworks for activities, enrichment, and electives. A school clones a system framework before editing it, preserving a stable baseline while allowing complete local customisation. Schools may also create templates directly or save the reusable parts of an existing programme setup.

Templates may contain programme defaults and reusable purpose, location, participation, and governance answers. They cannot contain Scheduler setup IDs, placement IDs, or other timetable-specific timing references. Applying a template preserves valid timing already attached to the target programme and otherwise leaves timing incomplete. Application is revision-controlled, audited against the programme and setup, and reopens a configured programme for human review and reconfirmation.

## Offerings, eligibility, and capacity

An offering is the operational choice unit beneath a configured programme. Every offering belongs to one confirmed programme Scheduler window. Its proposed staff, room, and resource references are accepted only when Scheduler reports them available; Programme Manager also prevents staff or room reuse and excessive resource quantity across offerings in the same window.

Capacity is hard by default. Advisory capacity must be explicit and is surfaced as an advisory rather than silently enforced. Eligibility supports open or restricted populations, explicit inclusion and exclusion lists, and typed hard or advisory custom rules. Offering relationships declare prerequisites and incompatibilities and are exposed as a dependency graph.

Offerings remain drafts until an authorised human confirms their readiness with a reason. At least one available staff facilitator is required. Confirmation rechecks live Scheduler evidence. Editing or reinstating an offering returns it to draft and requires fresh confirmation. This phase configures choices only; it does not collect preferences or allocate students.

## Nested surveys and publication

Survey designs are ordered question graphs with stable keys, parent-child relationships, typed conditions, and validated question configuration. The generated student flow begins with grade, class, and student identity and then creates ranked selection questions for every Scheduler window represented by ready offerings. Choices in the same window share a uniqueness group so a respondent cannot repeat the same offering across preference ranks.

Designs remain editable drafts. Publication requires an authorised human, a reason, at least one channel, a complete identity and selection flow, and offerings that are still ready. Each publication stores an immutable snapshot of the survey, questions, relevant offerings, channels, and response rules. Native, public-link, and Google Forms schema-export channels are supported. A live publication accepts responses only through channels enabled in its immutable channel manifest.

Withdrawing or closing a survey ends its live publication. Reinstatement returns it to draft rather than silently restoring an old public version. Revised submissions will reset their priority timestamp, duplicate preferences will be rejected, and allocation will require human confirmation; these rules are embedded in the publication snapshot for downstream enforcement.

## Multi-channel response intake

Native, public-link, Google Forms, and CSV records enter one canonical response store. Public submissions use a high-entropy publication token and receive a separate private amendment token. External imports require authorised administration and accept at most 1,000 records per request. Source record keys make imports idempotent; receiving changed content for the same source record creates a revision rather than a duplicate.

Incomplete, malformed, unknown, or duplicate-choice records are never silently skipped. They are stored with structured flags and returned to the caller as `accepted_with_flags`. Bulk imports report `skipped: 0`. Governance violations on interactive submissions are rejected as permission failures; governance problems in authorised historical imports are retained as flags for review.

Every revision creates an immutable audit snapshot and resets identity reconciliation to pending. Interactive revisions use server time as the new priority timestamp. Revised external records use a trusted source revision timestamp when supplied, otherwise the ingestion time. The original and revised records remain traceable. Intake does not match identities or allocate students; those responsibilities belong to later phases.

## Identity reconciliation and duplicate people

Identity reconciliation reads canonical students from Student Registry and never creates a competing identity record. A unique exact canonical student ID may be matched automatically and records its evidence. Name, date-of-birth, grade, class, and preferred-name signals produce ranked candidates only. Probable, ambiguous, and unmatched identities remain in a human review queue; the engine does not select among them.

Human identity decisions require explicit confirmation, an authorised actor, a reason, and optimistic concurrency. Candidate sets and every system or human resolution are versioned and audited. Amending a response invalidates its previous resolution, clears the canonical link, and requires reconciliation again.

Multiple active responses matched to the same student and survey create a duplicate case. Priority timestamps are displayed as evidence but do not decide the case. An authorised human may identify one primary response or explicitly allow multiple responses. Excluded responses remain preserved rather than deleted. Identity changes recalculate both the old and new student's duplicate cases so stale decisions cannot survive.

## Explainable allocation recommendations

Allocation runs are deterministic recommendations generated from an immutable snapshot of the published survey, current ready offerings, reconciled identities, duplicate decisions, and response revisions. Responses are considered by their current priority timestamp and stable record ID; each ranked preference is then attempted in order. Hard eligibility and capacity are enforced. Advisory capacity, contextual eligibility rules, prerequisite gaps, incompatibilities, and multiple allowed responses competing in the same window are surfaced for human review.

Every response receives an explicit outcome: recommended, review required, unplaced, or excluded. Each outcome records its reason, attempted choices, constraint evidence, and relevant human decisions. Flagged intake records, unresolved identities, inactive students, unresolved duplicates, and human-excluded duplicate responses remain visible rather than disappearing from the run.

Generating a new run supersedes the previous recommendation set but preserves both snapshots and their results. A run never creates enrolments, changes a timetable, or makes an allocation decision. Those actions require the separate human-confirmation workflow.

## Human intervention and confirmation

Every non-excluded recommendation enters an intervention queue. An authorised human explicitly accepts the recommendation, rejects it, or records a manual placement. Review-required and unplaced results cannot be accepted as though they were ordinary recommendations. Manual placements remain inside the recommendation's Scheduler window and are checked against the immutable offering snapshot. Capacity exceptions and other overrides remain visible as structured flags and always require a reason.

Decisions use optimistic concurrency and create an immutable audit entry for every creation or revision. Excluded responses cannot be allocated. A decision set cannot be sealed until every actionable recommendation has a recorded human decision. Sealing requires separate explicit confirmation and a reason, stores an immutable snapshot tied to the allocation input hash, prevents further edits or regenerated runs, and still creates no enrolments. The confirmed snapshot is the sole input to the later enrolment handoff.

## Enrolment publication and Event Attendance

Programme enrolments may be published only from a sealed allocation decision snapshot and require a further explicit operational confirmation. Publication is idempotent and revalidates canonical Student Registry status. Accepted and manually placed decisions create active enrolments; rejected and excluded outcomes remain preserved in their original decision and recommendation records. A student cannot hold two programme enrolments in the same Scheduler window.

The first successful enrolment publication activates a configured programme and records that lifecycle transition in the programme audit. Publication retries do not repeat the transition or duplicate enrolments.

Programme Manager owns enrolment lifecycle and exposes active offering rosters. Withdrawal and reinstatement require confirmation, reasons, optimistic concurrency, and immutable audit history. Neither action changes Student Registry identity or Scheduler placements.

Event Attendance remains authoritative for occurrence-level presence. When an actual offering occurrence is opened, Programme Manager snapshots the current active roster, creates a neutral Event Attendance session referencing the programme offering, and idempotently seeds canonical students as expected participants. The handoff records its roster hash, session link, status, and failure evidence; it never creates classroom attendance.
