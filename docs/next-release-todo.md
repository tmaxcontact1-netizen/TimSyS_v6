# Release 2026.09.26.10 implementation record

## MemeCoin'Ed `.10`: complete launcher stop lifecycle

- **Defect:** The launcher Stop command terminates the MemeCoin'Ed worker and dashboard but leaves the PostgreSQL master running.
- **Severity:** Low. The original competing-supervisor failure did not recur: no duplicate worker, dashboard, database master, or instrumentation run was created during the Stop test.
- **Impact during epoch `.9`:** Operationally cosmetic. Restarting MemeCoin'Ed through the launcher reuses the existing database and resumes the sealed epoch cleanly. The deliberate 45-second test gap is recorded in the validation protocol and excluded from active time.
- **Resolution:** Included in `.10` after epoch `.9` terminated as diagnostic.
- **Planned fix:** Add an explicit graceful `pg_ctl stop` to the launcher shutdown sequence after worker/dashboard termination. Enforce a bounded graceful-shutdown timeout, verify the data-directory lock is released, and fail visibly rather than spawning or attaching a competing database instance.

### Verification requirement

The existing launcher test suite runs through the repository's standard workspace test command and currently verifies duplicate-runtime refusal and child-before-database shutdown ordering. On 2026-09-26 all 25 launcher Electron tests passed, including `launcher refuses a duplicate external MemeCoinEd without touching its database` and `launcher-owned shutdown stops children before its database`.

That ordering test uses mocked shutdown callbacks and therefore does not prove that production invokes `pg_ctl stop`; the manual epoch `.9` Stop test demonstrated the missing production behavior. Release `.10` must add a production-path lifecycle regression that starts the managed test database, invokes the real launcher Stop path, and proves that the PostgreSQL master exits, the data-directory lock clears, no duplicate process starts, and a subsequent launcher start resumes the same data cleanly.

## Consolidated `.10` scope

- Single-owner pending-entry dispatch and profile-account serialization.
- Idempotent position-collision handling; benign races cannot terminate the worker.
- Atomic position, cash, fill, decision, intent and signal-outcome bookkeeping.
- Startup reconciliation for legacy interrupted-entry sequences.
- Durable JSON incident reports for handled top-level worker exceptions.
- Persisted sub-observation quote paths for MFE/MAE and exit-adjacent reconstruction.
- One of four dense watch slots reserved for Fast & Furious; three remain shared.
- GitHub Actions runs the locked regression suite and production builds on every push and pull request.
- Jupiter HTTP 400 telemetry was attributable only to provider-side `validation` responses because the old client discarded the response detail. `.10` retains this as a non-retryable candidate rejection and improves incident/provider evidence rather than guessing at a request mutation.
