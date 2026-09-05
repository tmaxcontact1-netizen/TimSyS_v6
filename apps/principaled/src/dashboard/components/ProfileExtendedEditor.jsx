import React, { useMemo, useState } from "react";
import * as api from "../../api/client";
import { Button, Feedback, Field, Panel } from "../../../../shared-ui/react/index.js";

const join = (value) => Array.isArray(value) ? value.join(", ") : value && typeof value === "object" ? Object.entries(value).filter(([, enabled]) => enabled).map(([key]) => key).join(", ") : value || "";
const tags = (value) => Object.fromEntries(String(value || "").split(",").map((part) => part.trim()).filter(Boolean).map((part) => [part, true]));
const list = (value) => String(value || "").split(",").map((part) => part.trim()).filter(Boolean);

export default function ProfileExtendedEditor({ type, id, value, onSaved, onCancel }) {
  const initial = useMemo(() => type === "student" ? {
    interests: join(value?.interests), strengths: join(value?.strengths), goals: join(value?.goals), extracurricular: join(value?.extracurricular), medical_details: value?.medical_details || "", dietary_requirements: value?.dietary_requirements || "", transport_info: value?.transport_info || "", parent_conference_notes: value?.parent_conference_notes || "",
  } : {
    professional_development: join(value?.professional_development), mentorship_roles: join(value?.mentorship_roles), committee_memberships: join(value?.committee_memberships), performance_reviews: join(value?.performance_reviews), career_goals: value?.career_goals || "",
  }, [id, type]);
  const [form, setForm] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const change = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = type === "student" ? { ...form, interests: tags(form.interests), strengths: tags(form.strengths), extracurricular: list(form.extracurricular) } : { ...form, professional_development: list(form.professional_development), mentorship_roles: list(form.mentorship_roles), committee_memberships: list(form.committee_memberships), performance_reviews: list(form.performance_reviews) };
      if (type === "student") await api.updateStudentExtendedProfile(id, body); else await api.updateStaffExtendedProfile(id, body);
      await onSaved();
    } catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
    finally { setBusy(false); }
  };
  const fields = type === "student" ? [
    ["interests", "Interests", "Comma-separated"], ["strengths", "Strengths", "Comma-separated"], ["goals", "Goals"], ["extracurricular", "Activities", "Comma-separated"], ["medical_details", "Medical details"], ["dietary_requirements", "Dietary requirements"], ["transport_info", "Transport information"], ["parent_conference_notes", "Parent conference notes"],
  ] : [
    ["professional_development", "Professional development", "Comma-separated"], ["mentorship_roles", "Mentorship roles", "Comma-separated"], ["committee_memberships", "Committee memberships", "Comma-separated"], ["performance_reviews", "Performance review references", "Comma-separated"], ["career_goals", "Career goals"],
  ];
  return <Panel className="profile-editor" title="Edit extended profile" description="This information supplements the core registry record and remains attached to the person.">{error && <Feedback tone="error" title="Profile was not saved" technical={error}>Your entries are still available below.</Feedback>}<form onSubmit={submit}>{fields.map(([key, label, hint]) => <Field key={key} label={label} hint={hint}><textarea value={form[key]} onChange={change(key)} /></Field>)}<footer><Button type="button" variant="quiet" onClick={onCancel} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save profile"}</Button></footer></form></Panel>;
}
