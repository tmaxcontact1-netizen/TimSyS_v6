CREATE TABLE IF NOT EXISTS researched.analysis_templates(
 id uuid PRIMARY KEY,
 name text NOT NULL UNIQUE,
 description text,
 analysis_types jsonb NOT NULL,
 custom_questions jsonb NOT NULL DEFAULT '[]',
 expected_fields jsonb NOT NULL DEFAULT '[]',
 options jsonb NOT NULL DEFAULT '{}',
 created_by text NOT NULL,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS researched_analysis_template_name_idx ON researched.analysis_templates(lower(name));
