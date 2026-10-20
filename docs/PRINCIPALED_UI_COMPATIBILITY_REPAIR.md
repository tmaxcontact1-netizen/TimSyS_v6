# Principal'Ed interface compatibility repair

The 2026.10.20.2 platform bundle installed successfully, but the installed native updater correctly held the launcher UI because that build omitted `assistant.html` and the existing assistant UI. The earlier verification used an older updater implementation from the release checkout and did not catch this.

The corrected source includes the existing assistant panel, account/API settings, AI Integration entry, assistant-only page styling and current held-update handling. It generates the dedicated assistant entry during every production build. Nervous Breakdown still renders only its empty state; the retired model remains removed.

The packaging command now extracts and runs the **installed native updater's** compatibility validator before packaging. It does not change that validator, native launcher files, credentials, backend, active database or deferred-update state.

Verification:

- Production UI build passed.
- Browser checks against installed platform code used a disposable database and mocked AI responses: desktop settings bridge invocation, account/API settings, assistant conversation interface, and empty Nervous Breakdown all passed with zero page errors.
- The installed updater rejects a bundle missing the assistant and accepts the rebuilt UI.
- No real provider request or account change was made.

The repair is published as a new UI bundle, so the previous version's deferral does not suppress it. The current platform and Research'Ed manifest entries are preserved. Publication alone does not install or restart the running application.
