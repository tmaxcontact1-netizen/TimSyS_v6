# Architecture boundary

Dress'Ed is hosted and supervised by TimSyS but owns its wardrobe domain, PostgreSQL schema, private images, deterministic styling knowledge, and local CV processing.

The TypeScript application consumes structured visual fingerprints. It does not inspect raw images inside the styling or planning engines. The Python CV service processes locally stored images through a versioned contract and must not use generative AI, LLMs, vision-language models, recommendation models, or cloud AI services.

Detailed domain, entity, fingerprint, scoring, rule, planner, privacy, and testing specifications will be completed before feature implementation.

