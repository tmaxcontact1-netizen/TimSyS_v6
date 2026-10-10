import React, { createContext, useContext, useState } from 'react';

// Navigation context contains references only. It never changes saved records.
export const WorkflowContext = createContext({ context: null, navigate: () => {}, available: [] });
export const useWorkflow = () => useContext(WorkflowContext);

export function useContextForm(initial) {
  const { context } = useWorkflow();
  const defaults = () => {
    const value = typeof initial === 'function' ? initial() : initial;
    if (!context || !Object.hasOwn(value, 'subject_id')) return { ...value };
    return { ...value, subject_component: context.component, subject_type: context.type, subject_id: context.id };
  };
  const [value, setValue] = useState(defaults);
  // Explicit resets retain the originating record; editing an existing record
  // always uses its own reference, even when it differs from this context.
  const update = next => setValue(previous => {
    const result = typeof next === 'function' ? next(previous) : next;
    return result === initial ? defaults() : result;
  });
  return [value, update];
}

export function ContextBar() {
  const { context, currentView, navigate, available } = useWorkflow();
  if (!context) return null;
  return <aside className="school-context" aria-label="Current work">
    <div><small>Working on {context.type}</small><strong>{context.title}</strong><span>New linked records start with this {context.type} selected. Lists may also contain other records.</span></div>
    <div className="school-context-actions">{currentView !== context.returnView && available.includes(context.returnView) && <button type="button" onClick={() => navigate(context.returnView, context)}>Back to {context.type}</button>}<button type="button" onClick={() => navigate(null, null)}>Leave this context</button></div>
  </aside>;
}
