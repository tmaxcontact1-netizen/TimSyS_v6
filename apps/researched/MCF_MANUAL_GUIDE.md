# MCF Analysis — manual research phase

This release implements the approved Stages 1–3 inside Research’Ed. No machine classifier, semantic provider, sentiment engine, reliability threshold, domain roll-up or institutional average is implemented. MCF never calls the configured AI connection.

## Instrument and data boundaries

`instruments/mcf/1.0.json` preserves the supplied seven domains, 21 competency names, operational definitions and inclusion/exclusion statements. `suppliedText` retains each complete authoritative statement verbatim. Criteria arrays contain only statements explicitly supplied; empty arrays do not imply additional inferred criteria. **Conflict and Performance Management** is the authoritative C3 competency. A golden SHA-256 test and the stored instrument hash detect accidental changes.

`analysis-config/mcf-retrieval/1.0.json` is separate, versioned and unconfigured. Keywords, synonyms and future classifier aids are not part of the theoretical instrument.

The storage layers are distinct: original file bytes → unchanged extraction output → mapped original record text → separate working text → versioned units → frozen manual sessions → append-only researcher decisions. There is no machine output in this phase. Original files use Research’Ed’s existing source/snapshot archive. PostgreSQL triggers prohibit UPDATE/DELETE on MCF research tables. A revision adds a row linked to the previous decision; concurrent stale edits return a conflict instead of overwriting work.

Working-text normalisation only changes CRLF/CR line endings to LF. Unit offsets refer to **original record text**, measured in UTF-16 code units. CSV locations retain logical row/column; XLSX retains worksheet/row/column; document records retain original extraction offsets and available page/element locations. Parser text is a derivative of a DOCX/PDF, not a claim of exact visual transcription. Original bytes are always available for checking.

## Pilot workflow

1. Open the updated Research’Ed application and select **MCF Analysis** in the sidebar. Enter your researcher name. This name labels audit entries; it is not a multi-user login.
2. Choose **New dataset**. Use **Review corpus** and one of **Director**, **Principal** or **School**. Keep the three corpora in separate datasets. For a curriculum or standard, choose **Documentary representation** instead.
3. In **Corpus**, upload a small raw DOCX/TXT/CSV/XLSX file. A synthetic practice file is available in `tests/fixtures/mcf-manual-pilot.csv`; keep practice data separate from actual ISR research.
4. Review the import preview. For CSV/XLSX, select the worksheet, header row, raw text column and any institution/identifier columns. A mapped category column must match the dataset. Previous sentiment or competency columns are never imported as decisions. Leave optional metadata unmapped if it was not supplied.
5. For DOCX/TXT, choose **Entire file is one review/document**, or **Each non-empty paragraph is a separate record** only when each paragraph really is an independent review. For combined reviews with metadata, a mapped CSV/XLSX is preferable. Confirm the mapping. This creates derived records once; correcting a mapping requires a new import, preserving the old import.
6. Select **Inspect units** for a record. Check sentence boundaries and the preserved original. Split at a chosen character offset or join the next unit, supplying a reason. Each change creates a new segmentation version. The version selector also opens historical boundaries. Older versions cannot be edited.
7. Under **Corpus**, create a **manual coding session**. It freezes the latest unit sets. Later imports and segmentation changes do not alter that session; create another session when you want those new units. Earlier coding is not automatically transferred.
8. In **Coding**, choose **Code passage**. View the passage, surrounding text, full original record and source location. Select zero, one or multiple competencies. Each selected code stores Explicit/Implicit strength, an exact supporting span and optional rationale. Review mode supports passage valence and separate code-level valence. Unassigned code valence is not silently inherited from the passage. Neutral/descriptive does not mean factual or unbiased.
9. For zero codes, explicitly check **Reviewed — no applicable MCF competency**. Record notes, including any relevant exclusion considerations. Save. Use **Show this session’s decision history** to inspect earlier revisions. Draft forms are preserved locally while unfinished.
10. For documentary datasets, open **Representation**. Select the document and a competency. Record 0 Not represented, 1 Referenced, 2 Developed or 3 Assessed/Evaluated. Scores above 0 require one or more units from that document in the session. **Not yet assessed** and **Source unavailable** have no numerical score. A source with no readable text cannot be scored 0. There are exactly 21 competency-level observations per document view; absent decisions display Not yet assessed. No arithmetic aggregation occurs.
11. In **Validation**, supply a sample size and fixed seed; leave **Blind manual review** checked. Sampling uses the latest segmentation population. The population IDs, population hash, selected IDs, seed and sampling algorithm are frozen in the session. Repeating a seed on the same population repeats the sample. New imports or segmentation change the population.
12. Code the sample in its own session. It does not reveal or copy decisions from other sessions. The local user can deliberately navigate to another session; blinding is a workspace convention, not an access-control boundary. Each new review session starts independently.
13. Download **Export session and decision history (JSON)**. This includes the instrument, configuration, provenance, raw extraction, frozen units, all decisions for that session, documentary observations and sampling metadata. Blind exports omit raw import tables, which might contain unused historical-label columns; mapped original record text and source fingerprints remain included. Original binary files are separately downloadable beside their imports. Analytical CSV/XLSX exports and agreement statistics remain later-stage work.

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
