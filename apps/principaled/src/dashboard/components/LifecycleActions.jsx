import React, { useState } from 'react';

const paths = {
  venue: { requested: ['confirmed'], confirmed: ['completed'] },
  resource: { requested: ['confirmed'], confirmed: ['issued'], issued: ['returned'] },
  journey: { draft: ['requested'], requested: ['approved'], approved: ['confirmed'], confirmed: ['departed'], departed: ['arrived'] },
  catering: { draft: ['requested'], requested: ['approved'], approved: ['confirmed'], confirmed: ['delivered'] },
  budget: { draft: ['submitted'], submitted: ['approved'], approved: ['closed'] },
  expenditure: { draft: ['submitted'], submitted: ['approved', 'rejected'], rejected: ['draft'], approved: ['paid'] },
  risk: { draft: ['in_review'], in_review: ['approved', 'rejected'], rejected: ['draft'] },
  medical: { responded: ['closed'] },
};
const names = { requested: 'Submit request', submitted: 'Submit for review', confirmed: 'Confirm', approved: 'Approve', rejected: 'Reject', draft: 'Return to draft', in_review: 'Submit for review', completed: 'Mark complete', issued: 'Record issue', returned: 'Record return', departed: 'Record departure', arrived: 'Record arrival', delivered: 'Record delivery', closed: 'Close record', paid: 'Record payment' };

// Existing service contracts remain authoritative. No action runs on render.
export default function LifecycleActions({ kind, row, save, reload, ask }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const next = paths[kind]?.[row.status] || [];
  const act = async status => {
    if (!ask) { setError('Confirmation is unavailable. Reopen this page before continuing.'); return; }
    if (!await ask({ title: `${names[status]}?`, message: `${row.title || row.name || 'This record'} will change from ${row.status.replaceAll('_', ' ')} to ${status.replaceAll('_', ' ')}. This records your decision; it does not send a message or make a payment.`, confirmLabel: names[status] })) return;
    setBusy(true); setError('');
    try { await save(row.id, status); await reload(); }
    catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
    finally { setBusy(false); }
  };
  return <span className="school-lifecycle-actions">{next.map(status => <button type="button" key={status} disabled={busy} onClick={() => void act(status)}>{names[status]}</button>)}{error && <span role="alert">{error}</span>}</span>;
}
