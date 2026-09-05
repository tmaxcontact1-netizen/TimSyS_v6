BEGIN;

ALTER TABLE dressed.planned_outfits DROP CONSTRAINT planned_outfits_status_check;
ALTER TABLE dressed.planned_outfits ADD CONSTRAINT planned_outfits_status_check CHECK(status IN ('planned','skipped','replaced','worn'));

CREATE TABLE dressed.garment_care_cases (
  care_case_id uuid PRIMARY KEY,
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  case_type text NOT NULL CHECK(case_type IN ('cleaning','repair','alteration','stain')),
  severity text NOT NULL CHECK(severity IN ('minor','moderate','severe')),
  title text NOT NULL,
  details text,
  provider text,
  opened_date date NOT NULL,
  due_date date,
  resolved_date date,
  cost_minor bigint CHECK(cost_minor >= 0),
  currency char(3) CHECK(currency ~ '^[A-Z]{3}$'),
  blocks_availability boolean NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','cancelled')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK(due_date IS NULL OR due_date >= opened_date),
  CHECK((status='resolved')=(resolved_date IS NOT NULL))
);

CREATE INDEX garment_care_open_idx ON dressed.garment_care_cases(garment_id,status);

CREATE TABLE dressed.wear_events (
  wear_event_id uuid PRIMARY KEY,
  worn_date date NOT NULL,
  saved_outfit_id uuid REFERENCES dressed.saved_outfits(outfit_id),
  planned_outfit_id uuid UNIQUE REFERENCES dressed.planned_outfits(planned_outfit_id),
  context_id uuid REFERENCES dressed.outfit_contexts(context_id),
  notes text,
  created_at timestamptz NOT NULL
);

CREATE TABLE dressed.wear_event_items (
  wear_event_id uuid NOT NULL REFERENCES dressed.wear_events(wear_event_id),
  garment_id uuid NOT NULL REFERENCES dressed.garments(garment_id),
  slot_id text REFERENCES dressed.outfit_slots(slot_id),
  PRIMARY KEY(wear_event_id,garment_id)
);

CREATE INDEX wear_event_items_garment_idx ON dressed.wear_event_items(garment_id,wear_event_id);
CREATE INDEX wear_events_date_idx ON dressed.wear_events(worn_date DESC);

COMMIT;
