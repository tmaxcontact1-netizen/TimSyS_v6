# Semantic policy v9 — substantive engagement

Implemented and verified 31 October 2026. This is a source change, not an installed/published release. No research analysis was run. The historical v8 validation artifacts and results were not modified.

## Architectural decision and exact conceptual rule

The classifier uses instructions frozen in each run's `classificationConfig.rules`. The worker reads that saved text for every request. The new cross-competency reasoning constraint therefore belongs in the construction of new run instructions, not in MCF definitions, retrieval keywords, output filters, or per-competency schema validation.

**A competency must not be assigned merely because the target/evidence occurs in an associated setting, process, event or medium. The substantive claim, interpreted with permitted same-review evidence, must satisfy the frozen operational criterion. Context can establish that criterion; association alone cannot.**

The full executable instruction text is `SUBSTANTIVE_ENGAGEMENT_RULES` in `src/domain/mcf-semantic-policy.ts`. It applies to all 21 competencies and explains the C1, F1, A3, D3, evidence-based decision-making and change-management boundaries. It expressly preserves same-review contextual inference, equal Explicit/Contextual validity, multiple supported competencies, existing thresholds, polarity and ambiguity rules. No name, institution, validation item, source passage or keyword blacklist is used in production rules.

## Versions and history

- New-run `semanticPolicy.version`: 8 → 9.
- New-run `classificationConfig.version`: 3.0 → 3.1.
- Semantic protocol 3, evidence protocol 2, ambiguity protocol 2 and the `mcf-evidential-proposals.v3` response-contract identifier remain unchanged.
- Existing evidential and ambiguity instruction strings remain byte-identical prefixes; the new constraint is appended only at enqueue.
- Policy versions through 8 described execution changes. Explicit resume of versions below 8 still upgrades their execution settings to 8. Resume of 8 or 9 preserves the saved policy. No resume silently acquires v9 reasoning or labels v8 reasoning as v9.
- The frozen MCF hash remains `0c10b62334e888084a0d293e8d2d0a08f634035f3b7212e1e791e57a011d5f24`.
- No schema/migration, segmentation, ontology, scoring, source data, ambiguity/valence algorithm, provenance format or sampling changes.

## Files

Production:
- `src/domain/mcf-semantic-policy.ts`: general instruction composition and historical resume-policy safeguard.
- `src/application/mcf-semantic.ts`: new-run version/configuration and resume helper.

Verification:
- `tests/mcf-substantive-engagement.test.ts`: 19 new policy/history and response-contract regression tests.
- `tests/fixtures/substantive-engagement.json`: nine invented positive/negative pairs, independent of the validation sample (18 cases).
- `tests/mcf-semantic-integrity.test.ts`: current policy-version expectation updated to 9; operational settings unchanged.
- `tests/isr-rating-metadata.test.ts`: current composed-rule expectation updated; source scale/evidence/ambiguity checks retained.
- `tests/provider-identity.test.ts`: actual resume-path assertion that v8 stays v8 and classificationConfig is not rewritten.
- `scripts/verify-semantic-integrity.mjs`: real isolated worker/persistence check that v9 is frozen, sent and recorded.
- `scripts/verify-substantive-engagement.mjs`: optional explicit-provider v8/v9 synthetic semantic evaluator. Not run against a live model in this change.

## Tests and observations

- Full Research'Ed Vitest suite: **402 passed, 46 files** (383 existing plus 19 new).
- Follow-up provider/history tests after adding resume SQL assertions: **5 passed**.
- TypeScript compile and Vite production build: **passed**.
- Existing isolated end-to-end semantic-integrity workflow: **20 passed**, using a new disposable PostgreSQL cluster, random loopback ports, synthetic provider and isolated source storage. Includes UI/HTML/PDF, coverage, retry/continuation, preserved successful outputs, historical guards and synthetic validation/report persistence.
- Live model calls: **0**. Live database access: **false**. Director rerun: **false**.
- Initial sandbox-only runs encountered temporary-file and loopback permissions; final reruns above passed. An initial new test used the wrong count property (`total`); corrected to the unchanged schema's `totalFindings` before the successful full suite.
- Trade'Ed worker PID 5512 and watchdog PID 19436 remained under independent owner PID 4280, parent 2572. Its final watchdog check reported active, zero failures. No shared runtime, launcher, updater or Trade'Ed files/data were modified.

Paired cases cover recruitment logistics/demeanour/welfare versus capability selection and growth; communication as medium versus channels/information flow; punishment versus monitoring/accountability; unrelated disrespect versus workplace safety/climate; nearby information versus evidence used in decisions; and change occurrence versus implementation. Positive contextual cases and explicit-route cases remain structurally admissible, as does C1+F1 multi-coding. These automated response-contract checks feed expected synthetic outputs; **they do not establish live-model classification accuracy or prove absence of false negatives**.

No unintended structural suppression was observed in the automated checks. Real-model behavioural change, including C1/F1 false-negative rates, remains unmeasured. The optional evaluator compares v8 and v9 on the same synthetic pairs, without sending expected labels, reading any audit responses, or connecting to a database. After building, run it only with explicitly chosen `MCF_EVAL_URL`, `MCF_EVAL_MODEL`, `MCF_EVAL_PROTOCOL`, optional `MCF_EVAL_KEY`, and a new `MCF_EVAL_OUTPUT` path. It performs 36 bounded requests and preserves outputs for review; it is not a full research analysis or a substitute for validation.

Local verification logs: `verification-local/policy9-tests.log`, `verification-local/policy9-pipeline.log`, and `verification-local/semantic-integrity/verification.json`. No commit, push, publish, installation or corpus rerun was performed by this change.
