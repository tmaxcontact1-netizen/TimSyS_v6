BEGIN;

CREATE TABLE tradeed_segment_controls (
  segment_id text PRIMARY KEY CHECK (segment_id IN ('memecoined','cryptoed')),
  enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO tradeed_segment_controls(segment_id,enabled) VALUES ('memecoined',false),('cryptoed',false)
ON CONFLICT(segment_id) DO NOTHING;

CREATE TABLE exchange_candles (
  venue text NOT NULL,
  venue_symbol text NOT NULL,
  interval text NOT NULL CHECK(interval IN ('1m','5m','15m','1h','4h')),
  open_time timestamptz NOT NULL,
  close_time timestamptz NOT NULL,
  event_time timestamptz NOT NULL,
  received_at timestamptz NOT NULL,
  open numeric NOT NULL, high numeric NOT NULL, low numeric NOT NULL, close numeric NOT NULL,
  base_volume numeric NOT NULL, quote_volume numeric NOT NULL,
  trade_count integer NOT NULL CHECK(trade_count>=0),
  is_closed boolean NOT NULL,
  source text NOT NULL CHECK(source IN ('websocket','rest_backfill')),
  continuity_segment uuid NOT NULL,
  fingerprint text NOT NULL,
  PRIMARY KEY(venue,venue_symbol,interval,open_time)
);
CREATE INDEX exchange_candles_series_idx ON exchange_candles(venue,venue_symbol,interval,open_time DESC);

CREATE TABLE exchange_top_of_book (
  venue text NOT NULL, venue_symbol text NOT NULL, event_time timestamptz NOT NULL, received_at timestamptz NOT NULL,
  bid_price numeric NOT NULL, bid_quantity numeric NOT NULL, ask_price numeric NOT NULL, ask_quantity numeric NOT NULL,
  continuity_segment uuid NOT NULL, fingerprint text NOT NULL,
  PRIMARY KEY(venue,venue_symbol,event_time,fingerprint)
);
CREATE INDEX exchange_top_of_book_latest_idx ON exchange_top_of_book(venue,venue_symbol,event_time DESC);

CREATE TABLE exchange_ticker_24h (
  venue text NOT NULL, venue_symbol text NOT NULL, event_time timestamptz NOT NULL, received_at timestamptz NOT NULL,
  high numeric NOT NULL, low numeric NOT NULL, base_volume numeric NOT NULL, quote_volume numeric NOT NULL,
  continuity_segment uuid NOT NULL, fingerprint text NOT NULL,
  PRIMARY KEY(venue,venue_symbol,event_time)
);

CREATE TABLE exchange_session_levels (
  id uuid PRIMARY KEY, epoch_id bigint REFERENCES paper_validation_epochs(id), venue text NOT NULL, venue_symbol text NOT NULL,
  civil_date date NOT NULL, time_zone text NOT NULL CHECK(time_zone='America/New_York'),
  level_type text NOT NULL, window_start timestamptz NOT NULL, window_end timestamptz NOT NULL,
  status text NOT NULL CHECK(status IN ('building','locked','incomplete','superseded')),
  high numeric, low numeric, level_price numeric, contributing_candles integer NOT NULL DEFAULT 0,
  calculation_fingerprint text NOT NULL, version integer NOT NULL DEFAULT 1, last_verified_at timestamptz NOT NULL,
  UNIQUE(venue,venue_symbol,civil_date,level_type,version)
);

CREATE TABLE exchange_stream_events (
  id uuid PRIMARY KEY, venue text NOT NULL, venue_symbol text, event_type text NOT NULL,
  occurred_at timestamptz NOT NULL, continuity_segment uuid NOT NULL,
  latency_ms integer, http_status integer, retry_after_ms integer,
  detail_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX exchange_stream_events_timeline_idx ON exchange_stream_events(venue,occurred_at DESC);

CREATE VIEW market_observations_read_model AS
SELECT 'solana'::text AS venue, token_mint AS instrument, observed_at,
       market_price_usd::numeric AS market_price, five_minute_volume_usd::numeric AS volume,
       'swap_quote'::text AS observation_type, market_evidence_json AS evidence
FROM paper_fast_market_observations
UNION ALL
SELECT venue,venue_symbol,received_at,close,quote_volume,
       ('candle_'||interval)::text,
       jsonb_build_object('open_time',open_time,'close_time',close_time,'open',open,'high',high,'low',low,'closed',is_closed,'source',source,'continuity_segment',continuity_segment)
FROM exchange_candles;

COMMIT;
