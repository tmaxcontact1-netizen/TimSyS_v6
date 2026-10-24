# Research’Ed 0.10.8

Two concurrent MCF semantic batches, with independent lane refill and atomic database claims across competing workers. New runs and explicitly resumed older runs use operational policy 8; historical results remain unchanged.

No changes to MCF v1.0, batch composition, review context, evidence rules, model selection, prompts or retry limits. Valid in-flight results are retained if a peer pauses the run; partial status reflects that retained coverage. No schema migration or shared runtime change.

Verification: 340 regression tests across 40 files; TypeScript and production frontend build; disposable PostgreSQL concurrency checks with five competing workers, retry exhaustion/resume, frozen successful outputs, cancellation and authentication pause. No live corpus or external AI requests used. Research’Ed-only release; published non-Research’Ed bundle entries retained.
