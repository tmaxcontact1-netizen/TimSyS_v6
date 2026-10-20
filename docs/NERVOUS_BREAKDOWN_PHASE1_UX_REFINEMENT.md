# Documentary Landscape — Phase 1 UX refinement

Local implementation, 20 October 2026. Base commit: `d130a9089bb7143beca8424c53cee48a766bdc46`.

## Scope and files

Only the documentary landscape presentation and its tests changed:

- `apps/principaled/src/documentary-landscape/model.ts`: deterministic balanced layouts, presentation labels, inspector frame state and camera helpers.
- `apps/principaled/src/documentary-landscape/DocumentaryLandscape.jsx`: selected-object-first inspector, selection/navigation history, docking and camera restoration.
- `apps/principaled/src/documentary-landscape/landscape.css`: level-specific cards and responsive dock.
- `scripts/landscape-ux.test.mjs`: five focused layout, label and camera tests.
- `scripts/landscape-ux-acceptance.cjs`: real-source UX acceptance and screenshots.
- `scripts/landscape-e2e.cjs`: invokes UX acceptance alongside existing acceptance.
- `scripts/landscape-scale-e2e.mjs`: policy, unresolved-source and scale browser acceptance.
- This report.

No parser, relationship engine, backend route, production database, installed bundle or updater modification. No Phase 2 functionality.

## Source integrity and isolation

All 16 protected hashes match the pre-test baseline: six frozen engine files, the live project JSON and nine source binaries. The frozen Research’Ed checkout remains clean. The real corpus remains nine documents, 389 retained statements/descriptors and 75 section occurrences, with project SHA-256:

`ac042fec11e59d52aeae7e4b32c263fb39e99d947a935db2250dee3f5e53ccd2`

The read-only adapter matches the frozen engine's reviewed projection. Browser acceptance uses a disposable corpus copy and temporary test platform. Synthetic fixtures are explicitly labelled and never persisted as organisational records.

Trade’Ed was checked before work and after browser acceptance. Worker 24216 and watchdog 21380 remained under independent owner 24120, outside Launcher ancestry. The watchdog remained active with zero failures and no new incidents; worker health reported collecting with no error. No runtime, data, logs, scheduled tasks or ports belonging to Trade’Ed were changed.

Evidence: `diagnostics/landscape-ux/frozen-before.json`, `frozen-after.json`, `real-acceptance.json`, `browser-run.log`, `browser-scale.json`.

## Stable addresses

Each parent uses a cached deterministic grid. Columns are derived from item count and that level's fixed footprint, never viewport size, selection, search or camera state. Containers retain stable ID ordering; sections and statements retain documentary order. Search changes emphasis and moves the camera to the existing address.

Tested 10/50/200 containers and sections containing 5/20/125 statements. Navigation, search, resizing and reconstruction retain addresses. Browser acceptance additionally checks Back, Home and reload against captured addresses.

This guarantee applies to an unchanged corpus. Adding/removing objects can change the calculated column count; persistent addresses across corpus revisions are not introduced in this pass.

## Labels

Previously, recognised introductory descriptors appeared under `Unassigned — check source`. They now display as `Role description`, `Policy description` or neutral `Source description`, according to document type.

These are presentation labels only. The original dimension, text, source identifiers and offsets remain unchanged. Undimensioned statements, explicit ambiguity and unextracted headings display as `Unresolved source structure`. A section is labelled as a description only when all its children qualify; mixed/uncertain contents remain unresolved.

## Inspector and camera

The inspector starts with the selected responsibility's exact wording, or the selected role/section title. Documentary context follows, then source provenance and the source action. The same structure supports policy documents.

Desktop uses a roughly 68% landscape / 32% inspector split. The inspector occupies its own column rather than obscuring the canvas. Below a 900px component width, it stacks beneath the landscape. It has bounded scrolling for long source text.

Opening the inspector saves the undocked camera. Resizing minimally translates the camera to keep the selected object within a 24px margin, reducing zoom only when required to fit it. Closing restores the saved camera and retains selection and context. Back restores the previous frame, including camera and inspector state. A search into another section saves that destination's camera rather than inheriting the previous section's undocked camera.

Pointer selection opens role/section inspection after a short 250ms delay to preserve double-click entry. Keyboard selection and statement selection are immediate.

## Visual levels

At equal zoom, document containers are 310×152, sections 278×138 and statements 254×132. Containers use a subtle document-sheet treatment; sections use modest elevation; statements use simpler compact cards. Type sizes also distinguish levels. Previews truncate verbatim source text rather than paraphrasing.

Auto-fit can apply different zoom levels to different collections. Visual size differences should therefore be understood at equal zoom, rather than as cross-screen semantic weighting. Spatial positions do not encode authority or relationships.

## Acceptance and tests

- 117 frozen JD tests passed.
- 12 landscape/API/UX tests passed.
- Strict landscape TypeScript check passed.
- Frontend production build passed.
- Real browser acceptance passed against the disposable nine-document corpus, including frozen projection parity.
- Student Affairs → Domain 1 → exact first-contact responsibility passed. The source bullet is retained. Inspector order, visible selection, dock ratio, Close, Back and address stability passed.
- Student Affairs introductory descriptor displays `Role description`, retaining `Unassigned — check source` in the underlying model.
- Career Week search retained its address and Back restored the actual search-origin camera.
- Teacher → Standard 4 → exact responsibility → source, semantic zoom, keyboard pan, breadcrumbs and reduced-motion acceptance continued to pass.
- Responsive checks at 1200, 800 and 430px passed: no page horizontal overflow, selected object visible, inspector separate from landscape.
- Synthetic policy uses Policy / Section / Policy statement labels, exact source context and the shared dock.
- Synthetic unresolved-source fixture remains visibly distinct from recognised description material.

Measured synthetic browser results on this machine:

| Fixture | First tiles | Search ready | Search including debounce | Initial rendered tiles | Longest recorded main-thread long task |
| --- | ---: | ---: | ---: | ---: | ---: |
| 50 containers / 5,000 statements | 404 ms | 1,522 ms | 241 ms | 12 | 0 ms |
| 200 containers / 25,000 statements | 306 ms | 3,295 ms | 249 ms | 12 | 76 ms |

Both scale cases passed culling, search, selected-object visibility, address stability and navigation checks with no browser errors. These are single-run measurements, not performance guarantees.

## Screenshots

All were visually inspected. Evidence files are local and ignored by Git.

1. [Organisation](../diagnostics/landscape-ux/01-organisation.png)
2. [Role and dimensions](../diagnostics/landscape-ux/02-role-dimensions.png)
3. [Responsibilities](../diagnostics/landscape-ux/03-responsibilities.png)
4. [Docked responsibility](../diagnostics/landscape-ux/04-docked-responsibility.png)
5. [Role description](../diagnostics/landscape-ux/05-role-description.png)
6. [Career Week with inspector](../diagnostics/landscape-ux/06-career-week-docked.png)
7. [Synthetic policy inspector](../diagnostics/landscape-ux/07-synthetic-policy.png)
8. [Large synthetic landscape](../diagnostics/landscape-ux/08-large-synthetic.png)
9. [Unresolved-source fixture](../diagnostics/landscape-ux/09-unresolved-fixture.png)

## Limitations and stop condition

No functional regression was detected by the acceptance suite. The frontend still reports its existing large-chunk warning; Node reports the existing module-type warning. Large collections deliberately show a culled viewport and require pan, zoom or search. Search indexing has an initial preparation interval. Policy browser coverage is synthetic, not a newly imported organisational policy.

This is a local refinement only. Nothing was committed, pushed, packaged, installed or published. The installed app does not yet contain these changes. No relationships, inference, workflow, governance activation or Phase 2 work was added.

## Subsequent authorised release

Tim subsequently authorised commit, push and publication as release **2026.10.20.9**. The stop-condition statement above records the original implementation handoff.

This release replaces only `launcher-ui` from published baseline **2026.10.20.8**. The platform and Research’Ed bundle descriptors are retained unchanged. No Trade’Ed bundle is supplied or replaced, and no installed runtime or data is changed during publication.

Before release, the actual Trade’Ed worker/watchdog ancestry and both port heartbeats were checked again: worker 24216, watchdog 21380, independent owner 24120, zero failures and no recent incidents. Real-corpus UX acceptance and AI settings/conversation browser acceptance passed using disposable databases against the published backend. All 7,557 staged backend files matched their verified inventory.

The UI-only packaging script now accepts release-specific notes and accurately records whether acceptance used only synthetic data. It continues to check the published UI baseline and the installed updater compatibility guard. The release's `principaled-verification.json` records the committed source revision, archive hash, compatibility result and retained bundles.

After publication, use Launcher **Updates → Check again**, install the available compatible update, then open **Principal’Ed → Nervous Breakdown**. Publication itself does not install or restart the app.
