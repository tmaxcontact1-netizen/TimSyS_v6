BEGIN;

-- Results produced before the cold-start scheduler correction are not valid
-- evaluation evidence. Keep operator profile choices, but remove every prior
-- profile account, observation, signal, position, fill and derived outcome.
TRUNCATE TABLE paper_profile_accounts CASCADE;
TRUNCATE TABLE paper_fast_market_observations CASCADE;
TRUNCATE TABLE paper_fast_signal_events CASCADE;
TRUNCATE TABLE paper_profile_regime_watches CASCADE;

CREATE TABLE paper_validation_epochs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  release_version text NOT NULL,
  protocol_version text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL,
  UNIQUE (release_version, protocol_version)
);

INSERT INTO paper_validation_epochs (release_version,protocol_version,reason)
VALUES ('2026.09.25.6','cold-start-v1',
        'Clean paper baseline after pre-qualification observation scheduler correction');

COMMIT;
