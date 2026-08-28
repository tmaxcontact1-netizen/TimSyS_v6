# CV service contract v1

The TypeScript application submits a local file reference already resolved beneath the private storage root, its content hash, image role, requested operations, and algorithm version. The Python service returns measurements only; it cannot persist application state.

Responses include the contract version, analysis version, input identity/hash, processing time, quality findings, confidence, and an immutable measurement payload. Errors use stable codes and never claim successful analysis.

The transport is local HTTP with bounded JSON bodies, explicit timeout, exact content type, and no redirect following. Future binary transfer must be introduced through a new contract version.

