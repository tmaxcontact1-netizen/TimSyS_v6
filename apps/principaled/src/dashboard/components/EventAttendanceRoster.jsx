import React, { useState } from "react";
import RecordPicker from "./RecordPicker";
import * as api from "../../api/client";
import { Button, Feedback, Panel } from "../../../../shared-ui/react/index.js";

export default function EventAttendanceRoster({ session, onClose, onSaved }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    const ids = [...new Set(value.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean))];
    if (!ids.length) return setError("Choose at least one student.");
    setBusy(true); setError("");
    try { await api.seedAttendanceExpectedRoster(session.id, ids); await onSaved(); onClose(); }
    catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
    finally { setBusy(false); }
  };
  return <Panel className="attendance-roster" title={`Expected roster · ${session.title}`} description="Choose students from your school records. Existing attendance records are retained.">{error && <Feedback tone="error" title="Roster was not saved">{error}</Feedback>}<form onSubmit={submit}><RecordPicker kind="student" label="Students" multiple required value={value} onChange={event => setValue(event.target.value)} disabled={busy} /><footer><Button type="button" variant="quiet" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Adding…" : "Add expected students"}</Button></footer></form></Panel>;
}
