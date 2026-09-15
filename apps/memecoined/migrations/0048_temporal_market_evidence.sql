BEGIN;

ALTER TABLE paper_fast_market_observations
  ADD COLUMN market_price_usd numeric,
  ADD COLUMN liquidity_usd numeric,
  ADD COLUMN five_minute_volume_usd numeric,
  ADD COLUMN five_minute_buys bigint,
  ADD COLUMN five_minute_sells bigint,
  ADD COLUMN five_minute_price_change numeric,
  ADD COLUMN one_hour_price_change numeric,
  ADD COLUMN market_evidence_json jsonb;

ALTER TABLE paper_fast_market_observations
  ADD CONSTRAINT paper_fast_market_nonnegative_market_values CHECK (
    (market_price_usd IS NULL OR market_price_usd >= 0) AND
    (liquidity_usd IS NULL OR liquidity_usd >= 0) AND
    (five_minute_volume_usd IS NULL OR five_minute_volume_usd >= 0) AND
    (five_minute_buys IS NULL OR five_minute_buys >= 0) AND
    (five_minute_sells IS NULL OR five_minute_sells >= 0)
  );

COMMIT;
