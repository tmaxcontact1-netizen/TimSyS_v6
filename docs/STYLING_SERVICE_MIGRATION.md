# Dress'Ed styling in TimSyS

The isolated source now hosts `styling@1.0.0` in `platform/services/styling`. Dress'Ed calls its declared versioned contract through an authorized main-frame native bridge. The app contains no styling repository, authoritative scoring engine, ensemble generator or outfit-creation transaction. Its old `/api/styling/*` and `/api/ensembles/*` endpoints return HTTP 410.

## Scope and compatibility

Styling catalogue and evaluation moved with their directly coupled ensemble catalogue, generation, saving and combination overrides. Those operations previously invoked the same styling engine in the app; keeping them there would retain a second implementation of the rules. The deterministic engine and rule parameters are preserved. Original-engine comparison verifies the same scores, grades, explanations and ensemble results for the seeded existing data, including existing preferences.

The service adopts the existing wardrobe database, owner and storage binding. No SQL migration is added or altered. All twelve historical migrations retain their hashes. Existing rule sets, parameters, contexts/configuration, evaluations, fingerprint references, saved outfits/items, calculated grades, manual grades, favourites, notes and overrides are retained. Photography paths and original bytes are untouched. Context configuration remains server-side data; the public context projection exposes the fields the renderer uses.

## Contract

The normal service-host route exposes the pinned schema. Operations under `/api/timsys/v1/apps/dressed/services/styling/contracts/1.0.0/operations/` are:

- `catalogue`: active rule-set identity/thresholds and contexts.
- `evaluate`: persist one evaluation with its fingerprint references and rule outcomes.
- `ensemble_catalogue`: paged eligible garments and retained saved outfits, plus contexts.
- `ensemble_generate`: read-only deterministic generation, using current fingerprints and preferences.
- `ensemble_save`: atomically persist an evaluation, saved outfit and items.
- `ensemble_override`: persist a ban or favourite combination preference.

Every command requires a durable idempotency key. The existing TimSyS command-receipt table stores its normalized input hash and result in the same PostgreSQL transaction as domain writes. Conflicting reuse is rejected. Uncertain responses retain renderer session keys for retry. Duplicate delivery and host restart replay the original evaluation/outfit ID without creating another record. A failed response validation rolls back the evaluation, outfit/items and receipt together. References and duplicate garment IDs are checked before committing.

All reads within an invocation share a repeatable-read transaction, keeping rule sets, garments and fingerprints consistent for that evaluation. Serialization conflicts and deadlocks retry at most twice after releasing the failed transaction; remaining conflicts return HTTP 409. The statement deadline is seven seconds and the service deadline is 25 seconds; cancellation is checked before commit. PostgreSQL serialization failures never leave a partial evaluation.

Inputs are bounded to 32 KiB, responses to 1 MiB, selections to 20 unique garments and generation to 50 outfits per grade. Catalogue pages contain at most 200 eligible garments and 200 saved outfits; the renderer gathers pages and obtains use definitions from `wardrobe@1.0.0`. The inherited generator keeps its existing 5,000 eligible-candidate query cap, beam search and slot-handling behavior. This migration does not claim exhaustive outfit search or change those domain algorithms.

Authentication, app scope, styling read/write permissions and the existing bound owner are required. IPC fixes the service ID/version and allows only declared operations from Dress'Ed's registered main frame. Database credentials and service bearer tokens stay native. Startup rejects an app bundle missing the complete styling declaration.

## Verification and cutover

Implementation and verification are confined to `verification-local/styling-service-20261031`. PostgreSQL, SQLite, image markers, browser profiles and logs are synthetic and separate. Network guards exclude external/pre-existing services and Trade'Ed ports; the only permitted child is the exact dedicated headless browser command. Live Trade'Ed worker/watchdog and sealed files are observed read-only.

The evidence README records regression, original-engine comparisons, atomic rollback, idempotency, concurrency/restart, preservation and actual renderer checks. This change has not been deployed or applied to live Dress'Ed data. A future authorized cutover should back up the existing database and image root together, retain the existing binding, deploy compatible platform/app bundles together, then run packaged Electron acceptance.

Planner/rotation, lifecycle/care, insights/preferences, existing saved-outfit edits, remaining app database access, CV scaffolding and native backend lifecycle duties remain separate migration work. This is not completion of the all-services-in-TimSyS requirement.
