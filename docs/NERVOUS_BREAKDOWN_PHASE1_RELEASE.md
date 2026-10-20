Nervous Breakdown Phase 1 — release record
========================================

Release target: **2026.10.20.8**, authorised by Tim on 20 October 2026.

This release supplies the Principal’Ed documentary landscape UI and the read-only backend required to open the existing Research’Ed job-description collection. It does not import, modify or clear documentary records.

The platform is assembled from the SHA-256-verified **published 2026.10.20.7 manifest's platform bundle**, rather than replacing it with this checkout’s older shared platform. Exactly two backend files change:

- `modules/nervous_breakdown/index.js`
- `modules/nervous_breakdown/module.json` (module version 2.1.0)

Every other packaged platform file must match the baseline inventory. The current Research’Ed bundle is retained verbatim in the cumulative update manifest. AI integration files, dependency copies, migrations, native launcher, updater and shared services are preserved.

Packaging passed: 7,555 unrelated platform files matched the verified baseline exactly, both installed-updater compatibility checks passed, and real-corpus navigation plus AI settings/conversation browser checks passed against the staged platform.

`scripts/package-documentary-landscape.mjs` refuses a mismatched source baseline or a concurrently changed published manifest. It checks both new bundles with the installed native updater’s compatibility guard and runs the real-corpus documentary browser acceptance plus existing AI settings/conversation browser checks against the staged platform. These checks use disposable databases and a copied documentary snapshot. The resulting release verification records the source commit, changed backend files, retained bundles, compatibility checks, archive sizes and hashes.

Trade’Ed isolation was checked before release preparation:

- Scheduled task `TradeEd-Isolated-Q35-Outcome-Recovery-2026.10.20` owns the independent runtime.
- Worker PID 24216 → watchdog PID 21380 → owner PID 24120 → Windows services; no Launcher ancestry.
- Dedicated ports 18860/18861, immutable runtime under `tradeed-validation/runtime-q35-outcome-recovery-2026.10.20`, and separate durable data/log directories.
- Both HTTP heartbeats healthy, zero watchdog failures, no incidents in the last 15 minutes, owner log-write permissions confirmed.
- Installed updater/supervisor inspection confirms update restarts stop only recorded Launcher child processes. They do not enumerate or kill the independent validation worker.

Publication does not install the update or restart the running app. To test: use the Launcher’s **Updates → Check again**, install the available compatible updates, then open **Principal’Ed → Nervous Breakdown**. This shared platform/UI update uses the existing Launcher restart flow. Research’Ed’s documentary source collection remains the source of the read-only view.

The published release assets and their `phase1-verification.json` are the authoritative publication evidence. Local build evidence and screenshots are linked from [the implementation report](NERVOUS_BREAKDOWN_DOCUMENTARY_LANDSCAPE_PHASE1.md).
