import React, { useEffect, useRef, useState } from 'react';
import api from '../api/base';
import useAuthStore from '../store/authStore';
import './assistant.css';

const root = '/ai-gateway';
function SourceLink({ link }) {
  if (!/^https?:\/\//i.test(link.url)) return null;
  return <a href={link.url} target="_blank" rel="noreferrer" onClick={e => { if (window.electronAPI?.assistant?.openSource) { e.preventDefault(); window.electronAPI.assistant.openSource(link.url); } }}>{link.title || link.url}</a>;
}
function Answer({ message }) {
  return <div className="ai-answer">{message.content.split(/(\[S\d+\]|\*\*[^*]+\*\*|`[^`\n]+`)/g).map((text, i) => {
    const source = /^\[S\d+\]$/.test(text) && message.sources?.find(s => '[' + s.id + ']' === text);
    if (source) return <button key={i} className="ai-citation" onClick={() => { const target = document.getElementById(message.id + '-' + source.id); if (target) { target.parentElement.open = true; target.open = true; target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }}>{text}</button>;
    if (text.startsWith('**') && text.endsWith('**')) return <strong key={i}>{text.slice(2, -2)}</strong>;
    if (text.startsWith('`') && text.endsWith('`')) return <code key={i}>{text.slice(1, -1)}</code>;
    return text;
  })}</div>;
}
async function call(method, path, data) {
  const response = await api({ method, baseURL: '/', url: root + path, data });
  if (response.data.success === false) throw new Error(response.data.error?.message || 'Unable to complete the request.');
  return response.data;
}
function Connections({ onApplied }) {
  const bridge = window.electronAPI?.assistant;
  const [profiles, setProfiles] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [appConnections, setAppConnections] = useState([]);
  const [tab, setTab] = useState('accounts');
  const [chatgpt, setChatgpt] = useState({ accounts: [] }), [signingIn, setSigningIn] = useState(false);
  const [form, setForm] = useState({ protocol: 'openai-responses', name: 'OpenAI', baseUrl: 'https://api.openai.com', model: '', apiKey: '' });
  const visibleProfiles = profiles.filter(p => (p.protocol === 'chatgpt-plan') === (tab === 'accounts'));
  const active = visibleProfiles.find(p => p.active);
  function selectTab(value) { setTab(value); setError(''); setNotice(''); }
  function loadProfiles(result) {
    setProfiles(result.profiles);
    setAppConnections(result.appConnections || []);
    if (result.chatgpt) setChatgpt(result.chatgpt);
    const selected = result.profiles.find(p => p.active);
    if (selected && selected.protocol !== 'chatgpt-plan') setForm({ id: selected.id, protocol: selected.protocol, name: selected.name, baseUrl: selected.baseUrl, model: selected.model, apiKey: '' });
  }
  useEffect(() => { bridge?.profiles().then(loadProfiles).catch(e => setError(e.message)); }, []);
  async function action(fn, progress = 'Testing connection…') {
    setBusy(true); setError(''); setNotice(progress);
    try { const result = await fn(); loadProfiles(result); setNotice(result.notice || ''); onApplied(); }
    catch (e) { setError(e.message); setNotice(''); bridge.profiles().then(loadProfiles).catch(() => {}); } finally { setBusy(false); }
  }
  async function signIn(id) { setSigningIn(true); try { await action(() => bridge.chatgptSignIn(id), 'Waiting for ChatGPT sign-in in your browser, then testing…'); } finally { setSigningIn(false); } }
  if (!bridge) return <p>Provider connections are managed in the TimSyS desktop assistant.</p>;
  return <section className="ai-connections" aria-label="AI connections">
    <h2>AI Integration</h2>
    {appConnections.map(app => <React.Fragment key={app.app}>{app.restartRequired && <p role="status">Research’Ed is still using its previous AI connection. Close and reopen Research’Ed to apply the selected connection. The shared assistant uses the current selection immediately.</p>}{app.warning && <p role="status">{app.warning}</p>}</React.Fragment>)}
    <div className="ai-connection-tabs" role="tablist" aria-label="Connection type">
      {[['accounts', 'AI connections'], ['api', 'API connections']].map(([value, label]) => <button key={value} id={'connection-tab-' + value} role="tab" aria-selected={tab === value} aria-controls={'connection-panel-' + value} tabIndex={tab === value ? 0 : -1} disabled={busy} onClick={() => selectTab(value)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'accounts' : e.key === 'End' ? 'api' : tab === 'accounts' ? 'api' : 'accounts'; selectTab(next); document.getElementById('connection-tab-' + next)?.focus(); } }}>{label}</button>)}
    </div>
    <div id={'connection-panel-' + tab} role="tabpanel" aria-labelledby={'connection-tab-' + tab}>
    <p>{tab === 'accounts' ? 'Connect an AI account using browser sign-in.' : 'Connect a provider using an API key.'}</p>
    <div role="status" aria-live="polite" className={'ai-connection-status ' + (active?.verification?.status || '')}>
      {busy ? notice : active ? <><strong>{active.verification?.status === 'verified' ? '✓ Connected and verified' : active.verification?.status === 'failed' ? 'Connection test failed' : 'Saved · not yet verified'}</strong><p>{active.name} · {active.model}</p>{active.verification?.checkedAt && <p>Last tested: {new Date(active.verification.checkedAt).toLocaleString()}</p>}{active.verification?.message && <p>{active.verification.message}</p>}</> : visibleProfiles.length ? 'Select a saved connection below to use it.' : tab === 'accounts' ? 'No AI account connected yet.' : 'No API connection saved yet.'}
    </div>
    {active && <button disabled={busy} onClick={() => action(() => bridge.testConnection())}>{busy ? 'Testing…' : 'Test connection'}</button>}
    {active && <p className="ai-muted">{active.protocol === 'chatgpt-plan' ? 'Using your ChatGPT plan allowance.' : 'Using API billing for this provider.'}</p>}
    {visibleProfiles.map(p => <button disabled={busy} key={p.id} onClick={() => action(() => bridge.activateProfile(p.id), 'Selecting connection…')}>{p.active ? 'Active: ' : ''}{p.name} · {p.model}</button>)}
    {tab === 'accounts' ? <>
    <h3>ChatGPT plan</h3>
    <p>Use an eligible ChatGPT plan through browser sign-in. Your existing plan limits apply.</p>
    <button className="ai-primary" disabled={busy} onClick={() => signIn()}>Continue with ChatGPT</button>
    {signingIn && <button onClick={() => bridge.chatgptCancel().catch(e => setError(e.message))}>Cancel sign-in</button>}
    {chatgpt.accounts.map(account => <div key={account.id} className="ai-plan-account">
      <strong>{account.label}</strong><p>{account.connected ? 'Signed in' : 'Sign-in required'}</p>
      {account.connected ? <>
        <label>ChatGPT model<select aria-label={'Model for ' + account.label} disabled={busy} value={profiles.find(p => p.accountId === account.id)?.model || ''} onChange={e => action(() => bridge.chatgptSelect({ accountId: account.id, model: e.target.value }))}>
          <option value="" disabled>Select an available model</option>{account.models.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select></label>
        <button disabled={busy} onClick={() => action(() => bridge.chatgptModels(account.id), 'Refreshing available models…')}>Refresh models</button>
        <button disabled={busy} onClick={() => action(() => bridge.chatgptSignOut(account.id), 'Signing out…')}>Sign out</button>
      </> : <button disabled={busy} onClick={() => signIn(account.id)}>Reconnect with ChatGPT</button>}
    </div>)}
    <p><SourceLink link={{ title: 'Manage ChatGPT plan and usage', url: 'https://chatgpt.com/' }} /></p>
    <p className="ai-muted">Account credentials are encrypted by Windows. Conversations and retrieved sources are sent to your selected AI provider.</p>
    </> : <>
    <h3>API connection</h3><p>OpenAI API and Gemini use their own API billing and quotas.</p>
    <form onSubmit={e => { e.preventDefault(); action(() => bridge.saveProfile({ ...form, active: true })); }}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <label>Provider<select value={form.protocol} onChange={e => { const gemini = e.target.value === 'gemini'; setForm({ protocol: e.target.value, name: gemini ? 'Gemini' : 'OpenAI', baseUrl: gemini ? 'https://generativelanguage.googleapis.com' : 'https://api.openai.com', model: '', apiKey: '' }); }}><option value="openai-responses">OpenAI API</option><option value="gemini">Gemini API</option></select></label>
      <label>Connection name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>Model<input required placeholder="Enter your model ID" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} /></label>
      <label>API key<input required={!form.id} type="password" autoComplete="off" placeholder={form.id ? 'Saved securely · leave blank to keep' : ''} value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} /></label>
      <button className="ai-primary" disabled={busy}>{busy ? 'Testing connection…' : 'Save and test connection'}</button>
      </fieldset>
    </form>
    <p className="ai-muted">Testing sends a short request to the selected model. Normal API usage charges may apply.</p>
    <p className="ai-muted">Keys are encrypted by Windows. Conversations and retrieved sources are sent to your selected provider.</p>
    </>}
    {!busy && notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
    </div>
  </section>;
}
export default function AssistantPanel({ onClose }) {
  const authenticated = useAuthStore(s => s.isAuthenticated), initializing = useAuthStore(s => s.isInitializing);
  const [status, setStatus] = useState(null), [conversations, setConversations] = useState([]), [id, setId] = useState('');
  const [messages, setMessages] = useState([]), [draft, setDraft] = useState(''), [settings, setSettings] = useState(() => new URLSearchParams(window.location.search).get('settings') === 'connections');
  useEffect(() => window.electronAPI?.assistant?.onSettings?.(() => setSettings(true)), []);
  const [error, setError] = useState(''), [sending, setSending] = useState(false), [history, setHistory] = useState(false);
  const [context, setContext] = useState(null);
  const [connection, setConnection] = useState(null);
  const [web, setWeb] = useState(false);
  const bottom = useRef(null), input = useRef(null), generation = useRef(0);
  const appId = new URLSearchParams(window.location.search).get('app') || window.location.pathname.split('/app/')[1]?.split('/')[0] || 'timsys';
  const busy = sending || messages.some(m => m.status === 'running');
  async function refreshStatus() { setStatus(await call('get', '/assistant')); if (window.electronAPI?.assistant) setConnection((await window.electronAPI.assistant.profiles()).profiles.find(p => p.active)); }
  async function refreshHistory() { setConversations((await call('get', '/conversations')).conversations); }
  useEffect(() => {
    if (authenticated) { refreshStatus().catch(e => setError(e.message)); refreshHistory().catch(e => setError(e.message)); }
  }, [authenticated]);
  useEffect(() => {
    const current = ++generation.current;
    setMessages([]); setError('');
    if (!id) return undefined;
    let timer, cancelled = false;
    const poll = async () => {
      try {
        const result = await call('get', '/conversations/' + id);
        if (!cancelled && current === generation.current) { setMessages(result.messages); timer = setTimeout(poll, result.messages.some(m => m.status === 'running') ? 900 : 3500); }
      } catch (e) { if (!cancelled) setError(e.message); }
    };
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [id]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length, messages.at(-1)?.status]);
  async function send(e) {
    e.preventDefault(); if (!draft.trim() || busy) return;
    setSending(true); setError('');
    try {
      let conversationId = id;
      if (!conversationId) { conversationId = (await call('post', '/conversations', { appId })).id; setId(conversationId); }
      await call('post', '/conversations/' + conversationId + '/messages', { text: draft, web, ...(context ? { context } : {}) });
      setDraft(''); setContext(null); setMessages((await call('get', '/conversations/' + conversationId)).messages); await refreshHistory();
    } catch (e) { setError(e.message); } finally { setSending(false); input.current?.focus(); }
  }
  async function remove() {
    try { await call('delete', '/conversations/' + id); setId(''); await refreshHistory(); } catch (e) { setError(e.message); }
  }
  return <aside className="ai-panel" aria-label="TimSyS AI assistant">
    <header className="ai-header"><div><strong>TimSyS AI</strong><span>{status?.configured ? `${connection?.protocol === 'chatgpt-plan' ? 'ChatGPT plan' : status.provider === 'gemini' ? 'Gemini API' : 'OpenAI API'} · ${status.model}` : 'Your thinking partner'}</span></div>
      <button aria-label="Assistant settings" title="Connections" onClick={() => setSettings(!settings)}>⚙</button>
      <button aria-label="Close assistant" onClick={onClose || (() => window.electronAPI?.assistant?.close())}>×</button>
    </header>
    {!authenticated ? <div className="ai-empty"><h2>Ask TimSyS</h2><p>Sign in to explore your information.</p><button disabled={initializing} onClick={() => useAuthStore.getState().login({}).catch(e => setError(e.message))}>Sign in</button>{error && <p role="alert">{error}</p>}</div> : <>
      <nav className="ai-toolbar"><button disabled={sending} onClick={() => { setId(''); setHistory(false); setSettings(false); input.current?.focus(); }}>＋ New chat</button><button onClick={() => { setHistory(!history); refreshHistory().catch(e => setError(e.message)); }}>History</button>{id && <button disabled={busy} onClick={remove}>Delete chat</button>}</nav>
      {settings ? <div className="ai-scroll"><Connections onApplied={() => refreshStatus().catch(e => setError(e.message))} /></div> : <>
        {history && <div className="ai-history">{conversations.length ? conversations.map(c => <button key={c.id} aria-current={id === c.id} onClick={() => { setId(c.id); setHistory(false); }}>{c.title}</button>) : <p>No conversations yet.</p>}</div>}
        <div className="ai-scroll" role="log" aria-label="Conversation" aria-live="polite">
          {!messages.length && <div className="ai-empty"><div className="ai-spark">✦</div><h2>What would you like to explore?</h2><p>Ask a question, follow an idea, or dig into your records. Keep asking until you have what you need.</p>
            {['What information can you explore here?', 'Help me think through a problem', 'What needs my attention?'].map(s => <button key={s} onClick={() => { setDraft(s); input.current?.focus(); }}>{s} ↗</button>)}
          </div>}
          {messages.map(m => <article key={m.id} className={'ai-message ai-' + m.role}><strong>{m.role === 'user' ? 'You' : 'TimSyS AI'}</strong>
            {m.status === 'running' ? <p className="ai-progress" role="status">{m.progress || 'Thinking…'}</p> : <Answer message={m} />}
            {!!m.sources?.length && <details className="ai-sources"><summary>Sources read · {m.sources.length}</summary>{m.sources.map(s => <details id={m.id + '-' + s.id} key={s.id}><summary>[{s.id}] {s.label}</summary>{s.links?.map((link, i) => <div key={i}><SourceLink link={link} /></div>)}<pre>{typeof s.data === 'string' ? s.data : JSON.stringify(s.data, null, 2)}</pre></details>)}</details>}
            {m.sources?.flatMap(s => s.links || []).map((link, i) => <div className="ai-web-link" key={i}><SourceLink link={link} /></div>)}
            {m.sources?.filter(s => s.suggestions).map(s => <iframe key={s.id} className="ai-search-suggestions" title="Google Search suggestions" sandbox="allow-popups" srcDoc={s.suggestions} />)}
          </article>)}<div ref={bottom} />
        </div>
        <footer className="ai-composer">
          {appId !== 'researched' && window.electronAPI?.assistant?.context && <button className="ai-context" onClick={() => context ? setContext(null) : window.electronAPI.assistant.context().then(setContext).catch(e => setError(e.message))}>{context ? '✓ Page attached · Remove' : '＋ Use current page'}</button>}
          {appId === 'researched' && <p className="ai-muted">Ask about a saved project or report. Evidence access respects Research’Ed’s blind-review restrictions.</p>}
          <label className="ai-web-option"><input type="checkbox" checked={web} onChange={e => setWeb(e.target.checked)} /> Research the web</label>
          {!status?.configured && <p>Connect <button onClick={() => setSettings(true)}>OpenAI or Gemini</button> to start.</p>}
          {error && <p role="alert" className="ai-error">{error}</p>}
          <form onSubmit={send}><textarea ref={input} aria-label="Message TimSyS AI" placeholder="Ask anything…" value={draft} maxLength={16000} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(e); } }} />
            {busy ? <button type="button" onClick={() => call('post', '/conversations/' + id + '/cancel', {}).catch(e => setError(e.message))}>Stop</button> : <button className="ai-primary" disabled={!draft.trim() || !status?.configured}>Send ↑</button>}
          </form><p className="ai-muted">Reads available sources when needed. Check the sources behind important answers.</p>
        </footer>
      </>}
    </>}
  </aside>;
}
