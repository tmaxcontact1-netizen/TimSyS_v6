# Research’Ed 0.9.4 — consistent review inputs

Processed 18 October 2026 (GMT+3).

The compiled-review cleaning screen now uses one content selection for the whole uploaded document. Narrative and questionnaire answers (including rating labels and values) are selected by default for every review. Optional headings and editorial notes also apply document-wide. Mixed selections in an older unmapped draft are identified and must be replaced by a single selection before mapping. New mappings record documentComponents and reject inconsistent per-review components.

For already prepared/stopped work, “Use ratings and narrative for every review” creates a separate corrected work item. It preserves existing boundaries and researcher metadata, selects both components across all reviews and returns to Clean. Preparing its text creates a new mapping version; the old work, mapping, units, runs and results remain available. It never enqueues semantic work. Undo/redo still applies to draft component selections; the corrected work item can be deleted through the existing workflow.

Read-only verification of the original Director DOCX: 77 reviews; 77 questionnaire blocks included; all narrative and questionnaire text retained; 2,020 substantive units. Missing rating fields remain missing. Source blocks/spans and component provenance are retained. No live corpus analysis was started or resumed and MCF v1.0 is unchanged.

Verification: 191 unit tests in 33 suites, TypeScript/Vite build, isolated browser/database workflow regression. Regression coverage includes changing a checkbox on one displayed review and verifying the change applies throughout, creating a corrected copy without provider calls or changes to the prior work, and capturing semantic-worker requests to assert that every review supplies its rating labels/values and narrative within its own context boundary. All AI calls in these tests go to a local synthetic fixture, not an external model.

Release scope: Research’Ed only. No migrations, platform, launcher, updater, AI integration or Trade’Ed runtime changes. Trade’Ed retains worker PID 17104/watchdog PID 10888 with healthy heartbeat and ongoing durable logs.

After installation: open the stopped work and choose “Use ratings and narrative for every review”, then “Show the extracted text” in the corrected copy. Confirm the prepared inputs before separately starting analysis. Do not use Resume on the old run to change its population: resume intentionally retains its original inputs.
