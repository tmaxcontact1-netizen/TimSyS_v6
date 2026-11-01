# Dress'Ed photography in TimSyS

This isolated source change moves the photography repositories, profile validation, image quality checks, original-file handling and classical fingerprint processing into `platform/services/photography`. Dress'Ed consumes `photography@1.0.0` through its declared, main-frame-scoped native bridge. Shared fingerprint types live in the contract package. App photography endpoints return HTTP 410; originals are no longer served by the app.

## Data continuity

Use the existing protected wardrobe configuration: the same PostgreSQL database, owner and absolute storage root. Historical migrations 0000–0009 are retained unchanged. Additive migration 0011 creates an upload journal; it does not rewrite image metadata, calibration profiles, original paths, image IDs or image bytes. Existing current/superseded image records remain readable. Retiring a used profile marks it inactive and retains its patches and historical references.

Do not create an empty replacement database, copy originals to a new path, re-encode originals or alter a historical migration. Back up the existing database and image root together before a future authorized cutover. This change has not been deployed and has not migrated live data.

## Versioned contract

JSON operations under `/api/timsys/v1/apps/dressed/services/photography/contracts/1.0.0/operations/` cover profile listing/creation/retirement, image listing/readiness, upload begin/commit/abort and fingerprint generation/read/decisions. Every command requires a durable idempotency key and stores its result atomically with the domain change. The schema is returned by the normal service-host contract route.

Binary companions at that versioned root are `PUT uploads/:uploadId/content` and authenticated `GET`/`HEAD images/:imageId/content`. Both require the app scope, operation permission and existing bound owner. The renderer receives bytes through its native bridge and creates/revokes Blob URLs; it receives no bearer token or database credential. Transfers are bounded to 25,000,000 bytes. The TimSyS host owns sharp; Dress'Ed has no image-processing dependency or file reader.

## Recovery

An upload begins with expected size, SHA-256 and metadata in PostgreSQL. A stable upload/image ID identifies its staging file. TimSyS fsyncs uploaded bytes and links them without overwriting originals. Commit validates the image/card, publishes the original and commits metadata and receipt in one database transaction. An interruption after publication but before commit retains the staged bytes and immutable target, allowing the same command to recover. A lost response replays the committed result. Abort removes only files for an uncommitted session; it never deletes an image row's original.

There are at most ten open uploads and 250 MB of declared pending content per owner. Open sessions do not expire automatically; resolve an uncertain upload with the same command key or explicitly abort it. Native retries retain keys in renderer session storage; recovery after losing that browser session can use the durable upload ID via the contract. A failed processing transaction is rolled back before retry. Processing is serialized using a PostgreSQL advisory lock and has bounded request/statement deadlines.

## Remaining backend work

Dress'Ed's styling, ensemble, planning, lifecycle/care, insights, remaining PostgreSQL access and CV scaffolding still require separate TimSyS migrations. The coupled fingerprint engine moved with photography because it directly consumes private originals. The native IPC/window authorization remains in Electron. This milestone does not complete the all-backend-services architecture.

## Isolation and validation

Implementation and verification are confined to `verification-local/photography-service-20261031`. Test PostgreSQL, SQLite, originals, logs and browser profiles are separate synthetic fixtures. The network guard rejects external and pre-existing service connections, including Trade'Ed ports 18860/18861, and blocks subprocesses except the exact dedicated headless browser command. Live Trade'Ed worker/watchdog, scheduler, sealed runtime and data paths are observed read-only. See the evidence README and machine-readable results alongside this source snapshot.
