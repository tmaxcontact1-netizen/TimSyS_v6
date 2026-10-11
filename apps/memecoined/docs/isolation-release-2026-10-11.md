# Trade'Ed isolation release 2026.10.11.2

Standalone supervision package; not a launcher updater bundle. No strategy, profile or epoch changes. Published from adapter-crypto-playbook, without merging the adapter into main.

Includes independent Task Scheduler registration, worker PID/HTTP checks, evidence-before-restart, durable stdout/stderr and alerts, checkpoint recovery, preflight gate, and deployment-only fixture. The fixture performs no trading and connects to no market provider or database.

Local verification: 146 files / 866 tests with branch-local SDK resolution; TypeScript passed; dead-worker and live-PID/lost-port recovery tests passed. GitHub Actions now covers pushes to this feature branch. Remote CI results must be reported separately, never inferred from local results.

Deployment acceptance: immutable runtime copy and checksum manifest; scheduled task ownership; actual watchdog and worker ancestry; both HTTP heartbeats; durable stdout/stderr, checkpoints, alerts and OS evidence; forced fixture failure followed by a single recovered worker and retained counter. Stop and disable the acceptance task afterward. A subsequent actual test requires a real-worker configuration and fresh preflight, not a fixture masquerading as validation.
