import React from 'react';
import { EmptyState } from '../../../../shared-ui/react/index.js';
export default function OverviewWidget({ data, onNavigate, availableViews = [] }) {
 const actions = [
 ['execution','Projects & tasks','Find your next task or plan work with your team.'],
 ['calendar','Calendar','See what is coming up and add school dates.'],
 ['approvals','Approvals','Check requests and record decisions.'],
 ['students','Students','Find a student and open their record.'],
 ['staff','Staff','Find people and manage staff records.'],
 ['documents','Documents','Find files and keep track of versions.'],
 ].filter(([view]) => availableViews.includes(view));
 return <div className="school-home"><header className="school-home-header"><h1>Home</h1><p>Where would you like to start?</p></header>
 <div className="school-home-links">{actions.map(([view,title,description])=><button key={view} onClick={()=>onNavigate(view)}><strong>{title}<span aria-hidden="true"> →</span></strong><span>{description}</span></button>)}</div>
 <section className="school-home-notifications"><h2>Recent notifications</h2>{data.notifications?.length ? data.notifications.slice(0,5).map((n,i)=><article key={n.id||i}><strong>{n.title||n.message||'Notification'}</strong><small>{n.created_at?new Date(n.created_at).toLocaleDateString():''}</small></article>):<EmptyState title="No recent notifications" description="Your projects and tasks are available above."/>}</section>
 {availableViews.includes('intelligence_workspace')&&<button className="school-secondary" onClick={()=>onNavigate('intelligence_workspace')}>Open school insights</button>}</div>;
}
