BEGIN;

CREATE TABLE dressed.styling_rule_sets (
  rule_set_id uuid PRIMARY KEY,
  name text NOT NULL,
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','active','retired')),
  grade_a_threshold numeric(6,2) NOT NULL,
  grade_b_threshold numeric(6,2) NOT NULL,
  grade_c_threshold numeric(6,2) NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE(name,version),
  CHECK (grade_a_threshold > grade_b_threshold AND grade_b_threshold > grade_c_threshold)
);

CREATE UNIQUE INDEX styling_rule_sets_active_idx ON dressed.styling_rule_sets(status) WHERE status='active';

CREATE TABLE dressed.styling_rules (
  rule_id text NOT NULL,
  rule_set_id uuid NOT NULL REFERENCES dressed.styling_rule_sets(rule_set_id),
  domain text NOT NULL CHECK (domain IN ('availability','colour','pattern','texture','formality','season','ensemble')),
  rule_type text NOT NULL CHECK (rule_type IN ('hard','soft')),
  name text NOT NULL,
  parameters jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL,
  PRIMARY KEY(rule_set_id,rule_id)
);

CREATE TABLE dressed.outfit_contexts (
  context_id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  formality_min smallint NOT NULL CHECK (formality_min BETWEEN 1 AND 5),
  formality_max smallint NOT NULL CHECK (formality_max BETWEEN 1 AND 5),
  configuration jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CHECK (formality_min <= formality_max)
);

CREATE TABLE dressed.styling_evaluations (
  evaluation_id uuid PRIMARY KEY,
  rule_set_id uuid NOT NULL REFERENCES dressed.styling_rule_sets(rule_set_id),
  context_id uuid NOT NULL REFERENCES dressed.outfit_contexts(context_id),
  numerical_score numeric(7,3) NOT NULL,
  grade char(1) CHECK (grade IN ('A','B','C')),
  eligible boolean NOT NULL,
  requested_season text,
  created_at timestamptz NOT NULL
);

CREATE TABLE dressed.styling_evaluation_items (
  evaluation_id uuid NOT NULL REFERENCES dressed.styling_evaluations(evaluation_id),
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  fingerprint_id uuid NOT NULL REFERENCES dressed.visual_fingerprints(fingerprint_id),
  PRIMARY KEY(evaluation_id,garment_id)
);

CREATE TABLE dressed.styling_rule_outcomes (
  evaluation_id uuid NOT NULL REFERENCES dressed.styling_evaluations(evaluation_id),
  outcome_index integer NOT NULL,
  rule_id text NOT NULL,
  domain text NOT NULL,
  passed boolean NOT NULL,
  hard_failure boolean NOT NULL,
  score_delta numeric(7,3) NOT NULL,
  explanation_code text NOT NULL,
  explanation text NOT NULL,
  affected_garment_ids uuid[] NOT NULL,
  measurements jsonb NOT NULL,
  PRIMARY KEY(evaluation_id,outcome_index)
);

INSERT INTO dressed.styling_rule_sets(rule_set_id,name,version,status,grade_a_threshold,grade_b_threshold,grade_c_threshold,created_at)
VALUES('10000000-0000-4000-8000-000000000001','Dress''Ed menswear foundations','1.0.0','active',85,72,60,now());

INSERT INTO dressed.styling_rules(rule_set_id,rule_id,domain,rule_type,name,parameters,enabled,sort_order) VALUES
('10000000-0000-4000-8000-000000000001','availability.required','availability','hard','All garments must be available','{}',true,10),
('10000000-0000-4000-8000-000000000001','fingerprint.required','ensemble','hard','Every garment needs a current fingerprint','{}',true,20),
('10000000-0000-4000-8000-000000000001','context.formality','formality','hard','Garments must fit the context range','{"tolerance":1}',true,30),
('10000000-0000-4000-8000-000000000001','formality.coherence','formality','soft','Formality should remain coherent','{"reward":7,"penalty":-8,"maximumSpread":1}',true,40),
('10000000-0000-4000-8000-000000000001','colour.contrast','colour','soft','Dominant colours need controlled contrast','{"low":8,"idealLow":12,"idealHigh":55,"high":70,"reward":8,"matchingPenalty":-12,"clashPenalty":-5}',true,50),
('10000000-0000-4000-8000-000000000001','pattern.scale','pattern','soft','Multiple patterns need scale separation','{"minimumDensityDifference":0.04,"reward":6,"penalty":-10}',true,60),
('10000000-0000-4000-8000-000000000001','ensemble.complexity','ensemble','soft','Cumulative complexity must remain controlled','{"low":1.1,"high":1.6,"reward":4,"mediumPenalty":-6,"highPenalty":-12}',true,70),
('10000000-0000-4000-8000-000000000001','texture.balance','texture','soft','Texture should have useful separation','{"minimumDifference":0.08,"reward":4,"penalty":-3}',true,80),
('10000000-0000-4000-8000-000000000001','tie_square.duplication','ensemble','soft','Tie and pocket square should complement rather than duplicate','{"maximumDeltaE":10,"maximumPatternDifference":0.03,"penalty":-15}',true,90),
('10000000-0000-4000-8000-000000000001','season.suitability','season','soft','Garments should suit the requested season','{"penalty":-10,"reward":3}',true,100);

INSERT INTO dressed.outfit_contexts(context_id,slug,name,formality_min,formality_max,configuration) VALUES
('20000000-0000-4000-8000-000000000001','formal-business','Formal business',4,5,'{}'),
('20000000-0000-4000-8000-000000000002','business-casual','Business casual',3,4,'{}'),
('20000000-0000-4000-8000-000000000003','smart-casual','Smart casual',2,4,'{}'),
('20000000-0000-4000-8000-000000000004','casual','Casual',1,3,'{}'),
('20000000-0000-4000-8000-000000000005','evening','Evening',3,5,'{}'),
('20000000-0000-4000-8000-000000000006','formal-event','Formal event',4,5,'{}'),
('20000000-0000-4000-8000-000000000007','travel','Travel',1,4,'{}');

COMMIT;
