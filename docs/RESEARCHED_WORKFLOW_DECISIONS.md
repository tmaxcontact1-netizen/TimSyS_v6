# Research’Ed workflow decisions — 10 October 2026

Update: the MCF-specific restrictions below were superseded by explicit user approval on 10 October 2026. See [Automatic MCF workflow](RESEARCHED_AUTOMATIC_MCF.md) for the current 0.8.0 behavior. The earlier decisions are retained as dated rationale.

Scope: production Research’Ed 0.7.0. No scenario selector, fictional data, reset-example controls or document-category questionnaire belongs in the application. These decisions use documented product workflows as benchmarks and the researcher's requirements as calibration; documentation is not a hands-on usability study.

| Decision | Benchmark | Adaptation and acceptance |
| --- | --- | --- |
| Source-first intake | [MAXQDA document import](https://www.maxqda.com/help/import/text?view=full) | Upload actual files or paste actual links. Detect supported formats and compiled-review structure. Ask about spreadsheet columns and uncertain boundaries after extraction, not the subject or school role before upload. |
| Check a small output before scaling | [Browse AI Table Studio](https://help.browse.ai/en/articles/15256743-how-to-train-a-robot-using-ai-in-table-studio) | Content preview processes the first selected destination with at most two pages. It cannot be confirmed as the complete report. Full processing is a separate explicit action and rereads the preview source with the selected limits. |
| Make navigation explicit | [Octoparse first task](https://helpcenter.octoparse.com/en/articles/6470927-lesson-7-wrap-up-build-your-first-scraping-task) | Webpage and document permissions are separate and off initially. Ordinary limits are five pages and one link deep; advanced limits remain editable. AI does not control navigation. |
| Evidence beside results | [Elicit extraction columns](https://support.elicit.com/en/articles/14758162-create-and-save-columns-in-elicit) | Show deterministic matching passages under meaningful information headings, with source links and explicit not-found states. Optional AI answers retain quotations. Dead destinations remain visible. |
| Researcher-controlled coding | [MAXQDA reviewable coding](https://www.maxqda.com/help/ai-assist/ai-coding/coding-documents) | Keep the frozen MCF and multi-code/manual decisions. Ordinary MCF workflow never starts classification, including for previously saved AI-enabled options. Optional interpretation of confirmed findings remains separate. |
| Review-level reading | User's approved corpus hierarchy | Present one actual document/review at a time while cleaning. Original review identifiers may repeat: record IDs, not review numbers, distinguish selections. Institution is optional metadata. |
| Recovery and disposal | User's explicit requirements | Persisted Undo/Redo handles draft edits. Delete permanently erases owned work and files, preserving external originals and separately referenced data. No Earlier work panel or restoration after permanent deletion. Real timestamps remain visible. |

## Ordinary journeys

Content: choose Content analysis → upload a link document or paste links → keep relevant links → choose information/questions and navigation permissions → preview first link → inspect evidence → process all selected links → check full draft → confirm → read/download results.

MCF: choose MCF analysis → upload → inspect detected text (confirm boundaries or choose a text column when needed) → select passages within each record → choose optional coverage assessment → create draft → choose competencies / no competency for each passage → check confirmation summary → supply researcher name → confirm → read/download results. Unreviewed passages remain explicit. Interpretation can be requested after confirmation using a configured AI service.

## Limits and release coordination

No new machine classifier, provider selection, MCF instrument revision, aggregation method or database migration is introduced. Existing specialist tools remain available. This pass changes the ordinary workflow, not their previously implemented classification infrastructure. AI is off by default for new content work; existing content work retains its explicit settings.

The preview is not a statistical validation sample. MCF reliability sampling and blind review remain specialist research functions. Website preview accuracy does not guarantee the rest of the corpus. User usability feedback remains necessary; passing tests establishes behavior, not intuitive usability.

Publish only the Research’Ed runtime bundle through the shared TimSyS manifest. Fetch the current published manifest immediately before packaging/publication and retain all other bundle entries verbatim. Recheck latest release before promotion; if it changed, rebuild the manifest against the newer baseline. Never publish a competing standalone installer or replace Principal’Ed from this checkout.
