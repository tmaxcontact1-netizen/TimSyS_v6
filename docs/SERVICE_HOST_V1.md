# TimSyS-owned service host: foundation v1

31 October 2026. Implemented in an isolated source copy. No installed service, launcher bundle, validation runtime, live database or updater has been changed.

## Hosting and ownership

`platform/modules/service_host` boots through TimSyS's existing module lifecycle. `platform/shared/service-host` owns registration, invocation, limits and call records. Implementations are supplied by trusted TimSyS boot code; no API accepts an implementation path, process command, provider credentials, registration request or arbitrary target URL. Nothing imports or starts an app backend.

The first hosted service is `runtime`, contract `1.0.0`, with a read-only `status` operation. It identifies TimSyS as the owner and explicitly returns `domainMigrationComplete: false`. It is usable by Principal'Ed, Dress'Ed, Research'Ed and Trade'Ed without starting any of their backend servers. This establishes the hosting/contract boundary; it does not yet move domain APIs, workers or data out of apps.

The runtime service remains read-only. The subsequent wardrobe migration adds trusted command handlers with mandatory idempotency and PostgreSQL-atomic receipts; ordinary write handlers remain forbidden. Durable background-job leasing is still separate work. See [the wardrobe migration](WARDROBE_SERVICE_MIGRATION.md).

## Versioned app contracts

Protocol: `timsys.services.v1`. Apps declare pinned dependencies in `apps/<app>/timsys.services.json`. These files describe client requirements; they grant no permissions. Canonical app IDs are `principaled`, `dressed`, `researched` and `tradeed`. The school domain's existing `principal-ed` data scope is separate and is not silently remapped.

| Method | Path relative to `/api/timsys/v1/apps/:appId/services` | Purpose                                                   |
| ------ | ------------------------------------------------------ | --------------------------------------------------------- |
| GET    | root                                                   | Discover permitted services and exact versions            |
| GET    | `/:serviceId/contracts/:version`                       | Read a contract, schemas, limits and canonical hash       |
| POST   | `/:serviceId/contracts/:version/operations/:operation` | Invoke a registered operation with the JSON body as input |

Every response has an envelope. Successful responses contain `success`, `data` and `meta`. Service metadata identifies protocol, app, request ID and, on invocation, service ID, exact contract version and contract hash. The request ID returned for an invocation is the same ID stored in `service_host_calls`. Existing platform response behavior is preserved for other modules.

The host persists the canonical descriptor in `service_host_contracts`. Changing a descriptor under the same service/version is rejected even after restart. Publish a new version instead; no automatic version selection or `latest` fallback exists. Canonical hashes sort object keys and retain array ordering. Contract descriptors are public metadata within an authorized app/service catalogue; operation permissions are checked on every invocation.

`@timsys/service-contracts`, located in `platform/packages/service-contracts`, exports a Node CJS interface, ESM interface, browser-compatible HTTP client and TypeScript declarations. It has no database, provider or Node-specific dependency in the client. The package is ready for app adoption; existing app screens are not silently switched to it.

```js
import { TimSysServiceClient } from "@timsys/service-contracts";
const services = new TimSysServiceClient({
  baseUrl: platformOrigin,
  appId: "tradeed",
  getToken: () => platformSessionToken,
});
const status = await services.invoke("runtime", "1.0.0", "status", {});
```

## Authorization and validation

The existing platform verifies the bearer JWT and requires `admin:service_host:access`. The host then independently requires `app:<appId>:use` and the operation's permission, currently `service:runtime:read`. Existing explicit `admin:*` authority can access all four apps. Restricted callers need all three grants; the app path or request body cannot grant access. Existing signed permission wildcards retain their platform semantics.

Contracts enumerate input/output fields and forbid extras, with bounded arrays and nesting. The supported JSON Schema subset is deliberately limited to explicit types, properties, required fields, constants/enums and declared size/range bounds; unsupported keywords such as `$ref` are rejected at registration. This is not a general JSON Schema implementation. Input and output byte limits are enforced separately. Output validation and failure masking prevent invalid results or handler exception details from escaping.

Failures include `APP_FORBIDDEN`/`OPERATION_FORBIDDEN` (403), missing app/service/operation (404), `CONTRACT_VERSION_UNSUPPORTED` (409), invalid input (400), excessive input (413), timeout (504), cancellation (499), host stopped (503) and invalid output/internal handler failure (500). Platform authentication and route-access errors occur before the service envelope.

## Deadlines, records and recovery

Each operation declares a server deadline and byte limits. The client bounds its response stream and has a separate deadline plus caller abort support. The platform passes request disconnect cancellation to the host. Handlers receive a cooperative AbortSignal; cancellation/timeout prevents returning a late result but cannot forcibly terminate synchronous code. Only read implementations are admitted until durable write recovery exists.

Accepted calls persist caller/app, service/version/hash, operation, input hash, timestamps and status. Raw input/output/provider credentials are not saved in call history. At boot, incomplete call records become `interrupted` with `HOST_RESTARTED`; they are not replayed automatically. Read calls may be retried by the caller. Contract descriptors remain persisted across boot. History retention/compaction and production-volume bounds remain pre-rollout work.

## Trade'Ed naming and installation boundary

Maintained source now uses `apps/tradeed`, app ID `tradeed`, `TRADEED_*` configuration variables, renamed launcher ownership files and Trade'Ed labels. Generic market search terms referring to the asset class remain market data, not the old product identity.

This is a coordinated source rename, not an installed identity/data migration. It changes bundle IDs, persistent-directory defaults, database defaults, environment names and client storage keys. Do not install or publish it over an existing installation until a separately reviewed migration preserves existing data/configuration, maps update identities, prevents dual writers and verifies rollback. No existing database or directory was renamed here. Never create an empty new account/ledger in place of preserving an existing one.

Sealed validation files and historical evidence outside the isolated source retain their original bytes and provenance. No branding edit to those files is permitted as part of this source change.

## Verification and next migration

The isolated verification evidence lives at `../../` relative to this document (the `backend-service-host-20261031` evidence directory). Focused and full-platform results, cold-recovery results, rename/source manifests and Trade'Ed observations are recorded there. These are source verification results, not release/live-provider certification.

| Check | Result |
| --- | --- |
| Full platform regression | 137 suites, 609 tests passed; final run 31 October 2026, 12:49–12:52 Riyadh time |
| Focused host/app contract path | 24 tests across five suites passed before the full run |
| Renamed launcher layout/ownership/supervision | 16 checks passed using mocked process/database actions |
| Cold-process recovery | Separate PIDs preserved the contract hash and completed-call receipt; an unfinished synthetic call became interrupted without replay; 107 migrations and SQLite integrity ok |
| Client compatibility | Strict TypeScript usage compiled; browser ESM bundle succeeded |
| Source audit | 1,010 code files parsed with no syntax failures; no old product-name references or paths remained in the maintained isolated source |

Earlier development failures and interrupted runs are retained separately in the evidence directory. The final run used a fresh per-process database. No domain-wide app regression, actual trading lifecycle, installed update/identity migration, forced-crash recovery or live provider validation is claimed. The complete platform regression took about 189 seconds in this guarded environment, above the repository's two-minute target.

Next: select a bounded app service, define its versioned domain contract, move its implementation and persistence ownership into TimSyS, verify the real UI/client -> TimSyS -> data path plus negative/recovery cases, then retire that app's server path. The service host currently owns no trading, research or wardrobe data and does not contact their APIs. Native-host supervision, secret bridges and durable command/job infrastructure remain explicit migration work.
