import React, { useEffect, useState } from "react";
import * as api from "../../api/client";
import Pagination from "../components/Pagination";
const message = (e) => e?.response?.data?.error?.message || e.message;
const human = (v) =>
  String(v || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
const saveFile = (name, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
const safeName = (value) =>
  String(value || "assessment-report")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const exportReport = (report, format) => {
  const name = safeName(report.assessment.title);
  if (format === "json")
    return saveFile(
      `${name}.json`,
      JSON.stringify(report, null, 2),
      "application/json",
    );
  const rows = [
    ["Item", "Status", "Primary construct", "Assessment demand", "Evidence behaviour", "Standards", "Professional review"],
    ...report.qualitative.item_findings.map((item) => [
      item.item_key,
      human(item.status),
      item.primary_construct,
      item.assessment_demand,
      item.evidence_behaviour,
      item.standards.map((x) => `${x.framework}: ${x.code || "Unmapped"}`).join("; "),
      item.professional_review?.rationale || "",
    ]),
  ];
  saveFile(
    `${name}.csv`,
    rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
};
const Distribution = ({ title, rows = [], total = 0 }) => (
  <article className="cover-chart">
    <h3>{title}</h3>
    {rows.map((row) => (
      <div className="cover-bar" key={row.label}>
        <span>{human(row.label)}</span>
        <strong>{row.count}</strong>
        <i><b style={{ width: `${Math.max(3, row.percentage)}%` }} /></i>
        <small>{row.percentage}% of {total} items</small>
      </div>
    ))}
  </article>
);
const Field = ({ label, area = false, ...props }) => (
  <label className="field">
    <span>{label}</span>
    {area ? <textarea {...props} /> : <input {...props} />}
  </label>
);
export default function AssessmentEvaluatorWidget() {
  const [audits, setAudits] = useState([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(null),
    [insights, setInsights] = useState({}),
    [aiStatus, setAiStatus] = useState({ configured: false }),
    [frameworks, setFrameworks] = useState([]),
    [repositories, setRepositories] = useState([]),
    [showStandards, setShowStandards] = useState(false),
    [form, setForm] = useState({
      source_type: "document",
      workflow_mode: "teacher",
      framework_ids: [],
    }),
    [file, setFile] = useState(null),
    [item, setItem] = useState({ answer_choices: "" }),
    [review, setReview] = useState(null),
    [intent, setIntent] = useState({ intent_text: "", standard_codes: "" }),
    [report, setReport] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    try {
      const [a, i, f, all, ai] = await Promise.all([
        api.listAssessmentAudits({ page, limit: 50 }),
        api.getAssessmentEvaluatorInsights(),
        api.listRepositoryFrameworks({ status: "active" }),
        api.listRepositoryFrameworks(),
        api.getAiGatewayStatus(),
      ]);
      setAudits(a.data.audits || []);
      setTotal(a.data.total || 0);
      setInsights(i.data.summary || {});
      setFrameworks(f.data.frameworks || []);
      setRepositories(all.data.frameworks || []);
      setAiStatus(ai.data || { configured: false });
      setError("");
    } catch (e) {
      setError(message(e));
    }
  };
  useEffect(() => {
    load();
  }, [page]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const open = async (id) => {
    setBusy(true);
    try {
      setSelected((await api.getAssessmentAudit(id)).data.audit);
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const refresh = () => selected && open(selected.id);
  const create = (e) => {
    e.preventDefault();
    run(async () => {
      if (form.workflow_mode === "teacher" && !file)
        throw new Error("Choose the question paper to begin");
      const r = await api.createAssessmentAudit({
          ...form,
          framework_ids: form.framework_ids.map(Number),
        }),
        a = r.data.audit;
      if (file) {
        if (file.size > 10 * 1024 * 1024)
          throw new Error("The file exceeds the 10 MiB limit");
        const d = await api.createDocument({
          title: file.name,
          category: "assessment_question_paper",
          description: `Question paper for ${a.title}`,
        });
        await api.addDocumentVersion(d.data.document.id, {
          filename: file.name,
          mime_type: file.type || "application/octet-stream",
          content_base64: await readFile(file),
        });
        const source = await api.addAssessmentSource(a.id, {
          document_id: d.data.document.id,
          filename: file.name,
          mime_type: file.type || "application/octet-stream",
          source_role: "question_paper",
        });
        await api.extractAssessmentSource(source.data.source.id, { ocr: true });
      }
      setForm({
        source_type: "document",
        workflow_mode: "teacher",
        framework_ids: [],
      });
      setFile(null);
      setNotice(
        "Assessment created. Possible questions are ready for your review.",
      );
      setSelected((await api.getAssessmentAudit(a.id)).data.audit);
    });
  };
  const add = (e) => {
    e.preventDefault();
    run(async () => {
      await api.addAssessmentAuditItem(selected.id, {
        ...item,
        answer_choices: item.answer_choices
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        visible_scaffolding: item.visible_scaffolding
          ? item.visible_scaffolding
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
      });
      setItem({ answer_choices: "" });
      setNotice("Assessment item added.");
      await refresh();
    });
  };
  const act = (fn, id) =>
    run(async () => {
      await fn(id);
      setNotice("Action completed.");
      await refresh();
    });
  return (
    <div className="gradebook-screen">
      <header className="workspace-hero">
        <div>
          <span className="eyebrow">
            Independent audit · construct before standard
          </span>
          <h1>Assessment Evaluator</h1>
          <p>
            Upload a question paper to see what students are actually being
            asked to know and do. Standards and declared intent are compared
            only after the first analysis is locked.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowStandards(!showStandards)}>
            {showStandards ? "Close standards setup" : "Standards setup"}
          </button>
          <button disabled={busy} onClick={load}>Refresh</button>
        </div>
      </header>
      {error && (
        <div className="workspace-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="workspace-success" role="status">
          {notice}
        </div>
      )}
      <div className="scheduler-summary">
        <Summary title="Items" value={insights.total} />
        <Summary title="Awaiting analysis" value={insights.pending} />
        <Summary title="Human review" value={insights.review_required} />
        <Summary title="Unmapped" value={insights.unmapped} />
      </div>
      {showStandards && (
        <StandardsSetup
          repositories={repositories}
          run={run}
          reload={load}
          setNotice={setNotice}
        />
      )}
      {!selected ? (
        <>
          <div className="split-workspace">
            <form className="form-card" onSubmit={create}>
              <h3>Evaluate an assessment</h3>
              <label className="field">
                <span>Who is this for?</span>
                <select
                  value={form.workflow_mode}
                  onChange={(e) =>
                    setForm({ ...form, workflow_mode: e.target.value })
                  }
                >
                  <option value="teacher">Teacher — question paper only</option>
                  <option value="coordinator">
                    Curriculum lead — detailed comparison
                  </option>
                </select>
              </label>
              <Field
                label="Assessment name"
                required
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <label className="field">
                <span>
                  Question paper{" "}
                  {form.workflow_mode === "teacher"
                    ? "(required)"
                    : "(optional for setup)"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  required={form.workflow_mode === "teacher"}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <Field
                label="Subject (optional — the evaluator will infer it)"
                value={form.subject || ""}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
              <Field
                label="Grade or age band (optional)"
                value={form.grade_band || ""}
                onChange={(e) =>
                  setForm({ ...form, grade_band: e.target.value })
                }
              />
              <fieldset className="field">
                <legend>Standards to compare</legend>
                {frameworks.length ? (
                  frameworks.map((x) => (
                    <label key={x.id}>
                      <input
                        type="checkbox"
                        checked={form.framework_ids.includes(x.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            framework_ids: e.target.checked
                              ? [...form.framework_ids, x.id]
                              : form.framework_ids.filter((id) => id !== x.id),
                          })
                        }
                      />{" "}
                      {x.name} · {x.version_label}
                    </label>
                  ))
                ) : (
                  <small>
                    No verified standards repositories are active yet. You can
                    create the assessment and add frameworks later.
                  </small>
                )}
              </fieldset>
              <button className="primary" disabled={busy}>
                Create assessment
              </button>
            </form>
            <section className="callout">
              <strong>What happens first?</strong>
              <p>
                The evaluator reads only what the student sees. It identifies
                the demand, construct, evidence, scaffolding and independence
                before it is allowed to compare standards or your declared
                intent.
              </p>
            </section>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  {[
                    "#",
                    "Assessment",
                    "Context",
                    "Items",
                    "Review",
                    "Status",
                    "",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map((a, i) => (
                  <tr key={a.id}>
                    <td>{(page - 1) * 50 + i + 1}</td>
                    <td>
                      <strong>{a.title}</strong>
                      <small>{human(a.workflow_mode || a.source_type)}</small>
                    </td>
                    <td>
                      {[a.subject, a.grade_band].filter(Boolean).join(" · ") ||
                        "To be inferred"}
                    </td>
                    <td>{a.item_count}</td>
                    <td>{a.review_count}</td>
                    <td>
                      <span className="status-pill">{human(a.status)}</span>
                    </td>
                    <td>
                      <button onClick={() => open(a.id)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!audits.length && (
              <p className="empty-state">
                No assessments yet. Upload a question paper to begin.
              </p>
            )}
          </div>
          <Pagination
            page={page}
            pageSize={50}
            total={total}
            onPageChange={setPage}
          />
        </>
      ) : (
        <>
          <section className="workspace-heading">
            <div>
              <button className="back-link" onClick={() => setSelected(null)}>
                ← All assessments
              </button>
              <h2>{selected.title}</h2>
              <p>
                {selected.items.length} items · {selected.sources?.length || 0}{" "}
                source files · {selected.frameworks?.length || 0} standards
                frameworks
              </p>
            </div>
            <div className="header-actions">
              <button
                className="primary"
                disabled={
                  busy || !selected.items.some((x) => !x.analysis_locked_at)
                }
                onClick={() => act(api.analyseAssessmentAudit, selected.id)}
              >
                Analyse unclassified items
              </button>
              <button
                disabled={
                  busy ||
                  !selected.items.length ||
                  selected.items.some((x) => !x.alignments.length)
                }
                onClick={() =>
                  run(async () => {
                    const r = await api.generateAssessmentReport(selected.id);
                    setReport(r.data.report);
                    setNotice("Report generated.");
                  })
                }
              >
                Generate report
              </button>
            </div>
          </section>
          <div className="split-workspace">
            <form className="form-card" onSubmit={add}>
              <h3>Add or correct an extracted item</h3>
              <p>
                Enter only information visible to the student. Images, charts
                and equations detected in uploaded files are retained as visual
                evidence. Describe their meaning here whenever the original
                relationship needs clarification.
              </p>
              <Field
                label="Item ID"
                required
                value={item.item_key || ""}
                onChange={(e) => setItem({ ...item, item_key: e.target.value })}
              />
              <Field
                label="Stimulus, passage or visual description"
                area
                value={item.stimulus || ""}
                onChange={(e) => setItem({ ...item, stimulus: e.target.value })}
              />
              <Field
                label="Question or task"
                area
                required
                value={item.task || ""}
                onChange={(e) => setItem({ ...item, task: e.target.value })}
              />
              <Field
                label="Answer choices — one per line"
                area
                value={item.answer_choices || ""}
                onChange={(e) =>
                  setItem({ ...item, answer_choices: e.target.value })
                }
              />
              <Field
                label="Response format"
                value={item.response_format || ""}
                onChange={(e) =>
                  setItem({ ...item, response_format: e.target.value })
                }
              />
              <Field
                label="Visible support — comma separated"
                value={item.visible_scaffolding || ""}
                onChange={(e) =>
                  setItem({ ...item, visible_scaffolding: e.target.value })
                }
              />
              <Field
                label="Other information shown to the student"
                area
                value={item.supporting_information || ""}
                onChange={(e) =>
                  setItem({ ...item, supporting_information: e.target.value })
                }
              />
              <button className="primary" disabled={busy}>
                Add item
              </button>
            </form>
            <section>
              <CandidateReview
                selected={selected}
                run={run}
                refresh={refresh}
                setNotice={setNotice}
                setItem={setItem}
                item={item}
              />
              <div className="record-list">
                {selected.items.map((x, i) => (
                  <article
                    key={x.id}
                    className={
                      [
                        "ambiguous",
                        "human_review",
                        "insufficient_information",
                        "unmapped",
                      ].includes(x.analysis_status)
                        ? "row-alert"
                        : ""
                    }
                  >
                    <span>
                      <strong>
                        {i + 1}. {x.item_key} · {human(x.analysis_status)}
                      </strong>
                      <small>{x.task}</small>
                    </span>
                    <div className="header-actions">
                      {!x.analysis_locked_at && (
                        <button
                          onClick={() =>
                            act(api.analyseAssessmentAuditItem, x.id)
                          }
                        >
                          Analyse demand
                        </button>
                      )}
                      {x.analysis_locked_at && !x.alignments.length && (
                        <button
                          onClick={() => act(api.mapAssessmentAuditItem, x.id)}
                        >
                          Compare standards
                        </button>
                      )}
                      {x.analysis_locked_at && (
                        <button
                          onClick={() =>
                            setReview({
                              item: x,
                              decision: "confirm",
                              rationale: "",
                              primary_construct:
                                x.interpretations?.[0]?.interpretation
                                  ?.suggested_primary_construct ||
                                x.primary_construct ||
                                "",
                              interpretation_id: x.interpretations?.[0]?.id,
                              accept_interpretation: Boolean(
                                x.interpretations?.[0],
                              ),
                            })
                          }
                        >
                          Review
                        </button>
                      )}
                      {x.analysis_locked_at &&
                        ["ambiguous", "human_review", "insufficient_information"].includes(
                          x.analysis_status,
                        ) && (
                          <button
                            disabled={busy || !aiStatus.configured}
                            onClick={() =>
                              run(async () => {
                                const response = await api.interpretAssessmentAuditItem(x.id);
                                setNotice(response.data.message);
                                await refresh();
                              })
                            }
                          >
                            {aiStatus.configured
                              ? "Ask AI to interpret"
                              : "AI provider not configured"}
                          </button>
                        )}
                    </div>
                    {x.analysis_locked_at && (
                      <div className="callout">
                        <strong>
                          Primary construct:{" "}
                          {x.primary_construct || human(x.analysis_status)}
                        </strong>
                        <p>
                          <b>Demand:</b>{" "}
                          {x.assessment_demand || x.analysis_rationale}
                        </p>
                        <p>
                          <b>Evidence:</b>{" "}
                          {x.evidence_behaviour ||
                            "Requires professional interpretation."}
                        </p>
                        <p>
                          <b>Support:</b>{" "}
                          {x.scaffolding_analysis || "Not classified."}
                        </p>
                        <p>
                          <b>Independence and depth:</b>{" "}
                          {x.independence_depth || "Not classified."}
                        </p>
                        {x.alignments.map((a) => (
                          <p key={a.id}>
                            <b>{a.framework_name || "Likely alignment"}:</b>{" "}
                            {a.standard_code
                              ? `${a.standard_code} — ${a.standard_title}`
                              : "No defensible mapping"}{" "}
                            · {human(a.status)}
                            <br />
                            {a.rationale}
                          </p>
                        ))}
                        {!!x.interpretations?.length && (
                          <div className="callout row-alert">
                            <strong>AI suggestion — professional review required</strong>
                            <p>
                              <b>Possible construct:</b>{" "}
                              {x.interpretations[0].interpretation.suggested_primary_construct || "Uncertain"}
                            </p>
                            <p>
                              <b>Interpretation:</b>{" "}
                              {x.interpretations[0].interpretation.assessment_demand || "No claim made."}
                            </p>
                            <p>
                              Confidence {Math.round(x.interpretations[0].confidence * 100)}% ·{" "}
                              {human(x.interpretations[0].provider)} · {x.interpretations[0].model}
                            </p>
                            {!!x.interpretations[0].limitations?.length && (
                              <p><b>Limits:</b> {x.interpretations[0].limitations.join("; ")}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
          {selected.items.length > 0 &&
            selected.items.every(
              (x) => x.analysis_locked_at && x.alignments.length > 0,
            ) && (
              <form
                className="form-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await api.setAssessmentIntent(selected.id, {
                      intent_text: intent.intent_text,
                      standard_codes: intent.standard_codes
                        .split(",")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    });
                    setNotice(
                      "Declared intent saved and unlocked for comparison.",
                    );
                    await refresh();
                  });
                }}
              >
                <h3>Compare with intended learning (optional)</h3>
                <p>
                  This appears only after blind analysis and standards mapping
                  are locked.
                </p>
                <Field
                  label="What did you intend students to demonstrate?"
                  area
                  value={intent.intent_text}
                  onChange={(e) =>
                    setIntent({ ...intent, intent_text: e.target.value })
                  }
                />
                <Field
                  label="Intended standard codes — comma separated"
                  value={intent.standard_codes}
                  onChange={(e) =>
                    setIntent({ ...intent, standard_codes: e.target.value })
                  }
                />
                <button className="primary">Compare with my intent</button>
              </form>
            )}
          {report && (
            <section className="cover-analytics">
              <div className="cover-analytics-head">
                <div>
                  <span className="eyebrow">Evidence-led assessment audit</span>
                  <h2>{report.assessment.title}</h2>
                  <p>Automated findings remain advisory until professionally reviewed.</p>
                </div>
                <div className="header-actions">
                  <button onClick={() => exportReport(report, "csv")}>Download spreadsheet</button>
                  <button onClick={() => exportReport(report, "json")}>Download full data</button>
                </div>
              </div>
              <div className="scheduler-summary">
                <Summary title="Items analysed" value={report.quantitative.item_count} />
                <Summary title="Need review" value={report.qualitative.review_queue.length} />
                <Summary title="Professionally reviewed" value={report.quantitative.professionally_reviewed_items} />
                <Summary title="Items with visuals" value={report.quantitative.visual_items} />
                <Summary title="AI-assisted items" value={report.quantitative.ai_interpreted_items} />
              </div>
              <p>
                {report.quantitative.scaffolded_items} items contain identified support or scaffolding.
              </p>
              <div className="cover-chart-grid">
                <Distribution title="Confidence and review status" rows={report.quantitative.status_distribution} total={report.quantitative.item_count} />
                <Distribution title="What the assessment asks students to do" rows={report.quantitative.construct_distribution} total={report.quantitative.item_count} />
              </div>
              <div className="cover-chart-grid">
                {Object.entries(report.quantitative.frameworks).map(([name, data]) => (
                  <article className="cover-chart" key={name}>
                    <h3>{name}</h3>
                    <p>{data.mapped} mapped · {data.unmapped} not defensibly mapped</p>
                    {Object.entries(data.standards).map(([code, count]) => (
                      <div className="cover-bar" key={code}>
                        <span>{code}</span><strong>{count}</strong>
                        <i><b style={{ width: `${Math.max(3, (count / report.quantitative.item_count) * 100)}%` }} /></i>
                        <small>{Math.round((count / report.quantitative.item_count) * 100)}% of assessment items</small>
                      </div>
                    ))}
                  </article>
                ))}
              </div>
              {report.intent && (
                <div className="callout">
                  <strong>Declared intent compared with observed evidence</strong>
                  <p>{report.intent.match_rate == null ? "No standard codes were declared." : `${Math.round(report.intent.match_rate * 100)}% of declared codes were evidenced.`}</p>
                  {!!report.intent.declared_but_not_evidenced.length && <p><b>Declared but not evidenced:</b> {report.intent.declared_but_not_evidenced.join(", ")}</p>}
                  {!!report.intent.evidenced_but_not_declared.length && <p><b>Evidenced but not declared:</b> {report.intent.evidenced_but_not_declared.join(", ")}</p>}
                </div>
              )}
              {!!report.qualitative.recommendations.length && (
                <div className="cover-alerts">
                  {report.qualitative.recommendations.map((x, i) => (
                    <article key={i} className={x.priority === "high" ? "cover-alert-critical" : ""}>
                      <strong>{x.finding}</strong><p>{x.action}</p>
                    </article>
                  ))}
                </div>
              )}
              <div className="record-list">
                {report.qualitative.item_findings.map((item) => (
                  <article key={item.item_key}>
                    <span><strong>{item.item_key}. {human(item.status)}</strong><small>{item.task}</small></span>
                    <div><b>{item.primary_construct || "Not classified"}</b><br /><small>{item.assessment_demand || item.rationale}</small></div>
                  </article>
                ))}
              </div>
              <p className="cover-interpretation">{report.method.ai_used ? report.method.ai_scope : "This report used deterministic rules, ontology mapping and professional review; AI was not used."}</p>
            </section>
          )}
          {review && (
            <form
              className="decision-panel"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api.reviewAssessmentAuditItem(review.item.id, {
                    decision: review.decision,
                    primary_construct: review.primary_construct,
                    rationale: review.rationale,
                    interpretation_id: review.interpretation_id,
                    accept_interpretation: review.accept_interpretation,
                  });
                  setReview(null);
                  setNotice("Professional review saved.");
                  await refresh();
                });
              }}
            >
              <div>
                <strong>Record professional judgement</strong>
                <p>
                  {review.item.item_key}. Automated recommendations remain
                  advisory.
                </p>
              </div>
              <label className="field">
                <span>Decision</span>
                <select
                  value={review.decision}
                  onChange={(e) =>
                    setReview({ ...review, decision: e.target.value })
                  }
                >
                  {["confirm", "revise", "unmapped", "human_review"].map(
                    (x) => (
                      <option key={x} value={x}>
                        {human(x)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <Field
                label="Primary construct correction (optional)"
                value={review.primary_construct || ""}
                onChange={(e) =>
                  setReview({ ...review, primary_construct: e.target.value })
                }
              />
              {review.interpretation_id && (
                <label className="field">
                  <span>AI suggestion</span>
                  <select
                    value={review.accept_interpretation ? "accept" : "reject"}
                    onChange={(e) => setReview({ ...review, accept_interpretation: e.target.value === "accept" })}
                  >
                    <option value="accept">Use it as supporting evidence</option>
                    <option value="reject">Reject it</option>
                  </select>
                </label>
              )}
              <Field
                label="Why are you making this decision?"
                required
                value={review.rationale}
                onChange={(e) =>
                  setReview({ ...review, rationale: e.target.value })
                }
              />
              <button className="primary">Save review</button>
              <button type="button" onClick={() => setReview(null)}>
                Cancel
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
function parseStandardsFile(text, filename) {
  if (filename.toLowerCase().endsWith(".json")) {
    const value = JSON.parse(text);
    const rows = Array.isArray(value) ? value : value.standards;
    if (!Array.isArray(rows)) throw new Error("The JSON file must contain an array of standards");
    return rows;
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The CSV file contains no standards rows");
  const cells = (line) => {
    const result = [];
    let value = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { result.push(value.trim()); value = ""; }
      else value += char;
    }
    result.push(value.trim());
    return result;
  };
  const headers = cells(lines[0]).map((x) => x.toLowerCase().replaceAll(" ", "_"));
  return lines.slice(1).map((line) => Object.fromEntries(cells(line).map((value, index) => [headers[index], value])));
}

function StandardsSetup({ repositories, run, reload, setNotice }) {
  const [form, setForm] = useState({ jurisdiction: "United States", subject: "ELA" });
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [correction, setCorrection] = useState(null);
  const open = async (id) => setSelected((await api.getRepositoryFramework(id)).data.framework);
  const refresh = async () => { await reload(); if (selected) await open(selected.id); };
  return (
    <section className="form-card">
      <div className="workspace-heading">
        <div><h2>Standards repository setup</h2><p>Only source-checked, verified versions become available to assessments.</p></div>
      </div>
      <div className="split-workspace">
        <form onSubmit={(event) => { event.preventDefault(); run(async () => {
          const response = await api.createRepositoryFramework(form);
          setNotice("Draft standards framework created. Import the source-checked statements next.");
          setForm({ jurisdiction: "United States", subject: "ELA" });
          await reload(); await open(response.data.framework.id);
        }); }}>
          <h3>Create a versioned framework</h3>
          <Field label="Standards body" required value={form.publisher || ""} onChange={(e) => setForm({ ...form, publisher: e.target.value })} />
          <Field label="Framework code" required value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Field label="Framework name" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="Subject" required value={form.subject || ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Field label="Grade or age band" value={form.grade_band || ""} onChange={(e) => setForm({ ...form, grade_band: e.target.value })} />
          <Field label="Version or publication year" required value={form.version_label || ""} onChange={(e) => setForm({ ...form, version_label: e.target.value })} />
          <Field label="Source filename or publication reference" required value={form.source_filename || ""} onChange={(e) => setForm({ ...form, source_filename: e.target.value })} />
          <button className="primary">Create draft</button>
        </form>
        <div>
          <h3>Repository versions</h3>
          <div className="record-list">
            {repositories.map((repository) => (
              <article key={repository.id} className={repository.issue_count ? "row-alert" : ""}>
                <span><strong>{repository.name} · {repository.version_label}</strong><small>{human(repository.status)} · {repository.statement_count} statements · {repository.issue_count} open issues</small></span>
                <button onClick={() => open(repository.id)}>Manage</button>
              </article>
            ))}
            {!repositories.length && <p>No standards frameworks have been added.</p>}
          </div>
        </div>
      </div>
      {selected && (
        <div className="callout">
          <div className="workspace-heading"><div><h3>{selected.name} · {selected.version_label}</h3><p>{selected.source_filename || "No source reference recorded"}</p></div><button onClick={() => setSelected(null)}>Close</button></div>
          {selected.status === "draft" && (
            <>
              <label className="field"><span>Upload the standards PDF (recommended), CSV or JSON</span><input type="file" accept=".pdf,.csv,.json,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
              <button disabled={!file} onClick={() => run(async () => {
                let response;
                if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
                  if (file.size > 20 * 1024 * 1024) throw new Error("The standards PDF exceeds the 20 MiB limit");
                  const document = await api.createDocument({ title: file.name, category: "standards_source", description: `Authoritative source for ${selected.name}` });
                  await api.addDocumentVersion(document.data.document.id, { filename: file.name, mime_type: "application/pdf", content_base64: await readFile(file) });
                  response = await api.importRepositorySourceDocument(selected.id, document.data.document.id);
                  setNotice(response.data.message);
                } else {
                  const statements = parseStandardsFile(await file.text(), file.name);
                  response = await api.importRepositoryStatements(selected.id, statements);
                  setNotice(`${response.data.imported} standards imported. Any incomplete rows remain visible as issues.`);
                }
                setFile(null); await refresh();
              })}>Extract and review standards</button>
            </>
          )}
          {!!selected.issues?.length && <div className="cover-alerts">{selected.issues.map((issue) => <article key={issue.id} className={issue.severity === "error" ? "cover-alert-critical" : ""}><strong>{human(issue.issue_code)}</strong><p>{issue.message}</p><button onClick={() => run(async () => { await api.resolveRepositoryIssue(issue.id, { accepted: true, resolution: "Reviewed against the named source and accepted by the repository administrator." }); setNotice("Import issue reviewed and recorded."); await refresh(); })}>Accept with recorded review</button></article>)}</div>}
          {!!selected.statements?.length && (
            <div className="cover-chart">
              <h3>Extracted standards — compare with the source</h3>
              <div className="record-list">
                {selected.statements.map((statement, index) => (
                  <article key={statement.id} className={statement.verification_status === "flagged" ? "row-alert" : ""}>
                    <span>
                      <strong>{index + 1}. {statement.code} · {human(statement.verification_status)}</strong>
                      <small>{statement.statement}</small>
                      <small>Source page {statement.source_page || "not detected"}</small>
                    </span>
                    {selected.status === "draft" && (
                      <div className="header-actions">
                        <button onClick={() => run(async () => { await api.verifyRepositoryStatement(statement.id, true); setNotice(`${statement.code} verified against the source.`); await refresh(); })}>Verify</button>
                        <button onClick={() => { setCorrection({ ...statement, change_reason: "" }); }}>Correct</button>
                        <button onClick={() => run(async () => { await api.verifyRepositoryStatement(statement.id, false); setNotice(`${statement.code} flagged for correction.`); await refresh(); })}>Flag</button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
          {!!selected.statements?.length && selected.status === "draft" && (
            <div className="header-actions">
              <button onClick={() => run(async () => { await api.verifyAllRepositoryStatements(selected.id, { confirmation: "I reviewed every statement against the named source", source_reference: selected.source_filename }); setNotice("Source review recorded and statements verified."); await refresh(); })}>Confirm source review for all statements</button>
              <button className="primary" onClick={() => run(async () => { await api.verifyRepositoryFramework(selected.id); setNotice("Framework activated. Building its searchable ontology…"); await api.buildStandardsOntology(selected.id); setNotice("Framework verified, activated and ready for assessment comparison."); await refresh(); })}>Activate verified framework</button>
            </div>
          )}
          {correction && (
            <form className="decision-panel" onSubmit={(event) => { event.preventDefault(); run(async () => { await api.updateRepositoryStatement(correction.id, correction); setCorrection(null); setNotice("Standards correction saved with revision history."); await refresh(); }); }}>
              <strong>Correct extracted standard</strong>
              <Field label="Standard code" required value={correction.code} onChange={(e) => setCorrection({ ...correction, code: e.target.value })} />
              <Field label="Statement" area required value={correction.statement} onChange={(e) => setCorrection({ ...correction, statement: e.target.value })} />
              <Field label="Why is this correction needed?" area required value={correction.change_reason} onChange={(e) => setCorrection({ ...correction, change_reason: e.target.value })} />
              <button className="primary">Save correction</button>
              <button type="button" onClick={() => setCorrection(null)}>Cancel</button>
            </form>
          )}
          {selected.status === "active" && <p className="workspace-success">This version is active and available to the Assessment Evaluator.</p>}
        </div>
      )}
    </section>
  );
}
function Summary({ title, value }) {
  return (
    <article>
      <strong>{value ?? 0}</strong>
      <span>{title}</span>
    </article>
  );
}

function CandidateReview({ selected, run, refresh, setNotice, setItem, item }) {
  const rows = (selected.sources || [])
    .flatMap((source) => source.candidates || [])
    .filter((candidate) => candidate.status === "pending");
  if (!rows.length) return null;
  return (
    <div className="form-card">
      <h3>Review questions found in the file</h3>
      <p>
        Nothing is added automatically. Check each possible question against the
        original document, then accept, edit or reject it.
      </p>
      <div className="record-list">
        {rows.map((candidate) => (
          <article
            key={candidate.id}
            className={candidate.extraction_confidence < 0.7 ? "row-alert" : ""}
          >
            <span>
              <strong>
                {candidate.item_key} · {Math.round((candidate.extraction_confidence || 0) * 100)}% extraction confidence
              </strong>
              <small>{candidate.task}</small>
              {!!candidate.answer_choices?.length && (
                <small>{candidate.answer_choices.join(" · ")}</small>
              )}
              {!!candidate.media?.length && (
                <small>
                  {candidate.media.length} visual element{candidate.media.length === 1 ? "" : "s"} detected on this page. Check the original because visual meaning is not inferred automatically.
                </small>
              )}
              {(candidate.warnings || []).map((warning, index) => (
                <small key={index}>{warning}</small>
              ))}
            </span>
            <div className="header-actions">
              <button
                className="primary"
                onClick={() =>
                  run(async () => {
                    await api.decideAssessmentCandidate(candidate.id, { decision: "accept" });
                    setNotice("Question accepted and added for analysis.");
                    await refresh();
                  })
                }
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setItem({
                    ...item,
                    item_key: candidate.item_key,
                    task: candidate.task,
                    answer_choices: (candidate.answer_choices || []).join("\n"),
                  });
                  setNotice("Question copied into the correction form. Save the correction, then reject the original candidate.");
                }}
              >
                Edit first
              </button>
              <button
                onClick={() =>
                  run(async () => {
                    await api.decideAssessmentCandidate(candidate.id, { decision: "reject" });
                    setNotice("Extracted candidate rejected. No assessment item was created.");
                    await refresh();
                  })
                }
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
