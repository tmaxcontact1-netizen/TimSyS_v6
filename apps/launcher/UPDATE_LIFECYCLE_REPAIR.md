# Launcher update lifecycle repair — 2026-10-18

ResearchEd and DressEd bundle-only updates restart only the affected running apps. The platform, database and other apps stay running. Stopped apps remain stopped until opened. A health/migration failure restores the previous runtime and reports recovery failures. Shared-runtime updates still require launcher restart but do not run an unconditional full database dump. Backups belong to explicit maintenance and migration-specific policy, not every binary update.

The native repair archive was derived from the installed launcher, preserving its shared AI integration. Only electron/main.cjs and electron/update-manager.cjs changed; electron/app-update-runtime.cjs was added. The supplied script verifies both archive hashes, requires the launcher to be closed, preserves the original app.asar and makes an atomic replacement. It refuses a different launcher build rather than replacing unknown integration changes.

This is a one-time native launcher repair, not a ResearchEd bundle or a full replacement installer. It has already been applied locally. It is published separately and is not made the latest in-app release; ResearchEd 0.9.2 remains the app update. Do not manually replace application data or databases.

Verification: 36 launcher tests passed, plus a real-process selective-update test proving the other app PID and HTTP heartbeat survive. JSX syntax checks passed. No real corpus analysis or validation sample was run. TradeEd validation remained on PID 17104 with a healthy heartbeat and zero watchdog failures through recovery.
