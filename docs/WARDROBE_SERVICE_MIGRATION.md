# Dress'Ed wardrobe catalogue hosted by TimSyS

31 October 2026. Implemented and verified in an isolated source copy. No installed application, live database, existing private-storage directory or Trade'Ed validation runtime has been changed.

## Scope and ownership

TimSyS now owns wardrobe categories, garment uses, garment listing/detail, creation, optimistic update, archive and permanent deletion through `wardrobe@1.0.0`. Implementations, domain validation and PostgreSQL migrations reside in `platform/services/wardrobe`; there is no wardrobe repository or garment validator implementation under the app.

Dress'Ed's renderer uses `platform/packages/service-contracts/wardrobe-client.mjs`. Its native bridge invokes the versioned TimSyS service. The app's former catalogue HTTP routes return 410 and cannot write. Photography, fingerprinting, styling, ensembles, planning, care/lifecycle and insights remain separate migration work; the existing lifecycle repository still changes lifecycle status and increments garment versions. That dependency is explicitly allowed by the ownership audit and must be removed when lifecycle moves. This milestone does not claim the entire Dress'Ed backend is centralized.

The app's ten historical SQL files moved byte-for-byte to TimSyS. The old app migration entrypoint now fails explicitly instead of acting as a second migration authority. `scripts/audit-backend-ownership.mjs` checks that catalogue implementation and migrations do not reappear in the app and is part of workspace verification.

## Versioned contract

All operations use `POST /api/timsys/v1/apps/dressed/services/wardrobe/contracts/1.0.0/operations/:operation` through the shared client. Discovery and descriptor retrieval use the service host's existing versioned routes. Descriptors include bounded input/output schemas and immutable contract hashes.

| Operation | Effect | Input |
| --- | --- | --- |
| categories | Read | Empty object |
| uses | Read | Empty object |
| list | Read | limit 1–50, offset, optional search/category/use/status filters |
| get | Read | Existing garment UUID |
| create_category | Command | Category name/slug, optional parent/sort order |
| create | Command | Existing garment input shape and collections/acquisition data |
| update | Command | UUID plus garment data and expected version |
| archive | Command | UUID and expected version |
| delete | Command | UUID and expected version |

The host retains bearer authentication, `admin:service_host:access`, `app:dressed:use` and operation permissions (`service:wardrobe:read` / `service:wardrobe:write`). The existing personal wardrobe is additionally bound to one owner. The native configuration route derives that owner from the authenticated session; renderer input cannot select another owner. Owner and storage binding persist in PostgreSQL, so a restart cannot silently reassign an existing wardrobe.

The wardrobe transport keeps platform session tokens, database URLs and migration credentials out of the renderer. IPC accepts only the listed operations and fixes the service, app and version. The launcher authorizes only the registered Dress'Ed main frame. A prior app bundle lacking the wardrobe declaration is rejected before startup, preventing a new host from starting an old catalogue writer.

## Adopting existing data

The protected `PUT /api/timsys/v1/apps/dressed/wardrobe/configuration` endpoint requires both an administrator session and the process-private native bootstrap token. Native startup supplies the same runtime database URL, administrator migration URL and private-storage root already used by Dress'Ed. Runtime and migration URLs must identify the same local database.

The service refuses a target without the existing `dressed.garments` table and migration ledger. It does not silently initialize a replacement empty wardrobe. New-install initialization is a separate explicit setup workflow. Existing migration hashes are verified before applying missing migrations. With the current ten-file schema, only `0010_timsys_commands.sql` is added, containing service identity, command receipts and a file-cleanup outbox. No existing UUID, record, category, migration name/hash, image path or file is rewritten by adoption.

Changing the data target while configured, or changing the persisted owner/storage binding after restart, fails closed. Such a relocation requires a separately reviewed migration. In particular, the earlier Trade'Ed source naming change has not migrated installed bundle IDs or persistent-directory identities: that installation prerequisite still applies. Select the actual existing database and storage root; never substitute an empty dataset.

## Atomic commands and recovery

Commands require a stable `X-TimSys-Idempotency-Key`. The host admits command effects only for trusted handlers implementing the atomic-command protocol. Input normalization preserves the existing domain rules, including trimmed fields, uppercase currency and material/season/use checks. The previous strict-schema intersection that rejected valid versioned updates was replaced with a safe extension preserving those rules.

The PostgreSQL transaction holds the command receipt and all garment/collection/history changes together. Concurrent identical keys serialize; a replay returns the committed response, including its original UUID/version. Reusing a key for different normalized input returns 409. Optimistic conflicts, invalid references, invalid output and cancelled pre-commit requests roll back without leaving a receipt or partial garment. The complete normalized response is validated before commit. Receipt responses remain private domain data in the existing PostgreSQL store; generic platform call history retains hashes and status rather than raw wardrobe content.

The renderer retains uncertain command keys in session storage using a content hash, without storing source input in that retry map. A definitive validation failure releases the key; network uncertainty retains it for the same retry. This covers refresh/retry in the same app session, not arbitrary reconstruction of a user's intent after every client reset.

Garment deletion preserves the original dependent-record semantics and explicit confirmation. Private-file deletion uses a durable outbox committed with the domain deletion. Cleanup is constrained to the UUID directory under the configured images root and retries on replay/configuration. Adoption itself never deletes or moves files. PostgreSQL statement deadlines, host/client deadlines and cooperative cancellation bound requests. Idle PostgreSQL connection errors are handled and redacted so they cannot terminate the shared TimSyS host.

## Verification

Evidence is in `../../`, beside this isolated source directory.

- Full platform regression: 138 suites, 615 tests passed. The final connection-error handling adjustment also passed focused host tests and a fault-isolation/redaction check.
- Remaining Dress'Ed regression: 11 files, 36 tests passed; strict TypeScript checking passed.
- Shared client/native bridge: six checks passed, including uncertain retries and old-bundle refusal.
- Real PostgreSQL pipeline: adoption preserved an existing UUID/version and private-file marker; duplicate/concurrent commands, invalid input/references, optimistic conflicts, owner/app permissions, archive/deletion and persistent owner binding passed.
- Actual Dress renderer: displayed the existing garment and created a new one through the shared adapter, scoped test native transport, versioned HTTP and PostgreSQL. The former catalogue endpoint returned 410. The test used a fresh browser profile, no page errors and only the fixture origin; Electron IPC transport was injected for the browser test.
- The disposable PostgreSQL server was restarted, then a different Node host replayed a committed command without creating a new garment. Existing version 7 and receipt state survived. This was graceful recovery, not a forced-crash/power-loss test.
- Source migration hashes, ownership audit and review-patch checks passed. The synthetic database was stopped; its evidence/data were retained.

No external provider calls, installed-bundle rollout, production-volume certification or live data cutover were performed. Full Windows packaging was not run; source staging now includes the TimSyS service, PostgreSQL dependency and app contract declarations, with corresponding source-verification paths.

## Cutover and rollback prerequisites

Before any separately authorized installation, back up the actual PostgreSQL database and private storage, resolve installed identity/path mappings, and install a compatible launcher/platform/app set. Stop the previous catalogue server before enabling its replacement. Verify existing UUIDs, counts, representative records, images and migration hashes against the backup, then exercise a reversible synthetic record through the UI.

Rollback stops the new catalogue writer before restoring the prior compatible application set. Keep committed wardrobe data and the additive receipt/identity/outbox tables; do not reset the database or overwrite accepted writes with a stale backup. A restore, owner transfer, storage relocation or new empty setup requires its own explicit procedure and authorization.
