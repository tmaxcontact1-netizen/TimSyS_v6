# TimSyS Desktop Interaction Standard

Status: mandatory for launcher and application UI work

## Screen contract

Every screen must make location, available work, attention items, and the result of the latest action clear without requiring knowledge of the backend architecture.

## Navigation

- Use a persistent application sidebar with one selected destination.
- Use task language, not component or implementation names.
- Back returns to the preceding meaningful view. Return to launcher is always available.
- Detail work opens in a dedicated workspace or drawer; large workflows do not use browser prompts.
- Preserve the current destination and filters during background refreshes.

## Actions

- One visually dominant primary action is permitted per region.
- Creation and edits preserve a local draft until submitted or deliberately discarded.
- Delete, withdraw, publish, allocate, execute, and financial actions require an explicit confirmation that names the affected record and consequence.
- Reversible actions offer undo or a corresponding reinstate action.
- Disabled actions explain their unmet prerequisite.
- Every data-changing request shows an immediate working state and an explicit success or failure result. Silent completion is forbidden, even when the resulting record also appears in a refreshed list.
- Applications use the shared mutation-feedback host as a baseline. Context-specific confirmation remains in the workflow when it can identify the affected record more clearly.

## Forms

- Labels remain visible; placeholders are examples, not labels.
- Required fields are identified before submission.
- Use the input matching the domain: dates, times, numbers, money, searchable selection, multi-selection, file upload, structured repeating rows, or long text.
- Validate close to the field and preserve every valid value when another field fails.
- Long setup processes use named steps, a progress indicator, review, and explicit final confirmation.

## Lists and records

- Lists use a maximum of 50 rows per page, stable row numbering, search, relevant filters, sortable columns, and visible result counts.
- Selecting a row opens the record; row actions are limited to frequent contextual operations.
- Related records, audit history, and applicable insights appear in the record workspace.
- Empty lists explain why they are empty and how to create or import the first record.

## Feedback

- Loading preserves the page structure and indicates the region being refreshed.
- Success states identify what changed.
- Errors state what failed, whether input was preserved, and the safe next action.
- Technical diagnostics are expandable and never replace the user-facing explanation.
- Background health does not navigate the user away from active work.

## Outputs and insights

- Facts, calculations, recommendations, warnings, and human decisions are visually distinct.
- Every insight identifies its evidence period and links to the underlying records.
- Charts are used only where comparison, distribution, or change is easier to understand visually.
- Tables are used for exact values; concise narrative is used for interpretation.
- Recommendations never execute decisions automatically.

## Completion gate

A screen is complete only when its normal, empty, loading, validation, success, error, permission-denied, and stale-data states are handled; its operational backend connections work; its output is understandable; and it passes installed-runtime testing.
