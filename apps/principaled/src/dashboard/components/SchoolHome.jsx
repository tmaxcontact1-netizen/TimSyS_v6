import React, { useEffect, useState } from 'react';
import * as api from '../../api/client';

const jobs = [
  ['People', [['students', 'Find a student', 'Open their profile or record an arrival or departure.'], ['staff', 'Find a staff member', 'Open their profile or arrange absence cover.'], ['cover', 'Arrange cover', 'See uncovered lessons and confirm who will help.']]],
  ['The school day', [['calendar', 'See the calendar', 'Dates, meetings and commitments.'], ['event_planner', 'Plan an event', 'People, practical arrangements and readiness checks.'], ['programme_manager', 'Run a programme', 'Set up activities, enrolment and sessions.'], ['scheduler', 'Build the timetable', 'Set requirements, resolve conflicts and publish deliberately.']]],
  ['Teaching and shared work', [['gradebook', 'Open a gradebook', 'Record evidence, review grades and release reports.'], ['assessment_evaluator', 'Review an assessment', 'Check its purpose and supporting evidence.'], ['execution', 'Projects & tasks', 'Find your next action or plan work with your team.'], ['approvals', 'Make a decision', 'Review requests and record an explicit decision.']]],
  ['School information', [['documents', 'Find a document', 'Open files, add revisions and retain their history.'], ['communications', 'Write a message', 'Choose recipients, review and send.'], ['nervous_breakdown', 'Explore responsibilities', 'Find who handles something and inspect its source.'], ['rooms', 'Find a room', 'Check spaces and their details.'], ['inventory', 'Find equipment', 'See resources and manage custody.']]],
];
export default function SchoolHome({ onNavigate, availableViews = [] }) {
  const [agenda, setAgenda] = useState([]), [state, setState] = useState('loading'), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!availableViews.includes('calendar')) return;
    let cancelled = false; const from = new Date(); from.setHours(0, 0, 0, 0); const to = new Date(from); to.setDate(to.getDate() + 1);
    setState('loading');
    api.listCalendarEntries({ from: from.toISOString(), to: to.toISOString() }).then(response => { if (!cancelled) { setAgenda(response.data.entries || []); setState('ready'); } }).catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [availableViews.includes('calendar'), retry]);
  return <div className="school-home"><header className="school-home-header"><small>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</small><h1>Home</h1><p>Start with the person, event or piece of work you need.</p></header>
    {availableViews.includes('calendar') && <section className="school-today" aria-label="Today's calendar"><div><h2>Today</h2><button className="school-secondary" onClick={() => onNavigate('calendar')}>Open calendar</button></div>{state === 'error' ? <p role="alert">The calendar could not be loaded. <button onClick={() => setRetry(n => n + 1)}>Retry</button></p> : state === 'loading' ? <p role="status">Loading today’s calendar…</p> : !agenda.length ? <p>No calendar entries for today.</p> : <ul>{agenda.slice(0, 5).map(entry => <li key={entry.instance_id || entry.id}><time>{entry.all_day ? 'All day' : new Date(entry.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span>{entry.title}</span></li>)}</ul>}{agenda.length > 5 && <small>{agenda.length - 5} more entries in the calendar.</small>}</section>}
    {jobs.map(([heading, actions]) => { const visible = actions.filter(([id]) => availableViews.includes(id)); return visible.length > 0 && <section className="school-home-section" key={heading}><h2>{heading}</h2><div className="school-home-links">{visible.map(([id, title, text]) => <button key={id} onClick={() => onNavigate(id)}><strong>{title}<span aria-hidden="true"> →</span></strong><span>{text}</span></button>)}</div></section>; })}
    {availableViews.includes('intelligence_workspace') && <button className="school-secondary" onClick={() => onNavigate('intelligence_workspace')}>Open school insights</button>}
  </div>;
}
