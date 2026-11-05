# F1 production coding revision — 4 November 2026

New analysis runs use semantic policy **10**, classification configuration **3.2**, and `competencyRuleRevisions.F1 = f1-internal-communication.v1`. The response schema remains `mcf-evidential-proposals.v3`; the frozen MCF v1.0 instrument and hash are unchanged.

Only the Internal Communication paragraph in the v9 instructions is replaced. The revised F1 instructions require an identifiable internal communication function, allow negative accounts and poor follow-through, exclude a bare medium/meeting/availability/support, prevent borrowing an independent contextual example, distinguish appraisal substance from feedback communication, and preserve mixed-audience and actual-versus-hypothetical directive uncertainty.

Unresolved F1 uses the existing AI ambiguity alternative with exact same-review citations. The worker retains it in `unresolvedCompetencyIds`, excludes it from `noApplicationCompetencyIds`, and never counts it as supported. No schema migration or new reporting mechanism is introduced. Saved runs retain their snapshotted instructions, including on resume. All other competency instructions are byte-identical outside the replaced F1 paragraph. Existing Principal narrative-only ingestion and separate ISR ratings are untouched.

## Files

- `src/domain/mcf-semantic-policy.ts`: named F1 revision and v10 composition; v9 retained unchanged.
- `src/application/mcf-semantic.ts`: freeze v10/configuration 3.2 and the F1 revision when enqueuing fresh runs.
- `tests/mcf-f1-revision.test.ts`: 11 tests covering exact change scope, nine synthetic worker response cases, unresolved/count separation and the actual JSON export endpoint.
- Existing policy, source-rating and history tests updated for the current configuration; historical versions remain tested.
- `scripts/verify-semantic-integrity.mjs`: current policy snapshot assertions updated to v10/3.2. This legacy disposable-database script was not run in this pass.

## Verification

- ResearchEd regression suite: **423 tests passed in 48 files**.
- Final focused F1 suite after adding the export test: **11 passed**, including one additional test (424 distinct tests covered overall).
- Backend TypeScript production build: passed.
- Git whitespace check: passed.
- Initial invocation from workspace root failed the domain fixture guard before tests; corrected by running from the service directory. Restricted local-HTTP run was stopped and rerun with required local-test permissions. The successful suite uses repository isolation guards blocking production ports and non-test socket access.
- No external model calls or full Principal/Director corpus runs. Synthetic contract tests do not establish live-model classification accuracy. The previous isolated 15-item test predates the final conditional-directive and mixed-audience refinements.
- No live database, installed bundle, launcher, updater, AI connection, TradeEd process/data, or saved result was modified. TradeEd's scheduled inspection task was Ready, no matching worker/watchdog process was found, and no recent status-file writes were observed.

## Deployment status and use

Implemented and built in the consolidated source worktree; **not installed or published by this pass**. The installed ResearchEd 0.10.14 bundle still contains policy v9. No existing analysis is upgraded by opening it or resuming it.

After this backend change is packaged, published and installed, create a **fresh** Principal narrative-only analysis. Its JSON report identifies the revision at `machineOutputs.run.configuration.classificationConfig.competencyRuleRevisions.F1`, alongside semantic policy 10 and configuration 3.2. The policy is shared by fresh MCF analyses; there is no filename-specific or Principal-identity-specific branch. Only F1 differs.

## Subsequent authorised local installation
Installed locally on 4 November 2026 via the unchanged installed UpdateManager. Active platform bundle: a244d061310e73e70624154d; local release 2026.11.04.1-local-f1-v10. All 9,330 packaged files verified; only the two compiled ResearchEd policy modules and their source maps differ from the installed baseline. Three pre-existing DressEd changes were preserved. Installed updater gates and disposable-database Electron startup passed (HTTP 200). Launcher restarted and confirmed the pending bundle. ResearchEd opens at Continue as Admin. No corpus analysis started; no public release or repository push performed. The frontend still displays 0.10.14; semantic policy v10/configuration 3.2 identify this local rule update.
