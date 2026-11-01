# Main-source backend integration — 31 October 2026

Current acceptance, 1 November 2026: the recovered standalone 1.1.0 build is installed and activated with Research'Ed 0.10.13 and Dress'Ed 0.3.0. The recovered Research workflow and saved work are visible, and read-only live record hashes match the cold pre-installation baseline. The current inventory is BACKEND_INVENTORY.md; releases/2026.11.1.json identifies the recovered artifact and verification. The original integration report below is retained as historical evidence and predates the Research recovery. Source publication uses release-next-conviction; remote main is preserved.

The consolidated migration is integrated into the existing TimSyS_v6 checkout on release-next-conviction. No branch reset, staging or commit was performed. The existing index is unchanged. Main source means this checkout; the installed application and independent validation runtime have not been switched.

## Result

TimSyS owns Dress, Research and Trade backend services under platform/services, existing shared/school services under platform/modules, and the desktop lifecycle under platform/native/desktop. Apps contain frontends, versioned contract clients and the launcher bootstrap. The ownership audit and compiled central-layout verification pass. The inventory is BACKEND_INVENTORY.md.

The full compatible Windows runtime is version 1.1.0. Production dependencies are assembled offline from the existing installed caches at exact locked reachable versions, including nested versions. Old application dependency caches are retained for reproducibility and are excluded from maintained source. No runtime dependency installation is needed for this build.

## Preservation

Integration compares recorded original hashes before replacing/removing source. All replaced/removed files are backed up under verification-local/main-integration-20261031/before; before-working-tree.patch, before-index.patch and before-status.txt retain the starting state. The integration plan records 1,624 source operations. Additional build/compatibility changes are included in the final manifest. Do not blindly reset this previously dirty checkout to undo the migration; use the recorded before files and review changes individually.

Existing user databases, images, source documents, credentials, environment files and legacy dependency caches were not opened, migrated or removed. All 99 historical SQL migrations retain their bytes. Tests and packaged smoke use dedicated disposable fixture directories outside real profiles.

Trade branding is current throughout the maintained app identity and UI. Old on-disk trading directory/database/role names and environment prefixes remain solely as compatibility aliases. Existing populated folders, PostgreSQL database identity and credentials are reused. Conflicting data roots, ambiguous/missing database identity in an existing cluster, missing credentials or inconsistent old/new configuration stop startup. Existing environment files are normalized in memory without rewriting them.

## Verification

- Platform: 640 tests, 145 suites.
- Dress: 16 tests; Research: 128; Trade: 818, plus final focused configuration verification.
- Native: 62 tests including legacy folder, environment and database adoption/conflict cases.
- Contract clients: seven tests.
- Three production TypeScript builds, four production Vite builds, ownership audit, complete staged-runtime verification and central compiled-layout verification pass.
- Packaged Electron smoke uses RunAsNode, blocks worker subprocesses and non-fixture network access, and checks bootstrap selection, locked packages, native SQLite/Sharp, compiled HTTP factories, legacy data adoption and authenticated platform runtime contract on a separate database.

Build output and exact reports are under verification-local/main-integration-20261031. The Windows NSIS build is a local unsigned review artifact. It has not been installed, published or activated. Installation against a copied real profile and live cutover remain acceptance work under the standing Trade validation isolation order.

## Trade validation

Read-only observation verifies worker PID 5512, watchdog PID 19436, independent scheduled-task ancestry, heartbeat/ports, recent incidents, permissions and 43 sealed file hashes. The runtime, Task Scheduler task, configuration, ports, checkpoints and durable data/log directories remain unchanged. No new validation or trading worker was started. The earlier watchdog-policy discrepancy remains a separate finding.
