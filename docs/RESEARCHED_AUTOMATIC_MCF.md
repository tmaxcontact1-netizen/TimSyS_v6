# Automatic MCF workflow — Research’Ed 0.8.0

The user's approval on 10 October 2026 supersedes the earlier restriction on machine classification. The normal MCF workflow now performs the analysis instead of requiring the researcher to code every passage. This follows the evidence-linked, reviewable results pattern documented in RESEARCHED_WORKFLOW_DECISIONS.md and the user's explicit calibration: no competency checklist or mandatory explicit/implicit decisions.

## Workflow

1. Upload a document. File detection, original preservation and segmentation are unchanged.
2. All prepared passages are included by default. Inspecting/excluding text is optional. Compiled documents retain the structural mapping check, including a bulk action for clearly identified boundaries; genuinely ambiguous boundaries still require a decision. Spreadsheet text-column mapping remains where needed.
3. Choose **Analyse all 21 competencies**. Automatic analysis is the default; manual coding is an advanced alternative. A configured AI connection is required. Starting the analysis sends the selected passages and frozen instrument to that connection.
4. Read the competency report. Directly stated and contextual findings are identified automatically. Open evidence or the contextual/mixed findings group if useful. Correcting a passage is optional.
5. Confirm and download. Confirmation saves a report, not a claim that every machine finding was reviewed by a human. Only explicit corrections create human coding decisions.

Existing manual drafts can use **Analyse automatically** without re-uploading. Existing researcher corrections are preserved. Undo/redo, permanent deletion, timestamps and dark/light themes remain available.

## Research semantics

- MCF v1.0 is unchanged. Classification configuration 1.1 is separate; it batches selected units in source order and never crosses individual record boundaries. Only selected text is transmitted. Context outside a bounded batch is unavailable to that request.
- The existing configured provider is reused. No provider subscription or external model run is created by these tests.
- Machine proposals, exact quotations, provider/model, run configuration and researcher decisions remain separate. Invalid/missing output fails its batch; it cannot silently become a no-code result.
- A terminal run is pinned on confirmation. Its immutable proposals remain in their existing tables; the workbench stores compact report metadata, avoiding a full duplicated corpus in every draft save. Evidence export includes that precise run, outputs and task errors. Later runs do not change the saved report.
- Partial/cancelled runs with some valid output can be saved and show missing coverage. Empty/failed/running reports cannot be confirmed.
- Contextual/mixed is a spot-check grouping, not calibrated uncertainty. Passage counts are descriptive counts, not competency scores. The 0–3 documentary assessment, domain aggregation and reliability thresholds are not automated.
- Blind validation remains manual and hides machine proposals. All original import, mapping and segmentation history is retained.

## Verification

Unit tests cover run isolation, fixed report snapshots, human overrides, missing coverage, safe HTML and confirmation guards. Browser/database acceptance covers automatic upload-to-report, all passages included, no mandatory checkboxes, zero fabricated human decisions, evidence exports, optional correction, subsequent failed runs and partial batches. Existing content, manual MCF, structural import, blind validation, undo, deletion and theme suites run against the staged build. Synthetic AI checks verify software behavior, not the accuracy of a real model on the research corpus.

No database migration is needed: existing immutable proposal tables, session configuration and append-only workbench history support this workflow.
