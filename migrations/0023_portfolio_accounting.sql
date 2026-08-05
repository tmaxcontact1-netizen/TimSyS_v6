BEGIN;

CREATE TABLE portfolio_accounting_checkpoints (
  id uuid PRIMARY KEY,
  observed_at timestamptz NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  equity_sol numeric NOT NULL CHECK (equity_sol >= 0),
  uncommitted_sol numeric NOT NULL CHECK (uncommitted_sol >= 0 AND uncommitted_sol <= equity_sol),
  open_cost_exposure_sol numeric NOT NULL CHECK (open_cost_exposure_sol >= 0),
  liquidity_capacity_sol numeric NOT NULL CHECK (liquidity_capacity_sol >= 0),
  estimated_entry_costs_sol numeric NOT NULL CHECK (estimated_entry_costs_sol >= 0),
  open_position_count bigint NOT NULL CHECK (open_position_count >= 0),
  cumulative_realized_pnl_sol numeric NOT NULL,
  executable_unrealized_loss_sol numeric NOT NULL CHECK (executable_unrealized_loss_sol >= 0),
  consecutive_closed_losing_trades bigint NOT NULL CHECK (consecutive_closed_losing_trades >= 0),
  reconciliation_failures_last_24_hours bigint NOT NULL CHECK (reconciliation_failures_last_24_hours >= 0),
  unauthorized_transaction_detected boolean NOT NULL,
  authoritative_disagreement_duration_ms bigint NOT NULL CHECK (authoritative_disagreement_duration_ms >= 0),
  uses_leverage_or_borrowing boolean NOT NULL,
  evidence_json jsonb NOT NULL CHECK (jsonb_array_length(evidence_json) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (observed_at, content_hash)
);

CREATE INDEX portfolio_accounting_checkpoints_time_idx
  ON portfolio_accounting_checkpoints (observed_at DESC, id DESC);

CREATE FUNCTION reject_portfolio_accounting_checkpoint_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'portfolio accounting checkpoints are immutable';
END;
$$;

CREATE TRIGGER portfolio_accounting_checkpoints_append_only
BEFORE UPDATE OR DELETE ON portfolio_accounting_checkpoints
FOR EACH ROW EXECUTE FUNCTION reject_portfolio_accounting_checkpoint_mutation();

COMMIT;
