# MemeCoined’Ed operations runbook

This runbook covers the supervised desktop paper deployment and the common controls applicable to later modes. It does not authorize live execution. Promotion authority is defined exclusively in `PROMOTION_GATES.md`.

## Pre-start checks

1. Identify the intended mode and build commit. If either is unknown, do not start.
2. Confirm the system clock is synchronized and the host has sufficient disk space.
3. Confirm primary and fallback RPC endpoints belong to independent providers.
4. Run `npm run verify:providers` and retain the sanitized JSON report. Confirm both providers are healthy, on the configured cluster and within the permitted slot difference.
5. Confirm the configuration file is outside the application installation directory and is not readable by unapproved users.
6. In paper mode, confirm all signer and transaction-allowlist variables are absent.
7. Confirm the most recent database backup exists. Before live eligibility, confirm a restoration rehearsal has succeeded.
8. Confirm there are no unresolved critical/high incidents or unexplained reconciliation alerts.

## Desktop paper startup

For a bounded diagnostic without altering the installed database, run `node scripts/run-memecoined-paper-trial.cjs 90` from the repository root. The runner creates a temporary database, applies every migration, proves provider agreement, supervises the paper worker/dashboard, records sanitized pipeline samples, then stops and removes temporary credentials and data. A completed runner report is evidence only and does not authorize promotion.

1. Open TimSyS Launcher and select MemeCoined’Ed.
2. If configuration is required, edit only the generated application-data `.env`; never edit the packaged template.
3. Restart MemeCoined’Ed from the launcher.
4. The launcher starts its private PostgreSQL service, runs migrations with the migration role, grants runtime privileges, then starts the worker and dashboard.
5. Confirm the dashboard health endpoint returns HTTP 200 and displays paper mode.
6. Confirm both child processes are running and the launcher is not reporting `degraded`.
7. Confirm recent observations use the expected wallet, cluster and providers before accepting the run.

Do not repeatedly restart a failed application without reading the first failure. Configuration and migration failures are fail-closed and repeated attempts can obscure the initiating incident.

## Normal shutdown

Use the launcher stop or exit control. It sends `SIGTERM`, allows ten seconds for graceful shutdown, backs up the managed PostgreSQL database and then stops the local database. Confirm child processes have stopped before shutting down the host.

Never terminate PostgreSQL first while workers are running. If the launcher cannot stop a child, record diagnostics before forcing termination.

## Immediate safe stop

Initiate a safe stop on any of the following:

- mode shown by the application differs from the intended mode;
- signer or live-execution configuration appears in paper mode;
- unexplained wallet, inventory or accounting difference;
- primary/fallback disagreement reaches decision authority;
- stale or incomplete facts reach an entry proposal;
- duplicate job, candidate, position or transaction submission;
- repeated dashboard health failure or worker crash;
- credential or signer exposure;
- transaction inspection, simulation and submitted bytes disagree.

Response:

1. Block new entries and stop the supervised application.
2. For a live-mode incident, preserve position monitoring if it can run without increasing authority; otherwise use the approved emergency workflow.
3. Do not delete, edit or “repair” durable facts manually.
4. Export diagnostics and logs, record UTC time/build/mode and protect database evidence.
5. Rotate exposed credentials and isolate an affected wallet or host.
6. Reconcile provider, chain, wallet, order, inventory and accounting facts before restart.
7. Downgrade to the last safe mode and apply the relevant promotion gate again.

## Health and degraded operation

The dashboard health endpoint proves that its local HTTP surface and database connection are responsive; it does not prove provider, strategy or wallet correctness. The launcher marks the application degraded after three consecutive dashboard health failures and returns it to running after health recovers. Provider and worker alerts must be reviewed independently.

Missing or stale authority blocks positive decisions. Degraded data collection must never be reclassified as a successful observation, fill or reconciliation.

## Backup and recovery

The desktop launcher creates PostgreSQL custom-format backups and retains the seven newest files. A backup is not considered proven until it has restored into an isolated database and passed migration/readiness and accounting checks.

Recovery procedure:

1. Stop MemeCoined’Ed and preserve the failed database directory and logs.
2. Select a backup created before the suspected corruption or failed change.
3. Restore into an isolated PostgreSQL database; never overwrite the only copy first.
4. Run schema readiness checks and compare migration state.
5. Reconcile positions, inventory, transactions and accounting against authoritative chain/provider evidence.
6. Start in the preceding non-executing mode and observe before promotion.
7. Record the restoration test, selected backup, validation results and operator.

Database restoration cannot reverse an on-chain transaction. Live reconciliation always treats confirmed chain state as authoritative.

## Upgrade and rollback

Before upgrade, record the current commit/version, stop cleanly and take a verified backup. Install the new build, allow migrations to complete, and start in the same or safer mode. Do not combine a software upgrade with promotion to a more authoritative mode.

Application rollback is permitted only when its schema compatibility is known. If migrations are not backward compatible, retain the newer application or restore the matching pre-upgrade database into an isolated environment. Never manually down-edit migration history.

## Incident record

Record: incident ID, UTC detection time, build, mode, deployment/database/wallet identifiers, detector, symptoms, immutable evidence references, entry blocking time, containment, reconciliation result, root cause, corrective action and promotion impact. Do not include secrets or private keys.

## Runtime fact publication

Position observations intended for automatic fact publication use this exact immutable payload
envelope:

```json
{
  "schemaVersion": 1,
  "checkpointRevision": "12",
  "phase": "monitor",
  "facts": { "stepId": "monitor-12" }
}
```

`phase` is `monitor` or `reconcile`. Producers may publish partial `facts` objects. The publisher
orders evidence by observation time and evidence ID, merges only fragments bound to the current
checkpoint revision and phase, and lets later observations supersede earlier fields. Contradictory
values at the same observation time stop publication. The final complete object must satisfy the
existing monitoring or reconciliation fact schema.

Publication runs after the position job lease is acquired and before the worker reads its fact
snapshot. Snapshot identity is derived from position, revision, phase, and canonical aggregate
content. Exact retries are idempotent. Missing evidence, future evidence, incomplete schemas,
conflicting publications, and observation windows above the configured hard limit fail closed.

## Operator handoff checklist

- Intended mode and build recorded
- Configuration and secret location known
- Backup present; last restoration rehearsal known
- Worker, dashboard and database status reviewed
- Provider identities and current degradation reviewed
- Open positions/jobs and unresolved alerts reviewed
- Emergency stop owner identified
- No unresolved critical/high incident
- Next operator accepts the handoff and UTC time is recorded
