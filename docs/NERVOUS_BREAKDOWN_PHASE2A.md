# Documentary Landscape — Phase 2A

Local implementation, 20 October 2026. Base commit: `7067bfd9aba57b3ab33bc2e89732007f4aa323fc`.

One selected documentary statement can now reveal its frozen explicit relationships and navigate to an existing documentary container. No general graph, inference, workflow, hierarchy, dependency, multi-hop traversal or gap analysis was added.

## 1. Files changed

| File | Purpose |
| --- | --- |
| `apps/principaled/src/documentary-landscape/connections.ts` | Generic visual adapter, evidence validation and optional destination identity |
| `apps/principaled/src/documentary-landscape/DocumentedConnections.jsx` | Selection-local loading, destination shortcuts, paginated list and evidence inspection |
| `apps/principaled/src/documentary-landscape/DocumentaryLandscape.jsx` | Show/Hide, one-hop navigation and arrival context |
| `apps/principaled/src/documentary-landscape/model.ts` | Extend existing history frames with connection visibility, inspection, pagination and arrival state |
| `apps/principaled/src/documentary-landscape/landscape.css` | Restrained annotations using the existing visual language |
| `platform/modules/nervous_breakdown/documentary-connections.js` | Read-only bridge to the unchanged Research’Ed projection |
| `platform/modules/nervous_breakdown/index.js` and `module.json` | Authenticated, revision-fenced GET endpoint for one selected statement |
| `scripts/landscape-connection-fixtures.mjs` | Synthetic in-memory relationship fixtures |
| `scripts/landscape-connections.test.mjs` | Adapter, evidence, identity, negative, scale and read-only bridge tests |
| `scripts/landscape-connections-e2e.mjs` | Synthetic browser tests with 1/5/20/100 relationships |
| `scripts/landscape-phase2a-acceptance.cjs` | Real-corpus journeys and eight screenshots |
| `scripts/landscape-e2e.cjs` | Opt-in Phase 2A acceptance alongside all Phase 1 scenarios |
| `scripts/landscape-scale-e2e.mjs` | Explicit empty relationship response for existing Phase 1 synthetic fixtures |
| This report | Completion record |

## 2. Frozen model and source integrity

The six protected analytical/extraction source files, nine original source binaries and live project JSON remain unchanged: all 16 baseline hashes match. The Research’Ed checkout remains clean.

The corpus remains nine documents, 389 retained statements/descriptors and 75 section occurrences. Project SHA-256:

`ac042fec11e59d52aeae7e4b32c263fb39e99d947a935db2250dee3f5e53ccd2`

The bridge invokes the existing `jdMatrix` function from the registered Research’Ed runtime and consumes only its `documentedRelationships` output for the selected document/passage. It neither copies nor changes the relationship grammar. The frozen function computes its existing projection on demand; this collection does not persist precomputed relationship records. No extraction or source mutation is performed.

Normal runtime resolution reads the active Research’Ed bundle registration and fences it to the registered bundle directory. Tests can explicitly select the frozen compiled engine in test mode. The registered-runtime read path was also verified independently against Teacher collaboration.

Browser tests run against disposable databases and a copied project. No live application records were written. Trade’Ed remained on its independent worker/watchdog, with healthy heartbeats and zero watchdog failures.

## 3. Adapter and Show/Hide behaviour

The generic rendering contract is:

`documentary statement → explicit relationship → named counterpart → optional existing container`

The authenticated GET endpoint returns only the selected statement's frozen records and rejects a stale source revision. The browser does not load a global relationship corpus. Results are cached per statement/revision and obsolete requests are cancelled.

Only a selected statement with validated explicit records gets **Show connections**. Activating it reveals a neutral destination strip and **Documented connections** in the existing dock. **Hide connections** removes both. Selecting a container never exposes relationships. Statements without records show “No documented connections in this statement.” Errors remain distinct from an empty result.

The strip shows at most three shortcuts, in frozen source order. All records remain individually available in inspector pages of eight. There is no ranking, primary counterpart, merging or sequence.

## 4. Existing objects and referenced counterparts

Destinations resolve only to one existing documentary title matching the frozen counterpart identity, using the same case/whitespace normalization as the frozen title-matching rule. No synonyms, aliases or semantic matching are used.

The counterpart label preserves the exact `counterpartWording`, including wording such as “the AEA Department.” Matching uses the engine's separate `counterpart` field.

**19 of 107 relationship records** have an exact existing-container destination. **88 records** remain referenced counterparts. These are record counts, not unique entity counts. No ambiguous duplicate-title matches occur in the current corpus.

A referenced counterpart has inspectable evidence and neutral “No corresponding documentary source is currently present” wording. It cannot be entered as a container. An ambiguous title is labelled unresolved rather than treated as a missing source. No missing-container condition is called an organisational gap.

The frozen role-equivalence module stores researcher declarations for audit only; it does not project resolved identities from them. Accordingly, Phase 2A does not apply those declarations as routing aliases. The current corpus has no such declarations. Tests ensure a purported equivalence cannot silently create a destination.

## 5. Evidence and direction

Before rendering, the adapter requires:

- `documented_relationship` status;
- unique relationship identity;
- the selected document and passage identity;
- matching full retained passage, source role, filename and location;
- exact phrase, counterpart and sentence text at their retained spans.

A mismatch suppresses the record and produces a visible evidence warning. Role mentions, boundaries and unresolved connections are never upgraded into relationships.

Selecting a relationship shows its phrase, source role, documented actor, exact counterpart wording, document, location, full sentence and full passage when different. Object, purpose/context and condition are shown only when retained by the frozen record. **View Source** uses the existing revision-fenced source viewer.

The current frozen relationship records contain no organisational-direction field. All annotations are therefore neutral: no authority/dependency arrows are inferred from verbs. “Go to” denotes navigation only.

## 6. Navigation, arrival, Back and Home

The destination strip is a labelled navigation portal, not a duplicate graph node. Following an exact destination returns to the organisation coordinate system, selects the real existing container and places its existing stable address in view.

The existing history stores the original context, camera, selection, inspector visibility, visible connections, selected evidence and connection-list page. Back restores them. A small **Arrived via** indicator retains the source statement and literal relationship phrase. It contains no new analytical claim.

Home clears arrival and transient relationship state. Search remains literal retrieval; its terms never generate connections. The deterministic layout function and existing addresses are unchanged.

## 7. Acceptance results

- **Teacher collaboration:** three separate counterparts; AEA Coordinator navigates to the existing object. Learning Support and the AEA Department remain references. Back restores the selected Teacher responsibility, camera and visible/inspected connections.
- **Teacher behavioural escalation:** Section Principal, Section Vice Principal and Subject Leader stay separate. Section Principal and Subject Leader have exact documentary destinations; Section Vice Principal remains a reference. Literal escalation wording, object and “as appropriate” context are retained.
- **School Counselor referral:** “refers the case to”, “the case” and the explicit scope condition remain inspectable. View Source shows the retained passage, and AEA Coordinator navigation uses the same existing container.
- **Negative role mention:** the Teacher passage about PLCs and Subject Leader-facilitated meetings renders no relationship. It shows the neutral no-connections state.
- **Full corpus audit:** all 107 explicit records pass the evidence adapter; zero records rejected. The 24 frozen role-mention occurrences are not promoted into relationships.
- **Phase 1:** existing real-corpus navigation, source display, search, deterministic geography, inspector Close, Back, Home, responsive behaviour and reduced-motion acceptance still pass.
- **Generic policy:** synthetic policy origins use the same connection contract and renderer. No policy-to-JD inference is introduced.

## 8. Tests and scale

Passed:

- 117 frozen JD analytical tests;
- 12 existing landscape/API/UX tests;
- 9 new connection tests;
- real-corpus Phase 1 plus Phase 2A browser acceptance;
- synthetic Phase 1 medium/large/policy/unresolved-source browser acceptance;
- synthetic connection browser acceptance, including preserved pagination on Back and 600px responsive layout;
- strict landscape TypeScript and frontend production build.

At 200 containers / 25,000 statements:

| Relationships on selected statement | Show interaction, measured | Maximum destination shortcuts | Maximum inspector rows | Records reached |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 87 ms | 1 | 1 | 1 |
| 5 | 187 ms | 3 | 5 | 5 |
| 20 | 104 ms | 3 | 8 | 20 |
| 100 | 73 ms | 3 | 8 | 100 |

These are single-run browser timings including automation overhead. They are not performance guarantees. No connection request is made on initial organisation view; each scenario requested only its selected statement. All synthetic browser runs reported zero page errors.

Existing Phase 1 scale checks still render 12 initial container tiles for both 50/5,000 and 200/25,000 fixtures. The large fixture showed first tiles in approximately 343 ms and search was ready in approximately 3.9 seconds.

## 9. Screenshots and evidence

1. [Teacher before connections](../diagnostics/landscape-phase2a/01-teacher-before.png)
2. [Teacher connections shown](../diagnostics/landscape-phase2a/02-teacher-connections.png)
3. [AEA Coordinator existing-container destination](../diagnostics/landscape-phase2a/03-existing-destination.png)
4. [Arrival at existing AEA Coordinator](../diagnostics/landscape-phase2a/04-arrival.png)
5. [Referenced counterpart](../diagnostics/landscape-phase2a/05-referenced-counterpart.png)
6. [Relationship evidence inspector](../diagnostics/landscape-phase2a/06-evidence-inspector.png)
7. [Behavioural escalation counterparts](../diagnostics/landscape-phase2a/07-behavioural-escalation.png)
8. [No relationship / role-mention negative](../diagnostics/landscape-phase2a/08-no-relationship.png)

Machine-readable local evidence in `diagnostics/landscape-phase2a`: `adapter-audit.json`, `corpus-summary.json`, `browser-real.json`, `browser-scale.json`, `frozen-before.json` and `frozen-after.json`. Screenshots and diagnostics are ignored local artifacts.

## 10. Limits and stop

No explicit frozen relationship in the current corpus failed evidence validation. Referenced counterparts are safely represented without fabricated containers. Organisational direction and equivalence-based routing remain unavailable because the frozen output does not provide them.

The existing engine computes the full analytical projection server-side before selecting a statement's records. This phase does not alter that engine or claim 25,000-statement engine performance; large synthetic tests measure the generic adapter and selection-local UI. The bridge requires an available compatible registered Research’Ed runtime and reports unavailability explicitly.

The existing frontend chunk-size and Node module-type warnings remain. This is local-only work: no commit, push, package, installation, publication, live data change or further phase was performed.

## 11. Publication authorised 23 October 2026

The subsequent user instruction authorises commit, push and publication of Phase 2A. Release 2026.10.23.2 preserves the published 2026.10.23.1 baseline, including ResearchEd 0.10.6. Only the Nervous Breakdown backend files and the launcher UI bundle are replaced; the native launcher and TradeEd runtime are unchanged. Source documents and analytical records are not modified.

Pre-release isolation check: scheduled-task worker PID 24216, watchdog PID 21380, owner PID 24120, ancestry through Task Scheduler service (not Launcher); heartbeat collecting, no error, zero watchdog failures and no incidents in the preceding 15 minutes. Runtime, data and logs are outside launcher bundles. Packaging uses separate staging and disposable databases on random ports excluding 18860/18861. No installation or process restart is part of publication.

The release packager checks the existing backend against the reviewed base, hashes every staged file, permits only two replacements and one helper addition, validates with the installed updater guard, and runs real-corpus Phase 2A plus AI UI browser acceptance. It preserves all unrelated published bundle entries and refuses publication preparation if the baseline changes during packaging. Release verification and inventory accompany the published assets.
