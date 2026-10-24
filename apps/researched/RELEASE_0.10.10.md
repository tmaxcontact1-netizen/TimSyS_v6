# Research’Ed 0.10.10 — AI ambiguity assessment

New MCF analyses explicitly assess ambiguity for every target passage, including zero-code results. Flagged ambiguity and plausible alternative competencies require exact same-review citations and an explanation. Alternatives never become supported findings or definitive No-application decisions.

Analysis UI filters and JSON/HTML/PDF reports expose ambiguity coverage, flagged passages, alternatives and provenance. Blind validation reveals the AI assessment only after initial coding is locked. Human judgements remain separate.

MCF v1.0 and historical results are unchanged. Resuming an older run retains its original protocol; historical missing assessments display as not assessed. No migration, Director rerun, shared AI integration change or Trade’Ed change.

Verification: 356 regression tests, TypeScript and production build, synthetic database/browser/export checks and existing semantic integrity/concurrency checks. No live model calls. Research’Ed-only update; other published bundles retained unchanged.
