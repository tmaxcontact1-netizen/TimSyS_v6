# TimSyS Q35 validation service

Q35 is a TimSyS-owned independent service, not a process in the desktop launcher. The general Trade'Ed PostgreSQL worker is not a substitute for this sealed file-ledger observer. The service is discoverable in `platform/services/independent-services.json`; its versioned read-only contract is `contract.json`. `client.cjs` is for trusted native/backend consumers, not browser token distribution.

## Source and data compatibility

`runtime/` preserves the original October 20 recovery runtime byte-for-byte. `runtime-provenance.json` records the original and imported SHA-256 values. `.gitattributes` prevents line-ending normalization from breaking those seals. Model bytes are frozen and checked by the existing scientific runtime. No fitting, strategy, ledger schema, calendar, threshold, live database or Research'Ed code is changed by this integration.

The runtime uses Node >=24.18.0 <25 and pinned decimal.js 10.6.0 from the Trade'Ed backend dependencies. `prepare.cjs` copies the executable, science modules and dependencies into a separate sealed deployment; it does not execute a worker. Provide an absolute durable destination outside launcher bundles, temporary directories and backups. Data and logs must be separate from each other and the immutable deployment. Do not point a test at the original validation data.

## Supervision and recovery

- The task starts `service.cjs`, which starts the Q35 worker. It refuses launcher ancestry. An exclusive ledger-specific Windows named pipe plus a durable owner record prevent competing writers even if they request different API ports.
- Both actual worker PID and HTTP heartbeat identity are checked every 30 seconds by default (configuration rejects intervals above 60 seconds). Startup grace is bounded. `/health` returns 503 until a current successful heartbeat; `/status` exposes state through an authenticated loopback-only versioned API. No remote activation or restart API exists.
- First failure captures ledger/configuration files, process ancestry and available Windows System/Application events and flushes durable incident/alert logs. Evidence-capture errors block restart. A second consecutive failure within five minutes may restart only under an explicitly authorized restart policy. The service rechecks deployed bytes, authority and the atomic checkpoint/config identity before every start and records the restart gap.
- Default worker failure policy is `stop`; the review latch survives clean service shutdown and machine restart. No automatic retry can erase that latch. Default unclean recovery policy is `review`. A live deployment configured for `resume` additionally requires explicit recovery authorization. Synthetic fixtures may exercise both policies without collection authority.
- Unclean supervisor recovery secures evidence before spawning a replacement and records a gap. A still-live orphan worker or ambiguous PID identity blocks recovery rather than risking two writers. Completed validations require review, not automatic re-creation.
- The original Q35 continuation protocol preserves scientific config identity across permitted deployment-path changes. Existing collection approvals remain required. Sealed missed decisions, restart gaps and the original study calendar remain authoritative; no October 3 archived soak is concatenated.

## Prepare without activation

Run `node validation/prepare.cjs <options.json>` from the backend. Options include:

```json
{
  "destination": "C:/TimSyS/services/q35/releases/REVIEWED-RELEASE",
  "nodeExecutable": "C:/TimSyS/toolchains/node-v24.18.0/node.exe",
  "decimalDirectory": "C:/reviewed-build/modules-runtime/decimal.js",
  "jobFile": "C:/reviewed-continuation/job.json",
  "dataDirectory": "C:/TimSyS/data/q35/EXISTING-VALIDATED-LEDGER",
  "logDirectory": "C:/TimSyS/logs/q35/EXISTING-VALIDATION",
  "account": "TradeEdSvc",
  "port": 18860,
  "workerPort": 18861,
  "failurePolicy": "stop",
  "recoveryPolicy": "review"
}
```

These are illustrative paths, not authorization to copy or start the original ledger. The tool emits a disabled boot-task XML with password/batch logon, least privilege, IgnoreNew, unlimited execution time, StartWhenAvailable and bounded supervisor restart-on-failure. It never registers a task, creates an account, modifies permissions or writes an activation approval. All runtime/dependency bytes and inputs are sealed. Keep the deployment read-only for the service account; grant Modify only to the separate data/log directories and Read to the private configuration/token/approval files. Restrict those private files to the operator, SYSTEM and the dedicated service account. Administrator provisioning and an actual account-access check are required before enabling a production task.

A live start requires a separately supplied `activation-NOT-AUTHORIZED.json` at the configured activation-file path:

```json
{
  "kind": "TIMSYS_Q35_SERVICE_ACTIVATION",
  "approved": true,
  "configHash": "EXACT-REVIEWED-SERVICE-CONFIG-HASH",
  "restartAuthorized": false,
  "recoveryAuthorized": false
}
```

No approval file is included in the prepared deployment. `restartAuthorized` must be true for a live restart policy; `recoveryAuthorized` must be true for live unclean-resume policy. Neither replaces the scientific worker's collection approval or predecessor/model seals.

## Verification

`npm run test:validation` runs pure deployment gates plus isolated synthetic process/HTTP/restart tests, and is included in the backend's ordinary test command. A durable test-output path can be supplied using `Q35_TEST_ROOT`; `Q35_DECIMAL_ROOT` can select a previously installed pinned dependency without installing anything. Tests never use the live ledger. Runtime scientific byte parity and checkpoint corruption rejection are included.

For Windows task verification, prepare a fresh `fixture: true` deployment below `verification-local/q35-service-integration-*/fixtures/` using ephemeral ports, then run `scripts/verify-scheduled-task.ps1 -ConfigFile <fixture/private/service.json>`. It rejects public collection jobs and paths outside that fixture, creates a unique disposable current-user task with no automatic trigger, verifies independent ancestry and IgnoreNew, abruptly removes only fixture processes, dispatches the task again, verifies checkpoint/config identity and removes the task. This simulates loss of all Q35 processes at reboot; it does not reboot Windows or prove a boot trigger fired.

Production boot-trigger registration requires administrator rights. The dedicated batch account's permissions, password-based task registration and an actual boot-trigger/reboot test remain installation acceptance checks. Do not reboot a machine running Research'Ed for this test without separate coordination.

## Activation boundary

Before activation: reconcile the existing interruption/calendar, verify full backup and restore, rehearse the exact final continuation configuration against a copied ledger with synthetic IO, provision least-privilege access and independently review task XML/authority/hash. Preserve the original runtime/config/task for rollback. A candidate that has already written new ledger generations cannot be rolled back by overwriting it with an older checkpoint; prove reverse compatibility first. Activation is a separate authorized step and must occur only through the independent scheduled task.
