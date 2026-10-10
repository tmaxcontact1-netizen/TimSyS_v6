import React, { useState } from 'react';
import * as api from '../../api/client';
import useUnsavedChanges from './useUnsavedChanges';

export default function GradeReportReview({ book, student, period, data, refresh, ask }) {
  const [editing, setEditing] = useState(null), [content, setContent] = useState(''), [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [preview, setPreview] = useState(null);
  useUnsavedChanges(editing !== null);
  const run = async (title, work) => {
    if (!await ask?.({ title, message: 'This records your action. Other review and publication steps remain separate.', confirmLabel: 'Confirm' })) return;
    setBusy(true); setError('');
    try { await work(); await refresh(); }
    catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
    finally { setBusy(false); }
  };
  const current = data.results.find(r => String(r.reporting_period_id) === String(period) && ['calculated', 'overridden'].includes(r.status));
  const drafts = data.commentary.filter(r => !period || String(r.reporting_period_id) === String(period));
  const reports = data.reports.filter(r => !period || String(r.reporting_period_id) === String(period));
  return <section className="school-report-review"><h3>Review and release</h3><p>Check the wording, create a report, submit it for review, then publish an approved version.</p>
    {!period && <p role="status">Choose a reporting period above to create a report.</p>}
    {error && <p role="alert">{error}</p>}
    <h4>Commentary</h4>{!drafts.length && <p>No commentary yet. Calculate a result, then generate a commentary draft.</p>}
    {drafts.map(draft => <article key={draft.id}><header><strong>Version {draft.version}</strong><span>{draft.status} · {draft.generated ? 'Generated draft — human review required' : 'Edited by a person'}</span></header><p>{draft.content}</p>
      {editing === draft.id ? <form onSubmit={e => { e.preventDefault(); void run('Save a new commentary version?', async () => { await api.updateAcademicCommentary(draft.id, content); setEditing(null); }); }}><label className="school-field"><span>Commentary wording</span><textarea value={content} required onChange={e => setContent(e.target.value)} /></label><button disabled={busy}>Save new version</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></form> : <div className="school-person-actions"><button disabled={busy} onClick={() => { setEditing(draft.id); setContent(draft.content); }}>Edit wording</button>{draft.status === 'draft' && <button disabled={busy} onClick={() => run('Mark this commentary ready?', () => api.markAcademicCommentaryReady(draft.id))}>Mark ready</button>}{draft.status === 'ready' && period && current && <button disabled={busy} onClick={() => run('Create a draft report from this commentary and current result?', () => api.createGradeReport(book.id, student, { reporting_period_id: Number(period), grade_result_id: current.id, commentary_draft_id: draft.id }))}>Create report draft</button>}</div>}
    </article>)}
    <h4>Reports</h4>{!reports.length && <p>No report versions yet.</p>}
    {reports.map(report => <article key={report.id}><header><strong>Report version {report.version}</strong><span>{report.status}</span></header>{report.decision_reason && <p>Review reason: {report.decision_reason}</p>}<div className="school-person-actions"><button onClick={async () => { try { const response = await api.getGradeReport(report.id); setPreview(response.data.report); } catch (cause) { setError(cause.response?.data?.error?.message || cause.message); } }}>Read saved report</button>{['draft', 'rejected'].includes(report.status) && <button disabled={busy} onClick={() => run('Submit this report for review?', () => api.submitGradeReport(report.id))}>Submit for review</button>}{report.status === 'submitted' && <><button disabled={busy} onClick={() => run('Approve this report?', () => api.decideGradeReport(report.id, { decision: 'approve' }))}>Approve report</button><label className="school-field"><span>Reason if rejecting</span><input value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={busy || !reason.trim()} onClick={() => run('Reject this report?', () => api.decideGradeReport(report.id, { decision: 'reject', reason }))}>Reject report</button></>}{report.status === 'approved' && <button disabled={busy} onClick={() => run('Publish this approved report?', () => api.publishGradeReport(report.id))}>Publish report</button>}</div></article>)}
    {preview && <section className="school-report-preview" aria-label="Saved report"><h4>Saved report · version {preview.version}</h4><p>{preview.snapshot?.gradebook?.name} · {preview.snapshot?.student_id}</p><p>{preview.snapshot?.commentary?.content}</p><p>Result: {preview.snapshot?.grade_result?.overridden_value ?? preview.snapshot?.grade_result?.text_result ?? preview.snapshot?.grade_result?.numeric_result ?? 'Insufficient evidence'}</p><p>Status: {preview.status}</p><button onClick={() => setPreview(null)}>Close saved report</button></section>}
  </section>;
}
