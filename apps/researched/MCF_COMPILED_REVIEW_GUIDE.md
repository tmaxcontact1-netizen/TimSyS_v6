# Legacy compiled-review DOCX import

The canonical hierarchy is **Corpus → Individual Review → Analysis Units**. Institution is optional, versioned review metadata with `confirmed`, `proposed` and `unassigned` states. An unassigned institution never prevents review creation or analysis. No machine classification or external transmission is involved.

## Researcher workflow

1. Open **MCF Analysis → Corpus**, enter your researcher name and open the appropriate dataset.
2. For an existing DOCX import, choose **Review individual texts** beside the preserved original. Re-uploading is unnecessary, including for an existing one-record mapping. For a new upload, choose **Find individual reviews**.
3. Inspect each candidate's source blocks and extracted metadata. A high-confidence boundary means the structural signals agree; it is not a researcher decision or a classification score. You can explicitly accept the remaining high-confidence boundaries with the displayed metadata/component selections. Unheaded candidates require individual confirmation.
4. Use **Split review candidate** at a source block boundary or **Join next candidate** when required. These are explicit researcher actions. Every source block must still belong to exactly one review. Record the reason in the candidate notes. Changes invalidate that candidate's confirmation.
5. Set institution metadata to confirmed, proposed/unconfirmed or unassigned. Leave missing metadata unassigned; do not guess. Original heading names, numbers, periods, campus and editorial notes remain available as source metadata. A heading name is not automatically an author, and a period is not a publication date.
6. Select which components enter analysis for each review. The default is **narrative only**. Questionnaire responses, heading metadata and editorial notes can be explicitly included; they remain distinguishable in provenance. `Comments:` is always a structural marker, not research narrative.
7. Confirm all candidates, enter a reason for the mapping version, then choose **Save prepared reviews**. Review confirmation does not imply institution confirmation.
8. Inspect sentence units within individual reviews. Create a new manual coding or validation session when ready. It uses the latest confirmed mapping of each import. Existing sessions and decisions retain their original mapping and unit versions.

To revise institution assignments or component selections later, open a new mapping version. The preview carries forward the latest structural mapping's selections when its extraction hash matches. Confirm the revised mapping and create a new session; coding is never automatically transferred. Historical records are accessible through **Show earlier and archived preparation**. Preview edits are in memory until confirmation; closing the preview or reloading discards unsaved changes.

## Profile and provenance

`analysis-config/compiled-review/1.0.json` defines the legacy questionnaire profile separately from MCF. The profile uses repeated questionnaire labels, an immediately following `Comments:` paragraph and an optional numbered heading. It supports the explicit parent-review/empty-table variant. There is no filename, school-name dictionary, expected candidate count or duplicate-text merge rule.

The original bytes and previous raw extraction stay unchanged. Structural extraction reads the preserved original after checking its SHA-256. Each confirmed mapping stores the profile/version, extraction hash, original body/block locations, paragraph text, questionnaire rows/cells, candidate boundaries and warnings, researcher selections, institution states, actor, reason and previous mapping ID.

Each derived review gets a new UUID independent of its source review number. Missing source numbers stay null in metadata; a generated source-block locator is retained in technical provenance; the ordinary interface shows a review number within the prepared source. Narrative and other selected components are joined with two LF characters, with component-to-analysis UTF-16 offsets recorded. This derived analysis text does not replace the full raw extraction. Record inspection exposes all source components, including exclusions.

U+FFFD replacement characters are flagged and retained. This check is not proof that a document is free of every possible encoding or transcription error. Unsupported DOCX structures are warned about; this profile is for the recognised questionnaire layout, not a universal DOCX review detector. Sentence units remain researcher-reviewable.

## Storage and API

- Migration `0018_mcf_structural_mappings.sql` adds mapping `version` and `previous_id`, replacing the one-mapping-per-import constraint with a unique `(import_id, version)` constraint. Existing append-only triggers remain in force. No source records, units, coding decisions or instrument data are rewritten.
- `GET /api/mcf/imports/:id/structural-preview` derives candidates locally without database writes.
- Existing `POST /api/mcf/imports/:id/map` accepts a validated `structural` configuration. A matching preview hash, current previous-mapping ID, complete source-block partition and explicit candidate confirmations are required. The transaction locks the import to reject concurrent/stale versions.
- New sessions select only the newest mapping per import, avoiding double-counting the old whole-document record. Historical sessions continue to use their pinned record/unit IDs.

## Verification

Run the existing Research'Ed unit tests and build, `scripts/verify-mcf-manual.mjs` and `scripts/verify-content-pipeline.mjs`. These use synthetic fixtures and disposable databases. Compiled-review tests cover headed/unheaded records, repeated/reset numbering, multi-paragraph comments and lists, parent reviews, editorial notes, replacement characters, optional/proposed/confirmed institutions, campus metadata, ambiguous school mentions, duplicate wording, selected components and complete boundary coverage.

For a local read-only check of a real corpus, after building:

```text
node scripts/inspect-compiled-docx.mjs "path/to/source.docx" "path/to/report.json"
```

This reports candidates and an in-memory narrative-only segmentation without creating researcher decisions or changing a database. The supplied School Reviews corpus produced 242 candidates: 199 headed/high-confidence and 43 unheaded/review-required. All institution assignments remained unassigned. No source text or actual corpus file is included in repository fixtures.

Boundary and metadata confirmation remain researcher responsibilities. Stage 4, reliability thresholds and domain/institution aggregation remain unimplemented.
