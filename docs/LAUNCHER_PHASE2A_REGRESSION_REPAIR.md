# Launcher Phase 2A regression repair

The TimSyS 1.1.0 launcher source retained the superseded responsibility-network widget even though the installed backend retained documentary Phase 2A. Restore the previously reviewed documentary components and dashboard entry on top of the current published source (5ead5a7), retaining current launcher routes, AI integration and runtime contract.

The central backend migration also removed the old ResearchEd code bundle. Resolve the documentary engine beside the Nervous Breakdown backend in platform/services/researched first, with the legacy registered-bundle lookup retained for pre-1.1 layouts. No engine semantics, source documents, records or migrations change.

The launcher build now checks for documentary destinations, connection evidence and the viewport, and rejects the superseded interface. Regression coverage includes central engine resolution, source fences, navigation, exact evidence, one-hop destinations, return context, bounded synthetic lists and the AI interface.

Publication uses a verified copy of release 2026.11.05.2. Only documentary-connections.js is replaced in the platform; every other file is compared by hash. The ResearchEd bundle is retained verbatim and the new UI declares the 1.1.0 runtime contract. Installed updater compatibility and staged browser tests are required before creating the release manifest.

No installation is authorised in this task. Do not call update install, restart the launcher, stop research processes, or change installed state. Tests use disposable source copies and databases on random ports. TradeEd's stale watchdog was checked against actual processes, ports and Task Scheduler: the recorded worker/watchdog were absent, ports 18860/18861 were not listening, and the task was Ready. No validation was started or altered.

Verified results: real-corpus browser acceptance passed for 9 documents, 389 statements and 75 sections, with no source writes. Phase 2A connection evidence, existing destinations and Back restoration passed against the central packaged engine. AI UI compatibility and synthetic connection scale checks passed. Responsive acceptance exposed and fixed the inherited 1024px host minimum, scoped to the documentary page. Source SHA-256 remains ac042fec11e59d52aeae7e4b32c263fb39e99d947a935db2250dee3f5e53ccd2.
