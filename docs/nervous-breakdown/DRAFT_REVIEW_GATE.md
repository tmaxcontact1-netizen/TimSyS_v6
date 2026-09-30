# v0.2.1 Draft Review gate

29 September 2026. The Visualisation and Scale Architecture Review is accepted. Its renderer-neutral identity, shared graph, additive growth and separate presentation-state conclusions remain governing requirements. This narrowly scoped implementation resolves the draft-connection inspection caveat; it does not implement the future 3D/2D/List redesign.

## Implementation

The existing graph endpoint accepts `mode=normal` (default) or `mode=draft_review`. Draft Review additionally requires `admin:nervous_breakdown:govern`; the endpoint's existing read permission remains required. Workspace capability metadata controls whether the selector offers Draft Review. The server enforces permission independently of the UI.

Both modes call the same renderer-independent graph/trail functions over the same records. No review graph, table, record kind or migration was introduced. Selection and filters remain above the renderer; the connection inspector is driven by stable record IDs. Rendering does not call save/import/approval services.

Normal projection rules are unchanged: the default responsibility status is active; existing explicit responsibility status filters remain available; edges must be active and reviewed. Evidence and relationship filters retain their existing semantics.

Draft Review defaults to all responsibility statuses (the UI sets status=all), while preserving the existing role/source/classification/fixture filters. It includes draft and active connections, including inferred/proposed evidence and draft/proposed review. Connections still require both endpoints in the selected node projection. Inactive/superseded connections are not added to this review projection. Fixture isolation remains unchanged. No status, evidence, endpoint order or revision is modified.

## Inspection and visual treatment

- Prominent dashed banner: “GOVERNANCE / DRAFT REVIEW — NOT APPROVED ORGANISATIONAL STRUCTURE”.
- Dotted edges for draft/non-reviewed records; dashed outlines for unreviewed nodes; textual evidence, review and lifecycle labels supplement colour.
- Clicking an edge or using the native keyboard-accessible connection selector opens the same inspector.
- Inspector includes stable connection ID, both responsibility IDs/wording, both roles, relationship type/ID, evidence, review, lifecycle, exact supplied rationale and unreviewed-direction metadata where supplied.
- Endpoint statement IDs/revision pins, source names and immutable document/version IDs are shown, with access to statement history. Connection documentary evidence remains separately inspectable where supplied. Missing direct connection evidence is stated explicitly; endpoint provenance is not represented as proof of the inferred edge.
- Existing JSON-encoded candidate notes are decoded only for display; stored rationale/notes remain untouched. Plain-text notes remain verbatim.
- The Draft Review inspector offers no edit/approval action. Existing governance editing remains a separate workflow. No bulk approval or AI recommendations were added.

## Validation performed

18 focused Jest tests passed across graph unit and isolated HTTP integration suites. New coverage checks synthetic draft responsibilities, inferred/proposed draft edges, normal-view exclusion, evidence filters, deterministic trails, fixture isolation, rejected invalid modes, governance permission denial, capability metadata and unchanged records/history after inspection. Existing import/provenance/revision/round-trip tests in those suites also passed. HTTP tests use a separate disposable synthetic database, never the project database.

A headless Edge browser test mounted the actual widget against a synthetic read-only API fixture, checked mouse edge selection and the connection selector, rationale/status/provenance display, absence of the inspector edit action, return to normal mode, and hiding Draft Review for a read-only viewer. It captured zero write requests and zero browser page errors. The resulting screenshot was inspected. The fixture uses the actual graph/trail functions but mocks HTTP responses; server permission enforcement is independently covered by HTTP tests.

Principal'Ed and embedded launcher production builds passed. Both retain their pre-existing large-bundle advisory. No deployment occurred.

## Import readiness and stop point

The unchanged candidate is ready for a separately authorised import in draft state and subsequent inspection through Explore → Governance / Draft Review. All 167 connections can remain inferred/draft; visibility no longer requires approval or activation. Normal mode will continue to exclude those draft edges.

Candidate SHA-256: `a77a179f45c53f41f6792f402931a68eff92a37953809b4db94feb0f653129c8`.

Read-only inspection of the project store confirmed seven roles and seven source records only. Zero candidate ontology terms, statements, responsibilities or connections were imported. The candidate file was not modified. No production activation, bulk approval, 3D, Layer 2, Layer 3, deployment or push occurred.
