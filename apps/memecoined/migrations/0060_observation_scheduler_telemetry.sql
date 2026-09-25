BEGIN;

ALTER TABLE paper_validation_epochs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','diagnostic','completed','quarantined')),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS findings_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE paper_validation_epochs
  ADD COLUMN IF NOT EXISTS config_hash text CHECK(config_hash IS NULL OR config_hash ~ '^[0-9a-f]{64}$');

UPDATE paper_validation_epochs
   SET status='diagnostic',
       ended_at=COALESCE(ended_at,'2026-09-25T18:45:00+03:00'::timestamptz),
       findings_json=jsonb_build_array(
         'Observation cadence was coupled to an unbounded sequential supervisor pass',
         'Qualified watches could starve before reaching the five-evaluation pin threshold',
         'Oscillation Trader coverage was unreachable under the scheduler capacity allocation'
       )
 WHERE release_version='2026.09.25.7';

CREATE OR REPLACE FUNCTION current_paper_validation_epoch_id() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM paper_validation_epochs WHERE status='active' ORDER BY id DESC LIMIT 1
$$;

CREATE TABLE paper_observation_cycles (
  id uuid PRIMARY KEY,
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  scheduled_at timestamptz NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  scheduler_lag_ms integer NOT NULL CHECK (scheduler_lag_ms>=0),
  status text NOT NULL CHECK (status IN ('running','completed','partial','overrun','failed','skipped')),
  dense_capacity integer NOT NULL CHECK (dense_capacity>=0),
  rotating_capacity integer NOT NULL CHECK (rotating_capacity>=0),
  candidates_available integer NOT NULL CHECK (candidates_available>=0),
  slots_selected integer NOT NULL CHECK (slots_selected>=0),
  slots_empty integer NOT NULL CHECK (slots_empty>=0),
  attempts_enqueued integer NOT NULL DEFAULT 0 CHECK (attempts_enqueued>=0),
  attempts_completed integer NOT NULL DEFAULT 0 CHECK (attempts_completed>=0),
  observations_persisted integer NOT NULL DEFAULT 0 CHECK (observations_persisted>=0),
  overlap_detected boolean NOT NULL DEFAULT false,
  engine_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(epoch_id,scheduled_at),
  CHECK (slots_selected+slots_empty=dense_capacity+rotating_capacity)
);

CREATE TABLE paper_observation_attempts (
  id uuid PRIMARY KEY,
  cycle_id uuid NOT NULL REFERENCES paper_observation_cycles(id),
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  wallet text NOT NULL,
  token_mint text NOT NULL,
  cohort text NOT NULL CHECK (cohort IN ('ot_probe','watch','rotating')),
  slot_index integer NOT NULL CHECK (slot_index>=0),
  selection_reason text NOT NULL,
  selected_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  queue_delay_ms integer CHECK (queue_delay_ms>=0),
  total_latency_ms integer CHECK (total_latency_ms>=0),
  outcome text NOT NULL CHECK (outcome IN ('queued','running','success','quote_failed','market_failed','both_failed','deadline_expired','cancelled')),
  observation_recorded boolean NOT NULL DEFAULT false,
  observation_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 1),
  engine_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cycle_id,cohort,slot_index),
  UNIQUE(cycle_id,token_mint),
  CHECK (outcome<>'success' OR observation_recorded),
  CHECK (NOT observation_recorded OR observation_at IS NOT NULL)
);

CREATE TABLE paper_observation_provider_calls (
  id uuid PRIMARY KEY,
  observation_attempt_id uuid NOT NULL REFERENCES paper_observation_attempts(id),
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  provider text NOT NULL,
  operation text NOT NULL,
  try_number integer NOT NULL CHECK (try_number BETWEEN 1 AND 2),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  latency_ms integer NOT NULL CHECK (latency_ms>=0),
  outcome text NOT NULL CHECK (outcome IN ('success','timeout','rate_limited','http_4xx','http_5xx','transport_error','validation_error')),
  http_status integer CHECK (http_status BETWEEN 100 AND 599),
  error_code text,
  retryable boolean NOT NULL,
  retry_scheduled boolean NOT NULL DEFAULT false,
  retry_delay_ms integer CHECK (retry_delay_ms>=0),
  response_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(observation_attempt_id,provider,operation,try_number)
);

CREATE TABLE paper_profile_evaluation_watermarks (
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  wallet text NOT NULL,
  profile_id text NOT NULL,
  token_mint text NOT NULL,
  last_observation_at timestamptz NOT NULL,
  last_observation_fingerprint text NOT NULL,
  last_evaluated_at timestamptz NOT NULL,
  evaluation_result text NOT NULL CHECK (evaluation_result IN ('qualified','failed_market','insufficient')),
  engine_version text NOT NULL,
  PRIMARY KEY(epoch_id,wallet,profile_id,token_mint)
);

CREATE TABLE paper_observation_probe_assignments (
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  wallet text NOT NULL,
  token_mint text NOT NULL,
  channel text NOT NULL CHECK(channel IN ('fairness','responsive')),
  assigned_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  sparse_volatility_score numeric,
  PRIMARY KEY(epoch_id,wallet,token_mint),
  CHECK(expires_at>assigned_at)
);

CREATE INDEX paper_observation_cycles_epoch_schedule_idx
  ON paper_observation_cycles(epoch_id,scheduled_at);
CREATE INDEX paper_observation_attempts_epoch_cohort_idx
  ON paper_observation_attempts(epoch_id,cohort,selected_at);
CREATE INDEX paper_observation_attempts_outcome_idx
  ON paper_observation_attempts(epoch_id,outcome,completed_at);
CREATE INDEX paper_observation_provider_calls_outcome_idx
  ON paper_observation_provider_calls(epoch_id,provider,outcome,started_at);

ALTER TABLE paper_observation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_observation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_observation_provider_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_profile_evaluation_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_observation_probe_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY paper_observation_cycles_current_epoch ON paper_observation_cycles
  USING(epoch_id=current_paper_validation_epoch_id())
  WITH CHECK(epoch_id=current_paper_validation_epoch_id());
CREATE POLICY paper_observation_attempts_current_epoch ON paper_observation_attempts
  USING(epoch_id=current_paper_validation_epoch_id())
  WITH CHECK(epoch_id=current_paper_validation_epoch_id());
CREATE POLICY paper_observation_provider_calls_current_epoch ON paper_observation_provider_calls
  USING(epoch_id=current_paper_validation_epoch_id())
  WITH CHECK(epoch_id=current_paper_validation_epoch_id());
CREATE POLICY paper_profile_evaluation_watermarks_current_epoch ON paper_profile_evaluation_watermarks
  USING(epoch_id=current_paper_validation_epoch_id())
  WITH CHECK(epoch_id=current_paper_validation_epoch_id());
CREATE POLICY paper_observation_probe_assignments_current_epoch ON paper_observation_probe_assignments
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
    paper_profile_positions,paper_profile_post_exit_observations,
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

SELECT reset_paper_validation_epoch(
  '2026.09.25.8','independent-observation-v1',
  'Fresh frozen epoch for independently scheduled, fully instrumented paper observations'
);

REVOKE ALL ON FUNCTION reset_paper_validation_epoch(text,text,text) FROM PUBLIC;

COMMIT;
