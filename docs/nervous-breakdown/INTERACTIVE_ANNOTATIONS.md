# Interactive annotation navigation

A visible entity annotation is another interaction surface for the existing entity. It has no independent selection state or persisted identity.

| Annotation | Existing action |
|---|---|
| Responsibility / connected responsibility | Workspace `choose(id)`, exactly as node, search and List selection |
| Unresolved role endpoint | Existing handoff inspection, retaining its originating responsibility |
| Specific connection label | Existing connection inspection |
| Documentary source-family label | Shared `showGroup(key)` action used by the inspector |
| Domain, level, orientation, legend, count | Informational; no navigation action |

Accelerated 3D and 2D render entity labels as native buttons. Enter/Space, full-card clicking, focus outlines and pointer/hover affordances are provided. Family labels pass their actual statement/revision key. Recycled zoom-detail callouts read the current entry ID at interaction time; displaced callouts retain their true anchors. Suppressed labels are hidden and cannot intercept pointer events.

Responsibility hover is transient renderer presentation: a node halo and its visible label outline synchronise in both directions. Keyboard focus supplies the same correspondence cue. Camera movement clears hover so a recycled label cannot retain a stale highlight. The Canvas 2D fallback synchronises its native responsibility buttons and painted node halo too.

Selection still uses the accepted camera/Focus behaviour. Clicking a connected label changes the selected responsibility and rebuilds context; it does not invoke Home or change discovery filters, direction or depth. Focus can be explicitly requested around the new selection. No graph, selected-context, semantic-layout or corpus semantics change in this pass.

## Acceptance contract

Real-corpus browser acceptance covers Teacher/Behaviour R-0393 callout selection, C-0016 card inspection, a distant 3D node under nine pixels, node/callout hover correspondence, full-card hit areas, Enter/Space, all seven dense family callouts, displaced-callout identity, family-label action, a specific connection annotation, decorative-label exclusion and List continuity. It walks an actual cross-role chain through A/B/C callouts in both 3D and 2D, asserting the shared selected ID and rebuilt organisational position after every hop. All backend access is read-only and non-GET organisational requests fail the test.

Existing Layer 1 traversal, semantic layout, selected-context and governance tests remain unchanged and must pass. Release acceptance repeats the interaction suite against the updater-installed UI in an isolated copy of the real seven-JD installation, followed by corpus/source/history integrity comparison.
