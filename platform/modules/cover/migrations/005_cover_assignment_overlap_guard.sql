CREATE TRIGGER IF NOT EXISTS trg_cover_assignment_no_overlap
BEFORE INSERT ON cover_assignments
WHEN NEW.status = 'active'
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM cover_assignments existing
    JOIN cover_demands existing_demand
      ON existing_demand.id = existing.cover_demand_id
     AND existing_demand.app_id = existing.app_id
    JOIN cover_demands new_demand
      ON new_demand.id = NEW.cover_demand_id
     AND new_demand.app_id = NEW.app_id
    WHERE existing.app_id = NEW.app_id
      AND existing.status = 'active'
      AND existing.candidate_ref = NEW.candidate_ref
      AND existing_demand.starts_at < new_demand.ends_at
      AND existing_demand.ends_at > new_demand.starts_at
  ) THEN RAISE(ABORT, 'OVERLAPPING_COVER_ASSIGNMENT') END;
END;
