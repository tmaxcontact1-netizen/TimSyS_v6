# Dress'Ed

Dress'Ed is the TimSyS-hosted, domain-isolated wardrobe management and deterministic outfit-coordination application.

Version 0.1.0 adds a functional card-free intake prototype: upload an original, select the garment in-app, inspect provisional detection, correct every presented field, and confirm before outfit generation. Originals and review history are retained. Colour families are approximate; unknown attributes and approximate ranking are visible in outfit suggestions. This release verifies intake through saved outfit generation, rather than claiming every existing planner and lifecycle feature has been validated.

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
3. immutable single-photo intake, optional detail photograph, in-app selection and validation;
4. provisional detection and explicit appearance review, with manual fallback;
5. styling rules and explanations;
6. ensemble generation and ranking;
7. planner and rotation;
8. garment lifecycle and wear history;
9. insights and refinement.
