# TimSyS in-app updates

Launcher 1.0.11 separates the stable Electron/PostgreSQL installation from replaceable application bundles. The packaged resources remain a recovery baseline. Verified updates are stored beneath Electron's user-data directory and never overwrite user databases, photographs, configuration, or credentials.

## Create a release

1. Run the full platform verification and stage the Windows runtime.
2. Build the Launcher UI.
3. Run `npm run update:bundle -- 2026.09.1` from the repository root. To publish a cumulative subset relative to the 1.0.10 installer baseline, add—for example—`--only=principaled,memecoined,dressed,researched`.
4. Create a GitHub Release whose tag is exactly `2026.09.1`.
5. Upload every file from `dist-updates`, including `timsys-update.json`, as release assets.

The manifest contains the exact byte size and SHA-256 digest of every archive. The Launcher downloads from the repository's latest release, verifies both values before extraction, validates the required runtime files, and only then changes its active-bundle record.

Every latest-release manifest must remain cumulative for users who skip releases: once a bundle has changed relative to the 1.0.11 installer baseline, continue including its current version in later manifests. Content fingerprints prevent users who already have that version from downloading it again.

## Recovery behaviour

The installed resources are always usable as a fallback. Bundle activation is recorded transactionally. If the updated TimSyS platform cannot start after relaunch, the Launcher restores the previous bundle selection and relaunches automatically. Application data is outside all bundle directories and is not part of an update.

## When a full installer remains necessary

A new installer is required only for changes to Electron, the embedded Node or PostgreSQL runtime, the updater itself, or another native installation-level dependency. Ordinary frontend, backend, contract, migration, and application-dependency changes use in-app bundles.
