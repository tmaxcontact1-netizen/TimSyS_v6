# Photography workflow

The Phase 3 workflow is:

1. photograph a physical matte reference card and store its measured master patch values;
2. select a garment and image role (`whole`, `detail`, or `additional`);
3. upload a JPEG or PNG; Dress'Ed must locate and measure the card automatically;
4. store the original bytes once beneath the private storage root;
5. calculate SHA-256, structural format, dimensions and deterministic quality findings;
6. retain failed evidence as `recapture_required` rather than skipping it;
7. consider the garment ready for analysis only when accepted current whole and detail photographs both exist.

The quality gate checks format structure, empty or excessive input, plausible dimensions, minimum 800 × 800 resolution, extreme aspect ratio, card geometry and patch glare. A checkbox is not accepted as evidence that the card is present. The preferred card contains black, red, green, blue, cyan, magenta, yellow and neutral grey patches in one evenly spaced row. Legacy RGB cards remain supported at lower confidence.

Garment photographs are corrected against the stored master card. Eight-patch evidence fits an affine colour-correction matrix; three-patch evidence uses a bounded channel-gain fallback. The detected patch strip is excluded from garment palette measurement. The original image is never overwritten.

Original bytes are immutable and retrievable by image ID. Replacements create another record and supersede the previous accepted role. Corrected images and other derivatives have separate identities, hashes, paths and algorithm versions; no process may overwrite the original.
