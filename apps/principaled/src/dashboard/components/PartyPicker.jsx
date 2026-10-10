import React from 'react';
import RecordPicker from './RecordPicker';

export default function PartyPicker({ type, value, onChange, label = 'Person', required = false }) {
  if (type === 'staff' || type === 'student') return <RecordPicker key={type} kind={type} label={label} value={value} onChange={onChange} required={required} />;
  // These services currently have no authorised searchable directory. Do not
  // pretend that arbitrary text identifies a student/staff member or role.
  return <label className="school-field"><span>{label} · {type}</span><input required={required} value={value || ''} onChange={onChange} aria-label={label} /><small>Enter the existing {type} reference. For a school person, choose Staff or Student to search by name.</small></label>;
}
