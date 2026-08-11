BEGIN;

CREATE TABLE portfolio_operational_safety_observations (
  id uuid PRIMARY KEY,
  wallet text NOT NULL CHECK (length(btrim(wallet)) > 0),
  observed_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  open_cost_exposure_sol numeric NOT NULL CHECK (open_cost_exposure_sol >= 0),
  liquidity_capacity_sol numeric NOT NULL CHECK (liquidity_capacity_sol >= 0),
  estimated_entry_costs_sol numeric NOT NULL CHECK (estimated_entry_costs_sol >= 0),
  open_position_count bigint NOT NULL CHECK (open_position_count >= 0),
  executable_unrealized_loss_sol numeric NOT NULL CHECK (executable_unrealized_loss_sol >= 0),
  reconciliation_failures_last_24_hours bigint NOT NULL CHECK (reconciliation_failures_last_24_hours >= 0),
  authoritative_disagreement_duration_ms bigint NOT NULL CHECK (authoritative_disagreement_duration_ms >= 0),
  uses_leverage_or_borrowing boolean NOT NULL,
  evidence_json jsonb NOT NULL CHECK (jsonb_array_length(evidence_json) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet, observed_at)
);

CREATE INDEX portfolio_operational_safety_time_idx
  ON portfolio_operational_safety_observations (wallet, observed_at DESC, id DESC);

CREATE FUNCTION reject_portfolio_operational_safety_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'portfolio operational safety observations are immutable';
END;
$$;

CREATE TRIGGER portfolio_operational_safety_append_only
BEFORE UPDATE OR DELETE ON portfolio_operational_safety_observations
FOR EACH ROW EXECUTE FUNCTION reject_portfolio_operational_safety_mutation();

COMMIT;
