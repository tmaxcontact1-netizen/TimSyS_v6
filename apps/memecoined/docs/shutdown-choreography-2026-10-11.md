# Isolated shutdown choreography — root cause and verification

## Confirmed root cause

The failed .4-r2 run recorded `finished` at 2026-10-11 17:04:23.688 UTC and `validation_completed` at 17:04:28.695 UTC. Its persisted state was `completed`, with watchdog PID 11840 still alive after Task Scheduler `/End`.

In the former `validation-watchdog.cjs`, the finished-event branch set completed status and cleared its timer, but never called `stop()` or closed the HTTP server. The task host used PowerShell `Start-Process` to give Node its own hidden console; ending the task-owned host did not kill that independently launched Node process. Worker adoption also meant the current host did not own the surviving worker's original ancestry. The runner had no explicit stop-request/acknowledgement protocol: it disabled/ended the task and assumed that would terminate the watchdog. The code and observed live PID support this cause; there is no evidence of a received-and-ignored stop signal.

Original evidence: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\logs\acceptance-2026.10.11.4-r2\incidents.ndjson` and `watchdog-state.json`; failed assertion recorded in the earlier verification report. No successful final JSON was produced for that run.

## Single shutdown implementation

`isolation-shutdown.cjs` atomically writes `stop-request.json`, scoped to configuration hash and watchdog PID, with a unique request ID. The watchdog persists `stopping` and serves that ID and its own PID on the status endpoint. The runner observes that exact acknowledgement, writes `stop-confirmed.json`, and the watchdog then stops its worker, closes its server and removes the lock. A ten-second post-ack fallback stops it if the requester disappears.

The runner disables future task triggers before requesting shutdown. It then verifies both PIDs are absent and both ports can be bound, ends the task host, and writes the final report before declaring success. Grace period is 45 seconds, allowing a 30-second heartbeat tick plus teardown. If the grace expires, force-kill evidence and `watchdog_force_killed: true` are persisted and the acceptance run fails. Error exits also request automatic teardown and write a failed report rather than silently orphaning the fixture.

Regression target is the same helper used by the deployed acceptance runner. `isolation-shutdown.test.cjs` covers completion arriving before the stop request, successful acknowledged teardown, and a deliberately nonresponsive supervisor. Completion now suppresses worker-health activity without disabling stop-request polling. The refusal case must be a failure despite successful force-kill cleanup. These tests are included in both GitHub Actions jobs.

## Scope

Feature branch only; no merge or release. Playbook remains review-only. Deployed acceptance uses a non-trading fixture, fresh immutable runtime and isolated data/log paths. No new strategy epoch or market-data soak is started.

Tested code commit: `c8fcd37f74216203b30da89b6e1dc9a20610d466`. Full remote CI passed: https://github.com/tmaxcontact1-netizen/TimSyS_v6/actions/runs/38159709207 . The earlier generic npm error was not a missing lockfile: npm's verbose loader reported a missing target record for the linked local SDK. Its target records were added to the three affected app lockfiles, without changing dependency versions.

Final deployed configuration hash: `b948696596c74e81fd01c72bb710e67b7b2d311bbd579c942994a5f0269dcda2`. Runtime: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\runtime-shutdown-2026.10.11-r3`. Logs: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\logs\acceptance-shutdown-2026.10.11-r3`. The final JSON contains its configuration hash, samples, recovery records and runtime hashes; the source commit is recorded here.

## Final deployed acceptance — passed

- Test began 17:27:33.452 UTC / 20:27:33.452 Riyadh.
- Worker death: 17344 → 2824; checkpoint count 1 retained. First failure 17:28:05.910; evidence 17:28:07.189; restart 17:28:35.914.
- Live-worker port loss: 2824 → 6916. First failure 17:29:05.900; evidence 17:29:07.250; restart 17:29:35.915.
- Supervisor recovery: 14688 → 4480; worker 6916 adopted at 17:30:36.913, fresh heartbeat confirmed 17:31:07.541.
- Recovered supervisor ancestry: 4480 node → 4436 PowerShell → 2576 svchost → 656 services → 948 wininit. No launcher or Codex owner.
- Healthy interval: 17:31:07.541–17:46:08.027 UTC, **900.486 seconds**; 30 samples, same worker, zero failures, constant hash.
- Sample interval mean 30.0160 s, maximum 30.022 s; sampled heartbeat age mean 0.771 s, maximum 0.908 s. These measure fixture supervision, not a trading scheduler.
- Counter advanced from 150 to 1,015 across the sampled interval; all worker stdout/stderr captures contained their startup markers.
- Durable stop requested 17:46:08.856, acknowledged 17:46:37.111, shutdown complete 17:46:37.225 UTC.
- Runner **exit 0**; final JSON written; task **Disabled**; watchdog and worker absent; both ports released; `watchdog_force_killed=false`. No manual cleanup.

Raw report: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\logs\acceptance-shutdown-2026.10.11-r3\deployment-verification.json`. The complete fixture command ran all three failures from fresh state, then the fifteen-minute interval; it did not reuse an earlier interval.

The first repeat failed on the verification runner's null fresh-heartbeat assertion; its error-path teardown passed and preserved failed JSON. A subsequent repeat was intentionally superseded to close the completion-before-stop ordering hole; it was stopped through the acknowledged protocol and is not counted as acceptance. Those artifacts remain retained. Final r3 is the passed run.

Watchdog runtime SHA-256: `72f5ff684b9300b07b5a2c524af2b432cef1848b29d9b4f229b7f72f5cdeb00e`; shutdown helper `42f12b8359313ca1874f76a3cebabaff485591323fe5230dbe2a68e7bbb0b23f`; task host `fda7ced0eda0ddce22a35644bef32958b02fbcc055d3b1caabf5329038da13ae`.

Subsequent reporting-only guard correction prevents a failed force-kill outcome from being overwritten by a second cleanup. It changes no deployed watchdog/worker bytes. Its shared report writer is exercised by the refusal regression: failed return value and persisted `watchdog_force_killed=true` are asserted. The runner returns non-zero directly after writing that failed outcome rather than re-entering cleanup.

Final code/reporting commit: `51eb2e1dc34cf6df6bccea7654f9ed39a7b4a3d9`. **Full remote CI green** for that commit: https://github.com/tmaxcontact1-netizen/TimSyS_v6/actions/runs/38161233531 . Both isolation and complete workspace regression/build jobs passed. Local app suite: 146 files / 866 tests; dependency-free isolation suite: 3 tests, including completion-before-stop and durable forced-failure reporting.

Nothing merged or published. Final task remains Disabled; no fixture process remains. Playbook profiles remain design-only and no new trading window or market-data soak was started.
