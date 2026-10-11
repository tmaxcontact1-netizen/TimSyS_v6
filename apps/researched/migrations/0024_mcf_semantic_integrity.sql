-- Additive only: historical runs, results, sessions and population definitions stay untouched.
CREATE TABLE researched.mcf_semantic_tasks (
 task_id uuid PRIMARY KEY REFERENCES researched.mcf_ai_tasks(id),
 cycle integer NOT NULL DEFAULT 1,
 next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_semantic_attempts (
 id uuid PRIMARY KEY,
 task_id uuid NOT NULL REFERENCES researched.mcf_ai_tasks(id),
 cycle integer NOT NULL,
 attempt integer NOT NULL,
 started_at timestamptz NOT NULL,
 finished_at timestamptz,
 duration_ms integer,
 outcome text NOT NULL CHECK(outcome IN ('running','semantic_success','semantic_failed','semantic_interrupted')),
 error text,
 UNIQUE(task_id,cycle,attempt)
);
CREATE TABLE researched.mcf_deterministic_candidates (
 run_id uuid NOT NULL REFERENCES researched.mcf_ai_runs(id),
 unit_id uuid NOT NULL REFERENCES researched.mcf_units(id),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(run_id,unit_id)
);
CREATE TRIGGER mcf_candidates_immutable BEFORE UPDATE OR DELETE ON researched.mcf_deterministic_candidates FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable();
CREATE TABLE researched.mcf_report_snapshots (
 session_id uuid PRIMARY KEY REFERENCES researched.mcf_sessions(id),
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER mcf_report_snapshot_immutable BEFORE UPDATE OR DELETE ON researched.mcf_report_snapshots FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable();
CREATE FUNCTION researched.mcf_attempt_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' AND current_setting('researched.workbench_delete',true)='yes' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.finished_at IS NULL THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'mcf_append_only';
END;
$$;
CREATE TRIGGER mcf_attempt_history BEFORE UPDATE OR DELETE ON researched.mcf_semantic_attempts FOR EACH ROW EXECUTE FUNCTION researched.mcf_attempt_history();
