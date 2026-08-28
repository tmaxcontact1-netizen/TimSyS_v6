# MemeCoined’Ed promotion gates

These gates are operational controls, not suggestions. Promotion changes what the application is allowed to do and must never occur merely because tests pass or a configuration value exists.

## Universal rules

1. Promotion is one mode at a time: `historical → observation → shadow → paper → supervised_live → limited_auto → full_auto`.
2. A named human operator records the decision, UTC timestamp, build commit, configuration fingerprint, evidence links and approved limits.
3. The system recommends; a human promotes. No worker, dashboard, installer or recovery path may promote itself.
4. Any stop condition immediately blocks new entries. Open-position safety and reconciliation continue where technically possible.
5. A downgrade requires no promotion approval. Returning upward requires the failed gate to be repeated.
6. Secrets, private keys and raw credentials are never promotion evidence.
7. `full_auto` remains prohibited until a later, explicit governance revision defines and approves its gate.

## Required evidence record

Every promotion record must contain:

- source and target mode;
- exact Git commit and packaged version;
- environment and database identifiers;
- start and end of the evidence window;
- automated test and build results;
- provider identities and independence confirmation;
- incidents, unresolved alerts and reconciliation discrepancies;
- approved wallet, per-transaction, daily-loss and fee limits where applicable;
- operator and independent reviewer sign-off;
- rollback mode and rollback owner.

## Gate 0 — build eligibility

Required before any live-data mode:

- strict typecheck, complete normal test suite and production build pass;
- dependency lockfile is unchanged after installation and has no unresolved high/critical audit finding;
- database migrations apply to a clean database and an upgrade fixture;
- logs and diagnostics contain no credentials;
- shutdown, restart and duplicate-instance controls pass;
- application starts in the configured mode and reports that mode honestly.

Failure returns the build to development. It is not eligible for environmental testing.

## Historical → observation

Required:

- primary and independent fallback RPC endpoints are configured;
- live credentials are environment-specific and rotation has been tested;
- provider contract probes establish schema, rate-limit, timeout and stale-data behaviour;
- signing and submission configuration is absent;
- live observations are attributable, timestamped and bounded for freshness;
- provider disagreement blocks positive authority.

Stop conditions: missing provenance, clock drift outside the approved tolerance, provider identity ambiguity, repeated unbounded retries or any transaction-signing capability.

Rollback: `historical`.

## Observation → shadow

Required:

- sustained observation window completes without unexplained gaps;
- primary loss, fallback operation and reconciliation after recovery are demonstrated;
- live candidate discovery is scheduled, idempotent and restart-safe;
- decisions are deterministic from the stored evidence;
- quote, security, wallet and portfolio evidence all enforce freshness;
- the shadow path cannot reach a signer or submission adapter.

Stop conditions: duplicated candidates, decisions based on stale/incomplete facts, disagreement between replay and live decision, or unexplained provider divergence.

Rollback: `observation`.

## Shadow → paper

Required:

- sustained shadow run completes with no unresolved critical alerts;
- paper initial capital and observational wallet are explicitly recorded;
- simulated fills use executable quotes and declared fee/slippage assumptions;
- accounting, inventory and realised performance reconcile after restart;
- cancellation, requested close, emergency exit and circuit-breaker paths pass;
- dashboard controls remain paper-only and require exact confirmation;
- no signer or transaction-submission policy is present.

Stop conditions: negative or duplicated inventory, unexplained accounting variance, non-idempotent recovery, stale quote acceptance or dashboard access to live authority.

Rollback: `shadow`.

## Paper → supervised live

Required:

- an extended paper evidence window and incident review are accepted by operator and reviewer;
- encrypted database backup and a restoration rehearsal have succeeded;
- a dedicated disposable low-value wallet is used and contains only the approved trial balance;
- signer file ownership and permissions are verified (`0600` or stricter on the approved production host);
- exact program, fee-recipient and destination-owner allowlists are independently reviewed;
- maximum transaction value, maximum priority fee, maximum daily loss and maximum concurrent positions are hard bounded;
- transaction construction, decoding, simulation and independent inspection agree before signing;
- every entry requires explicit human confirmation;
- Telegram or equivalent authenticated emergency communication is operational;
- the manually gated low-value E2E procedure has been reviewed but not yet executed;
- the operator is present for the entire trial and can stop the process and revoke the wallet.

Stop conditions: any unexplained transaction byte, allowlist miss, simulation disagreement, signer exposure, reconciliation lag, provider disagreement or loss of operator communication.

Rollback: stop new entries, reconcile any submitted transaction, close only through the approved emergency workflow, then return to `paper`.

## Supervised live → limited auto

Required:

- multiple separately approved supervised trials reconcile exactly;
- no unresolved security, accounting or operational incident remains;
- automated limits are stricter than or equal to supervised limits;
- manual kill switch and automatic circuit breakers have been exercised;
- alert delivery and operator response targets have been demonstrated;
- an independent review approves removal of per-entry confirmation.

Stop conditions: any reconciliation discrepancy, limit breach, missed critical alert, recovery ambiguity or emergency-exit failure.

Rollback: `supervised_live` when safe; otherwise `paper`.

## Limited auto → full auto

**Prohibited.** The current project has no approved gate for unattended full authority. Adding one requires a versioned governance change, threat-model review and explicit operator authorization.

## Incident severity and response

| Severity | Example                                                                                   | Immediate response                                     | Promotion effect                                |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Critical | signer exposure, unauthorised transaction, unexplained balance change                     | stop processes, isolate wallet/host, preserve evidence | revoke current live eligibility                 |
| High     | reconciliation mismatch, circuit-breaker failure, provider disagreement used as authority | block entries, reconcile, downgrade                    | repeat current and preceding gate               |
| Medium   | sustained stale data, failed fallback, repeated worker error                              | block affected workflow, repair and replay             | extend evidence window                          |
| Low      | display defect with correct durable authority                                             | record and repair                                      | operator decides whether evidence remains valid |

Incident records are append-only and include detection, containment, facts, impact, resolution and prevention. Promotion may not proceed with an unresolved critical or high incident.
