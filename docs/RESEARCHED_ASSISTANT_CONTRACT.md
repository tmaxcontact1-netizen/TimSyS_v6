# ResearchEd shared assistant contract v1 — 0.8.2

The installed 0.8.1 runtime was the baseline. The frozen MCF instrument and
original corpus are unchanged. This app-only artifact is handed to the AI
Integration thread for coordinated installation; it is not published separately.

## Connection and startup

Launcher supplies `RESEARCHED_ASSISTANT_TOKEN` (at least 32 characters, random
per launch), `RESEARCHED_AI_MANAGED=1`, and explicit `RESEARCHED_AI_*` environment
values from its central credential vault. There is no app-local dotenv/profile
fallback. Unsupported protocols (including native Gemini), missing remote keys,
incomplete model/endpoint settings and invalid URLs disable AI instead of failing
startup. Supported providers continue to use existing run-time deterministic
fallback. ChatGPT-plan connections must be translated by the launcher into its
local OpenAI Responses proxy; the raw protocol name is unsupported here.

`GET /api/ai/status` returns configured, managed, provider (ID/model only),
unavailableReason and deterministicAvailable. Managed mode blocks local provider
changes and discovery requests; the connection dialog directs the user to the
launcher and explains closing/reopening ResearchEd after changing settings.

## Trusted bridge

Only expose these routes to the model:

- `GET /api/assistant/projects`
- `GET /api/assistant/projects/:id`

The platform authenticates/authorises its user, then attaches
`Authorization: Bearer <RESEARCHED_ASSISTANT_TOKEN>` on the server side. The model
and renderer must never receive the token. Absent/short/wrong tokens and Origin
headers are rejected. This is a desktop bridge, not per-researcher authentication.

Allowed query keys: section, offset (0–1000000), limit (1–20, default 10),
contentOffset (0–20000000), and evidenceId (UUID, units section only, restricted
to membership in the selected session). Unknown or duplicate keys are rejected. List supports
summary only. A selected project supports summary; MCF additionally supports
report, units, decisions, representations and proposals. Content supports results.

Response envelope: contract=`researched.assistant.v1`, projectId/projectRevision
and sessionId where applicable, section, offset, limit, total, nextOffset,
content, contentOffset, totalCharacters, nextContentOffset, notice. `content`
is JSON-serialized rows, capped at 12,000 UTF-16 characters per chunk. Keep
section/offset/limit fixed and read all contentOffset chunks; then reset
contentOffset to zero and use nextOffset. Re-read when projectRevision changes.
Reading only one chunk/page is not complete corpus coverage.

Summary identifies selected final/session ID and pinned run, frozen instrument,
confirmation status, coverage and whether unconfirmed edits exist. Report is
a pure read of the pinned machine run plus latest saved human coding. It returns
21 separate competency passage counts with evidence unit IDs, separated into
human, AI proposals and deterministic candidates. Human coding takes precedence
for the same passage. No domain/institution averages or automatic representation
scores are computed. Unconfirmed workbench corrections are excluded and flagged.

Decisions/representations expose only effective latest revisions, with stable
decision IDs, revision and previous_id. They do not combine superseded revisions.
Units preserve exact source passages, snapshot/record/unit IDs, UTF-16 offsets,
filename and source locator metadata. Proposals retain method/provenance and
limitations. Content results are stored task results, never a fresh scrape.
Operational secret/storage metadata keys are removed before serialization.

## Blind review and side effects

If any session in an MCF dataset is blind OR a validation session, the entire
dataset is unavailable to the assistant, including nonblind sibling projects.
Archived datasets/sessions and deleted projects are also unavailable. This is
deliberately conservative until researcher-level authorisation is implemented.
Existing independent duplicate uploads are not semantically identified as the
same corpus. Do not expose legacy sources, evidence, analysis, raw workbench/MCF
exports, or raw page capture alongside this projection: those bypass its scope.

Every endpoint is GET-only with SELECT-only queries. Reading does not enqueue
analysis, start scraping, clean files, save coding or approve results. Existing
workers may finish work that a user explicitly started earlier.

## Verification

Unit tests cover fail-closed authentication, write/query rejection, complete
chunk reconstruction, nested metadata sanitization, managed connection mutation
and safe startup configurations. `scripts/verify-assistant.mjs` exercises the
actual migrated schema in disposable PostgreSQL, report/evidence pagination,
latest-decision precedence, blind sibling blocking, no read-triggered jobs and
the managed connection UI. The normal workflow verification scripts remain
required for the final staged artifact. No external model calls are needed.
