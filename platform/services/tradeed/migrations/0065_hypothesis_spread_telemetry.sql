BEGIN;

CREATE TABLE paper_candidate_quote_paths (
  id bigserial PRIMARY KEY,
  epoch_id bigint NOT NULL REFERENCES paper_validation_epochs(id),
  wallet text NOT NULL,
  token_mint text NOT NULL,
  observed_at timestamptz NOT NULL,
  input_amount_raw numeric(78,0) NOT NULL,
  token_amount_raw numeric(78,0) NOT NULL,
  exit_amount_raw numeric(78,0) NOT NULL,
  spread_bps integer NOT NULL CHECK(spread_bps>=0),
  buy_quote_fingerprint text NOT NULL,
  exit_quote_fingerprint text NOT NULL,
  liquidity_usd numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(wallet,token_mint,observed_at,buy_quote_fingerprint)
);

CREATE INDEX paper_candidate_quote_paths_token_idx
  ON paper_candidate_quote_paths(wallet,token_mint,observed_at DESC);
CREATE INDEX paper_candidate_quote_paths_epoch_idx
  ON paper_candidate_quote_paths(epoch_id,observed_at DESC);

-- This calibration evidence intentionally survives epoch resets. It is bounded
-- to the newest 128 executable round trips per wallet/token by the writer and
-- remains attributable to its source epoch for offline replay.

SELECT reset_paper_validation_epoch(
  '2026.09.28.15',
  'hypothesis-geometry-spread-v1',
  'Pre-registered 250/600 and 250/300 geometry with USD 100k liquidity and measured median-spread admission'
);

COMMIT;
