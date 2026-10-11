# Trade'Ed validation isolation

Status: implemented and verified with disposable process fixtures on 11 October 2026. No new market-data validation started. Deployed acceptance additionally tests a hidden independent console host; the initial direct-node task returned 0xC000013A and is not counted as a pass.

## Ownership and deployment

`scripts/start-isolated-tradeed.ps1` registers the dedicated `TradeEd-Isolated-Validation` Windows Task Scheduler task. Task Scheduler, not the multi-app launcher or Codex terminal, owns the watchdog. It runs at logon and has no 72-hour execution limit. The watchdog owns one worker. Do not attach this task to launcher Start/Stop/update lifecycle.

Before a real run, copy the built runtime and dependencies to a dedicated immutable directory beneath `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\runtime-<version>`. Copy `validation-watchdog.cjs` there too. Never run from an updater bundle, temp directory, backups or a development checkout. Create separate `data/<epoch>` and `logs/<epoch>` directories. The watchdog configuration requires absolute executable/cwd/data/log paths, separate status and worker heartbeat ports, explicit arguments, and an interval <=60 seconds (production: 30 seconds).

Example fields: `executable` (Node runtime), `args` (absolute compiled worker entrypoint), `cwd`, `dataDirectory`, `logDirectory`, `port` (watchdog status), `workerPort` (actual worker heartbeat), `intervalMs:30000`, and optional `env`. The future soak worker uses `CRYPTOED_SOAK_OUTPUT` and `CRYPTOED_HEARTBEAT_PORT`; existing application workers require a compatible heartbeat before this harness may supervise them.

## Failure behavior

Every check verifies PID existence and an HTTP response naming that worker PID from the worker's own port. First failure writes `incidents.ndjson`, copies data files into `logs/<epoch>/incidents/<timestamp>`, captures Application/System XML via `wevtutil`, records supervisor ancestry, and appends the user-visible `ALERTS.txt`. Second consecutive failure restarts the worker only after those files exist. Healthy workers are never duplicated. Watchdog restart can adopt the same verified worker; unverifiable identity fails loudly. Terminal `finished` records are recognized without restarting a completed window.

Task Scheduler can restart the watchdog if it dies; logon startup recovers after an OS restart. While the workstation is off, no watchdog can run. Its next startup must expose the outage and preserve the epoch origin. A dedicated watchdog does not prove market-data freshness merely from an HTTP listener; the future validation should additionally inspect observation timestamps.

## Checkpoints

The future soak runner atomically replaces `checkpoint.json` and `summary.json` at least once per minute. Checkpoints preserve the origin, config hash, counters, closed-candle watermarks and integer-millisecond percentile histograms. Restart appends a recovery event and retains the original end deadline. Histograms cap latency values at one hour; no historical run is retroactively rewritten. The maximum counter loss after a hard termination is the interval since the last checkpoint. Canonical candle persistence and the supplemental gap-repair gate remain separate requirements.

## Pre-work gate

The workspace-root `AGENTS.md` contains the standing isolation order, applying across app checkouts. Run `node apps/memecoined/tools/validation-preflight.cjs <absolute watchdog-state.json>` and review the last 15 minutes of incident logs before platform development. It checks process ancestry, PID existence, log-directory write access and heartbeat age. Missing state or an active window without proof blocks work. Even a verified isolated window requires proof that proposed platform work cannot affect its ports/data/processes, or Tim's explicit override. This is an agent/process rule; no script can prevent an administrator from bypassing it.

## Verification evidence

- Production watchdog fixture: healthy PID preserved; first dead-worker check captures final checkpoint and OS events plus alert; second check restarts; healthy recovery confirmed. A separate live-PID/lost-port failure also recovers without duplication. Two failures must occur within five minutes.
- Task Scheduler fixture: task exit result 0; captured ancestry `node → node → svchost → services → wininit`, no launcher.
- Production runner checkpoint test: original start/config retained; repeated closed candle not recounted after restart; percentile preserved.
- TypeScript check passed.
- Full suite: 146 files / 866 tests passed using `vitest.isolated.config.ts`, which resolves the SDK from this branch. The default local dependency junction points at another checkout and failed module imports; that run is not represented as passing.
- Tests are registered in the standard Vitest include list and Windows GitHub Actions workflow. They have been run locally; remote CI has not run because this work is not published.

Before the next actual epoch: verify the copied runtime hash, configuration hash, actual task ancestry, actual heartbeat port ownership, first log/checkpoint writes, and a 15-minute idle/healthy supervision period. No further Trade'Ed validation is authorized by this document alone.

`isolation-task-host.ps1` must accompany the watchdog. Task Scheduler waits on this host, which creates Node in its own hidden console and captures watchdog stdout/stderr. Windows workers use a separate process group, so terminating a worker does not intentionally signal its supervisor's console. The initial Ctrl-C termination's originating sender was not captured; console isolation is verified by the repeat deployment test, not asserted as a proven explanation for that earlier termination.
