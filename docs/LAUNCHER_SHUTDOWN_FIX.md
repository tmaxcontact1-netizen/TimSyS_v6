# Launcher shutdown fix — 2026.10.20.10

The UI update had installed successfully, but native Launcher restart aborted because `pg_ctl stop` returned “PID file does not exist” for an already stopped database.

The process runner now preserves numeric exit status. After a failed stop, the manager queries `pg_ctl -D <same cluster> status`. Only documented exit status 3 confirms the server is stopped. A successful stop also clears ownership. A live server, inaccessible cluster, permission failure or failed status execution preserves the original exception and manager state. No PID files are removed and no process-name termination is used.

PostgreSQL documents status code 3 as not running and 4 as inaccessible data directory: https://www.postgresql.org/docs/current/app-pg-ctl.html

Validation:

- All 35 native-launcher tests passed.
- Seven manager tests cover normal stop, repeated stop, missing PID, live server, inaccessible cluster, permission denial and failed status execution.
- The actual installed `pg_ctl.exe` passed two consecutive stop attempts against a disposable stopped-cluster fixture. No database was started.
- Trade’Ed preflight: independent scheduled task running; worker 24216 → watchdog 21380 → owner 24120; both health endpoints healthy, zero failures, no recent incidents, durable log permissions intact.

This code lives in native `resources/app.asar`. The existing app-bundle updater cannot replace native code. Publishing another launcher-ui bundle would not fix it.

The native patch archive includes the repaired `app.asar`, its baseline/payload SHA-256 hashes, and `Install-Shutdown-Fix.ps1`. Packaging preserves every other installed archive member, including newer AI integration and updater code absent from this branch. The installer refuses a different baseline or a running Launcher, verifies the staged payload, and atomically replaces the archive with a recoverable backup. It does not change application bundles, records, PostgreSQL data, Trade’Ed runtime, tasks, ports or validation files.

For another matching installation: extract the patch, close Launcher, run `Install-Shutdown-Fix.ps1` in PowerShell, then reopen Launcher. `-VerifyOnly` checks compatibility without modification. The archive is intentionally not advertised as an automatic UI bundle.

Release evidence: `native-patch.json` records source commit, hashes and preserved member count. The cumulative `timsys-update.json` retains all previously published application bundles; it does not claim native patch installation.
