# ResearchEd app-only releases

On 2026-10-10, release 2026.10.10.7 advertised historical platform and launcher
bundles from the public baseline. The installed shared AI assistant had newer
local bundles. The updater correctly rejected the platform replacement because
it omitted the assistant integration.

ResearchEd packaging now emits only the ResearchEd bundle. The updater merges
that entry into its installed state, preserving all other app and shared bundle
entries. This is an app update, not a full installation or a mechanism to bring
unrelated apps up to date. Shared releases need their own integrated validation.

Installation verification now checks the exact release manifest; it must not
filter out other advertised bundles. It seeds existing platform, launcher,
DressEd and MemeCoinEd entries and verifies that each survives unchanged.
RESEARCHED_VERIFY_UPDATER_MODULE optionally selects the AI-aware updater for
compatibility testing without modifying the installed application.

Release 2026.10.10.8 reuses the previously tested ResearchEd 0.8.1 archive and
SHA-256 from 2026.10.10.7. Only release metadata and the advertised bundle scope
change. No research data, instrument or application code changes are needed.
