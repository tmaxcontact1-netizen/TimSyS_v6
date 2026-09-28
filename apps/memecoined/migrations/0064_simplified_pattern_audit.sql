BEGIN;

CREATE TABLE paper_profile_admission_audit (
  id uuid PRIMARY KEY,
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  wallet text NOT NULL,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  observed_at timestamptz NOT NULL,
  eligible boolean NOT NULL,
  rule text NOT NULL,
  entry_price numeric NOT NULL,
  reference_price numeric NOT NULL,
  rsi numeric NOT NULL,
  z_score numeric NOT NULL,
  buy_pressure numeric,
  liquidity_usd numeric NOT NULL,
  sma_crossings integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(epoch_id,wallet,profile_id,token_mint,observed_at)
);

CREATE INDEX paper_profile_admission_audit_lookup_idx
  ON paper_profile_admission_audit(epoch_id,profile_id,observed_at);

ALTER TABLE paper_profile_admission_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY paper_profile_admission_audit_current_epoch ON paper_profile_admission_audit
  USING(epoch_id=current_paper_validation_epoch_id())
  WITH CHECK(epoch_id=current_paper_validation_epoch_id());

CREATE TABLE paper_untradable_mints (
  token_mint text PRIMARY KEY,
  first_rejected_at timestamptz NOT NULL,
  last_rejected_at timestamptz NOT NULL,
  rejection_count integer NOT NULL CHECK(rejection_count>=3),
  reason text NOT NULL
);

CREATE OR REPLACE FUNCTION reset_paper_validation_epoch(
  requested_release text, requested_protocol text, requested_reason text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE created_epoch bigint;
BEGIN
  TRUNCATE TABLE
    paper_cash_events,paper_entry_executions,paper_exit_evaluations,
    paper_fast_market_observations,paper_fast_signal_events,paper_fills,
    paper_lot_disposals,paper_operator_control_audit,paper_position_close_requests,
    paper_position_lots,paper_position_work,paper_profile_accounts,
    paper_profile_admission_audit,paper_profile_candidate_decisions,paper_profile_entry_intents,
    paper_profile_fills,paper_profile_positions,paper_profile_post_exit_observations,
    paper_profile_position_quote_paths,paper_profile_regime_watches,paper_profile_signal_outcomes,
    paper_profile_signals,paper_realized_performance,paper_observation_cycles,
    paper_observation_attempts,paper_observation_provider_calls,paper_profile_evaluation_watermarks,
    paper_observation_probe_assignments
  CASCADE;
  UPDATE paper_validation_epochs SET status='completed',ended_at=COALESCE(ended_at,clock_timestamp())
   WHERE status='active';
  INSERT INTO paper_validation_epochs(release_version,protocol_version,reason,status)
  VALUES(requested_release,requested_protocol,requested_reason,'active') RETURNING id INTO created_epoch;
  RETURN created_epoch;
END
$$;
REVOKE ALL ON FUNCTION reset_paper_validation_epoch(text,text,text) FROM PUBLIC;

COMMIT;
