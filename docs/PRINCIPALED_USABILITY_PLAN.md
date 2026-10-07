# Principal'Ed usability research and implementation plan — 7 October 2026

## Evidence and limits

Reviewed official product guidance and inspected its illustrated interfaces in the browser. This was not a logged-in evaluation of commercial accounts or a user study.

| Source | Observed pattern | Application here |
| --- | --- | --- |
| [Asana navigation](https://help.asana.com/s/article/navigating-asana?language=en_US) | Stable sidebar, compact project header, task list, details pane; create and filter near records | Direct navigation; one page hierarchy; contextual actions |
| [Linear concepts](https://linear.app/docs/conceptual-model) and [creation](https://linear.app/docs/creating-issues) | Tasks are primary work objects; projects group them; views do not change records; creation starts small | Plain object names, minimal creation, preserve workflow semantics |
| [Linear favorites](https://linear.app/docs/favorites) | Personal shortcuts reduce repeated navigation | Common destinations remain directly available |
| [Trello navigation](https://support.atlassian.com/trello/docs/navigation-in-trello/) | Global navigation is separate from board controls; searchable switching | Page search and breadcrumbs separate from record controls |
| [Trello card back](https://support.atlassian.com/trello/docs/new-card-back/) | Title and key properties precede description; content and actions have different locations; secondary activity is collapsible | Separate record properties, primary action, further detail and lifecycle actions |
| [Trello Inbox](https://support.atlassian.com/trello/docs/trello-inbox/) | Capture first, organise later; simple lists | Avoid showing every optional field before users can begin |

The transferable pattern is stable location and progressive detail, not copying any vendor's terminology or every shortcut. Linear's developer-oriented density and Asana's broader hierarchy would be excessive for routine school work. A Kanban drag operation must not bypass Principal'Ed approval/readiness rules.

## Current problems

Category-card detours conceal destinations. Sidebar descriptions consume attention. Home reports generic statistics rather than offering direct work. Repeated headings and setup prose push records below the fold. Several record pages permanently show large creation forms, even when users only want to find a record. Technical labels such as reusable component, subject identifier and execution leak the implementation model. Task details, project settings and navigation actions compete on the same screen. Cancel and delete are separate lifecycle operations and must remain visibly distinct.

## Build order

1. Add a Principal'Ed-specific shell: direct grouped page links, page search, breadcrumbs, narrow-screen navigation and keyboard access. Preserve permission/module filtering and unsaved-change guards.
2. Make Home a compact launchpad for available school work. Remove unsupported readiness claims. Keep notifications clearly separate from work.
3. Introduce reusable on-demand record forms and consistent page density. Apply them to the operational record modules, retaining all fields and validation. Keep technical details out of initial reading paths.
4. Rework Projects & tasks around compact navigation, the selected project/task, explicit actions and a return to the current list. Keep deletion, source provenance and approval semantics intact.
5. Test navigation/discovery, form opening/editing/saving/cancelling, unsaved-navigation protection, execution lifecycle/deletion, responsive layouts and installed archive integrity. Commit, push and publish only the Principal'Ed UI update, reusing the current backend when unchanged.

## Interaction standard

- Sidebar answers where to go; page header answers where you are; toolbar answers what to do.
- Name the object: Add student, Add task, Edit project, Delete project. Avoid generic Confirm and save where an exact action is known.
- Lists appear before forms. Show a purposeful empty state. Provide visible labels, status text and keyboard focus.
- One focused edit at a time. Do not discard a draft merely by opening another destination; retain the existing leave confirmation.
- Use a calm neutral surface, a single accent for primary actions, readable 14px body text and consistent controls. Destructive actions are labelled; colour alone is insufficient.
- Close detail returns to the current search/list. Opening a record never changes its workflow or governance state.
- Specialist network, timetable, assessment and approval operations keep their domain-specific controls and backend constraints within the shared shell. No new approval authority, guessed classification, Layer 1 import or production data mutation.
