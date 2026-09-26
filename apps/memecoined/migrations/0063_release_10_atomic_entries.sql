BEGIN;

ALTER TABLE paper_observation_provider_calls
  ADD COLUMN IF NOT EXISTS error_detail text;

CREATE TABLE IF NOT EXISTS paper_validation_trade_archive (
  archive_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  classification text NOT NULL CHECK(classification IN ('clean','environment_interrupted')),
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  entered_at timestamptz,
  exited_at timestamptz,
  lifecycle_state text NOT NULL,
  exit_reason text,
  outcome_json jsonb NOT NULL,
  fills_json jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Complete the audit identity of the position whose economic entry committed
-- immediately before the epoch .9 worker termination.
UPDATE paper_profile_signal_outcomes o
   SET lifecycle_state='entered',entry_fill_id=f.id,entered_at=f.filled_at,
       entry_input_raw=f.settlement_amount_raw,entry_output_raw=f.token_amount_raw,
       planned_loss_bps=o.planned_stop_bps,updated_at=clock_timestamp()
  FROM paper_profile_fills f
 WHERE o.epoch_id=4 AND f.epoch_id=4 AND o.profile_id='oscillation_trader'
   AND o.token_mint='CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU'
   AND f.profile_id=o.profile_id AND f.token_mint=o.token_mint AND f.side='buy'
   AND o.lifecycle_state='observed';

INSERT INTO paper_validation_trade_archive
  (source_epoch_id,classification,profile_id,token_mint,entered_at,exited_at,
   lifecycle_state,exit_reason,outcome_json,fills_json)
SELECT o.epoch_id,
       CASE WHEN o.token_mint='CbcyNo7m1amFWqEQm2m4PLv1UNvpcL3C1Ujm6AkzpKoU'
             AND o.profile_id='oscillation_trader' AND o.exited_at IS NULL
            THEN 'environment_interrupted' ELSE 'clean' END,
       o.profile_id,o.token_mint,o.entered_at,o.exited_at,o.lifecycle_state,o.exit_reason,
       to_jsonb(o),
       COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.filled_at)
                   FROM paper_profile_fills f
                  WHERE f.epoch_id=o.epoch_id AND f.profile_id=o.profile_id
                    AND f.token_mint=o.token_mint
                    AND (f.id=o.entry_fill_id OR f.id=o.exit_fill_id)),'[]'::jsonb)
  FROM paper_profile_signal_outcomes o
 WHERE o.epoch_id=4 AND (o.entered_at IS NOT NULL OR o.exited_at IS NOT NULL);

UPDATE paper_validation_epochs
   SET status='diagnostic',ended_at=clock_timestamp(),
       findings_json=findings_json || jsonb_build_array(
         'Entry-consumer concurrency collision committed one position and then terminated the worker',
         'Entry bookkeeping could be interrupted between economic commit and signal-outcome attribution',
         'CbcyNo…kzpKoU remained open across the outage and is archived as environment_interrupted'
       )
 WHERE id=4 AND release_version='2026.09.26.9';

SELECT reset_paper_validation_epoch(
  '2026.09.26.10','atomic-entry-v1',
  'Fresh frozen epoch after single-owner entry dispatch, atomic bookkeeping and dense-watch fairness'
);

CREATE TABLE paper_profile_position_quote_paths (
  id uuid PRIMARY KEY,
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  wallet text NOT NULL,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  observed_at timestamptz NOT NULL,
  value_raw numeric NOT NULL CHECK(value_raw>=0),
  return_bps numeric NOT NULL,
  high_water_raw numeric NOT NULL CHECK(high_water_raw>=0),
  exit_trigger text,
  quote_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(epoch_id,wallet,profile_id,token_mint,observed_at)
);
CREATE INDEX paper_profile_position_quote_paths_lookup_idx
  ON paper_profile_position_quote_paths(epoch_id,wallet,profile_id,token_mint,observed_at);
ALTER TABLE paper_profile_position_quote_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY paper_profile_position_quote_paths_current_epoch ON paper_profile_position_quote_paths
  USING(epoch_id=current_paper_validation_epoch_id())
  WITH CHECK(epoch_id=current_paper_validation_epoch_id());

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
    paper_profile_candidate_decisions,paper_profile_entry_intents,paper_profile_fills,
    paper_profile_positions,paper_profile_post_exit_observations,paper_profile_position_quote_paths,
    paper_profile_regime_watches,paper_profile_signal_outcomes,paper_profile_signals,
    paper_realized_performance,paper_observation_cycles,paper_observation_attempts,
    paper_observation_provider_calls,paper_profile_evaluation_watermarks,
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
