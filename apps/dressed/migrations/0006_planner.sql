BEGIN;

CREATE TABLE dressed.rotation_policies (
  policy_id uuid PRIMARY KEY,
  name text NOT NULL,
  complete_outfit_days integer NOT NULL CHECK (complete_outfit_days >= 0),
  garment_days jsonb NOT NULL,
  maximum_consecutive_jacket_days integer NOT NULL CHECK (maximum_consecutive_jacket_days >= 0),
  allow_grade_c boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX rotation_policies_one_default_idx ON dressed.rotation_policies(is_default) WHERE is_default;

CREATE TABLE dressed.outfit_plans (
  plan_id uuid PRIMARY KEY,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  context_id uuid NOT NULL REFERENCES dressed.outfit_contexts(context_id),
  policy_id uuid NOT NULL REFERENCES dressed.rotation_policies(policy_id),
  weekdays smallint[] NOT NULL CHECK (cardinality(weekdays) > 0),
  fixed_garment_ids uuid[] NOT NULL DEFAULT '{}',
  excluded_garment_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL
);

CREATE TABLE dressed.planned_outfits (
  planned_outfit_id uuid PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES dressed.outfit_plans(plan_id),
  planned_date date NOT NULL,
  saved_outfit_id uuid NOT NULL REFERENCES dressed.saved_outfits(outfit_id),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','skipped','replaced')),
  rotation_score numeric(8,3) NOT NULL,
  rotation_explanation jsonb NOT NULL,
  replaced_by_id uuid REFERENCES dressed.planned_outfits(planned_outfit_id),
  notes text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE(plan_id,planned_date)
);

CREATE INDEX planned_outfits_date_idx ON dressed.planned_outfits(planned_date,status);
CREATE INDEX planned_outfits_saved_idx ON dressed.planned_outfits(saved_outfit_id,planned_date DESC);

INSERT INTO dressed.rotation_policies(policy_id,name,complete_outfit_days,garment_days,maximum_consecutive_jacket_days,allow_grade_c,is_default,created_at,updated_at)
VALUES('30000000-0000-4000-8000-000000000001','Balanced rotation',30,'{"top":5,"bottom":3,"footwear":2,"jacket":2,"neckwear":10,"pocket_square":10,"default":3}',2,false,true,now(),now());

COMMIT;
