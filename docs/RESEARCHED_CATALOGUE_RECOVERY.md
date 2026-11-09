# Research’Ed 0.10.16 — archived catalogue recovery

Content analysis opens the resolved HTTP redirect URL in its isolated browser and waits for temporary browser-check responses to finish. It retains final response status, navigation history, original source URL and interim HTTP URL/status. An unresolved browser check is an access failure, never course evidence. Supporting links use the resolved root host so a provider-hosted archive can supply its course pages; unrelated hosts still require approval. Catalogue section labels are excluded from unit titles.

The wait is opt-in for Content analysis. No MCF, questionnaire, AI integration, database, launcher or TradeEd changes. Saved analyses and links are unchanged. No CAPTCHA solving or authentication automation.

Verification: 23 focused tests and TypeScript build passed. The supplied CSULB URL redirects to csulb.catalog.acalog.com and returns HTTP 202 before its browser check completes. The corrected isolated renderer captured HTTP 200 and the title “Educational Leadership, P-12 Specialization, Ed.D.”. Genuine missing pages remain failures. A bounded readiness wait preserves cancellation.

Install 0.10.16 and preview the saved link again. Historical failed previews are not silently rewritten.

A repeat live check encountered an unresolved provider browser check. Content capture retries this specific failure once (two isolated browser attempts maximum), retains attempt count on success, and reports access failure if both fail. It does not retry real 404s through this mechanism.
