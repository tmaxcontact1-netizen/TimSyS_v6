# Isolated shutdown choreography — root cause and verification

## Confirmed root cause

The failed .4-r2 run recorded `finished` at 2026-10-11 17:04:23.688 UTC and `validation_completed` at 17:04:28.695 UTC. Its persisted state was `completed`, with watchdog PID 11840 still alive after Task Scheduler `/End`.

In the former `validation-watchdog.cjs`, the finished-event branch set completed status and cleared its timer, but never called `stop()` or closed the HTTP server. The task host used PowerShell `Start-Process` to give Node its own hidden console; ending the task-owned host did not kill that independently launched Node process. Worker adoption also meant the current host did not own the surviving worker's original ancestry. The runner had no explicit stop-request/acknowledgement protocol: it disabled/ended the task and assumed that would terminate the watchdog. The code and observed live PID support this cause; there is no evidence of a received-and-ignored stop signal.

Original evidence: `C:\Users\tmaxc\Downloads\TimSyS\tradeed-validation\logs\acceptance-2026.10.11.4-r2\incidents.ndjson` and `watchdog-state.json`; failed assertion recorded in the earlier verification report. No successful final JSON was produced for that run.

## Single shutdown implementation

`isolation-shutdown.cjs` atomically writes `stop-request.json`, scoped to configuration hash and watchdog PID, with a unique request ID. The watchdog persists `stopping` and serves that ID and its own PID on the status endpoint. The runner observes that exact acknowledgement, writes `stop-confirmed.json`, and the watchdog then stops its worker, closes its server and removes the lock. A ten-second post-ack fallback stops it if the requester disappears.

The runner disables future task triggers before requesting shutdown. It then verifies both PIDs are absent and both ports can be bound, ends the task host, and writes the final report before declaring success. Grace period is 45 seconds, allowing a 30-second heartbeat tick plus teardown. If the grace expires, force-kill evidence and `watchdog_force_killed: true` are persisted and the acceptance run fails. Error exits also request automatic teardown and write a failed report rather than silently orphaning the fixture.

Regression target is the same helper used by the deployed acceptance runner. `isolation-shutdown.test.cjs` covers successful acknowledged teardown and a deliberately nonresponsive supervisor. The refusal case must be a failure despite successful force-kill cleanup. These tests are included in both GitHub Actions jobs.

## Scope

Feature branch only; no merge or release. Playbook remains review-only. Deployed acceptance uses a non-trading fixture, fresh immutable runtime and isolated data/log paths. No new strategy epoch or market-data soak is started.

Tested commit and deployed config hash are recorded in the final deployment JSON. Remote CI and fifteen-minute deployment results are pending until their complete artifacts exist; no pass is claimed prematurely.
