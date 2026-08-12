import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../../api/client';

const ACTIVE = new Set(['detected', 'presented', 'acknowledged', 'deferred']);
function tone(product) {
  if (product.severity === 'positive') return 'positive';
  if (product.product_type === 'data_quality') return 'quality';
  if (product.product_type === 'alert' || product.severity === 'warning' || product.severity === 'critical') return 'attention';
  return 'neutral';
}

function InsightCard({ product, onDecision }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const decide = async (action) => { setBusy(true); await onDecision(product.id, action); setBusy(false); };
  return <article className={`insight-card insight-${tone(product)}`}>
    <div className="insight-card-head"><span className="insight-kind">{product.product_type.replace('_', ' ')}</span><span>{Math.round((product.confidence || 0) * 100)}% confidence</span></div>
    <h3>{product.title}</h3><p>{product.summary}</p>
    {product.uncertainty && <p className="insight-uncertainty"><strong>What we do not know:</strong> {product.uncertainty}</p>}
    <button className="link-button" onClick={() => setOpen(!open)}>{open ? 'Hide explanation' : 'Why am I seeing this?'}</button>
    {open && <div className="insight-detail"><p>{product.explanation || 'This was generated from recorded evidence.'}</p><p><strong>Evidence:</strong> {product.evidence?.length || 0} supporting record(s)</p>{product.possibleActions?.length > 0 && <><strong>Possible next steps</strong><ul>{product.possibleActions.map(x => <li key={x}>{x}</li>)}</ul></>}</div>}
    {ACTIVE.has(product.status) && <div className="insight-actions"><button disabled={busy} onClick={() => decide('accepted')}>Act on this</button><button disabled={busy} onClick={() => decide('deferred')}>Come back later</button><button disabled={busy} onClick={() => decide('dismissed')}>Dismiss</button></div>}
    {!ACTIVE.has(product.status) && <div className="insight-status">{product.status}</div>}
  </article>;
}

export default function IntelligenceWorkspace() {
  const [products, setProducts] = useState([]); const [actions, setActions] = useState([]); const [loading, setLoading] = useState(true); const [running, setRunning] = useState(false); const [error, setError] = useState('');
  const load = async () => { try { setError(''); const [p, a] = await Promise.all([api.listInsightProducts(), api.listIntelligenceActions()]); setProducts(p.data.products || []); setActions(a.data.actions || []); } catch (e) { setError(e.response?.data?.error?.message || e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const groups = useMemo(() => ({
    positive: products.filter(p => tone(p) === 'positive'),
    attention: products.filter(p => tone(p) === 'attention' && ACTIVE.has(p.status)),
    changed: products.filter(p => tone(p) === 'neutral' && p.product_type !== 'reminder'),
    quality: products.filter(p => tone(p) === 'quality'),
    reminders: products.filter(p => p.product_type === 'reminder' && ACTIVE.has(p.status)),
    completed: actions.filter(a => a.status === 'completed'),
    open: actions.filter(a => a.status === 'open' || a.status === 'in_progress')
  }), [products, actions]);
  const analyse = async () => { setRunning(true); try { await Promise.all(['core.withdrawal-patterns', 'core.registry-quality', 'core.operational-strengths', 'core.cross-component'].map(id => api.runIntelligenceProvider(id, {}))); await api.generateIntelligenceReminders(); await load(); } catch (e) { setError(e.response?.data?.error?.message || e.message); } finally { setRunning(false); } };
  const decision = async (id, action) => { await api.decideOnInsight(id, { action }); if (action === 'accepted') { const item = products.find(p => p.id === id); await api.createIntelligenceAction({ insightId: id, title: item?.possibleActions?.[0] || `Review: ${item?.title}`, ownerId: 'local-desktop-owner' }); } await load(); };
  const section = (title, subtitle, items, empty) => <section className="workspace-section"><div className="workspace-section-title"><div><h2>{title}</h2><p>{subtitle}</p></div><span>{items.length}</span></div>{items.length ? <div className="insight-grid">{items.map(p => <InsightCard key={p.id} product={p} onDecision={decision} />)}</div> : <div className="workspace-empty">{empty}</div>}</section>;
  if (loading) return <div className="workspace-empty">Preparing your intelligence workspace…</div>;
  return <div className="intelligence-workspace">
    <header className="workspace-hero"><div><span className="eyebrow">Principal intelligence workspace</span><h1>Your school, in context</h1><p>Strengths, changes, priorities and blind spots—grounded in the information TimSyS actually has.</p></div><button onClick={analyse} disabled={running}>{running ? 'Reviewing records…' : 'Refresh insights'}</button></header>
    {error && <div className="workspace-error">{error}</div>}
    <div className="balance-strip"><div><strong>{groups.positive.length}</strong><span>Positive signals</span></div><div><strong>{groups.attention.length}</strong><span>Need attention</span></div><div><strong>{groups.open.length}</strong><span>Actions underway</span></div><div><strong>{groups.completed.length}</strong><span>Actions completed</span></div></div>
    {section('What is going well', 'Improvements and strengths worth recognising or sustaining.', groups.positive, 'No positive pattern has enough evidence yet. This does not mean nothing is going well.')}
    {section('Needs your attention', 'Material changes that may warrant a decision.', groups.attention, 'Nothing currently meets the alert threshold.')}
    {section('What has changed', 'Factual observations without an automatic judgement.', groups.changed, 'No new observations are available.')}
    {section('Waiting for you', 'Due, overdue or deferred work.', groups.reminders, 'Nothing is waiting for your attention.')}
    {section('Data confidence and blind spots', 'Missing or weak information that limits what TimSyS can responsibly conclude.', groups.quality, 'No material data-quality concern has been detected.')}
    <section className="workspace-section"><div className="workspace-section-title"><div><h2>Work in progress</h2><p>Actions created from accepted insights.</p></div><span>{groups.open.length}</span></div>{groups.open.length ? <div className="action-list">{groups.open.map(a => <div key={a.id}><div><strong>{a.title}</strong><p>{a.due_at ? `Due ${new Date(a.due_at).toLocaleDateString()}` : 'No due date set'}</p></div><button onClick={async () => { await api.updateIntelligenceAction(a.id, { status: 'completed' }); await load(); }}>Mark complete</button></div>)}</div> : <div className="workspace-empty">No actions are currently underway.</div>}</section>
  </div>;
}
