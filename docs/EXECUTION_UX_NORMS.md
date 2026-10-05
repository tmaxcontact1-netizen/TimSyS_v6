# Execution workflow and presentation norms

Execution helps school staff answer: What should I do next? What is stopping me? What happens when I finish?

## Everyday workflow

1. Open **My Work**. Ready and in-progress tasks appear under **Next up**. Blocked work appears under **Needs attention**; dependent and future work appears under **Waiting and scheduled**.
2. Open a task. Read the owner, due date, status and any unmet requirements. Keep the project list alongside the detail on wide screens; on small screens use **Close details** to return to the list.
3. Start the task, record a blocker if help is needed, or complete it. Approval tasks explicitly say **Approve decision**. Completion and approval show their consequences before saving.
4. Return to My Work for the next task. Do not manually move waiting tasks to ready: readiness follows existing prerequisites, dates, owners and governance rules.

## Planning norms

- A **project** is the UI name for an existing Execution work instance; this is not a new data entity.
- Start with the outcome in the project title. Add one observable action per task, using a verb and a concrete result. Assign a named owner; dates may remain unknown.
- Draft projects show a three-step guide: add tasks, choose a project lead and task owners, start when ready. Starting is explicit, never triggered by opening or editing a project.
- Add a prerequisite only when one task genuinely cannot proceed before another finishes. Open the task's before/after section to set it; the handoff diagram is an optional explanation.
- Use a decision only where someone must explicitly approve an outcome. Use milestones for meaningful completion points, not every task.
- Review unfinished work in the task list, progress in **Progress**, and dates in **Timeline**. Project settings, milestones, closure and activity remain available through **More**. Cancellation and reopening require explicit actions and retain their existing audit rules.
- Completion evidence, source links, waivers, reopening, review exceptions and permission boundaries retain their existing semantics. Presentation labels do not alter stored states.

## Presentation norms

- Default landing: My Work. Primary global choices: My Work and Projects. Project default: Tasks.
- Four list columns: task, owner, status, due date. Reasons and technical provenance appear on selection rather than filling every row.
- One selected task at a time. Ordinary selection does not switch to a diagram. Close returns to the current list/search; keyboard focus enters the detail when selected.
- Three project views: Tasks, Timeline, Progress. Specialist controls are under More. Existing deep links still work.
- Task creation shows title, description, owner and due date first. Approval type, start date, phase, role and evidence requirements are optional expanded fields.
- Use everyday labels: Projects (not Portfolio), New project (not New Work Instance), Draft, Ready to start, Waiting on another task, Needs help, Done. Stored identifiers and API states stay unchanged.
- Status uses text as well as colour. Preserve keyboard focus, modal trapping, explicit confirmation, error messages, provenance and permission checks. Never hide unresolved organisational truth behind a simplified label.
- Keep the Principal'Ed dark visual language, calm spacing, a short list and a distinct task detail area. Avoid nested walls of cards and multiple permanent toolbars.

## External patterns considered

- [Asana navigation](https://help.asana.com/s/article/navigating-asana?language=en_US): task lists, alternative views and task details on demand.
- [Linear My issues](https://linear.app/docs/my-issues): an individual work queue separate from wider project exploration.
- [Trello boards](https://support.atlassian.com/trello/docs/creating-a-new-board/): simple visible organisation of tasks into understandable stages.

These inform the presentation; Execution's existing governed readiness and handoff model remains authoritative. No new Layer 1 mappings, approval rules, workflow engine or database migration is introduced by this pass.

Task cleanup: project leads and managers can open a task and choose **Delete task**. Confirm the link and milestone effects before deleting. The task leaves all working views; audit history remains. Use Cancel to retain a task visibly as cancelled, or Delete to remove test/erroneous work. Source documents are never deleted by task cleanup.
