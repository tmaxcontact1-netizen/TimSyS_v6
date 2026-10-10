# Principal'Ed workflow benchmark

Research date: 10 October 2026. Scope: platform-wide workflow and presentation research, not implementation approval. The platform-wide correction below takes precedence over the initial work-management emphasis.

## Platform-wide correction

The user clarified that the subject is all of Principal'Ed. Task management is one part of the platform, not its organising principle. The initial report did not adequately cover this scope.

The current module-to-view mapping in `apps/principaled/src/dashboard/Index.jsx` exposes people, calendars, scheduling, cover, programmes, assessment, events, participation, logistics, safety, finance, communications, documents, responsibilities and administration. That mapping establishes scope, not proof that each feature is fully implemented or usable. A common shell alone does not create a coherent platform workflow.

### Coverage and reference matrix

The proposed journeys below are Principal'Ed recommendations. Sources substantiate the comparison patterns, not every proposed step or a claim that Principal'Ed already supports them.

| Existing area | Principal'Ed journey to design | Reference and evidence limit |
| --- | --- | --- |
| Students, student profiles, staff, staff profiles | Find person → understand their current context → take a relevant action → see its outcome/history without re-finding the person | Arbor's [student profile](https://support.arbor-education.com/hc/en-us/articles/211750965-Student-Profile-Introduction-Navigation) combines student information and contextual operations. Consolidating directory/profile entry points is a recommendation, not a backend merge. |
| Calendar, scheduler, teacher preferences, cover | View day/week → inspect a session or conflict → resolve the issue → confirm the changed arrangement | Arbor [cover assignment](https://support.arbor-education.com/hc/en-us/articles/115004465089-How-to-assign-cover) exposes unarranged sessions, availability and optional agreement requests. This validates daily cover handling; full timetable construction and programme constraints need a specialist benchmark before redesign. |
| Programme manager, gradebook, assessment evaluator | Programme/class → relevant assessment → submission/evidence → evaluation → review/release → record | ManageBac+ [task and grading workflow](https://help.managebac.com/hc/en-us/articles/360033521871-Adding-Sharing-Grading-Tasks-QuickStart-Guide). Programme authoring and the evaluator's particular capabilities require a closer fit check. |
| Events, event planner, audiences, invitations, event attendance | Open one event → establish who/when/where → invite and track responses → check readiness → register attendance → close/review | Arbor [trip setup](https://support.arbor-education.com/hc/en-us/articles/30880769594141-Setting-up-Trips-2-Creating-a-Trip) connects people, dates, capacity, consent and registration. SchoolsBuddy [platform scope](https://help.schoolsbuddy.com/hc/en-gb/articles/4405335753229-SchoolsBuddy-FAQs) connects activities, sign-ups, payments and bookings. Neither establishes all our event readiness semantics. |
| Rooms, venue bookings, resource reservations | Choose date/time and needs → see available options → reserve → inspect/change/cancel from the originating event or calendar | Skedda's [regular-user scheduler](https://support.skedda.com/en/articles/105724-using-the-scheduler-as-a-regular-user) supports filtering spaces, seeing availability, making and managing bookings. Prefer availability before form entry. |
| Inventory | Find equipment → see location/custodian/condition → allocate or issue → return → inspect history | Snipe-IT [overview](https://snipe-it.readme.io/docs/overview) and [asset management](https://snipe-it.readme.io/docs/managing-assets) distinguish assets and check-out/check-in. Reserving future use and recording present custody must remain distinct. |
| Transportation, catering | Within an event/day → identify participants and needs → arrange provision → confirm → handle changes and day-of exceptions | SchoolsBuddy [transport help](https://help.schoolsbuddy.com/hc/en-gb/sections/4405055107981-Transport) and [feature overview](https://www.schoolsbuddy.com/blog/an-overview-of-schoolsbuddy-features) establish route selections, bookings and meal-booking coverage. Detailed catering fulfilment, dietary controls and event transport dispatch remain evidence gaps. |
| Risk assessments, safeguarding requirements, contingency | Open the relevant event/person/issue → record concern or requirement → review → take required action → record outcome | SafetyCulture [inspection workflow coverage](https://help.safetyculture.com/using-safetyculture/inspections?page=3) is relevant to inspections. It is not a substitute for a safeguarding case-management benchmark. CPOMS was identified, but its detailed guide could not be retrieved; no detailed CPOMS UI claims are made. Current safeguarding requirements must not silently become a newly invented case system. |
| Student exits, late entries | Find student → record the arrival/departure → check required authorisation → confirm current state → retain the history | An operational desk workflow requiring person-first search and fast repeated entry. Detailed vendor benchmarking is outstanding; this is a proposed journey, not a verified comparison. |
| Financial planning | Open event/programme budget → enter and review costs → see remaining amount → record permitted changes → review outcome | SchoolsBuddy's integrated activity/payment model supports contextual financial information, but collecting payments is not equivalent to our financial planning. Budgeting-specific comparison remains outstanding. No accounting/payment expansion is implied. |
| Documents | Find document in its working context → inspect current version → edit/upload revision → review if required → retrieve previous versions | SharePoint [versioning](https://support.microsoft.com/en-au/sharepoint/lists/documents-and-library/how-versioning-works-in-lists-and-libraries). Version history and approval are separate concerns; do not conflate a new version with approval. |
| Communications | Start from class/person/event or message centre → select and verify recipients → compose/preview → send → inspect outcome/replies | ParentSquare [communications](https://www.parentsquare.com/solutions/communications-teams/) documents targeted groups, translation and multiple delivery channels. This is product-level evidence; detailed compose, failure and reply interactions need hands-on confirmation. |
| Responsibilities, ownership, Nervous Breakdown | Ask who handles something → inspect role/responsibility/source → follow a relationship → inspect governance where authorised | Holaspirit and Kumu references below. Governed responsibility, ownership assignment and execution task are related but not interchangeable. |
| Projects, tasks, approvals | Capture/assign → act → review where required → complete/retrieve | Asana and Process Street references below; these must not dictate every other module's interaction model. |
| Intelligence, reporting | Choose question/report → inspect summary → examine underlying permitted records → save/share/export where supported | Arbor [reporting introduction](https://support.arbor-education.com/hc/en-us/articles/360016570258-Begin-Introduction-to-Reporting-in-Arbor). AI recommendation, evidence inspection and ordinary reporting must be visibly distinguished; no new AI functions are recommended by this comparison. |
| Builder, system health, registries, rules, users and other administration | Configure or diagnose as an authorised administrator → preview/validate → apply deliberately → inspect result | Requires its own administrator workflow review. Backend registries and diagnostics should not dictate everyday staff navigation. No claim that all status-only modules have user-facing workflows. |

### Platform information architecture proposal

Organise around recognisable working contexts: a person, class/programme, event, date/session, place/resource, document or organisational question. Keep the same underlying record accessible from relevant contexts rather than creating copies for each module. A global directory or register remains useful to specialists, but should not be a mandatory detour for every related action.

Use a role-appropriate home with today's context, outstanding decisions and recent work. Provide permission-aware search and stable navigation. My Work is a destination within this system, not the whole system. An administrator may need system health; a teacher generally needs classes, students and their day. Sensitive information must retain its access boundaries even when surfaced in a joined-up workspace.

Standardise interaction rules: record identity, contextual actions, field labels, validation, dates, recipient/person selection, attachment handling, status explanations, save feedback, history, deletion consequences and return navigation. Select the layout by activity: directory/profile, calendar/availability, register, guided setup, marking workspace, report or network. Do not turn every screen into a wizard or generic task board.

### Cross-platform scenario acceptance

Before implementation, map current versus reference steps and prototype at least these journeys:

1. Plan a school event through participation, space/resources, logistics, costs, safety requirements, communication and attendance. Preserve event context throughout; expose missing requirements where they matter.
2. Handle a teacher absence, identify affected sessions, arrange cover and verify the new arrangement without confusing a request with acceptance.
3. Find a student, inspect permitted information, record an operational action and retrieve its history without duplicate entry.
4. Create an assessment in teaching context, evaluate evidence, review and deliberately release the result.
5. Find a responsibility and its documentary basis; inspect draft hypotheses without altering governance.
6. Revise a document, retain provenance/version identity, follow the applicable review path and find the approved version.
7. Move from a summary/report to its underlying records while preserving filters and permission boundaries.

A platform-wide implementation plan should identify broken transitions, repeated data entry and competing entry points before specifying a new menu. Address evidence gaps above before redesigning those specialist areas. Benchmark ordinary users and administrators separately. This report is a broader documented comparison, not a claim that authenticated end-to-end evaluation of every comparator is complete.

## Evidence and limitations

This review used current official product documentation. It was not an authenticated hands-on evaluation, comparative user study, or accessibility audit. Described vendor behaviours are documented; proposed Principal'Ed adaptations are recommendations. Product maturity and documentation alone do not establish that an interface is optimal for our users.

The 7 October usability plan concentrated on navigation, form density and record controls. Those remain useful, but do not specify a complete journey through assignment, action, handoff, return for changes, completion and later retrieval. Existing technical create/retrieve tests likewise cannot establish that staff can understand and finish their work unaided.

## Comparable workflows

| Product and relevant job | Documented workflow | Proposed adaptation and boundary |
| --- | --- | --- |
| Asana: personal and project work | Assigned tasks appear in My Tasks, where users organise their work. Dependencies identify what blocks a task and notify the assignee when prerequisites complete. Approvals have explicit approve, request-changes and reject outcomes. | Start with the person's work across projects. Explain dependencies in the task itself. Keep review decisions explicit; do not copy the entire configurable project hierarchy. |
| Process Street: repeatable procedures | A workflow defines a procedure; each run is an instance. My Work gathers assigned tasks, approvals and runs. Submitted work reaches an approver; rejected work returns to the submitter for amendment and resubmission. | Separate designing a procedure from carrying it out. Give the worker the current step and required inputs; identify who acts next. A status label alone is insufficient. |
| Arbor: school operations | The personalised homepage links calendar sessions and outstanding to-dos to the work requiring attention. A student profile brings student information and contextual actions together, subject to permissions. | Enter through the school day or a student/class, with relevant context already selected. Avoid making staff travel through unrelated module lists to work on one person. |
| ManageBac+: teaching and assessment | Teachers create tasks in a class, associate assessment information and resources, then access submissions through the gradebook. Marking can show submission and assessment controls together and move between students. | Class → assignment → submissions → feedback → explicit release. Use a focused marking workspace. Do not copy automatic visibility of grades where Principal'Ed requires a deliberate publication decision. |
| Holaspirit: organisational responsibility | Roles have purpose, domains and accountabilities, alongside related checklists, projects and actions. Roles can be reached through the role directory or organisation chart. | Make a role understandable before showing its network. Distinguish continuing responsibility from a particular piece of work. Do not introduce holacracy terminology or reinterpret governed classifications. |
| Kumu: relationship exploration | Elements and connections have profiles. Users select an item, focus on its neighbourhood, adjust how far to expand, and save views. | Search → select → read → inspect related items → expand if useful. Keep list and network as projections of the same records, with visible evidence and review states. |
| Trello: quick capture and lifecycle | Inbox permits quick capture before moving cards into boards. Archived cards can be restored; permanent deletion follows archiving and confirmation. | Capture with minimal information, enrich in context. Specify recovery and deletion early. Do not copy archive-before-delete navigation: this user explicitly needs discoverable task and project deletion. |
| Linear: contextual relationships | Issue details expose blocking, blocked-by and related issues. Its resolution and duplicate operations can alter relationship or record state. | Borrow readable relationship labels and focused detail. Never transplant automatic relationship changes or duplicate merging into documentary responsibility evidence. |
| ClickUp: configurable organisation | Its hierarchy guidance describes spaces, folders and lists, with List, Board, Gantt and other views serving different purposes. | Useful breadth benchmark, but adopting that full hierarchy would add setup decisions. Keep routine work in a simple list; expose specialist views for an actual need. |

## Source register

- Asana: [My Tasks](https://help.asana.com/s/article/my-tasks), [dependencies](https://help.asana.com/s/article/task-dependencies), [approvals](https://help.asana.com/s/article/approvals).
- Process Street: [My Work](https://www.process.st/help/docs/my-work/), [running workflows](https://www.process.st/help/docs/running-workflows/), [approvals](https://www.process.st/help/docs/approvals/), [completed runs](https://www.process.st/help/docs/completed-workflow-runs/), [test preview](https://www.process.st/help/docs/preview/).
- Arbor: [personalised homepage](https://support.arbor-education.com/hc/en-us/articles/360014867198-My-Homepage-your-personalised-Arbor-dashboard), [student profile navigation](https://support.arbor-education.com/hc/en-us/articles/211750965-Student-Profile-Introduction-Navigation).
- ManageBac+: [adding, sharing and grading tasks](https://help.managebac.com/hc/en-us/articles/360033521871-Adding-Sharing-Grading-Tasks-QuickStart-Guide).
- Holaspirit: [role overview](https://help.holaspirit.com/en/article/role-overview-m6cn0z/).
- Kumu: [first steps](https://docs.kumu.io/getting-started/first-steps), [profiles](https://docs.kumu.io/guides/profiles).
- Trello: [Inbox](https://support.atlassian.com/trello/docs/trello-inbox/), [archiving and deleting cards](https://support.atlassian.com/trello/docs/archiving-and-deleting-cards/).
- Linear: [issue relations](https://linear.app/docs/issue-relations).
- ClickUp: [hierarchy guidance](https://help.clickup.com/hc/en-us/articles/20480724378135-Hierarchy-best-practices).

## Proposed workflow norms

These are adaptations for Principal'Ed, not claims about existing implementation or authorisation to build.

1. **One personal work queue.** Surface assignments and decisions across supported modules without making users understand their storage types. Separate actionable work from notification history. Suggested filters: Needs my attention, Upcoming, Waiting, Completed; these are views, not new database statuses.
2. **Create in context.** A task created inside Bayan Tank already belongs to that project. A class assignment starts with the class selected. Use names and search rather than exposing internal identifiers. Require only information necessary for the current action; ask for additional information when a later transition needs it.
3. **Make the next action explicit.** Show the request, owner, due date, current state and relevant next action together. When work cannot advance, explain the missing input or prerequisite and who can resolve it. Avoid presenting every possible transition with equal emphasis.
4. **Complete the handoff.** Submission must tell the sender where the work went and put it in the recipient's queue. Return for changes must include a reason, preserve prior work, and offer an obvious resubmission path. Review is optional where the actual workflow does not require it.
5. **Preserve context.** Open details alongside a list where space permits; narrow screens use a full detail page with a reliable return. Preserve search, filters and scroll position. Place files, discussion and history with the record they explain.
6. **Design the whole lifecycle.** Specify edit, reassignment, cancellation, completion, reopening, archive and deletion where supported. Task and project deletion must be separately discoverable. Show dependent-record consequences and permissions before confirmation; do not invent cascade behaviour.
7. **Share conventions, not identical screens.** Lists and details fit routine work; step-by-step screens fit procedure execution; submission/criteria split views fit grading; profiles and optional networks fit responsibilities. Use common action language, feedback, navigation and error treatment across these layouts.
8. **Preserve governance.** Evidence status and human review status remain independent. Draft inspection cannot approve anything. Same-wording responsibilities with distinct provenance remain distinct. No inferred direction changes, data imports, or new Layer 2/3 functionality follow from this research.

## Representative journeys to design before implementation

### Project work: Bayan Tank

Open the project → see its tasks → add a task with a title, adding owner/date when known → owner finds it in My Work → opens the request and resources → completes it or submits it if review is required → reviewer accepts or returns it with a reason → completed work remains findable.

Alternative paths must be designed alongside that happy path: correction, reassignment, blocked work, deletion of a test task, deletion of a test project, and abandoning an unsaved edit. The project context must survive each return. This is a proposed interaction sequence, not a change to project readiness rules.

### Responsibility question

Search a role or responsibility → read a concise result → inspect exact source and classifications → inspect a related responsibility/connection and its rationale → optionally open the surrounding network → return to the same result. Governance users can deliberately enter Draft Review, with persistent non-approved labels and connection treatment that does not rely only on colour.

### Procedure execution

Choose an existing procedure → start an instance with the necessary context → receive the current assigned step → supply required information → hand off → review or return for changes → complete and retrieve its history. Procedure authoring is a separate specialist workflow. This benchmark does not authorise building Nervous Breakdown Layer 2.

## Development discipline to reduce repeated redesign

Before changing a workflow, record a short specification containing:

- The user's job, starting context and observable finished outcome.
- A linked reference workflow, what is being reused, and why any departure is necessary.
- Each actor's steps, required information, next action and return destination.
- Empty, loading, failure, permission, rework and deletion/recovery behaviour.
- Existing backend/governance constraints; unsupported requirements must be identified rather than hidden behind new labels.
- A small prototype of the complete journey before applying it across modules.
- Scenario acceptance: complete the job without explanatory coaching; return for changes reaches the correct person; work survives navigation; completed work is retrievable; applicable delete actions are discoverable; keyboard and small-screen operation work; governance state is unchanged by viewing.

Use existing components when they support the reference interaction. A new custom component, hierarchy or status needs a concrete user benefit. Technical tests and user walkthroughs are complementary: passing a save/reload test does not demonstrate ergonomic usability.

No application code, production records, or release packages were changed by this research.
