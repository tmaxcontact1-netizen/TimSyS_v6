# Research’Ed

Research’Ed is a local research application supervised by TimSyS. Tool 01 turns a Word or PDF document of links into structured, cited curriculum and professional-development evidence.

## MCF Analysis — manual research

Tool 02 implements the frozen MCF v1.0 instrument, immutable DOCX/TXT/CSV/XLSX corpus imports, versioned segmentation, append-only manual coding, competency-level documentary representation and seeded blind validation samples. It does not implement a machine classifier. See [the manual pilot guide](MCF_MANUAL_GUIDE.md) for the workflow, data boundaries and verification.

## Content analysis workflow

1. Create a research workspace, describe the goal, and select information categories.
2. Upload Word/PDF source documents. Visible URLs and embedded hyperlink targets are retained with every document occurrence. Re-uploading merges references; it never deletes earlier results.
3. Review included links. Accreditation, university and training links are all retained.
4. Start an immutable run with its own plan. The worker retrieves up to eight pages per original link by default, with two supporting-link levels and two concurrent tasks. Limits are configurable. Official-host links are eligible automatically; other hosts are suggested for review until explicitly trusted. Trust is a retrieval permission, not a claim of institutional recognition.
5. Inspect curriculum/module passages, outcomes, assessment, professional practice, delivery, duration and admissions. Each passage keeps its section, source snapshot, URL, locator, timestamp and content fingerprint. Accreditation material stays in a separate context category without course comparisons.
6. Export CSV or the versioned evidence JSON. Missing information is explicit. There are no confidence percentages derived from keyword counts.

The text prompt prioritises supporting links and guides optional AI reading notes. It does not enable arbitrary analysis types or override selected fields. The first release focuses on curriculum research; additional analytical methods can be added to the separate catalogue and output contracts later.

## Reliability and boundaries

- HTTP 404/410, blocked access, temporary failures and rate limits remain distinct.
- Retries have explicit persistent state. Restart recovery and cancellation retain previously completed runs.
- Original document labels are unverified context. Page headings and quoted passages retain distinctions between qualifications and academic years; multi-offering pages require human review.
- Relevant HTML, PDF and DOCX sources are read. Dynamic HTML can be rendered with the locally installed Chromium/Edge browser and bounded content expansion.
- Suggested replacements for missing links are discovered from the provider homepage within the page budget; the original URL is never silently replaced. Replacements require user review.
- Raw captures and result runs are retained. Replaying analysis over the same captured pages and plan produces the same deterministic fields. A fresh website capture may differ.
- Unsupported content, capture limits and incomplete interaction are visible. A found passage is not proof that every course detail was published or captured.

## Optional AI

AI is off by default and selected separately for each run. It is used for reading notes when fields remain missing or source classification is unresolved. Notes require a valid supplied evidence ID and an exact supporting quote; they remain labelled interpretations and never overwrite deterministic fields. Source text is treated as evidence rather than instructions.

The AI connection panel supports the existing OpenAI Responses, OpenAI-compatible, Anthropic and TimSyS JSON provider protocols. In-app connection credentials are memory-only; launcher-managed profiles and environment configuration remain supported. Relevant extracted passages are transmitted only for an AI-enabled run. No external provider is required for the core workflow.

## Runtime and verification

`RESEARCHED_DATABASE_URL`, `RESEARCHED_STORAGE_ROOT` and `RESEARCHED_APP_ROOT` configure the independent application. The launcher manages startup, database migrations, data locations and health. The additive `0016_content_analysis.sql` migration retains all earlier prototype data.

Run `npm test`, `npm run typecheck`, and `npm run build` for local checks. The release gate is `npm run verify:pipeline`, which requires `RESEARCHED_VERIFY_POSTGRES` to point to bundled PostgreSQL binaries. It creates a disposable cluster, exercises the real API/worker/archive/database pipeline with controlled HTTP sources, and drives the production UI in a headless installed browser. It never uses live user records.

Optional verification variables: `RESEARCHED_VERIFY_DOCUMENT` for a local reference document (the provided 74-link document); `RESEARCHED_VERIFY_OUTPUT` for the report and screenshots; `RESEARCHED_VERIFY_APP_ROOT` to verify a staged runtime instead of the development build; `RESEARCHED_VERIFY_LIVE=1` for representative live rendered-source probes. Reports distinguish controlled fixtures from live retrieval.

Earlier prototype results are accessible through **Prototype history**. The former broad research-platform documentation is retained in `README_LEGACY.md`; those general-purpose API routes remain unavailable in the focused interface.
