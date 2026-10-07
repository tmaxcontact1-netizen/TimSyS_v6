import React from "react";
import { EmptyState, PageHeader } from "../../../../shared-ui/react/index.js";

export default function WorkspaceHub({ title, description, items, onNavigate }) {
  return <div className="workspace-hub">
    <PageHeader eyebrow="Principal’Ed workspace" title={title} description={description} />
    {items.length ? <div className="workspace-card-grid">
      {items.map((item) => <button key={item.id} className="workspace-card" onClick={() => onNavigate(item.id)}>
        <span className="workspace-card-icon" aria-hidden="true">{item.icon || "→"}</span>
        <span className="workspace-card-copy"><strong>{item.label}</strong><small>{item.description}</small></span>

        <span className="workspace-card-arrow" aria-hidden="true">→</span>
      </button>)}
    </div> : <EmptyState title="Nothing is enabled here yet" description="Ask your school administrator to enable the tools you need." />}
  </div>;
}
