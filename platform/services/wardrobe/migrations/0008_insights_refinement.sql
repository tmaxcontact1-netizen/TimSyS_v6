BEGIN;

CREATE TABLE dressed.user_preferences (
  preference_key text PRIMARY KEY,
  preference_value jsonb NOT NULL,
  updated_at timestamptz NOT NULL
);

INSERT INTO dressed.user_preferences(preference_key,preference_value,updated_at) VALUES
('show_internal_scores','true',now()),
('underused_days','90',now()),
('low_versatility_outfit_count','2',now());

CREATE INDEX garments_available_category_idx ON dressed.garments(category_id,garment_id) WHERE lifecycle_status='available';
CREATE INDEX saved_outfit_items_garment_idx ON dressed.saved_outfit_items(garment_id,outfit_id);
CREATE INDEX care_cases_due_idx ON dressed.garment_care_cases(due_date) WHERE status='open';

COMMIT;
