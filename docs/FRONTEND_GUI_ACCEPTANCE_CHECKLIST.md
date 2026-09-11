# TimSyS Front-end GUI Acceptance Checklist

Status: mandatory release gate  
Scope: Launcher, Principal’Ed, MemeCoin’Ed, Dress’Ed, Research’Ed, and future TimSyS applications

This checklist turns established desktop-interface, accessibility, form-design, data-presentation, and safety practice into a TimSyS completion standard. “Present” is insufficient: each item must work in the normal, empty, loading, validation, success, failure, permission-denied, stale-data, and large-data states that apply to it.

## 1. Orientation and navigation

- [x] The application and current workspace are named visibly.
- [x] One navigation destination is visibly selected.
- [x] Back returns to the preceding meaningful screen.
- [x] Return to launcher is permanently available.
- [x] Refreshes preserve the current screen, filters, pagination, and unfinished input.
- [x] Empty screens explain what belongs there and how to begin.
- [x] First-run screens provide a short, task-oriented path to useful work.

## 2. Actions and feedback

- [x] Every data-changing action immediately shows that work has started.
- [x] Every completed action explicitly reports success or failure.
- [x] Success identifies the result; specific workflow wording takes precedence over generic confirmation.
- [x] Errors explain what failed, preserve input, and give a safe next step.
- [x] Repeated submission is prevented while an action is running.
- [x] Destructive and consequential actions use an application-owned confirmation dialog.
- [x] Confirmations name the affected item and explain the consequence.
- [x] Native browser alerts, prompts, and confirmations are forbidden.
- [x] Reversible lifecycle actions provide reinstate, restore, or an equivalent recovery path.
- [x] Buttons provide hover, focus, active/pressed, disabled, and busy feedback as applicable.

## 3. Forms and input

- [x] Every control has a persistent human-readable label.
- [x] Placeholders are examples, never the only label.
- [x] Required information is apparent before submission.
- [x] Input types match the data: dates, times, numbers, money, files, selections, long text, and structured rows.
- [x] Validation appears beside or immediately above the affected work.
- [x] One invalid field does not erase other valid input.
- [x] Cancel genuinely cancels and never submits.
- [x] Long setup processes use named steps, progress, review, and final confirmation.
- [x] CSV and batch imports retain imperfect rows for human review instead of silently discarding them.

## 4. Lists, tables, and scale

- [x] Lists contain no more than 50 records per page.
- [x] Row numbering remains continuous across pages.
- [x] Result totals and the displayed range are visible.
- [x] Search and relevant filters operate across the dataset, not only the current page.
- [x] Sort order and filter state remain stable during refreshes.
- [x] Wide data remains reachable through an obvious scrolling region.
- [x] Empty, loading, error, and no-results states are distinct.
- [x] Flagged or incomplete records are visible in their corresponding lists.
- [x] Frequent row actions are concise; detailed work opens in a dedicated workspace.

## 5. Accessibility and desktop ergonomics

- [x] All interactive controls are keyboard operable.
- [x] Keyboard focus is strongly visible.
- [x] Semantic buttons, links, headings, labels, tables, and landmarks are used.
- [x] Status changes use polite live announcements; failures use alerts.
- [x] Dialogs declare their purpose and modal relationship.
- [x] Colour is never the sole carrier of status or meaning.
- [x] Text and controls maintain usable contrast in the dark-first interface.
- [x] Reduced-motion preferences are respected.
- [x] Click targets and spacing are suitable for sustained desktop use.
- [x] Content is not hidden merely because the window is smaller; scrolling remains available.

## 6. Output, insights, and decision support

- [x] Facts, calculations, warnings, recommendations, and human decisions are visually distinguishable.
- [x] Insights identify their evidence period and underlying records.
- [x] Exact values use tables; comparisons and trends use charts only when clearer.
- [x] Narrative interpretation uses plain language and states limitations.
- [x] Recommendations never execute a decision automatically.
- [x] Every actionable insight links or routes to the relevant work area.
- [x] Technical diagnostics are expandable and do not replace the human explanation.

## 7. Safety, continuity, and trust

- [x] Unsaved work is protected from accidental navigation or refresh.
- [x] Background health checks never redirect active work.
- [x] Audit-sensitive actions capture the actor, time, reason, and resulting state where required.
- [x] Permission restrictions are explained without exposing inaccessible data.
- [x] User-facing language describes the task, not internal endpoints, schemas, or component names.
- [x] The UI never claims success before the server or supervised application confirms it.

## 8. TimSyS requirements above the ordinary minimum

- [x] Every app shares the same navigation, feedback, dark-mode, pagination, and confirmation principles.
- [x] A platform-level mutation-feedback host prevents silent completion even in legacy screens.
- [x] Human authority is explicit: the system recommends and explains but does not decide.
- [x] Components and modules expose health and operational insights appropriate to their role.
- [x] Backend capability coverage is audited separately from visual presence.
- [x] The installed-runtime path is tested, not merely the development browser.
- [x] Future app manifests inherit this required UI contract through Builder.

## Automated release gates

`node scripts/audit-gui-practice.mjs` fails when an app loses universal action feedback, reintroduces native browser dialogs, removes focus or reduced-motion support, weakens pagination context, or relaxes mandatory interaction contracts. The complete workspace verification additionally runs application tests and production builds.

Visual judgment still requires a desktop walkthrough. Automation proves structural safeguards; it cannot prove that wording, spacing, hierarchy, or a domain workflow feels intuitive to a human operator.
