# Research'Ed

Research'Ed is a general-purpose, local-first research platform for designing studies, managing corpora, preserving sources, producing traceable evidence, and conducting reproducible human-reviewed analysis.

The research core contains no subject-specific taxonomy. Domain concepts belong in configurable entity schemas, codebooks, and study templates.

## First operational slice

- Study Designer
- Corpus Manager
- configurable Entity Modelling
- immutable Source Archive schema
- guarded HTTP(S) source acquisition with private-network blocking, bounded downloads, redirect validation, content hashing, and change-aware immutable snapshots
- explicit, audited corpus inclusion and exclusion decisions
- deterministic HTML, plain-text, PDF text-layer and DOCX extraction into hashed, traceable segments
- human-reviewed evidence capture with typed interpretations, confidence, study codebooks and immutable source lineage
- deterministic cross-source coverage, coding and counterevidence summaries
- human-authored findings that require traceable supporting evidence
- immutable, fingerprinted HTML and JSON research reports with methodology, corpus and evidence appendices
- readiness-gated study locking, auditable lifecycle transitions, withdrawal/reinstatement and paginated evidence search
- bounded same-origin link discovery with explicit human add/dismiss decisions
- persistent acquisition queue with cancellation, attempt limits and exponential retry delays
- JavaScript-rendered acquisition through a locally installed Chromium/Edge browser with per-request network boundary checks
- bundled local English OCR for image-only PDFs, with explicit verification warnings
- supervised background acquisition processing and capability/worker health reporting
- guided analysis setup with plain-language rules, AI and hybrid analysis choices
- individual, batch URL and multi-file PDF, DOCX, text and HTML intake
- safe expansion of common accordions, details and explicit read/show/load-more controls with captured interaction metadata
- structured headings, paragraphs, list items, table rows and PDF page locators for evidence navigation
- saved, versioned analysis plans and persistent analysis runs
- deterministic syntax, readability, terminology, dates, quantities and expected-information checks
- evidence-grounded AI provider contract with structured-output and citation validation; AI analyses remain explicitly unavailable until a provider is configured
- auditable accept/reject/amend states for generated analysis results
- explicit unsupported status for formats that do not yet have a registered extractor
- audit foundation
- TimSyS supervision and health

Review, analysis, and reporting are intentionally unavailable until preserved source evidence exists.

## Optional AI analysis

Rules-based analysis works without an external service. Interpretive analysis supports four protocols selected with `RESEARCHED_AI_PROTOCOL`: `openai-responses`, `openai-chat`, `anthropic-messages`, and `generic-json`. The OpenAI-compatible option also supports local Ollama/LM Studio and hosted compatible gateways. The generic protocol accepts any service implementing `timsys.analysis-engine.v1` at the exact configured URL.

`RESEARCHED_AI_MODEL` selects the model, `RESEARCHED_AI_BASE_URL` selects the service, and `RESEARCHED_AI_API_KEY` supplies an optional bearer/vendor key. Keys are read only at startup, never returned by an endpoint, and never stored in Research'Ed's database. Remote endpoints must use HTTPS; unencrypted HTTP is accepted only for a loopback service on the same computer.

The capabilities panel provides connection testing, standard model discovery and provider profiles. In the desktop launcher, API keys are encrypted through Electron `safeStorage` (Windows DPAPI on Windows), kept outside the Research'Ed database and supplied only to the supervised process. In a standalone browser session, credentials remain memory-only and disappear when Research'Ed closes. Environment configuration remains available for managed deployments.

Provider diagnostics report availability and latency without returning credentials. Research'Ed also exposes session request, success, failure and average-latency counters; these are operational observations, not provider billing totals. Custom JSON webhooks have no standard model catalogue and are validated when analysis runs.

Analysis plans execute as durable background jobs. Every source/type pair is an independently tracked task with bounded concurrency, exponential retry delay and a configurable attempt ceiling. Runs can be paused, resumed, cancelled or retried from the interface. Interrupted running tasks return safely to the queue after restart; completed results are idempotent and remain available for human review.

Every supported analysis type has a versioned, closed output contract. Provider instructions include the relevant JSON Schema, returned values are validated again inside Research'Ed, and only valid results can be persisted or substituted during human amendment. The catalogue and `GET /api/analysis-types/:type/contract` expose the active contract to clients.

Themes, comparisons and contradiction checks execute once across the selected corpus rather than once per document. Evidence allocation is balanced across sources, source identities are explicit, and configured entity ancestry is included in the analysis context. Cross-source outputs must reference real corpus source IDs and cannot compare a source with itself.

Analysis setup is a guided four-step workflow covering purpose and sources, methods, questions and expected fields, and a final preflight review. Configurations can be saved as reusable templates without binding them to one study or corpus. Results render according to their validated meaning—metrics, comparisons, warnings, lists or structured fields—and can be exported as readable Markdown, spreadsheet CSV or a versioned JSON archive.

The Insights page derives attention items from recorded corpus readiness, task failures, review state, confidence, missing fields and potential contradictions. Every item states its numerical evidence and links to the relevant workspace. These are decision-support prompts with explicit limits, never automatic research conclusions.

AI requests contain extracted evidence needed for the chosen analysis, not the original file. Requests set provider-side storage to false. Returned data must satisfy the shared structured-output contract and may cite only evidence segment identifiers that were supplied. Invalid or invented citations fail visibly.
