# App window titles — 2026.11.07.3

Native app windows retain their application names instead of inheriting the shared HTML title. Principal'Ed, Builder, Dress'Ed, Research'Ed, Trade'Ed inspection and AI integration use the same title guard. The launcher follows its current workspace and restores its launcher title when returning to application selection.

The cancellable `page-title-updated` handler belongs to BrowserWindow. Reload and in-page navigation refresh the native title. This corrects the previous WebContents listener without changing page content, navigation, authentication, AI configuration, service supervision or data paths.

Acceptance: all 80 native tests passed. Real Electron 43.2 windows retained each app title after document-title changes and reloads. The installed dashboard and AI connection were checked, and database record hashes, original files/images and configuration bindings matched before/after installation. Q35 worker/watchdog processes, protected listeners and running validation tasks remained absent.

The platform archive is identical to the locally installed title fix. All 9,369 other platform files and all four frontend selections are retained. The cumulative update manifest retains the published consistent UI bundles. No database migration, full user-data backup, reboot or live-validation activation is included.
