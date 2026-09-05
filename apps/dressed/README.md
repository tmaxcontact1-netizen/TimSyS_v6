# Dress'Ed

Dress'Ed is the TimSyS-hosted, domain-isolated wardrobe management and deterministic outfit-coordination application.

Phase 9 is complete: Dress'Ed now provides the full local deterministic workflow from garment intake and measurable image analysis through explainable outfit generation, calendar rotation, explicit wear confirmation, garment care, cost-per-wear, wardrobe insights, and user-controlled refinement.

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
