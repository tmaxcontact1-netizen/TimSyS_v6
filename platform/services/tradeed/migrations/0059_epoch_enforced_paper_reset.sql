BEGIN;

CREATE OR REPLACE FUNCTION current_paper_validation_epoch_id() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM paper_validation_epochs ORDER BY id DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION reset_paper_validation_epoch(
  requested_release text, requested_protocol text, requested_reason text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE created_epoch bigint;
BEGIN
  -- Preserve only paper_accounts, paper_profile_activations,
  -- paper_profile_activation_audit, paper_validation_epochs and schema_migrations.
  -- Every table containing observations, decisions, orders, positions, fills,
  -- outcomes or derived performance is named explicitly here.
  TRUNCATE TABLE
    paper_cash_events,
    paper_entry_executions,
    paper_exit_evaluations,
    paper_fast_market_observations,
    paper_fast_signal_events,
    paper_fills,
    paper_lot_disposals,
    paper_operator_control_audit,
    paper_position_close_requests,
    paper_position_lots,
    paper_position_work,
    paper_profile_accounts,
    paper_profile_candidate_decisions,
    paper_profile_entry_intents,
    paper_profile_fills,
    paper_profile_positions,
    paper_profile_post_exit_observations,
    paper_profile_regime_watches,
    paper_profile_signal_outcomes,
    paper_profile_signals,
    paper_realized_performance
  CASCADE;

  INSERT INTO paper_validation_epochs (release_version,protocol_version,reason)
  VALUES (requested_release,requested_protocol,requested_reason)
  RETURNING id INTO created_epoch;
  RETURN created_epoch;
END
$$;

SELECT reset_paper_validation_epoch(
  '2026.09.25.7','epoch-enforced-v1',
  'Explicit allowlist reset and epoch isolation after partial reset diagnosis'
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'paper_cash_events','paper_entry_executions','paper_exit_evaluations',
    'paper_fast_market_observations','paper_fast_signal_events','paper_fills',
    'paper_lot_disposals','paper_operator_control_audit','paper_position_close_requests',
    'paper_position_lots','paper_position_work','paper_profile_accounts',
    'paper_profile_candidate_decisions','paper_profile_entry_intents','paper_profile_fills',
    'paper_profile_positions','paper_profile_post_exit_observations',
    'paper_profile_regime_watches','paper_profile_signal_outcomes','paper_profile_signals',
    'paper_realized_performance'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN epoch_id bigint NOT NULL DEFAULT current_paper_validation_epoch_id() REFERENCES paper_validation_epochs(id)',table_name);
    EXECUTE format('CREATE INDEX %I ON %I(epoch_id)',table_name||'_epoch_idx',table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('CREATE POLICY current_paper_epoch ON %I USING (epoch_id=current_paper_validation_epoch_id()) WITH CHECK (epoch_id=current_paper_validation_epoch_id())',table_name);
  END LOOP;
END
$$;

REVOKE ALL ON FUNCTION reset_paper_validation_epoch(text,text,text) FROM PUBLIC;

COMMIT;
