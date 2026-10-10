# Deterministic fallback — Research'Ed 0.8.1

AI is optional. The normal MCF workbench starts without a connection and completes locally if the connected provider fails. Content analysis likewise retains deterministic topic passages when requested AI is unavailable.

MCF local analysis uses the separately versioned `analysis-config/mcf-deterministic/1.0.json`, covering all 21 competency IDs. It retrieves candidate passages using explicit phrase/pattern rules and preserves original text, match offsets, rule IDs, configuration hashes and run provenance. The frozen MCF instrument is unchanged. These candidate rules are software retrieval aids, not a validated extension of the instrument.

Local candidates have no automatic competency codes, valence, Explicit/Implicit judgement or representation scores. Negation and contextual meaning are not inferred. A missing match is not absence of a competency. The UI and HTML export display candidate matches separately from AI findings and human decisions. Confirmation does not convert either type of automated result into human coding.

After an AI failure, that batch and subsequent batches use local rules. The switch is recorded in immutable output, so it survives worker restart. At most the two already in-flight requests can reach the provider before the switch is observed. Earlier successful AI findings remain intact and distinguishable. Local batches are drained quickly without waiting one second per pair. Cancellation, source lineage and blind-validation restrictions still apply.

The normal workbench opts into fallback. Specialist callers explicitly asking for AI-only classification retain their strict failure behavior. An explicit **Local rules only (no AI)** method sends no model requests even if a connection exists. Existing failed work offers **Continue with local analysis**, creating a new run and preserving the previous failed attempt without another upload.

Verification covers no configured provider, HTTP 429, circuit breaking, exact match offsets, reproducibility, excluded generic terms, retained negation, no invented human decisions, saved reports, export labels and recovery of existing failed work. Synthetic providers test software behavior, not classification accuracy. No database migration or provider subscription is required.
