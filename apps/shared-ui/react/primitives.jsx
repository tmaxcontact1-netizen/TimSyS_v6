import React from "react";

export function AppShell({ brand, context, navigation, active, onNavigate, onBack, onLauncher, children }) {
  return <div className="ts-shell"><aside className="ts-sidebar"><div className="ts-brand"><span>TimSyS</span><strong>{brand}</strong>{context && <small>{context}</small>}</div><SidebarNav items={navigation} active={active} onNavigate={onNavigate}/><div className="ts-sidebar-actions"><Button variant="quiet" onClick={onBack}>Back</Button><Button variant="quiet" onClick={onLauncher}>Return to launcher</Button></div></aside><main className="ts-main">{children}</main></div>;
}

export function SidebarNav({ items = [], active, onNavigate }) {
  return <nav className="ts-navigation" aria-label="Application">{items.map((item) => <button key={item.id} className={active === item.id ? "is-active" : ""} onClick={() => onNavigate(item.id)}>{item.icon && <span className="ts-nav-icon" aria-hidden="true">{item.icon}</span>}<span><strong>{item.label}</strong>{item.description && <small>{item.description}</small>}</span>{item.count != null && <em>{item.count}</em>}</button>)}</nav>;
}

export function PageHeader({ eyebrow, title, description, actions, status }) {
  return <header className="ts-page-header"><div>{eyebrow && <p className="ts-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}</div><div className="ts-header-actions">{status}{actions}</div></header>;
}

export function Button({ variant = "secondary", children, className = "", ...props }) {
  return <button className={`ts-button ts-button--${variant} ${className}`.trim()} {...props}>{children}</button>;
}

export function StatusBadge({ tone = "neutral", children }) {
  return <span className={`ts-status ts-status--${tone}`}>{children}</span>;
}

export function Panel({ title, description, actions, children, className = "" }) {
  return <section className={`ts-panel ${className}`.trim()}>{(title || actions) && <header><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions}</header>}{children}</section>;
}

export function Field({ label, hint, error, children, required = false }) {
  return <label className={`ts-field ${error ? "has-error" : ""}`}><span>{label}{required && <b aria-label="required"> *</b>}</span>{children}{error ? <small role="alert">{error}</small> : hint && <small>{hint}</small>}</label>;
}

export function EmptyState({ title, description, action }) {
  return <div className="ts-empty"><div aria-hidden="true">◇</div><h2>{title}</h2><p>{description}</p>{action}</div>;
}

export function Feedback({ tone = "info", title, children, technical }) {
  return <div className={`ts-feedback ts-feedback--${tone}`} role={tone === "error" ? "alert" : "status"}><strong>{title}</strong>{children && <div>{children}</div>}{technical && <details><summary>Technical details</summary><pre>{technical}</pre></details>}</div>;
}

export function Toolbar({ search, filters, actions }) {
  return <div className="ts-toolbar">{search && <div className="ts-toolbar-search">{search}</div>}<div className="ts-toolbar-filters">{filters}</div><div className="ts-toolbar-actions">{actions}</div></div>;
}

export function Metric({ label, value, context, tone = "neutral" }) {
  return <article className={`ts-metric ts-metric--${tone}`}><span>{label}</span><strong>{value}</strong>{context && <small>{context}</small>}</article>;
}

export function ConfirmationDialog({ open, title, description, consequence, confirmLabel = "Confirm", cancelLabel = "Cancel", destructive = false, busy = false, onConfirm, onCancel }) {
  if (!open) return null;
  return <div className="ts-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel?.()}><section className="ts-dialog" role="alertdialog" aria-modal="true" aria-labelledby="ts-confirm-title" aria-describedby="ts-confirm-description"><h2 id="ts-confirm-title">{title}</h2><p id="ts-confirm-description">{description}</p>{consequence && <div className="ts-dialog-consequence">{consequence}</div>}<footer><Button variant="quiet" onClick={onCancel} disabled={busy}>{cancelLabel}</Button><Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</Button></footer></section></div>;
}

export function InputDialog({ open, title, description, label = "Details", initialValue = "", required = true, confirmLabel = "Continue", cancelLabel = "Cancel", onConfirm, onCancel }) {
  const [value, setValue] = React.useState(initialValue);
  React.useEffect(() => { if (open) setValue(initialValue); }, [open, initialValue]);
  if (!open) return null;
  const submit = (event) => { event.preventDefault(); if (!required || value.trim()) onConfirm?.(value.trim()); };
  return <div className="ts-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel?.()}><form className="ts-dialog" role="dialog" aria-modal="true" aria-labelledby="ts-input-title" onSubmit={submit}><h2 id="ts-input-title">{title}</h2>{description && <p>{description}</p>}<Field label={label} required={required}><input autoFocus value={value} onChange={(event) => setValue(event.target.value)} /></Field><footer><Button type="button" variant="quiet" onClick={onCancel}>{cancelLabel}</Button><Button type="submit" variant="primary" disabled={required && !value.trim()}>{confirmLabel}</Button></footer></form></div>;
}
