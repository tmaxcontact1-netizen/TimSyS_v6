# Dress'Ed relational schema

## Phase 2 catalogue

- `garment_categories` is a configurable adjacency-list hierarchy. Stable slugs and UUIDs permit new categories without a migration.
- `garments` owns identity, descriptive clothing properties, acquisition data, lifecycle status and an optimistic concurrency version.
- `garment_materials`, `garment_seasons` and `garment_restrictions` preserve multi-valued properties relationally.
- `garment_status_history` is append-only evidence for catalogue lifecycle changes. Archiving never deletes garment history.

The initial menswear taxonomy is seed data, not an enum or UI assumption. Only active leaf categories are offered by the Phase 2 garment form, while the category API permits additional top-level groups and children.

Money is stored as integer minor units with an ISO-style three-character currency. Dates without a time-of-day use PostgreSQL `date`; audit instants use `timestamptz`. Garment edits require the caller's current version, so two open editors cannot silently overwrite one another.

Fingerprint, outfit, planning, wear and care records are introduced by their later sections below.

## Phase 3 photography

- `calibration_profiles` and `calibration_patches` preserve user-defined reference-card identities and numerical CIE Lab values.
- `garment_images` stores immutable evidence identity, role, relative private path, SHA-256 hash, dimensions, calibration association and validation state.
- `image_quality_findings` records every deterministic acceptance or recapture reason.
- `image_derivatives` reserves separately hashed/versioned corrected images, thumbnails and masks. It never overwrites an original and is populated only once the corresponding calibration/CV algorithm exists.

Only one accepted current whole image and one accepted current detail image exist per garment. A replacement supersedes the prior record without deleting it. Failed validation is retained with `recapture_required` and its findings, but cannot satisfy the readiness gate.

## Phase 4 visual fingerprints

- `visual_fingerprints` is append-only, links the exact source image IDs, stores schema and algorithm versions, and has one current version per garment.
- `garment_field_suggestions` retains each proposed field value, confidence, measurement evidence and human decision state.

Reanalysis supersedes rather than mutates the prior fingerprint. Suggested values never update `garments` directly; the user reviews them through the normal version-safe garment form.

## Phase 5 styling rules

- `styling_rule_sets` and `styling_rules` preserve versioned thresholds, rule type, domain, order and numerical parameters.
- `outfit_contexts` defines configurable formality bounds independently of the scoring engine.
- `styling_evaluations` records score, grade, eligibility, rule-set version and context.
- `styling_evaluation_items` pins the exact garment and fingerprint versions used.
- `styling_rule_outcomes` preserves every hard/soft result, delta, explanation code, rendered explanation, affected garments and measurements.

Historical evaluations are immutable. A future rule-set version creates new evaluations rather than changing previous explanations or scores.

## Phase 6 ensemble engine

- `outfit_slots`, `category_slot_assignments` and `context_slot_requirements` make outfit composition configurable rather than hard-coded in the generator.
- `saved_outfits` and `saved_outfit_items` preserve an accepted combination, its evaluation snapshot and the exact garments and roles involved.
- `combination_overrides` stores explicit exact-outfit or relationship-level bans and favourites.

Generation only considers available garments with current fingerprints and a configured slot. Saved calculated grades are never replaced by user grades; both values remain available for audit and future refinement.

## Phase 7 planner

- `rotation_policies` centralises complete-outfit and slot-specific repetition intervals plus grade-C policy.
- `outfit_plans` stores the requested date boundary, weekdays, context, fixed garments, excluded garments and policy version.
- `planned_outfits` stores each deterministic assignment and its rotation explanation independently from future wear history.

Planning does not imply wear. Entries can be skipped or moved; lifecycle confirmation creates an immutable wear event only after explicit user action.

## Phase 8 lifecycle

- `wear_events` and `wear_event_items` preserve each confirmed use and its exact garments. Counts and cost-per-wear are derived, never incremented counters.
- `garment_care_cases` records cleaning, repairs, alterations and stains with severity, cost, provider, dates and resolution.
- Blocking open care cases set the garment unavailable. Resolution restores availability only when no other blocker remains.

Original purchase data stays on the garment record. Care expenditure remains separately reconstructable rather than being silently folded into purchase price.

## Phase 9 insights and refinement

- `user_preferences` stores validated advanced-display and insight thresholds without embedding them in the interface.
- Insights are derived from catalogue, saved-outfit, wear-event and care evidence; no opaque recommendation records are created.
- Additional partial and relationship indexes keep available-garment, versatility and overdue-care queries bounded as history grows.

Manual saved-outfit grades remain alongside calculated grades. They never overwrite the original deterministic evaluation.
