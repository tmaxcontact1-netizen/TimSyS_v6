# Dress’Ed 2026.11.14.3

Home actions open dedicated task pages. Wardrobe garment names open read-only details with photographs and Edit, Duplicate, Archive and Delete actions; saving an edit closes the editor. Garment names offer photo previews in outfit and planner views.

Saved outfits support named collections, renaming, multiple collection membership and saving directly into a collection. Editing an outfit preserves its collection membership. Removing a collection leaves its outfits intact. Calendar and week-by-week planning remain available.

Builder exclusions are grouped by garment type, collapsed initially, with Select all used and individual overrides. The fixed-garment dropdown retains category ordering and hides each selected category until its garment is removed. Its controls are aligned; hover photos remain on selected garment names.

Validation: frontend and backend builds; 13 API, migration and saved-outfit regression tests; two packaging dependency tests; 19 isolated database acceptance checks; live transactional checks with all 65 wardrobe garments. Temporary live writes were rolled back. Native UI checks confirmed category removal and restoration. No retired outfits were restored.

Packaging adds the new immutable collection migration to both supported migration directories and overlays only Dress’Ed backend files on the published platform baseline. Existing migration bytes and unrelated platform files are preserved. Publishing does not install or restart apps.
