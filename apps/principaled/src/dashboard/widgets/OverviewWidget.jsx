import React from 'react';
import { Button, EmptyState, Metric, PageHeader, Panel } from '../../../../shared-ui/react/index.js';

function OverviewWidget({ data, onNavigate, availableViews = [] }) {
  const stats = data.stats || {};
  const studentCount = Array.isArray(data.students) ? data.students.length : (stats.student_count || 0);
  const staffCount = Array.isArray(data.staff) ? data.staff.length : (stats.staff_count || 0);
  const notifCount = Array.isArray(data.notifications) ? data.notifications.length : 0;

  const cards = [
    { label: 'Students', value: studentCount, context: 'records currently shown' },
    { label: 'Staff', value: staffCount, context: 'records currently shown' },
    { label: 'Notifications', value: notifCount, context: 'requiring attention', tone: notifCount ? 'warning' : 'neutral' },
    { label: 'System', value: 'Ready', context: 'school services available', tone: 'success' },
  ];

  const actions = [
    { view: 'people', label: 'Manage people', detail: 'Students, staff and profiles' },
    { view: 'learning', label: 'Open learning', detail: 'Assessment, attendance and gradebooks' },
    { view: 'planning', label: 'Plan school activity', detail: 'Calendar, scheduling and programmes' },
    { view: 'intelligence_workspace', label: 'Review insights', detail: 'Evidence-led alerts and recommendations' },
  ].filter((action) => availableViews.includes(action.view));

  return (
    <div className="home-workspace">
      <PageHeader eyebrow="Today" title="School overview" description="Start with the work that needs attention, or open a workspace to manage school operations." actions={<Button variant="primary" onClick={() => onNavigate('intelligence_workspace')}>Review insights</Button>} />
      <div className="home-metrics">
        {cards.map((card) => <Metric key={card.label} {...card} />)}
      </div>
      <div className="home-grid">
        <Panel title="What would you like to do?" description="Principal’Ed groups related tools so you do not have to hunt through a technical module list.">
          <div className="home-actions">
            {actions.map((action) => <button key={action.view} onClick={() => onNavigate(action.view)}><strong>{action.label}</strong><small>{action.detail}</small><span>→</span></button>)}
          </div>
        </Panel>
        <Panel title="Recent notifications" description="Updates that may need a response.">
          <div className="home-notifications">
            {data.notifications?.length ? data.notifications.slice(0, 5).map((n, i) => (
              <article key={n.id || i}><strong>{n.title || n.message || 'Notification'}</strong><small>{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</small></article>
            )) : <EmptyState title="Nothing needs your attention" description="New notifications will appear here." />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default OverviewWidget;
