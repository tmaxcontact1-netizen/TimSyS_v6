import React, { useEffect, useState } from 'react';
import * as api from '../../api/client';
import { Button, EmptyState, Feedback, PageHeader, Panel, StatusBadge } from '../../../../shared-ui/react/index.js';
import { useWorkflow } from './WorkflowContext';

const groups = [
  ['People and dates', ['calendar', 'audience', 'ownership', 'participation']],
  ['Practical arrangements', ['venue', 'resources', 'transport', 'catering']],
  ['Checks and decisions', ['risk', 'safeguarding', 'medical', 'contingency', 'finance', 'approvals']],
  ['Work and information', ['tasks', 'documents', 'communications']],
];
export const eventContext = event => ({ component: 'event_record', type: 'event', id: event.event_code, title: event.title, returnView: 'event_planner' });

export default function EventPlanningWorkspace() {
  const { context, navigate, available } = useWorkflow();
  const [plans, setPlans] = useState([]), [page, setPage] = useState(1), [total, setTotal] = useState(0), [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const open = async id => {
    setBusy(true); setError('');
    try { setSelected((await api.getEventPlan(id)).data); }
    catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
    finally { setBusy(false); }
  };
  const load = async () => {
    setBusy(true); setError('');
    try { const response = await api.listEventPlans({ page, limit: 50, q: search }); setPlans(response.data.events || []); setTotal(response.data.total || 0); }
    catch (cause) { setError(cause.response?.data?.error?.message || cause.message); }
    finally { setBusy(false); }
  };
  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer); }, [page, search]);
  useEffect(() => { if (context?.type === 'event') void open(context.id); }, [context?.id]);
  const go = area => navigate(area === 'calendar' || area === 'audiences' ? 'event_record' : area, eventContext(selected.event));
  return <div className="event-planner-workspace">
    <PageHeader title="Event Planner" description="Open an event, make its arrangements, then check what still needs attention." actions={<Button disabled={busy} onClick={() => selected ? open(selected.event.id) : load()}>Refresh</Button>} />
    {error && <Feedback tone="error" title="Could not load the event" technical={error}>Your saved records have not changed. Try Refresh.</Feedback>}
    {selected ? <>
      <button className="school-secondary" onClick={() => { setSelected(null); if (context) navigate('event_planner', null); }}>← All events</button>
      <Panel title={selected.event.title} description={`${selected.event.event_code} · ${new Date(selected.event.starts_at).toLocaleString()} · ${selected.event.status.replaceAll('_', ' ')}`} actions={<Button onClick={() => navigate('event_record', eventContext(selected.event))}>Event details</Button>}>
        <p className="school-readiness" role="status"><strong>{selected.readiness.ready} of {selected.readiness.applicable} applicable areas ready.</strong> Readiness is calculated from saved records; it is not approval to run the event.</p>
        {groups.map(([title, keys], index) => <section className="school-event-step" key={title}><h2><span>{index + 1}</span>{title}</h2><div className="school-arrangements">{selected.areas.filter(area => keys.includes(area.key)).map(area => {
          const destination = ['calendar', 'audience'].includes(area.key) ? 'event_record' : area.view;
          return <article key={area.key}><div><strong>{area.label}</strong><StatusBadge tone={!area.applicable ? 'neutral' : area.ready ? 'success' : 'warning'}>{!area.applicable ? 'Optional' : area.ready ? 'Ready' : 'Needs attention'}</StatusBadge><p>{area.detail}</p></div>
            {available.includes(destination) ? <Button onClick={() => go(area.view)}>{['calendar', 'audience'].includes(area.key) ? 'Link in event details' : 'Open'}</Button> : <small>This area is not available to your account.</small>}
          </article>;
        })}</div></section>)}
        {available.includes('attendance') && <Button onClick={() => navigate('attendance', eventContext(selected.event))}>Take event attendance</Button>}
      </Panel>
    </> : <Panel title="Your events" description="Choose an event to keep all its arrangements connected.">
      <div className="school-list-tools"><label className="school-field"><span>Find an event</span><input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>{available.includes('event_record') && <Button onClick={() => navigate('event_record')}>Create an event</Button>}</div>
      {!plans.length ? <EmptyState title={busy ? 'Loading events…' : 'No events found'} description={search ? 'Try a different name.' : 'Create an event with its purpose, dates and owner. Then return here to plan it.'} /> : <div className="school-event-list">{plans.map(plan => <button key={plan.event.id} onClick={() => navigate('event_planner', eventContext(plan.event))}><span><strong>{plan.event.title}</strong><small>{new Date(plan.event.starts_at).toLocaleDateString()} · {plan.event.status.replaceAll('_', ' ')}</small></span><span>{plan.readiness.blockers.length ? `${plan.readiness.blockers.length} areas need attention` : 'Ready for review'} →</span></button>)}</div>}
      <nav className="people-pagination"><span>Page {page} · {total} events</span><div><Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</Button></div></nav>
    </Panel>}
  </div>;
}
