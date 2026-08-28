# Foundation test strategy

- **Unit:** pure types, state transitions, configuration, redaction, bounded transports, and health aggregation.
- **Contract:** TypeScript/Python CV request and response fixtures validate against the same versioned JSON shape.
- **Integration:** PostgreSQL migrations, transactions, durable leases, restart recovery, and private image storage.
- **Replay:** identical facts, versions, configuration, and clock produce identical fingerprints, scores, recommendations, and plans.
- **End to end:** launcher supervision, garment creation, two-image association, analysis, recommendation, planning, wear, and reconciliation.

Every phase adds deterministic fixtures with declared tolerances. Full type checking and the complete normal suite are required at each phase gate.

