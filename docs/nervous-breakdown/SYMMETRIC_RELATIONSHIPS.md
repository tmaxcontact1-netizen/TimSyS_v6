# Pass 7 directionality foundation

Governed relationship terms now accept optional `directionality: directed | symmetric`. Omission retains directed behaviour without modifying existing records. Optional `review_status` permits explicit draft review metadata on new terms; existing terms are not backfilled. `grouping: source_statement` requires a symmetric relationship type.

Ordered connection endpoints and `direction: from_to` remain storage fields. Graph edges expose derived `semantics.directionality`, `process_order_inference`, `grouping`, `source_statement_id` and `statement_revision`. Symmetric edges carry `process_order_inference: excluded`; directed edges carry `not_established`—neither is automatic permission to infer a process. No Layer 2 functionality exists here.

Symmetric edges are traversable both ways under upstream, downstream or both controls. One stored edge suffices; duplicate current symmetric endpoint pairs for the same relationship type are rejected. Directed edges remain directional. Normal visibility rules remain unchanged.

For source-statement grouping, validation requires both endpoint responsibilities to retain documentary evidence and share the connection's pinned source statement and revision. The graph supplies statement groups independent of chain distance. The inspector lists the complete pinned documentary group, while ordinary depth-limited traversal continues to traverse actual stored edges. No clique expansion or invented proximity occurs.

The 2D renderer removes arrowheads for symmetric edges while retaining dotted draft treatment and explicit documentary/draft labels. The inspector identifies symmetric semantics, excludes process order, and preserves source evidence access. Future renderers can consume the same metadata.

Tests: 22 focused unit/HTTP integration tests passed, including a five-node/four-edge chain, directed regression, filters, source grouping, reverse-duplicate rejection, draft term import/export in an isolated synthetic database, and immutable inspection. Browser tests verified no companion arrowheads, a five-member group, documentary/draft evidence inspection, normal-view isolation and zero write requests. Principal'Ed and launcher builds passed with the existing large-bundle advisory.

Synthetic scale probe: 5,000 nodes, 30,000 edges, including 4,000 companion edges and 1,000 statement groups. Median graph/trail times were approximately 20.9/36.0 ms for directed handling and 21.6/34.3 ms with symmetric handling. This microbenchmark shows no material graph-processing degradation on this host; it is not a browser/GPU or end-to-end performance guarantee. No synthetic records were saved to the project store.

## Governance preparation status

The 17 reversal report is prepared from prior validation evidence and the unchanged baseline. Each proposal uses the existing ID with expected revision 1 and proposed revision 2; all remain inferred/draft. For the 52 rejected hypotheses, the planned lifecycle is `inactive`, because there is no rejected enum and no replacement relationship is asserted. Their IDs, original direction and evidence remain recoverable through immutable revision 1; rejection rationale will accompany the proposed revision 2.

The original Pass 7 JSON was restored and its hash matched the earlier validation. The exact 1,098-record candidate passed dry-run validation with zero blocking errors: one new term, 867 new documentary edges, 63 new inferred edges, 115 existing connection revisions and 52 inactive dispositions. Projection confirms 1,045 current edges, 237 components, 22 isolates, largest component 76 and median component size 3. Full candidate and governance reports are in the local principaled-context/pass7-v0.3-update folder; none has been applied.

No REL-010 or other Pass 7 record was persisted. All application tables were compared with the pre-work snapshot and remain identical. No approval, activation, handoff resolution, 3D, Layer 2/3, deployment or push occurred.
