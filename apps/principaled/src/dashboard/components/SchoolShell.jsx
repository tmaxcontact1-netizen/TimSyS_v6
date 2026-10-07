import React, { useEffect, useRef, useState } from 'react';
import './school-workspace.css';

// Navigation receives only the caller's enabled, authorised destinations.
export default function SchoolShell({ navigation = [], pages = [], active, onNavigate, onLauncher, children }) {
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const searchRef = useRef(null);
  const contentRef = useRef(null);
  const parent = navigation.find(item => item.modules?.includes(active));
  const current = pages.find(item => item.id === active) || navigation.find(item => item.id === active);
  useEffect(() => { if (parent) setExpanded(old => ({ ...old, [parent.id]: true })); setMobileOpen(false); setQuery(''); }, [active, parent?.id]);
  useEffect(() => {
    const keys = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('[aria-modal="true"]')) { event.preventDefault(); setMobileOpen(true); requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select(); }); }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) { setQuery(''); setMobileOpen(false); }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, []);
  useEffect(() => { contentRef.current?.focus({ preventScroll: true }); }, [active]);
  const go = id => { void onNavigate?.(id); };
  const found = pages.filter(item => `${item.label} ${item.description || ''}`.toLowerCase().includes(query.toLowerCase()));
  const link = item => <button key={item.id} type="button" aria-current={active === item.id ? 'page' : undefined} onClick={() => go(item.id)}>{item.label}</button>;
  return <div className="school-shell">
    <a className="school-skip" href="#school-content">Skip to page content</a>
    <aside className={`school-sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Principal’Ed navigation">
      <div className="school-brand"><strong>Principal’Ed</strong><span>Your school, organised</span></div>
      <label className="school-page-search"><span>Find a page</span><input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search pages…" aria-keyshortcuts="Control+k Meta+k" /></label>
      {query && <button className="school-clear-search" onClick={() => { setQuery(''); searchRef.current?.focus(); }}>Clear page search</button>}
      <nav aria-label="Application">
        {query ? <div className="school-search-results"><small>{found.length} pages</small>{found.map(link)}{!found.length && <p>No matching pages. Try “staff”, “projects” or “documents”.</p>}</div> : <>
          {navigation.filter(item => !item.modules).map(link)}
          {pages.filter(item => ['execution', 'calendar', 'approvals'].includes(item.id)).map(link)}
          <p className="school-nav-caption">School</p>
          {navigation.filter(item => item.modules).map(group => <div className="school-nav-group" key={group.id}>
            <button className="school-group-toggle" aria-expanded={Boolean(expanded[group.id])} aria-controls={`school-group-${group.id}`} onClick={() => setExpanded(old => ({ ...old, [group.id]: !old[group.id] }))}><span>{group.label}</span><span aria-hidden="true">{expanded[group.id] ? '−' : '+'}</span></button>
            {expanded[group.id] && <div id={`school-group-${group.id}`} className="school-group-pages">{pages.filter(item => group.modules.includes(item.id) && !['execution', 'calendar', 'approvals'].includes(item.id)).map(link)}</div>}
          </div>)}
        </>}
      </nav>
      <button className="school-launcher" onClick={onLauncher}>Switch app</button>
    </aside>
    <div className="school-body">
      <header className="school-topbar"><button className="school-menu-toggle" aria-expanded={mobileOpen} onClick={() => setMobileOpen(value => !value)}>Menu</button><nav aria-label="Breadcrumb"><button onClick={() => go('overview')}>Home</button>{parent && <><span aria-hidden="true">/</span><button onClick={() => go(parent.id)}>{parent.label}</button></>}{active !== 'overview' && <><span aria-hidden="true">/</span><span aria-current="page">{current?.label || 'School workspace'}</span></>}</nav><span className="school-topbar-hint">Find a page · Ctrl K</span></header>
      <main ref={contentRef} id="school-content" tabIndex={-1} className="school-content">{children}</main>
    </div>
  </div>;
}
