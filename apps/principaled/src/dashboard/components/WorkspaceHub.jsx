import React from "react";
import { EmptyState, PageHeader, StatusBadge } from "../../../../shared-ui/react/index.js";

export default function WorkspaceHub({ title, description, items, onNavigate }) {
  return <div className="workspace-hub">
    <PageHeader eyebrow="Principal’Ed workspace" title={title} description={description} />
    {items.length ? <div className="workspace-card-grid">
      {items.map((item) => <button key={item.id} className="workspace-card" onClick={() => onNavigate(item.id)}>
        <span className="workspace-card-icon" aria-hidden="true">{item.icon || "→"}</span>
        <span className="workspace-card-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
        <StatusBadge tone="success">Ready</StatusBadge>
        <span className="workspace-card-arrow" aria-hidden="true">→</span>
      </button>)}
    </div> : <EmptyState title="Nothing is enabled here yet" description="Enable a relevant component in Builder and it will appear in this workspace." />}
  </div>;
}
