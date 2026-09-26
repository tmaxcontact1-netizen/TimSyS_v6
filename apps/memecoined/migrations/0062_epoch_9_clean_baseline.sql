BEGIN;

SELECT reset_paper_validation_epoch(
  '2026.09.26.9','unified-supervision-v1',
  'Fresh epoch after unified launcher supervision, bounded telemetry retention and exit telemetry correction'
);

COMMIT;
