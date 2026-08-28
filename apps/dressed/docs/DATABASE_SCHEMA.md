# Dress'Ed relational schema

## Phase 2 catalogue

- `garment_categories` is a configurable adjacency-list hierarchy. Stable slugs and UUIDs permit new categories without a migration.
- `garments` owns identity, descriptive clothing properties, acquisition data, lifecycle status and an optimistic concurrency version.
- `garment_materials`, `garment_seasons` and `garment_restrictions` preserve multi-valued properties relationally.
- `garment_status_history` is append-only evidence for catalogue lifecycle changes. Archiving never deletes garment history.

The initial menswear taxonomy is seed data, not an enum or UI assumption. Only active leaf categories are offered by the Phase 2 garment form, while the category API permits additional top-level groups and children.

Money is stored as integer minor units with an ISO-style three-character currency. Dates without a time-of-day use PostgreSQL `date`; audit instants use `timestamptz`. Garment edits require the caller's current version, so two open editors cannot silently overwrite one another.

Fingerprint, outfit, wear, care and planning records remain absent until their owning phases define their invariants.

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
