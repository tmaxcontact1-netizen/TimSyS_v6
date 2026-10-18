-- Additive diagnostics; historical attempts and populations are not rewritten.
ALTER TABLE researched.mcf_semantic_attempts ADD COLUMN failure_category text;
ALTER TABLE researched.mcf_semantic_attempts ADD COLUMN diagnostics jsonb;
