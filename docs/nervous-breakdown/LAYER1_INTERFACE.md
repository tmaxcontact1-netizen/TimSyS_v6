# Layer 1 analytical interface

Nervous Breakdown is integrated in Principal’Ed under Organisation. Enter **Governance / Draft Review** to inspect the frozen seven-JD Pass 7 model. Normal View retains production visibility; an empty normal graph is legitimate while the corpus remains draft. Software completion does not constitute organisational approval.

## Architecture

The existing `nervous_breakdown` module remains the governed record store. There is no new graph database, hosted graph service, process model or organisational migration. Read-only `GET /nervous-breakdown/topology` and `GET /nervous-breakdown/records/:id/detail` routes use the established authentication, app scope and permission registration. Draft projection requires the existing governance permission. Normal detail requests cannot retrieve draft nodes by changing the ID. Source file downloads use the existing Documents endpoint and immutable version integrity check.

`exploration.js` builds the lightweight projection from the existing graph model. Topology includes identity/revision, navigational classifications, evidence/review/lifecycle, endpoint semantics, reference vocabulary and separate gap overlays. Full wording, pinned statement snapshots, rationale, source versions and history are retrieved on demand. The UI loads workspace metadata initially; the full governance workspace is loaded only when entering Govern or Sources & exchange. Detail caches are scoped to topology revision and mode, and invalidated on refresh. Selection/search/filter/camera changes do not fetch topology again.

The frontend `layer1` directory separates:

- `model.mjs`: adaptation, search index, filtering, grouping, traversal and deterministic layout.
- `Workspace.jsx`: shared selection, inspection, search, scope/filter state, evidence scope and trail state above all renderers.
- `layout.worker.mjs`: browser-local layout computation, independent of interaction rendering.
- `Network3D.jsx`: shared accelerated drawing primitives with perspective 3D and orthographic 2D cameras.
- `Network2D.jsx` and `Canvas2D.jsx`: accelerated 2D with a Canvas fallback when WebGL is unavailable.
- `ListView.jsx`: stable-ID rows, sorting, 50-row pagination, optional full classification/source columns and shared selection.
- `Inspector.jsx`: pinned documentary trace, current and historical relationships, gap context and deliberate transition to Govern.

Three.js 0.186.1 is pinned locally with its lockfile and MIT licence. It supplies browser-local WebGL, instanced responsibility/arrow geometry, batched edge segments and OrbitControls, with no organisational data sent externally. The heavy renderer is lazy-loaded. Relevant primary documentation: [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) and [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).

3D is a perspective spatial view. Accelerated 2D flattens the same stable geography onto an orthographic plane, disables rotation and enables direct panning. Canvas 2D preserves selection, edge direction and evidence semantics without WebGL. List does not depend on WebGL. A renderer error is isolated from the shared workspace; switching representations remains possible. Rendering is requested only when needed and coalesced to one animation frame. There is no continuous physics, camera animation or external telemetry. Multisample antialiasing is omitted for graphs above 10,000 edges to protect navigation budget; no records or edges are removed.

## Layout semantics

`domain-statement-topology-v1` is derived presentation logic. It never writes coordinates to governed records or generates revisions.

Primary governed domains have deterministic broad radial regions, sorted by stable ID. Source-statement identity seeds a reproducible local position, and stable-ID-sorted group members receive small offsets. Responsibility level, authority, role and subdomain jointly contribute a categorical local depth offset. They are not ranked by seniority: height does **not** mean supervisory authority. There is no Principal-above-Teacher rule. Ten bounded neighbour-relaxation passes attract connected responsibilities, normalised by degree, while retaining their original domain anchors. Source-group edges do not attract nodes according to chain order. The resulting coordinates stop moving.

Filtering, search, selection, evidence toggles and view switching do not recalculate layout. Refresh recomputes from current governed records, so revisions invalidate derived positions. The layout version is explicit. Spatial proximity never creates a governed relationship. Node size marks selection/emphasis, not workload or importance.

## Shared exploration

Search indexes stable ID, responsibility wording, role, domain/subdomain and source. Same-wording records remain separate and display their IDs, roles, source and statement context. Search locates/selects; it does not silently constrain trail eligibility. Role, domain, subdomain, action, authority, level, source, review and relationship filters are shared across views. Role/domain focus retains one eligible boundary hop by default; disabling connected context gives strict filtering. Isolate filtering uses degree in the full eligible current graph, not degree after hiding evidence. Gap filtering is separate.

If filters exclude the selected responsibility, a notice explicitly says the inspector is retained as context and offers to reveal it. Home / Show all clears selection/search/filters and restores the overview. Reset camera affects presentation only. Clear filters preserves selection. The inspector can be collapsed and the workspace expanded. The last representation is stored as a browser preference; cameras remain renderer-specific in memory. Neither preference enters organisational audit history.

Search results show up to 100 distinct matches with a visible total and instruction to narrow the query. The connection selector shows up to 250 matches, plus the inspected edge, with an explicit total and a searchable route to every eligible connection. This bounds DOM work without truncating topology or traversal. List exposes all eligible records through pagination and sorting. A full trail above 1,500 nodes gets a size notice, never silent truncation.

## Trails and documentary groups

Directed relationships obey upstream/downstream/both. Symmetric relationships are traversable from either endpoint. Evidence, review and relationship eligibility are applied **before** traversal. Suppressing companions excludes them from traversal; suppressing inferred excludes those edges.

REL-010 represents common pinned source-statement membership. Eligible companion groups supply zero-hop documentary context, independent of their stored spanning-chain distance. An organisational hop crosses a non-companion relationship. Complete source-statement membership is also available independently in the inspector and group-focus action, even when ordinary evidence filters suppress companion edges. No clique records or reverse duplicate edges are created.

The structured trail contains root responsibility, included responsibility and connection IDs, direction, depth, active filters and evidence scope. This is a future extension boundary only: no Process extraction, decision tree, execution, task or operational assignment is implemented.

## Visual semantics and accessibility

- Responsibility nodes are selectable; selected nodes are white, larger and labelled. Trail nodes/edges are prominent and unrelated context fades.
- Documentary companions are quieter symmetric segments, without arrowheads. Their grouping does not imply sequence, causality or workflow.
- Inferred/draft edges have broken lines and directional arrowheads where governed semantics are directed. Exact evidence/review/lifecycle badges remain visible in the inspector. The Draft Review banner is persistent.
- Unresolved handoffs use wireframe diamond markers and incomplete broken pathways, with an accessible handoff selector and full inspector. These markers are not counted as responsibility nodes or graph edges.
- Region labels are selective; hover and selection expose responsibility identity, while full wording and exact source text remain in the inspector. Canvas fallback limits incidental close-range labels, never records.

All controls, search, List selection and inspector actions support keyboard access. Arrow keys rotate/zoom 3D or pan 2D; buttons supply focus, zoom and home alternatives. View semantics do not rely solely on colour. No cinematic motion is introduced and reduced-motion CSS suppresses animation/transition. The dense global graph remains navigable through search/focus/filter/List rather than forced into a hierarchy.

## Unresolved handoff overlay

The original Pass 7 JSON's 95 `unresolved_handoffs` entries are retained verbatim in `gap-overlay.json`, alongside its source SHA-256 and app scope. This is a versioned analytical artefact accompanying the frozen corpus, not a new application entity or import into `nb_records`. A derived projection binds the originating responsibility and pinned statement; changed/missing bindings produce explicit diagnostics. No receiving responsibility is invented. Target role names remain as supplied; exact governed role matches provide context, otherwise the role remains referenced/unmapped.

Overlay evidence and human review remain independent. Original fields, including the analytical package's lifecycle wording, are inspectable but cannot confer production visibility. The overlay is available only in authorised Draft Review and never participates in graph metrics, ordinary adjacency or organisational traversal. A selected root/trail can expose its unresolved documentary context through markers and inspectors. Incoming/outgoing role references are described without resolving them.

The overlay is intentionally frozen to this analytical package. Future packages require an explicit governed artefact update and binding validation; there is no automatic ingestion or role resolution. The 52 inactive hypotheses remain in history, outside current topology; the 17 revised directions retain earlier endpoints in history.

## Validation and boundaries

Automated coverage includes pure adapter/traversal/layout tests, existing governance/import regressions, registered topology/detail route tests, real-data source/history/binding assertions, browser acceptance through the actual Principal’Ed shell and read-only handlers, and a separate 5,000/30,000 synthetic browser benchmark with WebGL fallback. Test synthetic records exist only in isolated fixtures/responses, never in the project database. Full project-table snapshots are compared before/after.

The real acceptance scenario includes rotation, zoom, responsibility search, R-0204 depth-three cross-role context, source-file download, shared 3D/2D/List selection, a six-member documentary group, inferred-edge rationale, actual unresolved handoff C-0001, role/domain focus, isolate inspection and reset. The completion report contains screenshots, measured timings and limitations. Browser harness authentication/registry responses are test fixtures; organisational handlers and frozen project data are actual. No deployment or production activation is implied by these tests.

No Layer 2, Layer 3, AI assistance, corpus approval, additional source ingestion, handoff resolution, analytical reclassification, new inferred relationships, deployment or code push is authorised by this build.
