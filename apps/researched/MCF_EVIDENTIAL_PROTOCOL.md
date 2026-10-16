# MCF evidential protocol 2 / semantic run protocol 3

MCF v1.0 is unchanged. New run configuration freezes evidential instructions and the approved context unit IDs. The existing JSONB code schema is extended; no SQL data rewrite is required. The compatibility key `evidenceStrength` is retained in stored codes, with `evidenceProtocol: 2` distinguishing its new evidential-basis meaning. It is not a confidence score.

Explicit: target alone is sufficient. Contextual: target plus cited same-review material is sufficient. Both count equally. Successful assessments retain the complement of the 21 supported competencies as `noApplicationCompetencyIds`; unresolved work never implies No application.

Confirm that each record is one individual review before new analysis. Confirmed structural mappings already establish boundaries. Generic imports require an explicit session-level researcher confirmation. Institution metadata does not define boundaries. Context uses all approved units in the frozen segmentation of the same record; excluded coding units are not silently reintroduced. Blind samples can access approved population context, without other researcher decisions or machine proposals.

Requests contain at most six targets, plus the permitted same-review context. Reviews over 200,000 characters remain unresolved with an explicit error; context is never silently truncated. Existing finite retry/timeout policy remains unchanged. Model classification is not guaranteed correct; the software enforces scope, citations and retention.

Context references retain unit IDs, exact quotations, review ID, segmentation set ID and UTF-16 offsets. Run/output links retain provider, model, attempt and run provenance. Manual decisions retain actor, timestamp and append-only revision provenance.

Historical Explicit/Implicit codes retain their original labels and protocol. They are excluded from new-protocol percentages and counted separately. Resuming an old run retains its original protocol; it does not upgrade earlier results. Reassessment requires a new analysis, never automatic relabelling.

Counts are competency applications at target evidence locations, not independent observations or institution/domain scores. Total supported = Explicit + Contextual. Percentages use this total; empty denominators are N/A. All 21 competencies remain separate.
