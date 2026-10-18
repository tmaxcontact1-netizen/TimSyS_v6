# Research’Ed 0.9.3 — mixed review boundaries

Processed 18 October 2026 (GMT+3).

The versioned Director questionnaire profile 1.1 also recognises the distinct Principal questionnaire signature. Mixed documents split at each recognised questionnaire. Principal prompts and questionnaire rows remain separate from narrative. Missing optional overall ratings are retained as missing metadata, not treated as ambiguous boundaries. MCF v1.0 is unchanged.

The cleaning screen opens the first unchecked review. Confirming a review or accepting clear boundaries advances to an unchecked review, with a direct “Next review needing attention” button and scroll reset. Previously saved unmapped candidates are split at newly recognised questionnaire boundaries; unchanged checks and source selections are preserved. This does not rewrite existing mappings, analysis units or runs.

Verification: 190 tests across 33 suites; TypeScript and Vite build; isolated browser/database six-step workflow regression (including direct navigation assertions). Original Director DOCX inspected in memory: 77 candidates, 77 structurally high-confidence boundaries, zero ambiguous boundaries. The newly separated narratives belong to distinct Director and Principal questionnaire records. Source hash bbc32eeccb1b1a50238cba2305c70590bd562f1615b770b81ecef5bef93be65c. No corpus import, semantic run or validation sample was created. Nonstandard embedded document content still carries its original-document inspection warning.

Release scope: Research’Ed only. No platform, AI integration, launcher, updater, shared database or Trade’Ed changes. Trade’Ed worker PID 17104 and watchdog PID 10888 were independently verified, outside launcher ancestry, with current heartbeat, ongoing durable log writes and zero watchdog failures. Publication does not install or restart the running apps.

After installing, upload the Director document (the previous draft had been removed), open Clean, and choose “Accept the clearly identified review breaks”. Any genuinely ambiguous future candidates will be selected automatically. “Show the extracted text” prepares records only; analysis remains a separate action.
