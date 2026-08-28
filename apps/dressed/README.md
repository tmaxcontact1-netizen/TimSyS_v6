# Dress'Ed

Dress'Ed is the TimSyS-hosted, domain-isolated wardrobe management and deterministic outfit-coordination application.

Phase 4 is complete: the catalogue and immutable photography workflow now feed a versioned classical pixel-analysis pipeline. Dress'Ed measures palette/Lab colour, lightness, chroma, contrast, foreground shape, edge direction, texture, pattern density and visual complexity, then presents conservative category, formality and season suggestions for explicit review. Styling scores and planning remain outside this phase.

## Boundaries

- `src/domain`: pure wardrobe domain models and deterministic rules.
- `src/application`: use cases, contracts, and ports.
- `src/infrastructure`: PostgreSQL, local image storage, runtime, and adapter implementations.
- `src/entrypoints`: the Phase 1 API plus future worker-process composition.
- `frontend`: responsive Dress'Ed user interface.
- `cv_service`: local conventional-computer-vision service; no generative or cloud AI.
- `migrations`: Dress'Ed-owned PostgreSQL migrations.
- `tests`: unit, integration, contract, replay, and end-to-end verification.
- `docs`: architecture and reproducibility specifications.

## Active phase sequence

1. supervised application heartbeat and isolated runtime;
2. configurable wardrobe catalogue and garment records;
3. immutable two-photo workflow, calibration-card capture and image validation;
4. deterministic visual fingerprints;
5. styling rules and explanations;
6. ensemble generation and ranking;
7. planner and rotation;
8. garment lifecycle and wear history;
9. insights and refinement.
