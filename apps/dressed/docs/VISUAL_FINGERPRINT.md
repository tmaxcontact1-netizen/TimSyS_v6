# Visual fingerprint v1

Algorithm: `classical-pixels-1.0.0`. Schema: `1.0.0`.

The implementation uses Sharp/libvips for local deterministic decoding, orientation and bounded 256 × 256 sampling. It uses no neural model, generative model, cloud service or stochastic operation.

## Measurements

- RGB pixels are converted to CIE Lab using the sRGB D65 transform.
- Palette entries use deterministic 5-bit RGB quantisation, ordered by pixel count, with numerical RGB/Lab values and approximate human labels.
- Foreground coverage and aspect ratio compare pixels with the averaged corner background. This is a deliberately simple silhouette estimate.
- Luminance contrast is the normalised standard deviation of perceptual luminance.
- Edge density counts central-gradient magnitude above the versioned threshold; horizontal and vertical energies remain separate.
- Texture strength is the normalised mean difference between neighbouring luminance samples.
- Solid confidence decreases with edge density and palette complexity.

Visual complexity v1 is clamped to `[0,1]`:

`clamp(0.20 × paletteComplexity + 0.40 × edgeDensity × 4 + 0.15 × contrast + 0.15 × texture + 0.10 × nonDominantPaletteShare)`

Whole-item evidence has weight `0.65`; detail evidence has weight `0.35`. A two-image fingerprint receives baseline confidence `0.90`; a single-image provisional fingerprint receives `0.62`, further reduced when foreground separation is weak.

## Suggestions

Category suggestions use only foreground aspect ratio and therefore remain deliberately low confidence. Formality uses visual complexity and chroma. Season suggestions use lightness. They are workload-reduction hints, not facts. Material, brand, size, fit, condition and acquisition information are never inferred.

The review form records suggestions as accepted only when the saved value matches the proposed value. Edited alternatives are recorded as rejected while preserving the final human-entered garment record.
