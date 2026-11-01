# Research’Ed 0.9.7 — Independent batch retries

The run-wide consecutive-provider-failure breaker stopped a run after two 120-second request timeouts and a 180-second retry, despite untouched batches and a remaining third attempt. Operational policy 6 removes that breaker and the first-batch readiness gate for newly queued or explicitly resumed work.

Each batch independently receives up to three attempts, deadlines 120/180/210 seconds, retry delays 30/120 seconds. Ready batches continue during another batch's retry delay. A batch exhausting retries remains failed; completion stays partial/failed until every eligible unit has a successful semantic result. Authentication, provider configuration and integrity/retention failures still pause for intervention. No deterministic fallback becomes a semantic finding.

Explicit resume upgrades older scheduling policy without changing successful tasks, outputs, proposals or prior attempts. No automatic resume or data migration occurs. MCF v1.0, prompts, evidential definitions, valence and review boundaries are unchanged.

Verification: TypeScript/Vite build; 200 unit tests; 18 isolated database/browser/export checks. Fixtures exercise interleaved timeouts, all three deadlines per batch, exhausted 502 failures, invalid first-batch responses, authentication pause, unresolved-only resume from policy 5, byte-for-byte successful output retention, immutable reports and restart/cancel paths. Synthetic providers and disposable databases only; no real corpus requests.
