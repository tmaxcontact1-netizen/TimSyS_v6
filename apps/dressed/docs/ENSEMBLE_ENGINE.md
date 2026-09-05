# Ensemble engine

Dress'Ed builds outfits around a user-selected anchor garment. Generation is deterministic: the same wardrobe, context, season, rule version, and preferences produce the same ordered results.

## Flow

1. Load available garments that have a current visual fingerprint and a configured outfit slot.
2. Fill every required context slot, then optional slots, using a bounded beam search.
3. Apply the Phase 5 styling rules and reject hard failures or results below grade C.
4. Apply explicit user overrides: banned relationships are removed and favourites receive a small, visible ranking bonus.
5. Return separately ranked A, B, and C groups with the underlying rule explanations.

The engine proposes; it never silently selects an outfit. Saving, favouring, and banning remain explicit user actions. Saved outfits retain the calculated score, grade, explanation snapshot, context, and constituent garments so historical results remain auditable when later rule versions change.

## Scale controls

Candidate retrieval is capped at 5,000 available analysed garments. Each slot considers at most 30 deterministic candidates, the beam defaults to 120 candidates, and each grade returns a caller-controlled bounded result set. These limits prevent combinatorial explosion while preserving predictable output.
