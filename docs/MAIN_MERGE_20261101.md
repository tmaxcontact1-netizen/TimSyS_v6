# Main/backend branch merge — 1 November 2026

This merges main d8f767b1cc3470e6e67031a6a74e957e06925742 and release-next-conviction 1a2c3c01cb0b770e0bb69fa4bffd4aebaf474466 in an isolated source checkout. Both histories are merge parents. No installed application, profile, image/document, credential store, live database or active validation is changed.

## Component resolution

- Retain recovered Research'Ed 0.10.13 frontend, central business implementation, migrations and versioned contracts. Main's older Research implementation is superseded by the accepted recovered release. Its six-step workflow, dark mode, deterministic fallback, selected-run recovery, deletion/history and document handling remain covered by the recovered tests.
- Retain main's Principal'Ed source, including navigation/scrolling improvements, guided projects/tasks and deletion controls. Rebase its API client to the central versioned namespace.
- Preserve main's trading segment controls and exchange adapter in platform/services/tradeed. Main-only exchange backend additions move from the old app tree into TimSyS. The app remains a static frontend using the versioned HTTP contract. Historical segment/database/environment identities remain compatibility aliases; current display/service branding is Trade'Ed.
- Keep main's cumulative published-bundle helper and tests. Research release commands continue through central platform/frontend packaging, and pipeline paths point to the central services.
- Preserve the already-released empty-model retirement and documentary projection. Recreating nb_records or restoring obsolete CRUD queries would break the recovered database. Main's superseded Layer 1 source and three old suites are retained under verification-archive/main-merge-20261101/retired-layer1; current retirement and Execution contracts stay in active regression discovery.

## Immutable migration histories

Both branches independently used slot 0066: release_next_conviction and tradeed_segments_exchange_data. Both original filenames and SQL contents remain. Only this explicitly named parallel slot is accepted; unrelated duplicates and sequence gaps remain errors. Exact LF/CRLF historical serializations remain checksum compatible.

The historical conviction SQL inserts a dormant profile for existing wallets, but the preceding historical catalogue constraint does not admit that identity. New migration 0067_conviction_profile_compatibility retains every historical profile identity, admits conviction_scale and adds only disabled/default activation entries. It is a recorded prerequisite of the immutable conviction migration, so no historical SQL or ledger entry must be rewritten. Existing controls, allocation settings and rows are preserved.

Real PostgreSQL fixtures start from each branch's original 66-file Git history and from a fresh database. Adoption applies only the missing branch migration plus the compatibility prerequisite; all 68 entries are recorded, existing row hashes over original columns remain present, and a repeated migration applies nothing. These migrations were not run on any live database.

## Verification and isolation

Seven production builds, the recovered Research/Dress/native suites, trading and platform regressions, branch-adoption tests, cumulative-manifest tests, ownership/GUI/preflight audits and compiled Research parity checks are recorded in the local verification-local/main-merge-20261101 evidence directory. The installed release and active Trade validation remain separate from this source checkout. No installer or update feed is published by this merge.

Final verification: 2,074 tests pass (625 platform across 143 suites, 877 trading, 402 Research, 102 Dress, 65 native and three cumulative-manifest tests). All 64 compiled Research modules, including the central HTTP entrypoint, match the installed recovered release. All 80 main school source files are retained, with only the API base adapted; 11 main-only exchange backend files are relocated centrally. Both original 66-file SQL histories are content-verified, and all three real PostgreSQL adoption scenarios pass with repeat migration empty.

Trade validation is observed read-only through the actual worker/watchdog ancestry, heartbeat, recent incidents, ports and sealed hashes. Its scheduled task, runtime, configuration, checkpoints, logs and durable data paths are excluded from every build and test fixture.
