import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ActionFeedbackHost } from "../../../shared-ui/react/index.js";
import "./styles.css";
import "./status.css";
const API = "/api";
async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  if (!response.ok) {
    let body = {};
    try {
      body = await response.json();
    } catch {}
    throw new Error(body.error ?? `Request failed (${response.status})`);
  }
  return response.json();
}
const niceError = (value) =>
  ({
    upload_a_word_or_pdf_document: "Upload a Word (.docx) or PDF document.",
    request_too_large: "The document is too large to upload.",
    browser_renderer_unavailable:
      "No supported browser is available for webpage capture.",
    source_http_error: "The university webpage refused the capture request.",
  })[value] ?? String(value).replaceAll("_", " ");
const list = (value) => (Array.isArray(value) ? value : []);
const statusLabel = (value) =>
  ({
    queued: "Waiting",
    running: "Capturing",
    succeeded: "Complete",
    failed: "Needs attention",
    cancelled: "Cancelled",
  })[value] ?? "Not started";
const time = (value) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

function App() {
  const [workflows, setWorkflows] = useState([]),
    [workflow, setWorkflow] = useState(null),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState(null),
    fileRef = useRef(null);
  const refreshList = async () =>
    setWorkflows((await request("/programme-workflows")).items);
  const refresh = async (id = workflow?.id) => {
    if (id) setWorkflow(await request(`/programme-workflows/${id}`));
  };
  useEffect(() => {
    refreshList().catch((error) =>
      setNotice({ tone: "bad", text: niceError(error.message) }),
    );
  }, []);
  useEffect(() => {
    if (
      !workflow?.candidates?.some((item) =>
        ["queued", "running"].includes(item.capture_status),
      )
    )
      return;
    const timer = setInterval(() => refresh(workflow.id).catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [workflow?.id, workflow?.candidates]);
  const counts = useMemo(() => {
    const candidates = workflow?.candidates ?? [],
      records = workflow?.records ?? [];
    return {
      included: candidates.filter((x) => x.decision === "included").length,
      complete: records.length,
      queued: candidates.filter((x) => x.capture_status === "queued").length,
      running: candidates.filter((x) => x.capture_status === "running").length,
      failed: candidates.filter((x) => x.capture_status === "failed").length,
      cancelled: candidates.filter((x) => x.capture_status === "cancelled")
        .length,
      finished: candidates.filter((x) =>
        ["succeeded", "failed", "cancelled"].includes(x.capture_status),
      ).length,
      lastActivity: candidates
        .map((x) => x.job_updated_at)
        .filter(Boolean)
        .sort()
        .at(-1),
    };
  }, [workflow]);
  const runningIsStalled =
    counts.running > 0 &&
    counts.lastActivity &&
    Date.now() - new Date(counts.lastActivity).getTime() > 3 * 60 * 1000;
  const state = runningIsStalled
    ? {
        key: "attention",
        title: "Processing appears stalled",
        detail:
          "No page-capture activity has been recorded for more than three minutes. You can cancel this run and retry a smaller selection.",
      }
    : counts.running > 0
      ? {
          key: "running",
          title: "Actively processing",
          detail: `Capturing ${counts.running} page${counts.running === 1 ? "" : "s"}; ${counts.queued} waiting.`,
        }
      : counts.queued > 0
        ? {
            key: "waiting",
            title: "Waiting to process",
            detail: `${counts.queued} page${counts.queued === 1 ? " is" : "s are"} queued.`,
          }
        : counts.failed > 0
          ? {
              key: "attention",
              title: "Idle — attention required",
              detail: `${counts.failed} page${counts.failed === 1 ? " needs" : "s need"} another attempt.`,
            }
          : counts.cancelled > 0 && counts.complete < counts.included
            ? {
                key: "cancelled",
                title: "Cancelled",
                detail:
                  "No more pages are being processed. Completed results have been kept.",
              }
            : counts.included > 0 && counts.complete >= counts.included
              ? {
                  key: "complete",
                  title: "Complete",
                  detail: "Every included programme has a saved result.",
                }
              : {
                  key: "idle",
                  title: "Idle",
                  detail: "No pages are currently being processed.",
                };
  const act = async (label, fn, success) => {
    setBusy(label);
    setNotice(null);
    try {
      await fn();
      setNotice({ tone: "good", text: success });
    } catch (error) {
      setNotice({ tone: "bad", text: niceError(error.message) });
    } finally {
      setBusy("");
    }
  };
  const create = () =>
    act(
      "create",
      async () => {
        const created = await request("/programme-workflows", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        await refreshList();
        await refresh(created.id);
      },
      "New analysis ready. Add the document that contains the programme links.",
    );
  const upload = (file) =>
    act(
      "upload",
      async () => {
        const result = await request(
          `/programme-workflows/${workflow.id}/document?filename=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            headers: {
              "content-type": file.type || "application/octet-stream",
            },
            body: file,
          },
        );
        setWorkflow(result);
        await refreshList();
      },
      "Document read. Review the programme links before capture starts.",
    );
  const decide = (candidate, decision) =>
    act(
      `candidate-${candidate.id}`,
      async () => {
        await request(`/programme-candidates/${candidate.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        await refresh();
      },
      decision === "included"
        ? "Programme included."
        : "Programme excluded from this analysis.",
    );
  const start = () =>
    act(
      "start",
      async () => {
        await request(`/programme-workflows/${workflow.id}/start`, {
          method: "POST",
        });
        await refresh();
      },
      "Capture started. Research’Ed is opening each page and reading its programme information.",
    );
  const cancel = () =>
    act(
      "cancel",
      async () => {
        await request(`/programme-workflows/${workflow.id}/cancel`, {
          method: "POST",
        });
        await refresh();
      },
      "Analysis cancelled. Completed programme results have been kept.",
    );
  const openExport = (format) =>
    window.open(
      `${API}/programme-workflows/${workflow.id}/export?format=${format}`,
      "_blank",
    );
  const stage = !workflow
    ? 0
    : !workflow.candidates?.length
      ? 1
      : counts.complete === 0 && !counts.queued && !counts.running
        ? 2
        : counts.queued || counts.running
          ? 3
          : 4;
  return (
    <div className="app-shell">
      <header>
        <div>
          <span className="eyebrow">Research’Ed</span>
          <h1>University programme analysis</h1>
          <p>
            Turn a document of university links into a clear, comparable account
            of what each programme contains.
          </p>
        </div>
        <div className="header-actions">
          <span className="local-badge">Runs locally</span>
          <button
            className="ghost"
            onClick={() =>
              window.electronAPI?.returnToLauncher?.() ?? window.close()
            }
          >
            Return to launcher
          </button>
        </div>
      </header>
      <nav className="steps">
        {["Add document", "Review links", "Capture pages", "Read results"].map(
          (label, index) => (
            <div
              className={
                stage > index
                  ? "step done"
                  : stage === index
                    ? "step current"
                    : "step"
              }
              key={label}
            >
              <span>{stage > index ? "✓" : index + 1}</span>
              {label}
            </div>
          ),
        )}
      </nav>
      {notice && (
        <div className={`notice ${notice.tone}`} role="status">
          <span>{notice.tone === "good" ? "✓" : "!"}</span>
          {notice.text}
        </div>
      )}
      {!workflow ? (
        <main className="start-layout">
          <section className="hero-card">
            <div className="hero-icon">↗</div>
            <h2>Start with the source document</h2>
            <p>
              Research’Ed will ignore material outside the university programme
              list, extract the programme links, let you check them, open each
              webpage—including expandable sections—and organise the results.
            </p>
            <button
              className="primary large"
              disabled={busy !== ""}
              onClick={create}
            >
              {busy === "create" ? "Preparing…" : "Start a new analysis"}
            </button>
          </section>
          {workflows.length > 0 && (
            <section className="recent">
              <h2>Continue an analysis</h2>
              {workflows.map((item) => (
                <button
                  className="recent-row"
                  key={item.id}
                  onClick={() => refresh(item.id)}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.candidate_count} links · {item.completed_count}{" "}
                      results
                    </small>
                  </span>
                  <b>Open →</b>
                </button>
              ))}
            </section>
          )}
        </main>
      ) : (
        <main>
          <div className="workbar">
            <button className="back-link" onClick={() => setWorkflow(null)}>
              ← All analyses
            </button>
            <div>
              <strong>{workflow.title}</strong>
              <span>
                {counts.complete} saved results from {counts.included} included
                programmes
              </span>
            </div>
            <div className={`run-state ${state.key}`}>
              <i />
              <span>
                <strong>{state.title}</strong>
                <small>
                  {state.detail} Last activity: {time(counts.lastActivity)}
                </small>
              </span>
            </div>
          </div>
          {stage === 1 && (
            <section className="panel upload-panel">
              <span className="panel-number">1</span>
              <h2>Add the document containing the programme links</h2>
              <p>
                Use the original Word or PDF file. Research’Ed will retain it as
                evidence but only promote programme-page links into this
                workflow.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.pdf"
                hidden
                onChange={(event) =>
                  event.target.files?.[0] && upload(event.target.files[0])
                }
              />
              <button
                className="primary large"
                disabled={busy !== ""}
                onClick={() => fileRef.current?.click()}
              >
                {busy === "upload"
                  ? "Reading document…"
                  : "Choose Word or PDF document"}
              </button>
              <p className="hint">
                Accreditation links, notes and unrelated text will not be queued
                as university programmes.
              </p>
            </section>
          )}
          {stage >= 2 && (
            <>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <span className="panel-number">2</span>
                    <h2>Check the programme links</h2>
                    <p>
                      {counts.included} included ·{" "}
                      {(workflow.candidates?.length ?? 0) - counts.included}{" "}
                      excluded
                    </p>
                  </div>
                  {!counts.queued && !counts.running && (
                    <button
                      className="primary"
                      disabled={busy !== "" || counts.included === 0}
                      onClick={start}
                    >
                      {busy === "start"
                        ? "Starting…"
                        : counts.complete
                          ? "Capture unfinished pages"
                          : `Capture ${counts.included} programme pages`}
                    </button>
                  )}
                </div>
                <div className="candidate-list">
                  {workflow.candidates.map((candidate) => (
                    <article
                      className={`candidate ${candidate.decision}`}
                      key={candidate.id}
                    >
                      <button
                        className={`toggle ${candidate.decision}`}
                        disabled={
                          busy !== "" ||
                          ["queued", "running", "succeeded"].includes(
                            candidate.capture_status,
                          )
                        }
                        onClick={() =>
                          decide(
                            candidate,
                            candidate.decision === "included"
                              ? "excluded"
                              : "included",
                          )
                        }
                      >
                        <span />
                      </button>
                      <div className="candidate-main">
                        <div>
                          <strong>{candidate.institution}</strong>
                          <span className="level">
                            {candidate.qualification_level}
                          </span>
                        </div>
                        <p>{candidate.programme_name}</p>
                        <a
                          href={candidate.canonical_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {candidate.canonical_url}
                        </a>
                        {candidate.last_error && (
                          <small className="job-error">
                            {niceError(candidate.last_error)}
                          </small>
                        )}
                      </div>
                      <span
                        className={`capture-status ${candidate.capture_status ?? "new"}`}
                      >
                        {statusLabel(candidate.capture_status)}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
              {(counts.queued > 0 ||
                counts.running > 0 ||
                counts.finished > 0) && (
                <section className="panel progress-panel">
                  <div className="section-heading">
                    <div>
                      <span className="panel-number">3</span>
                      <h2>Page capture</h2>
                      <p>
                        {state.title}. {counts.complete} results saved ·{" "}
                        {counts.running} processing · {counts.queued} waiting ·{" "}
                        {counts.failed} failed · {counts.cancelled} cancelled.
                      </p>
                    </div>
                    <div className="capture-actions">
                      <strong>
                        {counts.finished}/{counts.included} processed
                      </strong>
                      {(counts.queued > 0 || counts.running > 0) && (
                        <button
                          className="danger"
                          disabled={busy !== ""}
                          onClick={cancel}
                        >
                          {busy === "cancel"
                            ? "Cancelling…"
                            : "Cancel analysis"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="progress">
                    <span
                      style={{
                        width: `${counts.included ? Math.round((counts.finished / counts.included) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </section>
              )}
              {workflow.records.length > 0 && (
                <section className="panel results-panel">
                  <div className="section-heading">
                    <div>
                      <span className="panel-number">4</span>
                      <h2>Programme contents</h2>
                      <p>
                        {workflow.records.length} saved programme result
                        {workflow.records.length === 1 ? "" : "s"}. Missing
                        information is shown as missing—not guessed.
                      </p>
                    </div>
                    <div className="export">
                      <button
                        className="ghost"
                        onClick={() => openExport("csv")}
                      >
                        Export CSV
                      </button>
                      <button
                        className="ghost"
                        onClick={() => openExport("json")}
                      >
                        Export evidence
                      </button>
                    </div>
                  </div>
                  <div className="record-grid">
                    {workflow.records.map((record) => (
                      <article className="record" key={record.id}>
                        <div className="record-title">
                          <div>
                            <span>{record.institution}</span>
                            <h3>{record.programme_name}</h3>
                          </div>
                          <b>
                            {Math.round(Number(record.confidence) * 100)}%
                            coverage
                          </b>
                        </div>
                        <p className="summary">{record.summary}</p>
                        <dl>
                          <div>
                            <dt>Award</dt>
                            <dd>{record.award ?? "Not stated"}</dd>
                          </div>
                          <div>
                            <dt>Study format</dt>
                            <dd>
                              {list(record.delivery_modes).join(", ") ||
                                "Not stated"}
                            </dd>
                          </div>
                          <div>
                            <dt>Duration</dt>
                            <dd>{record.duration ?? "Not stated"}</dd>
                          </div>
                          <div>
                            <dt>Credits</dt>
                            <dd>{record.credit_requirement ?? "Not stated"}</dd>
                          </div>
                        </dl>
                        <Details
                          title="Curriculum and course structure"
                          items={record.curriculum}
                        />
                        <Details
                          title="Admissions"
                          items={record.admission_requirements}
                        />
                        <Details
                          title="Professional outcomes"
                          items={record.professional_outcomes}
                        />
                        {list(record.warnings).map((item) => (
                          <p className="record-warning" key={item}>
                            {item}
                          </p>
                        ))}
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      )}
    </div>
  );
}
function Details({ title, items }) {
  const values = list(items);
  return (
    <details>
      <summary>
        {title}
        <span>{values.length}</span>
      </summary>
      {values.length ? (
        <ul>
          {values.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="missing">Not found on the captured page.</p>
      )}
    </details>
  );
}
createRoot(document.getElementById("root")).render(
  <>
    <ActionFeedbackHost />
    <App />
  </>,
);
