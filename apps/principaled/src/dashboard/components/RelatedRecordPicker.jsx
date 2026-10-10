import React from 'react';
import RecordPicker from './RecordPicker';

const types = [
  ['event', 'Event', 'event_record', 'event'],
  ['student', 'Student', 'student_registry', 'student'],
  ['staff', 'Staff member', 'staff_registry', 'staff'],
  ['room', 'Room', 'room_registry', 'room'],
  ['resource', 'Equipment', 'inventory', 'inventory_item'],
  ['document', 'Document', 'documents', 'document'],
  ['task', 'Task', 'tasks', 'task'],
];

export default function RelatedRecordPicker({ value, onChange, required = false }) {
  const type = types.find(t => t[2] === value.subject_component && t[3] === value.subject_type);
  return <div className="school-related-record">
    <label className="school-field"><span>Related record</span><select aria-label="Related record type" required={required} value={type?.[0] || (value.subject_id ? '__existing' : '')} onChange={e => {
      const next = types.find(t => t[0] === e.target.value);
      onChange({ ...value, subject_component: next?.[2] || '', subject_type: next?.[3] || '', subject_id: '' });
    }}><option value="">{required ? 'Choose a record type…' : 'No linked record'}</option>{!type && value.subject_id && <option value="__existing">Existing {value.subject_type} link</option>}{types.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></label>
    {type && <RecordPicker kind={type[0]} label={type[1]} required value={value.subject_id} onChange={e => onChange({ ...value, subject_id: e.target.value })} />}
    {!type && value.subject_id && <p role="status">This record has an existing {value.subject_type} link. It is retained unless you choose a different linked record.</p>}
  </div>;
}
