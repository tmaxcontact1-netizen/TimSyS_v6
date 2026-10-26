# Dress'Ed

Dress'Ed is the TimSyS-hosted, domain-isolated wardrobe management and deterministic outfit-coordination application.

Version 0.3.0 adds multiple fixed garments in the outfit builder, category selection and garment dependencies, numerical coordination scores with separate confidence, more varied accessory recommendations, saved outfit management, and duplicate garments with independent wear histories. It includes a rotatable mannequin with garment/accessory styles, smoother shoulders and optional skin colour. Personal-colouring warnings are shown alongside coordination scores; they do not change the score or ranking. Photo estimates remain provisional and confirmed garment details take priority.

Portraits are processed in the browser. The profile stores selected summary values, optional mannequin colour and garment feedback, not the portrait. Grey remains the default mannequin colour. New migrations 0011 and 0012 add visual styles/accessory categories and saved-outfit retirement without changing earlier migrations.

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
