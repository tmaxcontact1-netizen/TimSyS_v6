# Layer 1 semantic spatialisation

This presentation layer uses the existing governed topology, detail and history routes. It does not alter records, classifications, relationship endpoints, evidence, review state, lifecycle, original files or revisions. Normal visibility and authorised Draft Review remain separate projections of the same graph. No import, approval, Layer 2/3 entity or AI analysis is involved.

## Stable geography

`semantic-layout.mjs` produces both coordinate maps in a worker. Its explicit version, projection mode, fixture scope and topology revision key the optional browser cache. Filters change eligibility, emphasis and camera framing; they do not recompute global coordinates. Selecting a responsibility highlights its direct trail and documentary family. Only **Focus selection** creates a temporary local arrangement. Home restores global geography and clears scope.

Domains occupy a deterministic hex lattice. Pairwise affinity combines non-family relationships (weight 1), shared source-statement families (0.35) and shared roles (0.12 per role). The highest weighted-degree domain anchors the map; subsequent domains minimise weighted distance to placed domains. Stable ID hashes break ties. Neither alphabetical order nor an unconstrained force simulation determines territory placement.

Within each domain and classified level, source families are ordered by governed subdomain, role and stable family identity. Atomic members occupy a compact grid. Parent-specific subdomain IDs remain distinct, including identically named General terms. A family spanning domains or levels has multiple enclosures but retains one statement/revision identity. Individual responsibilities remain individual selectable records; no stored clique or aggregate responsibility is created.

Territory width and level spacing grow with the largest family bucket. Parameters are exported as `PARAMETERS`; affinity weights and focus spacing are explicit in the layout module. This is a deterministic heuristic, not an optimum crossing-minimisation solver.

## Vertical model

Height uses each responsibility's governed `level_id`, never its role name, graph depth, evidence or authority label. The current presentation bands are:

| Band | Governed terms |
| --- | --- |
| 4 | LEV-05 — Section leadership / accountability |
| 3 | LEV-02 — Middle leadership / coordination |
| 2 | LEV-03 — Operational supervision / student affairs; LEV-04 — Program coordination / student engagement |
| 1 | LEV-06 — Specialist behavior intervention; LEV-07 — Specialist support / intervention |
| 0 | LEV-01 — Frontline implementation / classroom |
| -1 | Unknown or a governed level without a calibrated presentation band |

This ordering is presentation configuration, not a new ontology hierarchy or a statement of rank for every action. Actual term names remain visible. New governed level terms remain importable and retain identity; they require explicit presentation calibration before receiving a named vertical band. Null levels remain unknown. Lateral specialist work can share a band. An arrow may point upward, downward or sideways; geometry never changes its governed direction.

## Focus and two-dimensional layout

Focus begins with the existing renderer-independent traversal result. It groups families within classified bands, orders by domain/role and performs two constrained barycentric alignment passes using actual neighbours. Lateral relationships receive weight 1.5 for alignment. Family dimensions determine spacing; tall families increase lane separation. The selected responsibility stays at its exact global anchor. Context nodes keep their global positions and old trail locations are ghosted. Exit focus restores the cached coordinate maps without writes or revisions.

2D has its own domain columns and level lanes, with subdomain/role/family placement inside them. It is not a flattened 3D projection. Focus uses the same governed trail and level rules with a separate 2D coordinate map. Non-family 2D paths use light curves. Intersections do not create junction records. Canvas fallback uses the same 2D coordinates and selection/direction semantics; it offers simpler straight paths and fewer incidental labels.

## Progressive information and controls

Global family enclosures replace persistent REL-010 lines by default. All companion records remain in traversal, counts, List/inspection and export. **Show all companion lines** restores their individual segments. No companion arrowheads are drawn. Non-family pathways preserve exact direction and use dashed draft styling; relationship/evidence/review annotations and the inspector make their meaning explicit. Unresolved handoffs remain separate wireframe markers with no receiving responsibility invented.

Labels use screen-space callouts linked to actual anchors. Collision avoidance cannot move a label freely between levels. Small scopes and crowded focus bands arrange callouts by classified level; thin leaders distinguish label placement from graph coordinates. Focus labels are capped at 80, close-range incidental labels at 60 and inline relationship captions at 35. These are annotation limits only: records, edges, search, filters, inspection and List are not truncated. Full wording is available on hover and inspection. Secondary captions yield to responsibility wording.

The compact primary toolbar keeps representation, search, role/domain scope, Focus, Home, advanced filters, inspector visibility and expansion. Trail controls appear with a selection. Advanced classification/evidence filters use an overlay drawer. Top/side/front camera presets expose territories and levels. Role colour is the default; domain colour is available. Term names, enclosures, level guides, line style and badges provide non-colour cues. Camera easing honours reduced motion. No continuous simulation is running.

## Scale and limits

Nodes and arrows are instanced, edges batched, rendering event-driven and layout cached. Above 10,000 edges the renderer reduces tessellation, dash subdivisions and pixel ratio; every eligible edge is still represented. Camera range adapts to large focus bounds. There is no semantic edge sampling or hidden record limit. Large direct/full trails still need filtering or List to be legible.

Seven role colours are reused for larger domain sets; domain labels and territories remain the primary distinction. Global geography can shift when the governed topology revision changes. Multiple root-domain classifications currently use the first stable domain ID as their spatial anchor; all classifications remain in the record. Such future multi-domain datasets need explicit calibration. The current band configuration is specific to the supplied seven levels and is not an inferred universal hierarchy.

## Verification

Pure tests cover deterministic/reordered-input coordinates, cache round trips, parent-specific subdomains, unknown/new levels, family identity, pinned focus roots, unchanged endpoints and governance, and 5,000 responsibilities / 30,000 connections without graph truncation. Existing governance/graph regressions remain required.

Private acceptance artefacts compare the actual installed corpus before and after read-only browser exercises. Reference cases include R-0378, R-1082, Principal plus Curriculum, Behaviour, specialist collaboration, source families, an isolate and an unresolved handoff. Screenshots and performance measurements belong with the completion report; original JDs, databases and private screenshots are not release assets.
