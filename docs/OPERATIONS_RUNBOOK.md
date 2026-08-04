# Runtime fact publication

Position observations intended for automatic fact publication use this exact immutable payload
envelope:

```json
{
  "schemaVersion": 1,
  "checkpointRevision": "12",
  "phase": "monitor",
  "facts": { "stepId": "monitor-12" }
}
```

`phase` is `monitor` or `reconcile`. Producers may publish partial `facts` objects. The publisher
orders evidence by observation time and evidence ID, merges only fragments bound to the current
checkpoint revision and phase, and lets later observations supersede earlier fields. Contradictory
values at the same observation time stop publication. The final complete object must satisfy the
existing monitoring or reconciliation fact schema.

Publication runs after the position job lease is acquired and before the worker reads its fact
snapshot. Snapshot identity is derived from position, revision, phase, and canonical aggregate
content. Exact retries are idempotent. Missing evidence, future evidence, incomplete schemas,
conflicting publications, and observation windows above the configured hard limit fail closed.
