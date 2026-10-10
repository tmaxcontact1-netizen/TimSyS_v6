# Card-free intake prototype

One JPEG or PNG is sufficient. Upload stores the original bytes unchanged. Detection reads an oriented sRGB working image and uses background separation, or the user's in-app rectangle. It offers approximate colour families and conservative appearance suggestions. Category is a shape-based suggestion requiring review; formality, use, season and texture remain manual judgements. This is not general-purpose garment recognition or calibrated fabric measurement.

Detection failure keeps the review usable and recommends a clearer photograph, a tighter selection or manual entry. All presented fields are editable and unknown values are allowed. Saving creates an atomic review and current fingerprint, preserves unrelated garment metadata, and checks the garment version and source-photo snapshot. Reanalysis does not replace confirmed choices. Replacing a source photograph retains history and requires confirmation before new outfit generation.

Reviewed colour families use representative sRGB values internally, not measured fabric colours or certified colour-chart matches. Precise colour-contrast, pattern-scale and tie/pocket-square duplication penalties are disabled for these reviews. Unknown-dependent rules are suppressed and garment-specific uncertainty is carried into recommendations. The interface labels the resulting ranking approximate.

Migration 0010 permits images without calibration profiles and adds analysis/review history. Existing original photographs and legacy profiles are retained. The old unreviewed fingerprint-generation endpoint directs clients to intake review.

## Verification

Build and run the existing Vitest suite. Then run `node scripts/verify-card-free.mjs` from this app with `DRESSED_VERIFY_POSTGRES_BIN` set to the launcher's PostgreSQL distribution. It starts an isolated temporary cluster and exercises real migrations, HTTP upload, unchanged source bytes, detection, cropping, manual fallback, review persistence, concurrency/stale-source rejection, replacement history, outfit generation/save and restart persistence. It records build hashes and observed results in `verification.json` under the printed temporary directory. `DRESSED_VERIFY_APP_ROOT` can target an extracted release runtime; `DRESSED_VERIFY_ROOT` selects the evidence directory. Never point this test at a live cluster.

Synthetic image fixtures establish pipeline wiring and guardrails, not accuracy across fabrics, lighting and phone cameras. A representative real wardrobe photo set remains needed to evaluate detection quality.
