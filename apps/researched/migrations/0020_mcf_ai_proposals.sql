-- Machine proposals are distinct from the frozen instrument and researcher decisions.
CREATE TABLE researched.mcf_ai_runs (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES researched.mcf_sessions(id),
 kind text NOT NULL CHECK(kind IN ('classification','interpretation')),
 status text NOT NULL CHECK(status IN ('queued','running','completed','partial','failed','cancelled')),
 configuration jsonb NOT NULL, actor text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE UNIQUE INDEX mcf_ai_one_active ON researched.mcf_ai_runs(session_id) WHERE status IN ('queued','running');
CREATE TABLE researched.mcf_ai_tasks (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES researched.mcf_ai_runs(id), ordinal integer NOT NULL,
 unit_ids jsonb NOT NULL, status text NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
 error text, UNIQUE(run_id,ordinal)
);
CREATE TABLE researched.mcf_ai_outputs (
 id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES researched.mcf_ai_runs(id), task_id uuid NOT NULL UNIQUE REFERENCES researched.mcf_ai_tasks(id),
 payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.mcf_ai_proposals (
 id uuid PRIMARY KEY, output_id uuid NOT NULL REFERENCES researched.mcf_ai_outputs(id),
 session_id uuid NOT NULL, unit_id uuid NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(session_id,unit_id) REFERENCES researched.mcf_session_units(session_id,unit_id), UNIQUE(output_id,unit_id)
);
CREATE TABLE researched.mcf_ai_reviews (
 id uuid PRIMARY KEY, proposal_id uuid NOT NULL REFERENCES researched.mcf_ai_proposals(id),
 decision_id uuid REFERENCES researched.mcf_decisions(id), outcome text NOT NULL CHECK(outcome IN ('accepted','modified','rejected')),
 actor text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX mcf_ai_proposal_session ON researched.mcf_ai_proposals(session_id,unit_id,created_at DESC);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON researched.mcf_ai_outputs FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON researched.mcf_ai_proposals FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable();
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON researched.mcf_ai_reviews FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable();
