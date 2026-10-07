-- A reversible presentation layer. Original research records remain immutable.
CREATE TABLE researched.workbench_projects (
 id uuid PRIMARY KEY, tool text NOT NULL CHECK(tool IN ('content','mcf')),
 title text NOT NULL, state jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
 head uuid NOT NULL, redo jsonb NOT NULL DEFAULT '[]', deleted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE researched.workbench_revisions (
 id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES researched.workbench_projects(id),
 previous_id uuid REFERENCES researched.workbench_revisions(id), title text NOT NULL,
 state jsonb NOT NULL, label text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON researched.workbench_revisions
 FOR EACH ROW EXECUTE FUNCTION researched.mcf_immutable();
