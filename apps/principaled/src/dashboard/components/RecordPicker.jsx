import React, { useEffect, useRef, useState } from 'react';
import * as api from '../../api/client';

const sources = {
  student: [api.listStudents, 'students', 'student_id', r => `${r.first_name} ${r.last_name} · ${r.student_id}`],
  staff: [api.listStaff, 'staff', 'staff_id', r => `${r.first_name} ${r.last_name} · ${r.staff_id}`],
  room: [api.listRooms, 'rooms', 'id', r => `${r.room_number}${r.name ? ' · ' + r.name : ''}`],
  resource: [api.listInventory, 'items', 'id', r => r.item_name || r.name || r.item_number],
  event: [api.listEvents, 'events', 'id', r => r.title || r.name],
  task: [api.listTasks, 'tasks', 'id', r => r.title],
  document: [api.listDocuments, 'documents', 'id', r => r.title],
};

// Search and page through actual permitted records. Never invent a reference or
// accept typed search text as a selected identity. Wire format remains unchanged.
export default function RecordPicker({ kind, label, value = '', onChange, multiple = false, required = false, valueKey, disabled = false }) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(1);
  const [rows, setRows] = useState([]), [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const known = useRef(new Map());
  const [load, key, defaultKey, describe] = sources[kind];
  const identity = valueKey || defaultKey;
  const selected = (multiple ? String(value).split(',') : [String(value)]).map(v => v.trim()).filter(Boolean);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true); setError('');
      try {
        const response = await load({ q: query, search: query, page, limit: 50 });
        if (cancelled) return;
        if (response.data.success === false) throw new Error(response.data.error?.message || 'Records could not be loaded');
        const records = response.data[key];
        if (!Array.isArray(records)) throw new Error('The record service returned an unexpected response');
        records.forEach(r => known.current.set(String(r[identity]), describe(r)));
        setRows(records); setTotal(response.data.total ?? records.length);
      } catch (cause) {
        if (!cancelled) { setRows([]); setError(cause.response?.data?.error?.message || cause.message); }
      } finally { if (!cancelled) setBusy(false); }
    }, query ? 200 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [kind, identity, query, page, retry]);
  const visible = new Set(rows.map(r => String(r[identity])));
  return <div className="school-record-picker">
    <label className="school-field"><span>{label}</span>
      <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search by name…" value={query} disabled={disabled} onChange={e => { setQuery(e.target.value); setPage(1); }} />
      <select aria-label={label} multiple={multiple} size={multiple ? 5 : undefined} required={required} disabled={disabled} value={multiple ? selected : String(value || '')} onChange={e => onChange({ target: { value: multiple ? [...e.target.selectedOptions].map(o => o.value).filter(Boolean).join(',') : e.target.value } })}>
        {!multiple && <option value="">Choose {label.toLowerCase()}…</option>}
        {selected.filter(id => !visible.has(id)).map(id => <option key={id} value={id}>{known.current.get(id) || `Previously selected record (${id})`}</option>)}
        {rows.map(r => <option key={r[identity]} value={r[identity]}>{describe(r)}</option>)}
      </select>
    </label>
    {multiple && <small>Select more than one with Ctrl or Shift. {selected.length} selected.</small>}
    {busy && <small role="status">Loading records…</small>}
    {error ? <div role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></div> : !busy && !rows.length && <small>{query ? 'No matching records.' : `No ${kind} records yet. Add them in the corresponding workspace first.`}</small>}
    {total > 50 && <div><button type="button" disabled={page === 1 || busy} onClick={() => setPage(n => n - 1)}>Previous results</button><span> Page {page} </span><button type="button" disabled={page * 50 >= total || busy} onClick={() => setPage(n => n + 1)}>Next results</button></div>}
  </div>;
}
