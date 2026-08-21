# Assessment Evidence component contract

Assessment Evidence owns assessment definitions, category classification, many-to-many mappings to learning standards, and immutable student attempts. It stores neutral raw evidence and never decides a final grade or mastery result.

Recorded values reference the exact active Assessment Scale version used. Missing, incomplete, exempt, absent, late, not-assessed, and invalid remain first-class evidence states and are never silently discarded or automatically converted to zero. Corrections create a superseding attempt with a reason and assessor attribution; original evidence remains auditable.
