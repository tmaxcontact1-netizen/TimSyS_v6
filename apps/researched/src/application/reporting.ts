import { contentHash } from "@timsys/app-sdk";

export interface ReportConfiguration {
  readonly title: string;
  readonly includeMethodology: boolean;
  readonly includeCorpus: boolean;
  readonly includeEvidenceTable: boolean;
}

export function assembleReport(
  configuration: ReportConfiguration,
  data: {
    study: unknown;
    corpus: unknown[];
    findings: unknown[];
    evidence: unknown[];
  },
  generatedAt: string,
) {
  const payload = {
    schema: "researched.report.v1",
    title: configuration.title,
    generatedAt,
    study: data.study,
    methodology: configuration.includeMethodology ? data.study : null,
    corpus: configuration.includeCorpus ? data.corpus : [],
    findings: data.findings,
    evidence: configuration.includeEvidenceTable ? data.evidence : [],
  };
  return { payload, hash: contentHash(JSON.stringify(payload)) };
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderReportHtml(report: any) {
  const payload = report.report_payload;
  const findings = (payload.findings ?? [])
    .map(
      (
        finding: any,
      ) => `<article><h3>${escapeHtml(finding.title)}</h3><p>${escapeHtml(finding.conclusion)}</p>
      <p><strong>Confidence:</strong> ${escapeHtml(finding.confidence)}</p>
      ${finding.limitations ? `<p><strong>Limitations:</strong> ${escapeHtml(finding.limitations)}</p>` : ""}
      <ol>${(finding.evidence ?? []).map((item: any) => `<li>${escapeHtml(item.interpretation)} <cite>${escapeHtml(item.sourceLabel)}, snapshot ${escapeHtml(item.snapshotSequence)}, section ${escapeHtml(item.segmentOrdinal)}</cite></li>`).join("")}</ol></article>`,
    )
    .join("");
  const corpus = (payload.corpus ?? [])
    .map(
      (source: any) =>
        `<tr><td>${escapeHtml(source.label)}</td><td><a href="${escapeHtml(source.original_url)}">${escapeHtml(source.original_url)}</a></td><td>${escapeHtml(source.authority)}</td><td>${escapeHtml(source.corpus_status)}</td></tr>`,
    )
    .join("");
  const evidence = (payload.evidence ?? [])
    .map(
      (item: any) =>
        `<tr><td>${escapeHtml(item.evidence_type)}</td><td>${escapeHtml(item.interpretation)}</td><td>${escapeHtml(item.source_label)}</td><td>${escapeHtml(item.snapshot_sequence)} §${escapeHtml(item.segment_ordinal)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(payload.title)}</title><style>body{font:16px/1.55 system-ui;max-width:1000px;margin:40px auto;padding:0 24px;color:#17212b}h1,h2{border-bottom:1px solid #ccd5dc;padding-bottom:8px}article{break-inside:avoid;margin:24px 0}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ccd5dc;padding:8px;text-align:left;vertical-align:top}cite{display:block;color:#52616d;font-size:13px}@media print{a{color:inherit}.no-print{display:none}}</style></head><body>
  <h1>${escapeHtml(payload.title)}</h1><p>Generated ${escapeHtml(payload.generatedAt)}</p>
  <h2>Research question</h2><p>${escapeHtml(payload.study?.research_question)}</p>
  ${payload.methodology ? `<h2>Methodology</h2><p>${escapeHtml(payload.study?.methodology || "Not specified")}</p><h3>Inclusion rules</h3><pre>${escapeHtml(JSON.stringify(payload.study?.inclusion_rules ?? [], null, 2))}</pre><h3>Exclusion rules</h3><pre>${escapeHtml(JSON.stringify(payload.study?.exclusion_rules ?? [], null, 2))}</pre>` : ""}
  <h2>Findings</h2>${findings || "<p>No findings selected.</p>"}
  ${payload.corpus?.length ? `<h2>Corpus appendix</h2><table><thead><tr><th>Source</th><th>URL</th><th>Authority</th><th>Status</th></tr></thead><tbody>${corpus}</tbody></table>` : ""}
  ${payload.evidence?.length ? `<h2>Evidence appendix</h2><table><thead><tr><th>Type</th><th>Interpretation</th><th>Source</th><th>Location</th></tr></thead><tbody>${evidence}</tbody></table>` : ""}
  <footer><hr><small>Report fingerprint: ${escapeHtml(report.content_hash)}</small></footer></body></html>`;
}
