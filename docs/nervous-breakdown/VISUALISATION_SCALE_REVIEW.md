# Layer 1 visualisation and scale architecture review

Date: 29 September 2026. Governing requirement: [complete supplied addendum](VISUALISATION_SCALE_ADDENDUM.txt), superseding the earlier proposed visualisation addendum. Planning envelope: 30+ JDs, 5,000+ responsibility nodes, tens of thousands of connections, institution-wide scope, and future additional source types. These are capacity targets, not display caps.

Accepted by the user. Subsequent narrowly scoped work resolved the draft inspection caveat through a permission-checked projection; see [Draft Review gate](DRAFT_REVIEW_GATE.md). The review below records the architecture as inspected before that adjustment.

**Recommendation: architecture fundamentally compatible; continue the governed-data sequence. No schema migration, candidate change or foundational code change is required before the initial import. The current presentation/loading implementation is not yet a scale-qualified three-view product.** Its limitations can be addressed without rewriting imported organisational records. Complete the presentation foundations before adding the second renderer, rather than allowing each view to acquire independent state or data.

This review does not perform or authorise the real import. v0.2.1 remains validated, draft and unimported. Only documentation and a local synthetic benchmark artifact were written; no application records, application code, dependencies or candidate payloads were changed.

## 1. Current compatibility

Yes at the organisational-model boundary. `platform/modules/nervous_breakdown/model.js` stores responsibilities and directed connections with stable IDs and derives a graph independently of React, SVG or coordinates. The SQLite records/revisions infrastructure is not tied to sections, seven roles, domain counts or a renderer. One graph can feed 3D, 2D and List. The current Govern table is an editing/audit interface, not yet the coordinated analytical List described in the addendum.

Keep one authoritative responsibility graph. Sections, roles, sources and domains become query/context dimensions; they must not become independent graph stores. Renderers consume projections and never redefine identity, provenance or edge existence.

## 2. Scale assessment

The storage and graph algorithms provide a reasonable foundation for this envelope; the full frontend pipeline is not proven at that scale. `graph()` scans records and constructs ID maps; `trail()` builds adjacency and traverses visited nodes/edges. They do not impose a responsibility-count cap. SQLite has stable-ID and app/kind indexes, although topology is presently embedded in JSON and loaded wholesale. No graph database replacement is justified now.

A synthetic Node-only probe used 30 roles/sources, 1,500 statements, 5,000 responsibility nodes and 30,000 connections, including a hub, dense region, sparse/cross-role connections and 500 orphans. Across eight runs, graph projection took about 36–84 ms and a depth-20, both-direction hub trail took about 54–103 ms; the trail reached 4,500 nodes. All 5,000 nodes and 30,000 edges remained in the projection. Synthetic records were memory-only and are not BBS truth.

The serialized synthetic workspace was 9,655,376 bytes and graph response 8,736,266 bytes. This illustrates why returning full graph records on every selection will become expensive. These figures exclude database reads, HTTP, serialization timing, browser parsing, rendering, GPU work and interaction latency. They establish neither frame rate nor end-to-end capacity. Before scale launch, test actual desktop browsers with varied graph shapes, repeated filtering, rapid view switching, deep trails, fading, memory use and responsiveness.

The 10,000-record import limit is per request, not a corpus limit. New sources/responsibilities and later connection batches can be imported in dependency order. A complete 30,000-edge corpus export cannot be replayed in one current request; dependency-aware batching or a future staged transactional import is needed for large restoration. Do not silently raise limits or pretend multiple requests are one atomic transaction. History validation/export currently loads all relevant revisions and will also need attention as history grows.

## 3. Renderer assessment

Partially decoupled. `Network({ network, selected, onSelect, records })` receives graph data through props, while backend topology and traversal are renderer-neutral. Coordinates are computed locally and never persisted into responsibility records. This is a usable replacement boundary.

However, `NervousBreakdownWidget.jsx` contains the SVG renderer, role-based layout, camera state and governance UI in one file. Every visible edge creates SVG elements; every node creates a group/circle and associated content. Opacity fading does not reduce DOM element count. The current SVG implementation should be treated as a small/local graph implementation, not assumed to be the permanent all-institution renderer. Retain it for the real-corpus proving stage; browser measurements should determine whether to optimise it for local views or replace its drawing backend with Canvas/WebGL. Replacing drawing code would not replace the organisational model or the first-class 2D representation.

## 4. Shared-state assessment

Selection, filters and trail controls already live above `Network`, in `NervousBreakdownWidget`; they are not trapped inside SVG objects. Stable IDs are used. That is compatible with a shared Layer 1 controller.

Current gaps: Govern uses its own search/pagination and inspected record; selecting a table record does not consistently update the selected graph responsibility. The explorer exposes one generic term filter, not independent simultaneous domain/authority/level filters. Its `Network` viewport resets when that component unmounts during tab changes. Search-to-focus is not one shared command.

Before a second renderer, factor the existing selection/search/filter/trail context into one view-independent controller. Each representation consumes that context. Keep separate retained viewport/camera/layout and List sort/page state keyed by representation; share focused responsibility identity, not camera coordinates. Inspector navigation to a source or role should not silently replace responsibility selection. This is an interface refactor, not a data migration, so postponing it until the next view work does not increase data-population cost.

## 5. Data-loading assessment

Not appropriately separated yet. `workspace()` returns all full current records. The graph endpoint again reads all records and returns full responsibility/connection objects. Selection changes trigger another graph request; current history is retrieved separately, but the history handler loads the app's histories before filtering by ID. Source quotations are used during search. The browser therefore carries detail it does not need simply to draw topology.

Before scale UI work, introduce a summary/topology response and targeted record/revision detail retrieval. Include stable IDs, role/source/classification/evidence/review summaries and endpoint IDs in topology; load exact quotation, document version, notes and history on inspection. Preserve server-side search across source wording. Cache/index projected topology and adjacency by graph revision where evidence warrants it; selection should not require downloading the full graph again. Keep existing governed records/import/export authoritative and backward compatible. No imported data must be rewritten to add these read APIs.

## 6. Spatial state and progressive disclosure

Compatible, but stable incremental positioning is not implemented. The current role-ring/phyllotaxis layout is deterministic for a given ordered filtered input, yet adding roles or changing filters can move existing nodes. It does not preserve institutional spatial memory.

Future positions should live in a derived layout cache keyed by stable responsibility ID, representation, layout version and relevant graph revision. Preserve existing positions across filtering and ordinary growth; deliberately invalidate/recalculate when appropriate. Camera state is presentation state. Neither coordinates nor distance should be stored as governed responsibility meaning. Do not impose numeric ordering on the seven level terms or substitute role seniority for responsibility level.

Progressive labels, edge visibility, fading, picking and level-of-detail can all operate on a separate render projection. Retain the full underlying topology and explicit visibility counts. Current filtering returns an induced subgraph: both endpoints must match, so boundary connections disappear from that response. Future scope filters need explicit boundary/context projections; they must not delete connections or let visual suppression silently change trail traversal.

## 7. Referenced roles and unresolved handoffs

Existing stable role records already support `placeholder`, `referenced` and `mapped`; changing mapping state revises the same role, without recreating it. Responsibilities and role anchors must remain different semantic objects.

The 95 handoffs remain external governance artifacts; the current production schema has no handoff entity or auditable unresolved-resolution lifecycle. A future typed context overlay can show real role IDs and separately identified gap annotations, excluded from responsibility counts and canonical edge traversal. A governed gap/resolution record would need explicit future design if such artifacts are brought into the application. No fake responsibilities and no role endpoints in the connection schema are necessary. Source ingestion must never auto-resolve a handoff. This missing future workflow does not invalidate the present responsibility dataset.

## 8. Additive growth

Yes. New stable-ID roles, source/version bindings, statements, terms, responsibilities and connections can extend existing records; existing IDs are not generated from layout or wording. Ontology terms can be added with governed IDs/parents. Existing roles can mature through revisions. New sources do not require re-extracting prior sources, while relationship reanalysis can be reviewed independently.

Boundaries still to extend when needed: `source_type` is currently restricted to `job_description` in model, schema and UI; organisational section/function is not yet an explicit governed field; mapping states do not express every future completeness category. These are additive contract changes, not a reason to assign speculative sections or source types to today's records. Future time-slice visualisation needs a consistent historical snapshot/effective-date query; revision history exists but that query is not implemented. Rejected is not currently a lifecycle enum; inactive/superseded retain history, and any later distinct rejection semantics need an explicit contract change.

## 9. 3D technical direction

A browser-local Three.js/WebGL renderer is an appropriate class of solution for the existing React/Vite application. Use instanced node geometry, batched line geometry, bounded labels, stable ID-to-instance lookup and efficient selection/picking, with layout computation separate from rendering and potentially off the main thread. It should consume the same graph adapter and shared state as 2D/List. Do not create one expensive scene object or DOM label per responsibility/edge by default.

Three.js documents [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) for reducing draw calls across repeated geometry, and [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) for orbit/zoom/pan. OrbitControls preserves an up direction; unconstrained trackball-style rotation may better fit the eventual interaction requirement, so do not freeze that decision now. React Three Fiber is a possible React integration layer; its [performance guidance](https://r3f.docs.pmnd.rs/next/advanced/scaling-performance) discusses instancing and scaling. Check exact compatible versions against the current React 18 application before adopting any wrapper. No dependency was installed or selected irrevocably. No hosted graph service is required. No claim is made that a library alone satisfies the target scale.

## 10. Minimum changes now

**Before initial population: no code/schema change justified by this review.** Record this addendum and the following implementation boundaries now; imported IDs and provenance will remain valid through each change.

Before adding another view: extract the shared exploration controller, renderer contract and retained per-view presentation state. Before institution-wide rendering: add summary/detail loading, measured cache/index improvements and a drawing strategy demonstrated at target scale. Before future source types or institutional scope data arrive: extend the controlled source vocabulary/scope contract explicitly. None requires anticipating organisational classifications now.

An immediate inspection caveat is essential: `model.graph()` includes only active, reviewed connections, even when responsibility status is `draft` or `all`. Thus an authorised import of v0.2.1 would leave all 167 inferred draft connections stored but absent from the current graph view. Default active responsibility filtering also hides the draft nodes until adjusted. Do not activate or approve records to make them visible. A future explicit draft-review graph mode, with unmistakable review/evidence styling and unchanged default governed view, is the narrow UI/query extension needed to visually inspect those draft edges. It is not required for safe storage and is not implemented by this review.

Other launch gaps: trail depth is capped at 20 rather than supporting full connected traversal; evidence filtering is a single value; review filtering is incomplete; non-documentary edge types currently share one dashed treatment. Address these in the authorised view work, preserving independent evidence, review and lifecycle states. Do not interpret those gaps as missing connections or grounds to modify the candidate.

## 11. No-change areas

- Stable responsibility/connection identities, endpoint order and responsibility-only endpoints.
- Exact source statements, statement revision pins and registered immutable document/version bindings.
- Current governed ontology IDs, explicit parents, optional levels and legitimate unknowns.
- Separate evidence, human review and lifecycle status; all candidate records remain draft.
- Append-only revision/audit foundations and optimistic revision checks.
- The eight intentionally preserved documentary pairs and 95 excluded unresolved handoffs.
- Existing operational ownership and future Process/Execution separation.
- Current v0.2.1 payload, import contract and validation result.

## 12. Decision and evidence

**Architecture compatible; continue the current sequence, with explicit future presentation work rather than a redesign.** The current implementation is not the final three-view experience, but its deficiencies are local to queries, renderer/state coordination and future optional metadata. There is no material conflict demanding a data rewrite before import. Population does not make these view-layer extensions substantially more expensive; creating multiple independent renderers first would.

Primary inspected code: `platform/modules/nervous_breakdown/{model.js,index.js,validation.js,import-schema.js,module.json,migrations/001_responsibility_network.sql}`, `apps/principaled/src/dashboard/widgets/NervousBreakdownWidget.jsx`, its API client and application package manifest. The synthetic probe is supplemental evidence, not a production test or user acceptance result. No application boot, import, migration, deployment, push, Layer 2 or Layer 3 work occurred.
