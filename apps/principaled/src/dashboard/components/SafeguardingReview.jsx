import React, { useState } from 'react';
import * as api from '../../api/client';
export default function SafeguardingReview({ row, reload, ask }) {
  const [open, setOpen] = useState(false), [notes, setNotes] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (row.status !== 'open') return null;
  return <span className="school-verification"><button onClick={() => setOpen(!open)}>Review requirement</button>{open && <form onSubmit={async event => {
    event.preventDefault(); if (!await ask?.({ title: 'Verify this requirement?', message: 'Confirm that the safeguard has been checked. Record operational evidence only, not sensitive case details.', confirmLabel: 'Verify requirement' })) return;
    setBusy(true); setError(''); try { await api.setSafeguardingRequirementStatus(row.id, 'verified', notes); await reload(); } catch (cause) { setError(cause.response?.data?.error?.message || cause.message); } finally { setBusy(false); }
  }}><label className="school-field"><span>What was checked?</span><textarea required value={notes} onChange={event => setNotes(event.target.value)} /></label><button disabled={busy}>Verify requirement</button><button type="button" onClick={() => setOpen(false)}>Cancel review</button>{error && <span role="alert">{error}</span>}</form>}</span>;
}
