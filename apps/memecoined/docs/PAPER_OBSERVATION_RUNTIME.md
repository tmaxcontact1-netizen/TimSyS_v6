# Paper observation runtime ownership

Release `2026.09.26` uses one authority: **Option A, launcher-owned supervision**.

- The launcher starts and stops the MemeCoin'Ed worker, dashboard, resource sampler, and managed PostgreSQL cluster as one lifecycle.
- Before PostgreSQL is touched, launcher startup probes the canonical external dashboard endpoint at `http://127.0.0.1:8080/api/health`. A healthy MemeCoin'Ed process causes startup to fail loudly; the launcher does not start a database, child, rollback, or duplicate runtime.
- Launcher shutdown stops supervised children before stopping its managed PostgreSQL cluster.
- MemeCoin'Ed children receive Node diagnostic flags `--report-on-fatalerror` and `--report-uncaught-exception`, with `--report-directory` pointing at the run-specific instrumentation directory.
- Child stdout and stderr are appended to durable per-process files in that directory.
- The launcher samples worker/dashboard resource use into `resource-usage.csv` every 30 seconds while the supervised application is active.
- External production workers are not used during epoch `.9`. The external scripts remain diagnostic tooling only and must not run concurrently with the launcher.

The exact runtime switch is the `TIMSYS_CHILD_LOG_ROOT` environment value created by `startMemecoined()` and consumed by `SupervisedAppManager`. Database lifecycle remains launcher-owned; there is no second authority.
