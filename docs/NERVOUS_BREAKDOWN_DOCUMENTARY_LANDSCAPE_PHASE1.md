Nervous Breakdown — documentary landscape, Phase 1
================================================

Completed and verified locally on 20 October 2026. The original build stopped before commit or publication, as requested. Tim subsequently authorised commit, push and publication; release preparation is documented in [the Phase 1 release record](NERVOUS_BREAKDOWN_PHASE1_RELEASE.md).
This is a new read-only documentary explorer, not a restoration of the retired responsibility graph.

1. **Architecture**

   The Principal’Ed widget loads a documentary collection through three authenticated, read-only platform endpoints. The server reads the existing Research’Ed filesystem project store; it has no import, update, extraction, approval or relationship operation and creates no tables.

   A typed adapter projects the frozen JD structure into documentary containers, sections, statements and source provenance. Each document retains its own identity, original filename, document type and hash. Each statement retains its passage identity, verbatim text, location and original dimension. Researcher role/structure adjustments and exclusions are respected exactly as the frozen `reviewedPassages` projection specifies. Descriptors remain visibly identified as source descriptions. Repeated headings are separate occurrences; similarly named roles or sections in different documents are never merged.

   A fresh DOM/CSS 2.5D renderer uses deterministic shelves, modest depth, cached layouts, camera transforms, reduced-motion support and viewport culling. Roles appear first, dimension previews appear closer, deliberate entry or continued zoom opens dimensions and then responsibility previews. Full wording is rendered only for the selected statement. No graph engine or retired UI was reused.

   Literal, case-insensitive search uses a trigram index in a dedicated worker. Results retain document type, document, container and section; matching objects are labelled and highlighted while unrelated objects dim. Search never changes geography or classification. Search results are paginated. Full source context is fetched only on request.

2. **Files changed**

   - `apps/principaled/src/dashboard/widgets/NervousBreakdownWidget.jsx`: collection loading, selection and empty/error states.
   - `apps/principaled/src/documentary-landscape/model.ts`: generic types, JD adapter, search index, deterministic layouts, culling and documentary ancestry.
   - `apps/principaled/src/documentary-landscape/DocumentaryLandscape.jsx`: spatial navigation, selection, breadcrumbs, worker search and source inspector.
   - `apps/principaled/src/documentary-landscape/search-worker.ts`: background index construction and retrieval.
   - `apps/principaled/src/documentary-landscape/read.js`: authenticated GET transport.
   - `apps/principaled/src/documentary-landscape/landscape.css`: restrained visual design, responsive inspector and accessible selection/match treatment.
   - `apps/principaled/tsconfig.landscape.json`: strict TypeScript compilation of the core contract and worker.
   - `platform/modules/nervous_breakdown/index.js` and `module.json`: read-only documentary bridge and route registration.
   - `scripts/landscape-fixtures.mjs`, `landscape.test.mjs`, `landscape-api.test.cjs`, `landscape-e2e.cjs`, `landscape-scale-e2e.mjs`: disposable fixtures, contract/security tests, actual application acceptance and standalone synthetic browser harness.
   - `platform/tests/unit/nb-retirement.test.js`: keeps retirement safeguards while allowing the new read-only documentary routes.
   - `scripts/principaled-ai-ui-e2e.cjs` and `principaled-clean-pass-e2e.cjs`: updated empty-state expectations. AI compatibility was subsequently rerun successfully against the staged release platform; the broader clean-pass suite was not rerun.
   - This completion report.

3. **Frozen engine and source integrity**

   The extraction, PDF reconstruction, matrix/review projection, documentary relationship parser, role-equivalence code and JD API source files were not modified. Research’Ed’s source checkout remains clean.

   Before/after SHA-256 checks covered those six files, the original project JSON and all nine original document byte files: **16 checked, zero changed**. The real project revision is 3; its byte hash was:

   `ac042fec11e59d52aeae7e4b32c263fb39e99d947a935db2250dee3f5e53ccd2`

   Browser acceptance used a byte-identical, disposable copy of the project JSON and a separate database, not the installed application database. Synthetic fixtures were never imported or registered. Evidence: [integrity results](../diagnostics/landscape-phase1/frozen-after.json).

4. **Current-corpus acceptance**

   Passed in the actual built Principal’Ed UI with the new platform module:

   - Nine documents, 75 documentary section occurrences, 389 retained statements/descriptions.
   - Every adapted statement and its effective dimension matched the unchanged compiled `reviewedPassages` output.
   - Organisation → Teacher → **Standard 4: Assessment and Data-Informed Practice** → the complete “Collaborate with AEA specialists…” responsibility → exact retained source text, location and highlighted context.
   - Back through source → responsibility → dimension → Teacher → organisation.
   - **Career Week** → the original **Middle School Student Affairs and Administrative Supervisor** statement. The source’s full role name is retained.
   - Back from a search result restores the actual search origin and camera; Home clears search and restores the landscape.
   - Breadcrumb navigation, zoom previews, zoom entry into the selected Teacher role, keyboard pan, and the inspector at an 800px window width passed.
   - No browser errors or documentary write requests. Unauthenticated endpoint access was denied.

   Evidence: [real-corpus browser results](../diagnostics/landscape-phase1/browser-real.json).

5. **Medium scale**

   Synthetic 50 roles / 5,000 statements passed. The initial viewport rendered 12 role tiles and zero statement tiles. Search reached the last statement; Back restored its actual previous view and Home reset navigation.

6. **Large scale**

   Synthetic 200 roles / 25,000 statements passed, with the same 12 initial role tiles and zero initial statement tiles. Only the current section and visible statement previews are mounted after navigation; full wording is in the selected inspector.

   Final local headless Edge observations:

   | Fixture | First visible tiles | Search ready from navigation | Search to result, including debounce | Largest observed main-thread long task |
   | --- | ---: | ---: | ---: | ---: |
   | 50 roles / 5,000 statements | 349 ms | 913 ms | 221 ms | None observed |
   | 200 roles / 25,000 statements | 267 ms | 2,224 ms | 236 ms | 64 ms |
   | Policy / 20 statements | 131 ms | 221 ms | 228 ms | None observed |

   These are observations on this machine, not guarantees. Concurrent verification affects timing; earlier large-fixture runs took approximately 2.2–3.4 seconds to prepare search. Navigation remains available while the worker prepares the index. The test measures frontend navigation, not large-file import or database throughput. Evidence: [browser scale results](../diagnostics/landscape-phase1/browser-scale.json), [core scale measurements](../diagnostics/landscape-phase1/scale.json).

7. **Non-JD fixture**

   A synthetic Behaviour Policy with three sections and 20 statements passed through the same renderer as **Policy → Section → Statement → Source**. Search reached statement 3.6 and its highlighted source matched the full selected statement. No Role, Original dimension or Responsibility labels appeared in its inspector. No policy parser or importer was added.

8. **Navigation**

   Click selects a container or section; Open or double-click enters it. Selecting a statement opens its inspector immediately. Zoom reveals previews and, when approaching an object, enters the next documentary level. Drag and arrow keys pan; scrolling within the landscape zooms. Zoom buttons provide an alternative. Back restores actual prior contexts and cameras. Home resets to the landscape. Every documentary breadcrumb is a button; the current segment is a no-op.

   Source context opens inside Nervous Breakdown. Its retained text is highlighted and automatically scrolled to the selected passage, with surrounding context available. The outer page remains scrollable. Reduced-motion preferences disable camera transitions. Selection and search matches use outlines, dashed borders and text labels, not colour alone.

9. **Read contract, validation and limitations**

   Routes require authentication and `admin:documents:read`:

   - `GET /nervous-breakdown/collections`
   - `GET /nervous-breakdown/collections/:id`
   - `GET /nervous-breakdown/collections/:id/source/:documentId/:passageId?revision=<snapshot SHA-256>`

   Production resolves the existing sibling `researched/private-storage/jd-responsibilities` store from `DB_PATH`. `NB_DOCUMENTARY_ROOT` can explicitly select a documentary store. Tests have no implicit access to the installed store. Multiple collections require an explicit selection; a single available collection opens automatically.

   The bridge validates collection identity, path containment, document structure and exact passage-to-retained-source equality. A source request whose snapshot hash no longer matches is rejected instead of mixing versions. Missing or invalid data produces an error, not a repair or re-extraction.

   Limitations:

   - Publication and installation are separate from implementation verification. The installed app changes only after its updater installs the release; see the release record.
   - Source navigation displays retained document text with filename, document type and paragraph/page location; it does not embed the original DOCX/PDF page artwork.
   - All documentary statements and the search index are held in memory for the selected collection, although rendering is culled and source context is lazy. This is tested to 25,000 statements, not an unbounded streaming architecture.
   - The renderer supports the tested generic container → section → statement structure. Arbitrary nested subsections and other document ingestion adapters remain future work.
   - The frozen JD upload API’s existing limits are unchanged. Synthetic 200-role navigation is not a claim that the existing importer accepts 200 files in one upload.
   - The source is a snapshot. Reload the module after researcher changes; a stale source request reports the mismatch.
   - The independent frontend dev server needs a `/nervous-breakdown` proxy to its platform if used; acceptance instead used the production frontend served by the platform. Shared launcher configuration was not changed.
   - The existing frontend build still reports its large shared application chunk warning. The new search worker is separately built.
   - No relationships, workflow, upstream/downstream navigation, gaps, inferred structure, approvals, editing or Phase 2 functionality were added.

   Test results: **117 frozen JD tests, seven new core/API tests, three retirement regression tests, real-corpus browser acceptance, both synthetic scale browser cases and policy browser acceptance passed.** Strict landscape TypeScript compilation, the unchanged Research’Ed TypeScript build, and the Principal’Ed-containing launcher frontend build passed. Browser tests reported zero page errors. Initial sandbox cache-rename failures were rerun successfully outside that cache restriction.

   Trade’Ed remained in its separate scheduled runtime throughout. Final verification: worker 24216 and watchdog 21380 healthy, zero failures, no incidents during the last 15 minutes, unchanged configuration hash and no Launcher in their ancestry. No validation processes, ports, files or updater state were modified. Evidence: [final isolation check](../diagnostics/landscape-phase1/tradeed-final.json).

10. **Screenshots**

   [Organisation landscape](../diagnostics/landscape-phase1/01-organisation.png) ·
   [Teacher](../diagnostics/landscape-phase1/02-teacher.png) ·
   [Original dimension](../diagnostics/landscape-phase1/03-dimension.png) ·
   [Responsibility and source](../diagnostics/landscape-phase1/04-responsibility-source.png) ·
   [Career Week result](../diagnostics/landscape-phase1/05-career-week.png) ·
   [Large synthetic landscape](../diagnostics/landscape-phase1/06-large-synthetic.png) ·
   [Synthetic policy and source](../diagnostics/landscape-phase1/07-synthetic-policy.png).

   Evidence and original source copies remain under the ignored local `diagnostics/landscape-phase1` directory. They are not application records or source-control additions.
