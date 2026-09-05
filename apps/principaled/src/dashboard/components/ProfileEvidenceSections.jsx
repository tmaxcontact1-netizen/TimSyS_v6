import React from "react";
import { EmptyState, Panel, StatusBadge } from "../../../../shared-ui/react/index.js";

const text = (value) => value == null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value).replaceAll("_", " ");
const titleFor = (row, fallback) => row.title || row.summary || row.name || row.certification_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.academic_year || row.action || fallback;

function Cards({ rows = [], empty }) {
  if (!rows.length) return <p className="profile-evidence-empty">{empty}</p>;
  return <div className="profile-evidence-cards">{rows.slice(0, 50).map((row, index) => <article key={row.id || index}><header><strong>{titleFor(row, `Record ${index + 1}`)}</strong>{row.status && <StatusBadge>{text(row.status)}</StatusBadge>}</header><dl>{Object.entries(row).filter(([key, value]) => !["id", "custom_fields", "summary", "title", "name"].includes(key) && value != null && value !== "").slice(0, 6).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{text(value)}</dd></div>)}</dl></article>)}</div>;
}

function InsightCards({ rows = [] }) {
  if (!rows.length) return <p className="profile-evidence-empty">No operational insight has been generated for this profile yet.</p>;
  return <div className="profile-insight-cards">{rows.map((row, index) => <article key={row.id || index}><header><StatusBadge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>{row.kind || row.severity || "Insight"}</StatusBadge>{(row.evidence_period || row.period) && <small>{text(row.evidence_period || row.period)}</small>}</header><strong>{row.title || row.summary || "Profile insight"}</strong>{row.description && <p>{row.description}</p>}<small>Recommendation only. A person must decide any action.</small></article>)}</div>;
}

export default function ProfileEvidenceSections({ profile, type }) {
  const related = type === "student" ? [
    ["Contacts", profile.contacts, "No contacts are recorded."], ["Enrollment history", profile.enrollment_history, "No enrollment history is recorded."],
  ] : [["Certifications", profile.certifications, "No certifications are recorded."]];
  return <div className="profile-evidence"><Panel title="Attendance context" description="Current factual contribution from late-entry and attendance records.">{profile.attendance_context ? <pre className="profile-context">{JSON.stringify(profile.attendance_context, null, 2)}</pre> : <p className="profile-evidence-empty">No attendance contribution is available.</p>}</Panel><Panel title="Operational insights" description="Evidence-based observations are separated from human decisions."><InsightCards rows={profile.insights} /></Panel>{related.map(([title, rows, empty]) => <Panel key={title} title={title}><Cards rows={rows} empty={empty} /></Panel>)}<Panel title="Audit trail" description="Recent decisions and source events associated with this person."><div className="profile-audit-grid"><section><h3>Decisions</h3><Cards rows={profile.decisions} empty="No decisions are recorded." /></section><section><h3>Events</h3><Cards rows={profile.events} empty="No events are recorded." /></section></div></Panel></div>;
}
