# School ISR import profile

Implementation: school-questionnaire@1.0; report: researched.school-isr-ratings-report.v1; supplemental narrative scope: school-narrative.v1.

The importer automatically recognises a School questionnaire from at least eight of the 16 known prompts. It uses the existing immutable DOCX import, structural preview, researcher confirmation, versioned mapping, source-record UUIDs and sentence segmentation. Stable source-review identities are SHA-256/source-location derived and retained separately from database UUIDs and original review numbers.

Questionnaire + explicit Comments marker, optional recognised heading and editorial/blank intervening content establish the association. Nearest-text proximity alone does not. The supported heading variants include campus prefixes and authorship-warning prefixes. Prose-only and ratings-only reviews are retained. Institution assignment remains optional. Unheaded source sequences are provisional and must not be reported as confirmed schools.

All numerical values preserve raw text, original prompt wording, source table/row and validity status. Whitespace including NBSP is normalised only for matching. School uses the original 1–10 scale documented by ISR, not the Director scale. Reported averages are not recalculated. Salary ranges preserve raw text and parsed USD annual bounds; reversed ranges are unresolved. Unknown rows/tables remain available with locations and warnings; unknown tabular fields are excluded from semantic input. Clearly structured single-cell sentence prose can remain narrative, flagged for inspection.

The mapping API enforces narrative-only selection. Headings, numerical rating fields, averages, salary fields and editorial markers are outside MCF targets/context. Table narrative retains its source row in the questionnaire record and its source block in analysis spans. Any manual change creates a new structural mapping. Every review must be confirmed before the workflow continues. No semantic run was created during implementation/audit.

Existing MCF definitions and F1 v10 are unchanged. Only fresh sessions containing School records append the versioned School scope reminder: an organisational practice or decision must be established; generic satisfaction/dissatisfaction with local conditions alone is insufficient. Saved/resumed runs keep their saved rules. Rating prompts are not mapped to competencies.

The existing respondent-ratings export endpoint serves the full School extraction audit plus provenance JSON. Final JSON includes schoolIsrRatings; HTML/PDF and the report screen include an independent School section. All ten categories, zero counts, valid denominators and missing/unresolved counts are preserved per prompt. No composite or numeric conversion is introduced.

Verified source: 01. School Reviews.docx, SHA-256 a11138750e1b92a30c1fa53e0fa263d1b4d2c428ed1e356431e3bb856e510350.

Actual audit: 242 structurally supported review candidates; 241 ratings+narrative and one prose-only parent review. 199 headings (198 associated with questionnaires + parent review), 43 unheaded questionnaires, 891 outside-table paragraphs, 241 questionnaires, 3,856 valid values, 241 valid reported averages, 205 salary rows (two reversed/unresolved), one empty parent-review table. No unmatched blocks/tables/rows. No confirmed school-group count can be established from structure alone; 43 provisional source sequences remain unconfirmed. One source editorial duplicate pair retained, no additional word-set Jaccard >=0.75 pairs. No researcher confirmations claimed.

Verification: 446 tests/50 files passed; backend and frontend builds passed. Actual Principal document still yields 111 Principal questionnaires/999 recovered selections and seven excluded other profiles. Actual Director document retains its existing profile and 77 candidates. Ratings PDF verified against all 3,856 prompt/value/status/locator combinations and 242 source-review IDs; first page visually inspected. No live data, installed app, source DOCX, historical analysis or TradeEd files changed.

Full audit, every flagged case with excerpts/locations, structured extraction and JSON/HTML/PDF evidence are under:
C:/Users/tmaxc/Downloads/TimSyS/verification-local/school-import-audit/

Deployment status: source implementation only; not committed, published or installed by this task. Once installed, upload → automatic School detection → Clean → download/review extraction audit → resolve/check flagged boundaries and optional institution metadata → confirm. Do not start semantic analysis until the researcher accepts the extraction audit.
