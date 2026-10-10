import React from 'react';
import { useWorkflow } from './WorkflowContext';

export default function PersonActions({ kind, record, compact = false }) {
  const { navigate, available } = useWorkflow();
  const id = record?.[`${kind}_id`];
  if (!id) return null;
  const context = { component: `${kind}_registry`, type: kind, id, recordId: record.id, title: `${record.first_name || ''} ${record.last_name || ''}`.trim() || id, returnView: `${kind}_profiles` };
  const actions = compact ? [[`${kind}_profiles`, 'Open profile']] : kind === 'student' ? [['student_exits', 'Record departure'], ['late_entries', 'Record late arrival'], ['tasks', 'Add a task'], ['communications', 'Write a message'], ['documents', 'Link a document']] : [['cover', 'Record absence'], ['tasks', 'Add a task'], ['communications', 'Write a message'], ['documents', 'Link a document']];
  return <nav className="school-person-actions" aria-label={`Actions for ${context.title}`}>{actions.filter(([view]) => available.includes(view)).map(([view, label]) => <button key={view} type="button" className="school-secondary" onClick={() => navigate(view, context)}>{label}</button>)}</nav>;
}
