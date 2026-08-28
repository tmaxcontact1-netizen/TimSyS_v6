# Photography workflow

The Phase 3 workflow is:

1. define a physical reference card using its published CIE Lab patch values;
2. select a garment and image role (`whole`, `detail`, or `additional`);
3. upload a JPEG or PNG while confirming that the card is fully visible;
4. store the original bytes once beneath the private storage root;
5. calculate SHA-256, structural format, dimensions and deterministic quality findings;
6. retain failed evidence as `recapture_required` rather than skipping it;
7. consider the garment ready for analysis only when accepted current whole and detail photographs both exist.

The initial quality gate checks format structure, empty or excessive input, plausible dimensions, minimum 800 × 800 resolution, extreme aspect ratio and user-confirmed card visibility. It does not claim to detect shadows, highlights, card occlusion, perspective, garment coverage, colour cast, or exposure yet. Those measurements require the local conventional-CV implementation and must never be fabricated from metadata.

Original bytes are immutable and retrievable by image ID. Replacements create another record and supersede the previous accepted role. Corrected images and other derivatives have separate identities, hashes, paths and algorithm versions; no process may overwrite the original.
