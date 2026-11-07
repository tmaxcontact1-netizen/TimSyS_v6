# ResearchEd large-report performance verification — 7 November 2026

Scope: presentation, read-only report loading and export preparation. No semantic runs, migrations, MCF/F1 changes, saved-result edits, TradeEd or shared-runtime changes.

## Findings and repair

The completed School report rendered every per-review rating table and hidden evidence trail at once. Opening it also loaded source previews, per-record units and duplicated full export payloads. Filtering rebuilt whole-corpus summaries; ambiguity lookup and missing-assessment detection scanned proposal arrays repeatedly. HTML/PDF preparation ran synchronously on the UI thread.

The results view now requests a compact, read-only snapshot: per-record provenance remains in records, while repeated unit locators and duplicate output envelopes are omitted from this display response only. Full JSON archives are unchanged. Ratings inspection mounts one review at a time; evidence lists load on demand and paginate. Summaries are cached, filtering reuses them, lookups use maps/sets, and HTML generation runs in a worker. HTML/PDF exports still contain all reviews and findings.

## Verification

- Backend TypeScript build and frontend production build passed.
- 52 test files / 454 tests passed, including five new large-report tests and existing JSON/HTML/PDF tests. The first sandbox test run hit local socket EACCES; the unrestricted local rerun passed completely.
- Synthetic 7,500-assessment test proves compact/full HTML equality, preserved provenance and unchanged inputs; endpoint test forbids archive construction and provider calls.
- Real completed School fixture: 7,479 assessments, 242 reviews. Headless Edge before/after: 36,659 versus 3,998 DOM elements; 4,016 versus 160 initially mounted rating rows. Heap approximately 217 MB versus 164 MB. Latest filter interaction: 7,838 ms versus 55 ms. Timing varies with system load; an earlier baseline filter took 2,032 ms.
- All 242 review options remain available. Last-review selection and F1 evidence trail inspection passed.
- Complete Workbench test loads one report-view request, no full archive or AI request, responds to filtering and mouse movement, and raises no page errors.
- Full HTML: 14,585,322 bytes, SHA-256 e16d337d16aad5cc76b8da9511bc9867be8bbe1ea0b968e9c7b2dc7a49693a50 before/after, also identical from the worker. PDF renderer receives this same complete HTML; existing PDF endpoint regression tests pass. A new full-size PDF was not generated during this performance audit.

## Whole-computer freezes

The UI blockage is reproduced and corrected. Large payloads, repeated work and tens of thousands of rendered nodes plausibly increased CPU/memory pressure. Windows event checks found no matching application crash/hang, resource-exhaustion or display-driver-reset event in the inspected two-day window. A historical OS-wide freeze cause is therefore not established. No claim is made that a GPU or OS fault was proved or repaired. If system-wide freezes recur, capture live CPU/memory and a renderer trace during the incident.

## Preservation and isolation

Read-only pre-install output digests: School 5032e959923397a32f6962694cac0de2 (7,479 proposals); Principal 02 cff2ab40930b568b540e6d2f83b6e370 (2,214 proposals). Both completed. Private fixtures and hashes stay outside version control. Deployment must compare these after installation.

Packaging uses the currently installed platform bundle and changes only ResearchEd compiled files, plus ResearchEd frontend assets. The previous watchdog record is stale (1 November); actual watchdog/worker PIDs and current process/port inventory were checked rather than treating that record as live. No TradeEd worker was present. TradeEd files, ports and data paths are not touched.
