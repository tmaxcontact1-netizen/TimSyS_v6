# AI Gateway service contract

## Conversational assistant (1.2)

TimSyS AI is a shared conversational side panel. Open it with **Ask AI**, the **TimSyS AI** app menu, or **Ctrl+Shift+Space**. The same panel accompanies independent app windows. It supports free-form conversations, follow-ups, saved history, cancellation, inspectable sources, optional current-page/selection context, and optional public-web research. Provider connections are managed in the panel and stored in the existing OS-encrypted credential vault. Applying a connection updates the platform immediately.

Authenticated routes: `GET /ai-gateway/assistant`, `GET/POST /ai-gateway/conversations`, `GET/DELETE /ai-gateway/conversations/:id`, `POST /ai-gateway/conversations/:id/messages`, and `POST /ai-gateway/conversations/:id/cancel`. Chats belong to their creator. Messages start asynchronously; clients poll the conversation for progress and completion. Interrupted requests remain visible after restart. Latest 30 completed messages are sent as conversation context; the full local history remains viewable. Limits: 60 messages/hour, two simultaneous conversations/user, 24 tool calls and 12 model rounds/turn. No write tools are exposed.

Record tools execute explicitly listed read routes under the caller's existing permissions. Platform sources include student/staff/room/inventory registries, tasks, documents and extracted current document text, gradebooks and programme records. The desktop administrator can additionally read listed Research’Ed, Dress’Ed and Trade’Ed APIs while those apps are running. This is not unrestricted SQL or arbitrary HTTP access. Sources outside the catalogue, unextracted documents, stopped apps and provider/model limitations are reported as gaps. Current-page context supplies visible page text or the selection, up to 24,000 characters; screenshots and binary attachments are not included.

OpenAI Responses and Gemini use native tool calling; Gemini thought signatures are retained between tool turns. Web research is disabled unless selected for the message and uses the provider's native search capability. Model support and provider charges apply. Web links and Gemini search suggestions are retained with the answer. Suggestion HTML is displayed in a sandbox without script permissions.

Provider contracts: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling), [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Gemini search grounding](https://ai.google.dev/gemini-api/docs/google-search).

## Existing guided interfaces

The AI Gateway is a shared TimSyS backend service for **Help, Advise and Watch**. Availability is the default; enabling background work is a separate, explicit workflow choice. Native OpenAI Responses and Google Gemini are the preferred integrations. OpenAI-compatible Chat Completions, Anthropic Messages and the existing JSON webhook remain supported. Credentials remain encrypted in the launcher vault and are passed only to supervised backend processes.

Every request must contain bounded evidence with stable identifiers. Returned citations are rejected unless they reference supplied evidence. Results record provider, model, prompt version, evidence hash, confidence and limitations. AI output is advisory and cannot approve records, assign standards or overwrite deterministic evidence.

## App boundary

Apps own `ai-adapter.json`: their identity, versioned domain instructions, help documents and permitted Watch workflow names. Definitions for Principal’Ed, Research’Ed, Dress’Ed and Trade'Ed load at boot. Windows staging copies these definitions into `platform/modules/ai_gateway/app-adapters` as well as their app directories, so independently versioned update bundles work without a shared parent folder. An independently deployed app can register its definition through the API with configuration permission. File definitions are authoritative at boot.

Help answers from the app's registered help evidence. Advise accepts evidence the app has already authorised for the current user. Watch accepts that same bounded evidence on a registered workflow. The service does not query another app's database or automatically ingest the global event bus. Apps must call `publishEvidence` after an authorised domain event; registering a workflow alone does not connect a domain event producer.

Each request uses a TimSyS bearer session. `ai:<appId>:use` permits that app's AI operations; `ai:<appId>:configure` permits adapter registration. Platform administrators with `admin:*` can use/configure all apps. Run history, watches, jobs and notifications remain scoped to both app and requesting user, including for administrators. No client-supplied owner or provider credentials are accepted by these routes. Apps are responsible for source-record authorisation before submitting content. Queued evidence is a snapshot explicitly submitted by the authorised user; it does not re-fetch records later.

## API and SDK

All paths below are relative to `/ai-gateway/apps/:appId`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | (root) | Availability, provider configuration state and workflows |
| PUT | `/adapter` | Register an app-owned definition |
| POST | `/ask` | `{mode: "help" | "advise", question, evidence?}` |
| GET / PUT | `/watches` | List or configure the current user's workflow subscriptions |
| POST | `/events` | `{workflow, eventId, evidence}`; queue only if enabled |
| GET | `/runs` | Most recent 100 runs and saved answers |
| GET | `/jobs` | Most recent 100 Watch jobs, attempts and failures |
| GET | `/notifications` | Most recent 100 meaningful findings |
| PUT | `/notifications/:id` | `{status: "read" | "dismissed"}` |

`TimSysAiClient` is exported from `@timsys/app-sdk` for CommonJS and ESM, with TypeScript declarations. Provider keys never enter this client.

```js
import { TimSysAiClient } from '@timsys/app-sdk';
const ai = new TimSysAiClient({
  baseUrl: platformUrl,
  appId: 'researched',
  getToken: () => currentUser.platformToken,
});
await ai.help('How do I review evidence?');
await ai.advise('What changed?', authorisedEvidence);
await ai.setWatch({
  workflow: 'source-imported', instructions: 'Flag evidence that requires review.',
  enabled: true, cooldownSeconds: 300, dailyLimit: 20,
});
// The app invokes this after its import succeeds, using a stable event ID.
await ai.publishEvidence('source-imported', importId, authorisedEvidence);
const { notifications } = await ai.notifications();
```

Evidence records have `id`, `content`, optional `source` and optional ISO `observedAt`. Requests accept 1–100 unique evidence IDs, at most 20,000 characters per record and 120 KB of serialised evidence. Answers contain summary, recommendations, nonempty evidenceIds, confidence, limitations and needsAttention. Confidence is model-reported, not a calibrated probability. A valid ID proves a supplied source was referenced; it does not prove the interpretation is correct.

## Watch lifecycle and limits

Subscriptions start absent/disabled. The one-second worker leases durable SQLite jobs for two minutes; provider requests time out after 90 seconds. Failed transient requests retry with exponential backoff, at most three attempts. Expired leases recover after restart; interrupted runs are marked failed. Disabling a workflow cancels pending/running jobs and suppresses their notifications. In-flight provider requests may already have been transmitted.

Stable event IDs and canonical evidence hashes suppress repeat work per subscription. Identical summary/recommendations suppress repeated notifications. Non-actionable answers are saved without a notification. The worker is serial; interactive and Watch runs have a combined limit of 60 per app/user/hour. Watch also applies a configurable rolling daily ceiling across that app/user's Watch runs (default 20), cooldown (default five minutes) and 100 pending jobs per subscription. Provider responses are bounded to 2 MB and 4,096 output tokens. These are operational caps, not a currency-denominated billing guarantee.

Completed, failed and cancelled jobs discard queued source text; run history retains the answer, citations, evidence hash, provider/model, prompt version and usage. Raw input text is not retained in run history. There is no automatic failover to another provider and no autonomous write/action tool.

## Provider configuration

Use the existing launcher credential profiles or server-side `TIMSYS_AI_PROTOCOL`, `TIMSYS_AI_MODEL`, `TIMSYS_AI_BASE_URL` and `TIMSYS_AI_API_KEY`. Choose protocol `openai-responses` or `gemini`; the native default base URLs are `https://api.openai.com` and `https://generativelanguage.googleapis.com`. Models remain explicitly configurable rather than pinned to a changing catalogue. The desktop launcher applies the shared assistant configuration immediately. See the Research’Ed shared assistant section for app startup compatibility and restart requirements.

OpenAI uses `store:false` and strict structured output. Gemini uses native `generateContent`, an `x-goog-api-key` header and a JSON response schema. Both outputs are validated again by TimSyS. No source files, web search or provider-side tool execution are enabled.

Provider references checked 2026-10-08:
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Gemini generateContent reference](https://ai.google.dev/api/generate-content)

This change supplies the backend, app definitions and SDK. App-specific adviser panels and automatic domain-event producers are separate consumers of this contract; no background workflows are enabled by installing it.

## Research’Ed shared assistant (2026-10-10)

The launcher’s AI Integration tile owns connection setup. The shared conversational assistant supports OpenAI API, ChatGPT plan (through the local Responses bridge), and Gemini API. Research’Ed 0.8.2’s internal analysis provider safely disables unsupported protocols, including Gemini, while its deterministic workflow remains available. Missing credentials and provider failures must not prevent startup or deterministic processing. Changing the central connection applies to the shared assistant immediately; a running Research’Ed process retains its startup configuration until closed and reopened, with a notice in AI Integration.

The assistant discovers only `GET /api/assistant/projects` and `GET /api/assistant/projects/:id` for Research’Ed. Legacy sources, content, workbench and MCF routes are not available through the bridge. TimSyS requires `admin:*`, and Research’Ed independently verifies a per-launch bearer capability passed through trusted desktop configuration. The capability never enters a model prompt or renderer. A dataset with any blind or validation session is excluded, including through a nonblind sibling project. Raw Research’Ed page attachment is disabled to preserve this boundary.

Project reads use `section=summary|report|units|decisions|representations|proposals|results`, as supported by that project. Row pages use `offset` with a maximum `limit=20`; text chunks use the tool’s `contentOffset`, forwarded to the app. Finish `nextContentOffset` chunks with unchanged row arguments, then use `nextOffset` and reset `contentOffset=0`. Check `projectRevision` before combining reads. Results carry stable project, session, run and evidence IDs and source locators. Cite both the turn source reference and relevant evidence IDs; state which pages were actually read.

The workflow is upload → deterministic extraction/cleaning → choose analysis → draft → optional AI interpretation → researcher confirmation → output. Source passages, deterministic candidates, AI proposals and saved human decisions remain distinct. The assistant cannot change the frozen instrument, promote interpretations into decisions, navigate research workflows or start analysis. Reading a report is read-only. Background processing remains explicitly opt-in.

Release packaging must start from the current installed bundles, overlay reviewed changes and retain unrelated bundle descriptors and their original publication dates. Electron changes require a launcher update; a launcher-ui bundle alone is insufficient. Once installed, versioned Research’Ed assistant contract markers prevent a later incompatible platform or Research’Ed bundle from silently removing this integration; only that bundle is held, and unrelated updates can continue.

