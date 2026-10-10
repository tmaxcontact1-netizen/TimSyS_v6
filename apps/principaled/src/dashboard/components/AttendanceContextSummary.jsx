import React from 'react';

export default function AttendanceContextSummary({ value }) {
  if (!value) return <p>No attendance information is available.</p>;
  if (value.staff_id) return <div><p>{value.period?.from} to {value.period?.to}</p><p><strong>{value.arrivals_recorded ?? 0}</strong> arrival records entered by this staff member.</p>{value.interpretation && <p>{value.interpretation}</p>}{value.scheduled_class_lateness?.length > 0 && <ul>{value.scheduled_class_lateness.map(item => <li key={item.teaching_group_ref}>{item.teaching_group_ref}: {item.count} recorded late arrivals</li>)}</ul>}</div>;
  const entries = value.entries || [], cases = value.equivalence_cases || [];
  return <div className="school-attendance-summary">
    {value.period && <p>{value.period.from} to {value.period.to}</p>}
    <p><strong>{entries.length}</strong> recorded arrival{entries.length === 1 ? '' : 's'} · <strong>{cases.length}</strong> attendance review case{cases.length === 1 ? '' : 's'}</p>
    {value.interpretation && <p>{value.interpretation}</p>}
    {entries.length > 0 && <ul>{entries.map((entry, index) => <li key={entry.id || index}>{entry.arrival_at || entry.created_at || 'Date unavailable'} · {String(entry.status || entry.occurrence_type || 'Recorded').replaceAll('_', ' ')}{entry.minutes_late != null ? ` · ${entry.minutes_late} minutes late` : ''}</li>)}</ul>}
    {cases.length > 0 && <ul>{cases.map((item, index) => <li key={item.id || index}>Review {index + 1} · {String(item.status || 'Awaiting review').replaceAll('_', ' ')}{item.reason ? ` · ${item.reason}` : ''}</li>)}</ul>}
  </div>;
}
