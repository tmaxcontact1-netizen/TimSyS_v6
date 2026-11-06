-- Execution metadata only. No historical outputs or analysis configuration are rewritten.
ALTER TABLE researched.mcf_semantic_tasks ADD COLUMN inherited_attempts integer NOT NULL DEFAULT 0 CHECK(inherited_attempts>=0);
ALTER TABLE researched.mcf_semantic_tasks ADD COLUMN parent_attempt_id uuid;
ALTER TABLE researched.mcf_semantic_attempts ADD COLUMN target_unit_ids jsonb;
