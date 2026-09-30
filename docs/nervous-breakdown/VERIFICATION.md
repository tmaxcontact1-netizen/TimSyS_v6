# Import readiness verification — 28 September 2026

## 29 September remediation

Three focused suites / 18 tests passed (38.139 seconds), including all five evidence values with draft human-review state, governed level references, null/omitted levels, invalid level categories/references, same-named subdomains under different parents, unchanged export replay, level graph filtering, and continued rejection of missing or role-based connection endpoints. Receipt: `../../../principaled-context/remediation-tests.log`. Principal’Ed and launcher builds pass with the existing bundle-size advisory.

Source-only registration used the existing Documents/Nervous Breakdown services against the project store without booting the full platform or running migrations. All seven stored files were read back and matched the supplied original SHA-256 hashes. Final NB inventory is exactly seven draft roles and seven draft sources, with zero statements, terms, responsibilities or connections. See `SOURCE_BINDINGS.md`. The source documents and v0.1 analytical workbook were not edited. No mappings, workbook-derived ontology, Layer 2 or Layer 3 were imported/built.

- Full platform regression: 123 suites, 514 tests passed in 308.452 seconds. Receipt: `../../../principaled-context/import-contract-full-tests.log` (relative to this directory).
- Final focused checks after the last validation changes: 3 suites, 16 tests passed in 15.807 seconds. Receipt: `../../../principaled-context/import-contract-final-tests.log`.
- Principal’Ed and launcher production builds passed. Vite emits a large-bundle advisory; no build errors.
- `git diff --check` passed. Published schema snapshot matches the runtime schema object. Both synthetic example packages pass model and network validation.
- Browser test in an isolated synthetic-only database: invalid responsibility references produced a visible blocking report and no save; a legitimate placeholder produced “Valid for import”, warnings, and confirmation that dry-run saved nothing. The UI offers a complete report download and caps the on-screen issue list at 100 entries.

The HTTP tests cover the full synthetic chain: immutable file upload and download; one statement supporting multiple responsibilities; a statement correction retaining earlier pinned wording; new domain/subdomain/action/authority terms; null classifications and levels; documentary and unresolved connections; explicit direction; graph/trails; export and same-store re-import. Export replay preserved complete record identity/data/revisions, source pins, history, and graph nodes/edges/trails. It created zero changes. The original file bytes remained identical.

Additional tests reject duplicate IDs, dangling roles/statements/ontology/endpoints, wrong relationship categories, nonexistent document versions, malformed/reversed dates, stale revisions and permission violations. They verify atomic rejection in dry-run and commit, preserve duplicate-looking records with warnings, permit applicability-date uncertainty with warnings, reject a non-boolean dry-run flag, and validate a request exceeding 1 MiB without writing.

No live organisational records were imported, no seven-JD analysis was generated, and no Layer 2/3 implementation was added. Tests use synthetic fixtures in isolated databases. Changes remain local; no deployment or GitHub push was performed.

Round-trip scope: same-store replay is verified. Standalone cross-installation history/file restoration is not implemented or claimed; see `IMPORT_CONTRACT.md` for that architecture boundary.
