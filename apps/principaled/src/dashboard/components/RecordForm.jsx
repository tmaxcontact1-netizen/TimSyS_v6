import React, { cloneElement, useEffect, useId, useRef, useState } from 'react';

// Keeps drafts mounted when collapsed; page-level leave guards remain authoritative.
export default function RecordForm({ title, editing = false, initiallyOpen = false, children }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [error, setError] = useState('');
  const id = useId();
  const ref = useRef(null);
  useEffect(() => { if (editing) setOpen(true); }, [editing]);
  useEffect(() => { if (open) ref.current?.querySelector('input:not([type="hidden"]),select,textarea')?.focus(); }, [open, editing]);
  const form = cloneElement(children, { onSubmit: async event => {
    setError('');
    try {
      // A handler explicitly returns true only after its mutation succeeds.
      if (await children.props.onSubmit(event) === true) {
        setOpen(false);
        ref.current?.previousElementSibling?.focus();
      }
    } catch (failure) {
      setError(failure.response?.data?.error?.message || failure.message || 'Unable to save. Your entries are still here.');
    }
  } });
  return <section className="school-record-form">
    <button type="button" className={open ? 'school-secondary' : 'school-primary'} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{open ? 'Hide form' : editing ? 'Continue editing' : title}</button>
    <div ref={ref} id={id} hidden={!open}>{error && <p role="alert">{error}</p>}{form}</div>
  </section>;
}
