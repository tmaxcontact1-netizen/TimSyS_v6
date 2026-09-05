import React, { useEffect, useState } from "react";
import * as api from "../../api/client";
import { Button, EmptyState, Feedback, Field, Panel, StatusBadge } from "../../../../shared-ui/react/index.js";

const configuration = {
  student: {
    title: "Student record",
    sections: [
      { key: "contacts", label: "Contacts", load: api.listStudentContacts },
      { key: "enrollment", label: "Enrollment history", load: api.getStudentEnrollmentHistory },
    ],
  },
  staff: {
    title: "Staff record",
    sections: [{ key: "certifications", label: "Certifications", load: api.listStaffCertifications }],
  },
  room: {
    title: "Room record",
    sections: [{ key: "bookings", label: "Booking history", load: api.listRoomBookings }],
  },
  inventory: {
    title: "Inventory record",
    sections: [{ key: "checkouts", label: "Checkout history", load: api.listInventoryCheckouts }],
  },
};

const valuesFrom = (response, key) => {
  const data = response?.data || {};
  return Array.isArray(data[key]) ? data[key] : [];
};

const displayValue = (value) => {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replaceAll("_", " ");
};

function RecordRows({ rows }) {
  if (!rows.length) return <EmptyState title="No related records" description="Nothing has been recorded here yet." />;
  return <div className="related-record-list">{rows.map((row, index) => {
    const entries = Object.entries(row).filter(([key, value]) => !["id", "student_id", "staff_id", "room_id", "item_id", "custom_fields"].includes(key) && value != null && value !== "").slice(0, 8);
    const heading = row.name || row.certification_name || [row.first_name, row.last_name].filter(Boolean).join(" ") || row.academic_year || row.status || `Record ${index + 1}`;
    return <article key={row.id || index}><header><strong>{heading}</strong>{row.status && <StatusBadge>{displayValue(row.status)}</StatusBadge>}</header><dl>{entries.map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{displayValue(value)}</dd></div>)}</dl></article>;
  })}</div>;
}

export default function RegistryRelatedPanel({ type, record, onClose }) {
  const config = configuration[type];
  const [sections, setSections] = useState({});
  const [active, setActive] = useState(config.sections[0].key);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [form, setForm] = useState({});

  const load = async () => {
    setBusy(true); setError("");
    try {
      const responses = await Promise.all(config.sections.map((section) => section.load(record.id)));
      setSections(Object.fromEntries(config.sections.map((section, index) => [section.key, valuesFrom(responses[index], section.key === "enrollment" ? "history" : section.key)])));
    } catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
    finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, [record.id, type]);

  const addRelated = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (type === "student") await api.addStudentContact(record.id, { ...form, contact_type: form.contact_type || "guardian" });
      if (type === "staff") await api.addStaffCertification(record.id, form);
      setForm({}); await load();
    } catch (cause) { setError(cause.response?.data?.error?.message || cause.message); setBusy(false); }
  };

  const name = record.item_name || record.room_name || record.room_number || [record.first_name, record.last_name].filter(Boolean).join(" ") || "Selected record";
  return <div className="registry-detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="registry-detail" role="dialog" aria-modal="true" aria-label={`${config.title}: ${name}`}><header><div><span>Related information</span><h2>{name}</h2><p>{config.title}</p></div><Button variant="quiet" onClick={onClose}>Close</Button></header>{error && <Feedback tone="error" title="Related information could not be updated" technical={error}>Your main record has not been changed.</Feedback>}<nav aria-label="Record sections">{config.sections.map((section) => <button key={section.key} className={active === section.key ? "is-active" : ""} onClick={() => setActive(section.key)}>{section.label}<span>{sections[section.key]?.length || 0}</span></button>)}</nav>{busy ? <p className="registry-detail-loading">Loading related records…</p> : <RecordRows rows={sections[active] || []} />}{!busy && active === "contacts" && <Panel title="Add contact" description="Add a parent, guardian or other authorised contact."><form onSubmit={addRelated}><Field label="First name" required><input required value={form.first_name || ""} onChange={(event) => setForm({ ...form, first_name: event.target.value })} /></Field><Field label="Last name" required><input required value={form.last_name || ""} onChange={(event) => setForm({ ...form, last_name: event.target.value })} /></Field><Field label="Relationship" required><input required value={form.relationship || ""} onChange={(event) => setForm({ ...form, relationship: event.target.value })} /></Field><Field label="Telephone"><input type="tel" value={form.phone_primary || ""} onChange={(event) => setForm({ ...form, phone_primary: event.target.value })} /></Field><Field label="Email"><input type="email" value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field><Button variant="primary" type="submit">Add contact</Button></form></Panel>}{!busy && active === "certifications" && <Panel title="Add certification" description="Record a qualification, licence or clearance."><form onSubmit={addRelated}><Field label="Certification" required><input required value={form.certification_name || ""} onChange={(event) => setForm({ ...form, certification_name: event.target.value })} /></Field><Field label="Issuing body"><input value={form.issuing_body || ""} onChange={(event) => setForm({ ...form, issuing_body: event.target.value })} /></Field><Field label="Issue date"><input type="date" value={form.issue_date || ""} onChange={(event) => setForm({ ...form, issue_date: event.target.value })} /></Field><Field label="Expiry date"><input type="date" value={form.expiry_date || ""} onChange={(event) => setForm({ ...form, expiry_date: event.target.value })} /></Field><Button variant="primary" type="submit">Add certification</Button></form></Panel>}</aside></div>;
}
