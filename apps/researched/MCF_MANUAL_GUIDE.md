# MCF Analysis — manual research phase

This guide describes the retained manual research workflow. Research’Ed 0.5.0 also offers explicitly requested AI proposals and interpretation; see GUIDED_ANALYSIS_GUIDE.md. Manual coding and blind validation do not require AI. Reliability thresholds, domain roll-ups and institutional averages remain unimplemented.

## Instrument and data boundaries

`instruments/mcf/1.0.json` preserves the supplied seven domains, 21 competency names, operational definitions and inclusion/exclusion statements. `suppliedText` retains each complete authoritative statement verbatim. Criteria arrays contain only statements explicitly supplied; empty arrays do not imply additional inferred criteria. **Conflict and Performance Management** is the authoritative C3 competency. A golden SHA-256 test and the stored instrument hash detect accidental changes.

`analysis-config/mcf-retrieval/1.0.json` is separate, versioned and unconfigured. Keywords, synonyms and future classifier aids are not part of the theoretical instrument.

The storage layers are distinct: original file bytes → unchanged extraction output → mapped original record text → separate working text → versioned units → frozen manual sessions → append-only researcher decisions. Machine proposals and interpretations are stored separately from researcher decisions. Original files use Research’Ed’s existing source/snapshot archive. PostgreSQL triggers prohibit updates to research records and deletion of saved decisions. The lifecycle transaction permits deletion of unused containers after dependency checks. A revision adds a row linked to the previous decision; concurrent stale edits return a conflict instead of overwriting work.

Working-text normalisation only changes CRLF/CR line endings to LF. Unit offsets refer to **original record text**, measured in UTF-16 code units. CSV locations retain logical row/column; XLSX retains worksheet/row/column; document records retain original extraction offsets and available page/element locations. Parser text is a derivative of a DOCX/PDF, not a claim of exact visual transcription. Original bytes are always available for checking.

## Pilot workflow

1. Open **MCF Analysis**, enter your researcher name, and choose **Use this name**. The name identifies decisions; it is not a login.
2. Choose **New dataset**, give it a name and select **Review analysis** (Director, Principal or School) or **Documentary analysis**. Keep different review categories in separate datasets.
3. In **Sources**, choose **Add source**. Upload a small raw DOCX, TXT, CSV or XLSX pilot. Use synthetic practice material separately from real research.
4. In **Prepare**, inspect the extraction. For spreadsheets, select the original text column and any supplied metadata. Previous analysis columns are not coding decisions. For a compiled questionnaire DOCX, choose **Find individual reviews** and confirm its review boundaries and selected components.
5. Choose **Review text sections**. To split a section, choose **Split section**, click inside the read-only text, place the cursor using the arrow keys if needed, inspect both previews, supply a reason and choose **Split here**. **Combine with next section** previews the combined text before saving. Original wording stays unchanged.
6. Choose **Continue to coding**, name the session and choose **Start coding**. The session retains the prepared text it started with. Later text preparation requires a new session; existing coding is not transferred.
7. Read each section, select one or more competencies or explicitly mark **Reviewed — no applicable MCF competency**. Record Explicit/Implicit evidence strength, exact supporting text, optional rationale and, in review mode, valence. Use **Save & next** or **Save coding**. Unsaved coding drafts are retained on this device; saving records the researcher decision.
8. Use **Check** to find sections without a decision. This is a completeness check, not a reliability score or certification. Independent, seeded blind/manual validation sampling is under **Validation sampling**.
9. In **Results**, inspect counts for each of the 21 competencies and choose **View evidence** to return to the coded passage. Counts are descriptive coding counts, not competence scores. Export coding and research history as JSON.
10. Documentary datasets also show the separate **Documentary representation** assessment in Results: 0 Not represented, 1 Referenced, 2 Developed, 3 Assessed/Evaluated, with Not yet assessed and Source unavailable kept separate. Scores above 0 require evidence. No averaging or domain/institution aggregation is performed.

### Rename, remove and restore

Use **Actions for …** on a dataset, source or session. **Rename** changes only its display name. Original filenames, identifiers and coding history stay unchanged.

**Delete or archive** checks dependencies before showing a confirmation. Unused work can be permanently deleted. Saved coding/representation decisions protect the session and dataset; source/text versions referenced by any session (including archived/blind sample populations) are protected. Dependent preparation versions and the only remaining text version are also protected. Protected work can be **archived** and restored using **Show archived**. Dataset/session archives are read-only for coding. Historical preparation remains available under Details/History.

Deletion removes unused database records and their original files. A minimal actor/time/target deletion event remains; source content is not retained in that event. If an original file is temporarily locked, cleanup is queued and the UI reports it; the next delete operation retries pending file cleanup. No backup files or browser drafts on other devices are deleted.


## Import limits and explicit behaviour

- Upload limit: 25 MB; extracted text limit: 5 million characters; table import limit: 25,000 rows; manual session limit: 25,000 units. Validation samples support up to 10,000 units and cannot exceed the population.
- TXT/CSV support UTF-8 and BOM-marked UTF-16. Invalid decoding is rejected instead of replacing characters silently.
- CSV uses comma delimiters with quoted/multiline fields. XLSX supports stored numeric/text/shared/rich string cells and worksheet selection. Mapped formula cells are rejected: provide raw values. No formulas, macros or external workbook references are executed. Stored values are not silently reformatted as dates.
- Text-layer PDF and HTML are also accepted. Scanned PDFs without readable text retain the original and an extraction warning; OCR is not silently substituted. Supply a verified text-layer document/transcription before coding.
- Blank table text rows are skipped; the full original file and extracted table still retain them. Missing institutions remain unspecified. Missing identifiers receive explicit document/row locators, not invented source identifiers.
- Segmentation is an initial proposal based on `Intl.Segmenter('en')`, with its ICU version recorded. Human review remains necessary, including for abbreviations, lists and dependent sentences.
- Documentary observations in a sampled session concern the evidence available in that sample; use a full manual session to review a whole document.

## Schema and integration

Migration `0017_mcf_manual.sql` adds 11 tables within `researched`: `mcf_instruments`, `mcf_datasets`, `mcf_imports`, `mcf_import_mappings`, `mcf_records`, `mcf_unit_sets`, `mcf_units`, `mcf_sessions`, `mcf_session_units`, `mcf_decisions`, and `mcf_representation_decisions`. It also adds an append-only trigger function. It does not change existing prototype or content-analysis tables.

`/api/mcf/*` is mounted in the existing HTTP server. MCF uses the existing PostgreSQL runtime, archive function, audit table and shared mutation feedback. Existing content analysis and prototype screens remain available. `jszip` was already installed transitively; it is now an explicit pinned dependency for local XLSX reading. No model library or external service was added.

## Verification

Run Research’Ed’s existing `npm test`, `npm run typecheck`, and `npm run build`, plus `npm run verify:mcf` and `npm run verify:pipeline`. The pipeline scripts use a disposable PostgreSQL cluster and headless system Chromium/Edge, never the user's live database. `RESEARCHED_VERIFY_POSTGRES` can select bundled database binaries; `MCF_VERIFY_OUTPUT` selects the MCF report/screenshots directory.

MCF checks cover the nine supplied false-positive/boundary passages without assigning any code on import; instrument immutability; raw DOCX/TXT/CSV/XLSX handling; exact evidence; zero/multiple manual codes; UTF-16 offsets; split/join history; seeded sampling; stale revisions; database immutability; documentary scoring; blind-session isolation; zero AI calls; and browser import/review flows. These are software correctness checks, not empirical classifier validation.

## Decisions still unresolved

Stage 4 provider selection, semantic methodology, confidence interpretation/calibration and machine-output schema remain unimplemented pending explicit approval. Reliability thresholds, agreement reporting methodology and domain/institution representation aggregation remain open. Earlier data-scientist labels may later form a separate historical comparison dataset; they are not ground truth here.

## Compiled-review DOCX mappings

For DOCX files containing multiple questionnaire reviews, use the versioned structural preview before sentence segmentation. See [Legacy compiled-review DOCX import](MCF_COMPILED_REVIEW_GUIDE.md). Institution is optional review metadata, not a structural parent. Existing one-record imports can receive a new mapping version without overwriting their records or coding.
