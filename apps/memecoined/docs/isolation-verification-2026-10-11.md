# Trade'Ed deployed isolation verification — 11 October 2026

## Verdict

**Verification completed; overall acceptance FAILED at shutdown.** Recovery and the 15-minute continuity interval passed. Ending the scheduled task did not terminate its detached watchdog. Release 2026.10.11.4 is not published as a verified update. No market-data soak, strategy window, or live trading was started by this test.

Tested source: `361cd7353dbce1c1daa58563559d5dd9aa37dca2`, branch `adapter-crypto-playbook`. Executable deployment came from the .4-r2 archive; the subsequent commit corrected the verification helper, not deployed watchdog behavior.

## Environment and ownership

- Task: `TradeEd-Isolated-Validation`, current-user Windows Task Scheduler ownership; logon and one-minute recurring triggers; IgnoreNew multiple-instance policy.
- Frozen runtime: `tradeed-validation/runtime-2026.10.11.4-r2` outside the Git worktree.
- Configuration SHA-256: `2c94999eabda8ad826f9f9f89335c9251a9250e5a3802e5cd637395cbe834057`.
- Recovered supervisor ancestry: watchdog 11840 → PowerShell 31864 → svchost 2576 → services 656 → wininit 948. No launcher or Codex process in that chain.
- Adopted worker PID: 1548. Its former supervisor 3080 had been deliberately killed; the replacement adopted it without spawning a duplicate.
- Loopback ports: watchdog 18296, worker 18297; each heartbeat identifies the worker PID.
- Fixture only: no market requests, database, funds, or strategy execution.

## Failure injections and actual results

All times below are UTC; add three hours for Riyadh.

| Injection | First detected | Evidence secured | Recovery | Result |
|---|---|---|---|---|
| Worker 29644 terminated | 16:45:28.300 | 16:45:29.480 | 16:45:58.314, worker 24188 | Passed; checkpoint retained |
| Worker alive, HTTP port unavailable | 16:46:28.304 | 16:46:29.670 | 16:46:58.326, worker 1548 | Passed; old owner replaced |
| Supervisor 3080 terminated | — | Pre-failure state captured | 16:47:58.446, supervisor 11840 adopted worker 1548 | Passed; no duplicate worker |

Incident artifacts include checkpoint copies, ancestry, durable stdout/stderr, alerts, and Windows event-query exports. An empty Application export means the query returned no records; it is not proof that Windows produced a crash report.

## Healthy interval

- Start: **16:49:23.231 UTC / 19:49:23.231 Riyadh**.
- Finish: **17:04:23.688 UTC / 20:04:23.688 Riyadh**.
- Duration: **900.457 seconds**, or 15 minutes 0.457 seconds.
- 30 periodic samples, approximately 30 seconds apart; worker PID remained 1548, failures remained zero, configuration hash unchanged, both HTTP identities checked at every sample.
- First sampled counter: 203. Last sample at 17:03:53.680: 1,067. Final persisted fixture counter: 1,131.
- This is fixture continuity, not exchange-ingestion throughput or profitability evidence.

## Failed shutdown and cleanup

The runner recorded `finished` at 17:04:23.688. Watchdog recorded `validation_completed` at 17:04:28.695 and remained alive to serve its status endpoint. The runner disabled and ended the task, stopped the fixture worker, then failed:

```text
assert.ok(!alive(report.final.watchdogPid))
```

Supervisor PID 11840 was still present. Consequently the runner exited 1 before writing its final `deployment-verification.json`; **no successful final JSON report exists**. The task was confirmed Disabled. The exact remaining watchdog was subsequently identified by PID and frozen-runtime command line and manually stopped. The fixture worker was already absent. This manual cleanup does not convert the shutdown test into a pass.

Evidence directory: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\logs\acceptance-2026.10.11.4-r2`.

## Test-suite boundaries

- Local TypeScript build passed.
- Local isolated suite: 146 files, 866 tests passed.
- Dependency-free isolation regression passed locally and in GitHub Actions run 38157413492.
- Entire remote CI workflow did **not** pass: the workspace regression job failed dependency installation because its required app lockfile is missing. No claim of full remote CI success is made.
- Prior .2/.3 publications are not evidence that final deployed acceptance passed.

## Outstanding acceptance gates

1. Scheduled-task shutdown must stop the detached supervisor as well as its worker, with a repeat deployed regression.
2. Production ingestion supplemental gap-repair validation remains unrun.
3. The archived seven-day soak ended early at 160.9685 hours, not 168; its deviation and latency caveats remain in the final soak report.
4. Playbook profiles are design-only. No profile implementation or fresh testing window is authorized by this report.
