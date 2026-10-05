# Research’Ed 0.5.0 — guided analysis

## One shared AI connection

Open **AI connection**, choose the supported protocol, and enter your service URL, model and credentials where required. Both tools use this connection. Research’Ed does not select or purchase a model. Source text is sent only when you explicitly start an AI-enabled analysis. Connection settings must be supplied again after restarting when not configured through the application environment. Pending MCF tasks wait for a connection; a changed connection cannot silently continue an old run.

## Content analysis

1. Open **Content analysis → New research**.
2. Upload a DOCX/PDF containing links, or select **Enter links manually** and paste one URL per line.
3. Independently choose whether to follow relevant webpages and read linked PDFs/documents. Directly supplied URLs are always sources; the switches control additional links. Advanced settings set traversal depth, page limits and trusted hosts.
4. Describe your objective and enter one question per line.
5. Select **Go — analyse content**. Read each source’s answers in order, expand supporting quotations, and inspect source limitations or dead links.

Navigation uses deterministic link ranking, host/depth/page limits and independent media policy. AI receives extracted passages and questions; it cannot navigate. Answers must cite exact quotations from supplied passages. An exact quotation validates provenance, not the correctness of the interpretation. “Not found” means not found in the inspected material, not proof of absence. Large sources are bounded to six evidence batches; omissions are disclosed. Linked HTML, PDF, DOCX and plain text are supported; other binary formats may require separate import and are reported when unreadable. Existing deterministic extraction, source inspection, retries, history and CSV/JSON exports remain available.

## MCF analysis

1. Open **MCF Analysis** and set your researcher name.
2. Choose the material/review type, select a document and click **Upload and analyse**. Without an AI connection, **Upload and prepare** preserves the source for manual work.
3. For compiled reviews, confirm candidate boundaries, metadata and included components. For spreadsheets, confirm the column mapping. Institution may remain unresolved. Ordinary documents proceed to preparation and analysis automatically.
4. Read the proposed competencies and exact evidence passages. **Accept**, **Review or edit**, or **Reject** each proposal. A proposed no-code finding becomes reviewed only when accepted. Rejection does not undo an existing researcher decision.
5. Expand **Interpret reviewed results with AI**, enter questions and run the interpretation. Only saved researcher decisions and documentary observations enter its snapshot. Partial coding is identified. Later coding changes mark the interpretation outdated.

For an existing corpus, select it, use **Analyse prepared source**, then **Findings and interpretation**. **Manual tools and history** retains mapping, segmentation, coding, documentary representation, blind/manual validation, exports and lifecycle controls.

Original files, extraction, mapped reviews, versioned analysis units, machine proposals and append-only researcher decisions remain separate. Each run stores its instrument hash, classification settings, provider/model/connection fingerprint and unit versions. Classification configuration is in `analysis-config/mcf-classification/1.0.json`, separate from the unchanged theoretical instrument. AI results never automatically become researcher coding or documentary representation scores. Blind validation sessions do not expose AI results. The 21 observations remain separate; there are no domain/institution averages or imposed reliability thresholds.

MCF runs use a durable batch queue. The screen shows progress, errors and cancellation. Cancellation stops remaining work; already-sent requests can finish but late results are discarded. After interruption, unfinished in-flight batches are marked failed rather than silently replayed; saved proposals remain available and a new run can be requested. Oversized units require splitting or manual coding. A separate JSON export retains proposals, interpretations and researcher review history.

## Verification and limits

The release uses the existing TypeScript/Vite build, 123 unit tests, 12 content-pipeline checks, 16 manual MCF checks, eight guided integration/browser checks, and installation verification against the actual release ZIP. Tests use disposable PostgreSQL databases and synthetic documents. Guided AI tests use a local synthetic service through the real provider adapter, with no external model calls or live research corpus transmission.

These checks establish software workflow and evidence validation, not empirical classification accuracy. Provider/model suitability and reliability must be evaluated on the researcher’s pilot corpus. Domain aggregation and reliability thresholds remain methodological decisions. The frozen MCF instrument and existing source documents are unchanged.
