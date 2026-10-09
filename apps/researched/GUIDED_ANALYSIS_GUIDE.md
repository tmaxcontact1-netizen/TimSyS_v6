# Research’Ed 0.6.2 — a simple workflow

Both tools follow the same six steps: **Upload → Clean → Choose analysis → Check draft → Confirm → Results**.

1. **Upload:** give your work a name and choose a document. Content analysis also accepts pasted links. Uploading does not start AI analysis.
2. **Clean:** keep the links or text you want and remove what does not belong. Original files remain untouched. Compiled review documents ask you to check the review breaks; spreadsheets ask which column contains the text. Institution or organisation names are optional.
3. **Choose analysis:** select the information you want in plain English. For content analysis, enter your own questions and independently allow extra webpages or linked documents. For MCF, choose AI suggestions or manual review, with optional document coverage assessments.
4. **Check draft:** read the draft, check its evidence, remove findings, add notes or change competencies. MCF suggestions remain unapproved until you keep or edit them. No-code decisions require your review too.
5. **Confirm:** check the summary, then confirm. MCF records the reviewed decisions in a separate, fixed session. Unreviewed suggestions are excluded from confirmed findings.
6. **Results:** read the confirmed output, download a human-readable HTML report, print/save PDF, or download research evidence. Optionally ask AI to explain confirmed MCF findings.

## Undo and deletion

**Undo** and **Redo** stay visible beside your work. Changes, source selections, names and confirmations can be reversed, including after reopening. Text fields save automatically after a short pause. The competency editor has **Cancel changes** until **Save to draft** is selected.

**Delete** permanently removes the selected work, its stored source copies, results and revision history after confirmation. It cannot be undone or restored. Original files on your computer and collections referenced by another saved work item are kept. Pending results cannot recreate deleted work; requests already sent cannot be recalled. If a stored file cannot be removed immediately, the app reports this and retries cleanup when My work opens. Installing this update does not automatically delete previously hidden work; it remains available for explicit permanent deletion.

Source and finding selections remain reversible draft edits. **Edit draft** or **Reopen draft** returns to editing; these actions do not erase earlier confirmations.

## Dates and times

Saved work, open work and reports display recorded dates and times with the local timezone. Creation and last-save times are separate from processing start and finish. Manual MCF work shows when its draft was created. Confirmation has its own timestamp. Missing historical timestamps are not invented.

Stop a running analysis before undoing its inputs. Completed draft findings remain available; returning to Choose analysis and selecting Create draft starts a new run. Earlier requests and research decisions remain in the audit history until the work is permanently deleted.

## Existing research

The **Earlier work** section is removed. **Specialist tools** retains the original detailed mapping, split/join, coding, blind validation, lifecycle and evidence interfaces. Blind validation remains manual and separate from AI suggestions.

Original files, extracted text, versioned reviews and units, machine proposals and researcher decisions remain separate. The seven-domain/21-competency MCF v1.0 instrument is unchanged. No domain/institution averages or reliability thresholds have been introduced. Classifier settings remain a separate versioned configuration.

## AI connection

Use **AI connection** to configure your service and model. Creating an AI draft sends selected text to that service. Leave AI off to work manually or collect deterministic passages. Credentials stay in memory until the app closes unless configured through the application's existing environment settings. Website navigation remains bounded and deterministic; AI cannot browse independently. Exact quotations are validated against source text, while interpretation still requires researcher judgment.

## Verification

Use `npm test`, `npm run build`, `npm run verify:pipeline`, `npm run verify:mcf`, `npm run verify:guided`, and `npm run verify:simple`. The older browser suites explicitly exercise Specialist tools. The simple-workflow suite exercises the default six-step screens, reversible changes, deleted-item restoration, immutable confirmation, compiled reviews, spreadsheet mapping, documentary evidence, downloadable reports and a narrow viewport. Tests use disposable databases and a local synthetic AI service, not the live research corpus or a paid model. Release packaging also verifies installation of the exact published ZIP.
