# Research’Ed 0.6.0 — a simple workflow

Both tools follow the same six steps: **Upload → Clean → Choose analysis → Check draft → Confirm → Results**.

1. **Upload:** give your work a name and choose a document. Content analysis also accepts pasted links. Uploading does not start AI analysis.
2. **Clean:** keep the links or text you want and remove what does not belong. Original files remain untouched. Compiled review documents ask you to check the review breaks; spreadsheets ask which column contains the text. School names are optional.
3. **Choose analysis:** select the information you want in plain English. For content analysis, enter your own questions and independently allow extra webpages or linked documents. For MCF, choose AI suggestions or manual review, with documentary coverage assessments available for course documents and standards.
4. **Check draft:** read the draft, check its evidence, remove findings, add notes or change competencies. MCF suggestions remain unapproved until you keep or edit them. No-code decisions require your review too.
5. **Confirm:** check the summary, then confirm. MCF records the reviewed decisions in a separate, fixed session. Unreviewed suggestions are excluded from confirmed findings.
6. **Results:** read the confirmed output, download a human-readable HTML report, print/save PDF, or download research evidence. Optionally ask AI to explain confirmed MCF findings.

## Undo and deletion

**Undo** and **Redo** stay visible beside your work. Changes, source selections, names and confirmations can be reversed, including after reopening. Text fields save automatically after a short pause. The competency editor has **Cancel changes** until **Save to draft** is selected.

**Delete** moves work to **Deleted items**. **Restore** brings it back. This is recoverable deletion, not permanent erasure of source files or research history. Deleting work cancels pending analysis; already-sent requests cannot be recalled. Source removal and finding removal affect the current draft and can be undone. **Delete results** returns to the draft; Undo restores the confirmed result. Removing an AI explanation hides it from the current output and is reversible.

Stop a running analysis before undoing its inputs. Completed draft findings remain available; returning to Choose analysis and selecting Create draft starts a new run. Earlier requests and research decisions remain in the audit history.

## Existing research

**My work → Earlier work** opens previous content/MCF research in the new workflow. **Specialist tools** retains the original detailed mapping, split/join, coding, blind validation, lifecycle and evidence interfaces. Blind validation remains manual and separate from AI suggestions.

Original files, extracted text, versioned reviews and units, machine proposals and researcher decisions remain separate. The seven-domain/21-competency MCF v1.0 instrument is unchanged. No domain/institution averages or reliability thresholds have been introduced. Classifier settings remain a separate versioned configuration.

## AI connection

Use **AI connection** to configure your service and model. Creating an AI draft sends selected text to that service. Leave AI off to work manually or collect deterministic passages. Credentials stay in memory until the app closes unless configured through the application's existing environment settings. Website navigation remains bounded and deterministic; AI cannot browse independently. Exact quotations are validated against source text, while interpretation still requires researcher judgment.

## Verification

Use `npm test`, `npm run build`, `npm run verify:pipeline`, `npm run verify:mcf`, `npm run verify:guided`, and `npm run verify:simple`. The older browser suites explicitly exercise Specialist tools. The simple-workflow suite exercises the default six-step screens, reversible changes, deleted-item restoration, immutable confirmation, compiled reviews, spreadsheet mapping, documentary evidence, downloadable reports and a narrow viewport. Tests use disposable databases and a local synthetic AI service, not the live research corpus or a paid model. Release packaging also verifies installation of the exact published ZIP.
