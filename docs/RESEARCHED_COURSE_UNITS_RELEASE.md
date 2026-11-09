# Research’Ed 0.10.15 — course unit extraction

New Content analysis work collects published unit/module titles, codes where supplied, and overviews. Curriculum links, official academic sibling catalogues and linked documents are followed within bounded limits. AI is not called for this mode. Missing descriptions, inaccessible pages and dead links remain visible; nothing is invented. Source URLs, sections, locators and evidence IDs remain in JSON. HTML and PDF use the same unit layout; CSV has one row per extracted unit.

Existing general-analysis plans and accreditation behavior remain available unchanged. MCF coding, saved findings, ratings, AI integration and other apps are unchanged. No database migration.

Verification (9 November 2026):
- 12 focused extraction, intake, navigation, failure and export tests passed.
- ResearchEd TypeScript backend build and Vite production frontend build passed.
- Repository GUI-practice and backend-ownership checks passed.
- Actual Loyola MEd requirements page: 10 published course titles recovered; section headings excluded and subtitle punctuation preserved. This page contains titles, not descriptions; missing overviews are reported as missing.
- JSON serialization, course CSV and HTML/PDF input share tested extracted titles and overviews; unrelated marketing text is excluded from course output.
- Local source intake: 63 course-link occurrences, 59 canonical unique URLs; 16 accreditation-section occurrences excluded. Original document unchanged. Source hash and all occurrences retained privately.
- A new saved work item was created without starting a run. All 13 saved MCF run/output snapshots matched before and after insertion.

Limitations: deterministic extraction cannot guarantee coverage of every provider layout. Access-controlled catalogues, unpublished descriptions, ambiguous structure and crawl limits are reported rather than interpreted. The original source labels are not verified institution identities. Third-party directory links are retained as supplied; their external provider links require review.

Use My work → Course units and overviews — supplied provider links → check links → Continue → Preview one link → inspect the draft → process all selected links → Confirm → HTML/PDF/JSON/CSV downloads. You may remove links or findings and use the existing undo controls. Delete retains the existing permanent-delete behavior.
