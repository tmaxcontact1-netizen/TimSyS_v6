'use strict';
// Official Sign in with ChatGPT: credentials stay in the Electron main process.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const AUTH = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random = () => crypto.randomBytes(32).toString('base64url');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
async function limitedJson(response, limit = 2_000_000) {
  let size = 0; const chunks = [];
  for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw fail('Provider response was too large.'); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw fail('ChatGPT returned an unreadable response.', 502); }
}
function providerError(status, code) {
  if (['subscription_sharing_usage_limit_exceeded', 'subscription_sharing_usage_unavailable'].includes(code)) return fail('ChatGPT plan usage is unavailable or its allowance has been reached. Check usage in ChatGPT, then retry.', 429);
  if (status === 401) return fail('ChatGPT sign-in has expired. Continue with ChatGPT again.', 401);
  if (status === 403) return fail('This ChatGPT account has not granted plan access, or the model is unavailable to its plan.', 403);
  if (status === 429) return fail('ChatGPT reports a plan usage or rate limit. Check usage in ChatGPT, then retry.', 429);
  return fail('ChatGPT could not complete the request (HTTP ' + status + '). Try again.', status || 502);
}
function planRequest(body) {
  const allowed = ['model', 'instructions', 'input', 'tools', 'tool_choice', 'parallel_tool_calls', 'reasoning', 'text', 'include'];
  const result = Object.fromEntries(allowed.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
  result.input = typeof result.input === 'string' ? [{ role: 'user', content: result.input }] : result.input;
  if (!Array.isArray(result.input)) throw fail('A conversation is required.');
  result.input = result.input.map(item => item.role === 'system' ? { ...item, role: 'developer' } : item);
  if (result.tools) {
    const functions = result.tools.filter(t => t.type === 'function');
    result.tools = result.tools.filter(t => t.type !== 'function');
    if (result.tools.some(t => !['web_search', 'namespace'].includes(t.type))) throw fail('This tool is not supported by the ChatGPT plan connection.');
    if (functions.length) result.tools.push({ type: 'namespace', name: 'timsys', description: 'Read information from TimSyS.', tools: functions });
  }
  return { ...result, store: false, stream: true };
}
async function completedResponse(response) {
  if (!response.ok) { let body; try { body = await limitedJson(response, 65536); } catch {} throw providerError(response.status, body?.error?.code); }
  // Inspect the body instead of treating a content-type label as proof of success
  // or failure. Some transports buffer a streamed request into a JSON response.
  const complete = (value, transport) => {
    if (value?.error || value?.status === 'failed') throw providerError(502, value?.error?.code);
    if (value?.status !== 'completed' || !Array.isArray(value.output)) throw fail('ChatGPT did not complete its reply. Connection not verified.', 502);
    Object.defineProperty(value, 'timsysTransport', { value: transport, enumerable: false });
    return value;
  };
  if (!response.body?.getReader) throw fail('ChatGPT returned an empty response. Connection not verified.', 502);
  const reader = response.body.getReader(), decoder = new TextDecoder();
  const completedItems = new Map();
  let buffer = '', size = 0, format = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_000_000) throw fail('ChatGPT response was too large.', 502);
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
      if (!format && buffer.trimStart()) {
        const start = buffer.trimStart();
        if (start.startsWith('{')) format = 'json';
        else if (/^(?:data:|event:|:)/.test(start)) format = 'sse';
        else if (start.length > 16) throw fail('ChatGPT returned an unexpected response format. Connection not verified.', 502);
      }
      if (format !== 'sse') continue;
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        const data = event.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
        if (!data || data === '[DONE]') continue;
        let parsed; try { parsed = JSON.parse(data); } catch { throw fail('ChatGPT returned an unreadable response stream.', 502); }
        if (parsed.type === 'response.failed' || parsed.type === 'error') throw providerError(502, parsed.response?.error?.code || parsed.code);
        if (parsed.type === 'response.incomplete') throw fail('ChatGPT did not complete its reply. Try again.', 502);
        if (parsed.type === 'response.output_item.done' && Number.isSafeInteger(parsed.output_index) && parsed.output_index >= 0 && parsed.item && typeof parsed.item === 'object') completedItems.set(parsed.output_index, parsed.item);
        if (parsed.type === 'response.completed') {
          const result = complete(parsed.response, 'sse');
          // Some plan streams omit items from the final summary after sending
          // them as output_item.done. Only completed items may fill that gap.
          if (!result.output.length && completedItems.size) result.output = [...completedItems].sort(([a], [b]) => a - b).map(([, item]) => item);
          return result;
        }
      }
    }
    if (format === 'json') {
      let parsed; try { parsed = JSON.parse(buffer + decoder.decode()); } catch { throw fail('ChatGPT returned an unreadable JSON response. Connection not verified.', 502); }
      if (parsed.error || parsed.type === 'response.failed' || parsed.type === 'error') throw providerError(502, parsed.error?.code || parsed.response?.error?.code || parsed.code);
      if (parsed.type === 'response.completed') return complete(parsed.response, 'json-event');
      if (parsed.object === 'response' && typeof parsed.id === 'string' && parsed.id.startsWith('resp_')) return complete(parsed, 'json-response');
      throw fail('ChatGPT returned JSON without a completed Responses result. Connection not verified.', 502);
    }
    throw fail('ChatGPT disconnected before completing its reply. Connection not verified.', 502);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

class ChatGptPlan {
  constructor({ file, safeStorage, openExternal, fetcher = global.fetch }) {
    Object.assign(this, { file, safeStorage, openExternal, fetcher });
    this.locks = new Map(); this.routes = new Map(); this.inflight = new Map(); this.queue = Promise.resolve();
  }
  async read() {
    if (!this.safeStorage.isEncryptionAvailable()) throw fail('Windows credential encryption is unavailable.');
    try { return JSON.parse(this.safeStorage.decryptString(Buffer.from((await fs.readFile(this.file, 'utf8')), 'base64'))); }
    catch (e) { if (e.code === 'ENOENT') return { hostId: null, accounts: [] }; throw fail('Could not unlock ChatGPT credentials on this Windows account.'); }
  }
  change(fn) {
    const work = this.queue.then(async () => {
      const data = await this.read(); const result = await fn(data);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temporary = this.file + '.' + process.pid + '.tmp';
      await fs.writeFile(temporary, this.safeStorage.encryptString(JSON.stringify(data)).toString('base64'), { mode: 0o600 });
      await fs.rename(temporary, this.file); return result;
    });
    this.queue = work.catch(() => {}); return work;
  }
  async status() {
    const data = await this.read();
    return { signingIn: Boolean(this.pending), accounts: data.accounts.map(a => ({ id: a.id, label: a.label, connected: Boolean(a.tokens?.refresh_token && !a.reauthenticate), models: a.models || [] })) };
  }
  async request(url, options = {}) {
    try { return await this.fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(30000), ...options }); }
    catch (e) { if (e.status) throw e; throw fail('Could not reach ChatGPT. Check your connection and retry.', 502); }
  }
  async discovery() {
    const response = await this.request(AUTH + '/.well-known/openid-configuration');
    if (!response.ok) throw providerError(response.status);
    const data = await limitedJson(response);
    if (data.issuer?.replace(/\/$/, '') !== AUTH) throw fail('Unexpected ChatGPT identity issuer.');
    for (const name of ['jwks_uri', 'revocation_endpoint']) {
      const url = new URL(data[name]);
      if (url.origin !== AUTH || url.username || url.password) throw fail('Unexpected ChatGPT identity endpoint.');
    }
    return data;
  }
  async identity(token, clientId, nonce, previous) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw fail('ChatGPT did not return a valid identity.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
    if (!['RS256', 'ES256'].includes(header.alg) || header.crit) throw fail('Unsupported ChatGPT identity signature.');
    const discovery = await this.discovery();
    const response = await this.request(discovery.jwks_uri);
    if (!response.ok) throw providerError(response.status);
    const keys = (await limitedJson(response)).keys;
    const jwk = keys?.find(k => k.kid === header.kid && (!k.alg || k.alg === header.alg) && (!k.use || k.use === 'sig') && k.kty === (header.alg === 'RS256' ? 'RSA' : 'EC'));
    if (!jwk || !crypto.verify('sha256', Buffer.from(parts[0] + '.' + parts[1]), { key: crypto.createPublicKey({ key: jwk, format: 'jwk' }), ...(header.alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' } : {}) }, Buffer.from(parts[2], 'base64url'))) throw fail('Could not validate the ChatGPT identity signature.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url')); const now = Date.now() / 1000;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (claims.iss !== discovery.issuer || !audiences.includes(clientId) || (audiences.length > 1 && claims.azp !== clientId) || (claims.azp && claims.azp !== clientId) || !Number.isFinite(claims.exp) || claims.exp <= now || (claims.nbf && claims.nbf > now + 30) || !claims.sub || (nonce && !equal(claims.nonce, nonce)) || (previous && (previous.subject !== claims.sub || previous.issuer !== claims.iss))) throw fail('ChatGPT identity validation failed. Start sign-in again.');
    return claims;
  }
  validateTokens(tokens, previous) {
    if (tokens.token_type?.toLowerCase() !== 'bearer' || typeof tokens.access_token !== 'string' || !tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0) throw fail('ChatGPT returned an invalid session.');
    const scope = tokens.scope || previous?.scope;
    if (!scope?.split(' ').includes('chatgpt.tokens.use.direct')) throw fail('Identity confirmed, but ChatGPT plan access was not granted. Continue with ChatGPT and allow plan usage.');
    const merged = { ...previous, ...tokens, scope, expiresAt: Date.now() + tokens.expires_in * 1000 };
    if (!merged.refresh_token) throw fail('ChatGPT did not grant renewable access. Sign in again.');
    return merged;
  }
  async tokenRequest(params) {
    const response = await this.request(AUTH + '/api/accounts/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...params, resource: RESOURCE }).toString() });
    if (!response.ok) throw fail('ChatGPT sign-in could not be renewed or completed. Continue with ChatGPT again.', response.status === 400 ? 401 : response.status);
    return limitedJson(response, 131072);
  }
  cancel() { this.pending?.finish(fail('ChatGPT sign-in cancelled.')); }
  async signIn(id) {
    if (this.pending) throw fail('A ChatGPT sign-in is already in progress.');
    // Reserve the attempt before asynchronous disk work, preventing duplicate callbacks.
    const attempt = {}; this.pending = attempt;
    let server, timer;
    try {
      const data = await this.change(data => { data.hostId ||= 'urn:uuid:' + crypto.randomUUID(); return data; });
      const previous = id ? data.accounts.find(a => a.id === id) : null;
      if (id && !previous) throw fail('ChatGPT account not found.');
      const state = random(), nonce = random(), verifier = random();
      let settle; const callback = new Promise((resolve, reject) => { settle = (e, value) => e ? reject(e) : resolve(value); });
      // Attach a rejection handler before opening the browser, including cancellation during launch.
      callback.catch(() => {});
      attempt.finish = settle;
      let handled = false;
      server = http.createServer((req, res) => {
        res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Security-Policy', "default-src 'none'"); res.setHeader('Referrer-Policy', 'no-referrer');
        let url; try { url = new URL(req.url, redirectUri); } catch { res.writeHead(400); res.end('Invalid callback.'); return; }
        if (req.method !== 'GET' || req.headers.host !== new URL(redirectUri).host || url.pathname !== '/auth/callback' || !equal(url.searchParams.get('state'), state) || handled) { res.writeHead(400); res.end('Invalid or expired sign-in callback.'); return; }
        handled = true;
        if (url.searchParams.has('error')) { res.end('ChatGPT sign-in was not completed. Return to TimSyS.'); settle(fail('ChatGPT sign-in was declined or unavailable. Try again.')); return; }
        const clientId = url.searchParams.get('client_id') || previous?.clientId;
        if (!clientId || clientId === 'dynamic_agent_client' || (previous && clientId !== previous.clientId) || !url.searchParams.get('code')) { res.writeHead(400); res.end('Invalid registration. Return to TimSyS.'); settle(fail('ChatGPT registration was not valid.')); return; }
        res.end('Authorization received. Return to TimSyS to see the connection result.');
        settle(null, { clientId, code: url.searchParams.get('code') });
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      const redirectUri = 'http://127.0.0.1:' + server.address().port + '/auth/callback';
      timer = setTimeout(() => settle(fail('ChatGPT sign-in timed out. Try again.')), 300000);
      const url = new URL(AUTH + '/api/accounts/authorize');
      url.search = new URLSearchParams({ client_id: previous?.clientId || 'dynamic_agent_client', ...(previous ? {} : { agent_name_hint: 'TimSyS' }), ext_agent_host_id: data.hostId, response_type: 'code', redirect_uri: redirectUri, scope: SCOPE, resource: RESOURCE, state, nonce, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', ...(previous?.tokens?.id_token ? { id_token_hint: previous.tokens.id_token } : {}), ...(previous?.email ? { login_hint: previous.email } : {}) }).toString();
      await this.openExternal(url.href);
      const result = await callback;
      const tokens = this.validateTokens(await this.tokenRequest({ grant_type: 'authorization_code', client_id: result.clientId, code: result.code, code_verifier: verifier, redirect_uri: redirectUri }));
      const identity = await this.identity(tokens.id_token, result.clientId, nonce, previous);
      const account = { id: previous?.id || crypto.randomUUID(), clientId: result.clientId, subject: identity.sub, issuer: identity.iss, email: identity.email || '', label: previous?.label || (identity.email || 'ChatGPT account') + ' · ' + crypto.randomBytes(3).toString('hex'), tokens, models: previous?.models || [] };
      await this.change(data => { data.accounts = data.accounts.filter(a => a.id !== account.id); data.accounts.push(account); });
      this.inflight.delete(account.id);
      return account.id;
    } finally { clearTimeout(timer); server?.close(); server?.closeAllConnections(); if (this.pending === attempt) this.pending = null; }
  }
  async access(id) {
    if (this.locks.has(id)) return this.locks.get(id);
    const work = (async () => {
      const account = (await this.read()).accounts.find(a => a.id === id);
      if (!account?.tokens || account.reauthenticate || this.inflight.get(id)?.signedOut) throw fail('Continue with ChatGPT to reconnect this account.', 401);
      if (account.tokens.expiresAt > Date.now() + 60000) return account.tokens.access_token;
      try {
        const raw = await this.tokenRequest({ grant_type: 'refresh_token', client_id: account.clientId, refresh_token: account.tokens.refresh_token });
        if (raw.id_token) await this.identity(raw.id_token, account.clientId, null, account);
        const tokens = this.validateTokens(raw, account.tokens);
        await this.change(data => { const current = data.accounts.find(a => a.id === id); if (!current?.tokens) throw fail('ChatGPT account was signed out.', 401); current.tokens = tokens; });
        return tokens.access_token;
      } catch (e) { if (e.status === 401) await this.change(data => { const current = data.accounts.find(a => a.id === id); if (current) current.reauthenticate = true; }); throw e; }
    })();
    this.locks.set(id, work);
    try { return await work; } finally { if (this.locks.get(id) === work) this.locks.delete(id); }
  }
  async models(id) {
    const response = await this.request(RESOURCE + '/models', { headers: { Authorization: 'Bearer ' + await this.access(id) } });
    if (!response.ok) throw providerError(response.status);
    const raw = await limitedJson(response);
    const models = (raw.models || []).filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ slug: m.slug, name: m.display_name || m.slug }));
    if (!models.length) throw fail('No models are available to this ChatGPT account. Check plan access.');
    await this.change(data => { data.accounts.find(a => a.id === id).models = models; });
    return models;
  }
  async generate(id, body, signal) {
    const controller = new AbortController();
    const controllers = this.inflight.get(id) || new Set(); this.inflight.set(id, controllers);
    if (controllers.signedOut) throw fail('ChatGPT account was signed out.', 401);
    controllers.add(controller);
    try {
      const access = await this.access(id);
      const response = await this.request(RESOURCE + '/responses', { method: 'POST', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(240000), ...(signal ? [signal] : [])]), headers: { Authorization: 'Bearer ' + access, 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(planRequest(body)) });
      return await completedResponse(response);
    } finally { controllers.delete(controller); }
  }
  async test(id, model) {
    const raw = await this.generate(id, { model, input: 'This is a connection test. Reply with only OK.' });
    if (!raw.output?.some(o => o.content?.some(c => c.type === 'output_text' && c.text?.trim()))) {
      const known = value => ['message', 'reasoning', 'function_call', 'output_text', 'text', 'refusal'].includes(value) ? value : 'other';
      const structure = raw.output.slice(0, 8).map(o => known(o.type) + ':' + (Array.isArray(o.content) ? o.content.slice(0, 8).map(c => known(c.type) + '(' + (typeof c.text === 'string' ? c.text.length : 0) + ')').join(',') : 'no content')).join('; ') || 'empty output';
      throw fail('ChatGPT completed without a text reply. Connection not verified. Response: ' + raw.timsysTransport + '; ' + structure + '.');
    }
    return { status: 'verified', checkedAt: new Date().toISOString(), provider: 'chatgpt-plan', model, responseFormat: raw.timsysTransport };
  }
  async signOut(id) {
    if (this.pending) throw fail('Finish or cancel the current sign-in first.');
    const controllers = this.inflight.get(id) || new Set(); controllers.signedOut = true; this.inflight.set(id, controllers);
    for (const controller of controllers) controller.abort();
    for (const [secret, route] of this.routes) if (route.id === id) this.routes.delete(secret);
    await this.locks.get(id)?.catch(() => {});
    const account = (await this.read()).accounts.find(a => a.id === id);
    let revoked = !account?.tokens?.refresh_token;
    try {
      if (!revoked) {
        const discovery = await this.discovery();
        for (let i = 0; i < 2 && !revoked; i++) {
          try { const response = await this.request(discovery.revocation_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: account.tokens.refresh_token, token_type_hint: 'refresh_token', client_id: account.clientId }).toString() }); revoked = response.status === 200; } catch {}
          if (!revoked && i === 0) await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch { /* Local sign-out still completes if revocation is offline. */ }
    finally { await this.change(data => { const a = data.accounts.find(a => a.id === id); if (a) { delete a.tokens; a.models = []; } }); }
    return revoked ? 'Signed out of ChatGPT.' : 'Signed out locally. Session revocation could not be confirmed; revoke TimSyS access in ChatGPT settings.';
  }
  async environment(id, model) {
    // Each capability is bound to one account and model, so switching cannot redirect a running chat.
    if (!this.server) {
      this.server = http.createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
        const controller = new AbortController(); res.on('close', () => controller.abort());
        try {
          const secret = String(req.headers.authorization || '').replace(/^Bearer /, '');
          const route = this.routes.get(secret);
          if (req.method !== 'POST' || req.url !== '/v1/responses' || req.headers.origin || req.headers.host !== '127.0.0.1:' + this.server.address().port || !route) throw fail('Invalid local AI request.', 403);
          let size = 0; const chunks = [];
          for await (const chunk of req) { size += chunk.length; if (size > 2_000_000) throw fail('AI request is too large.', 413); chunks.push(chunk); }
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (body.model !== route.model) throw fail('Select this model in AI Integration first.');
          const result = await this.generate(route.id, body, controller.signal);
          res.end(JSON.stringify(result));
        } catch (e) { if (!res.destroyed) { res.statusCode = e.status || 502; res.end(JSON.stringify({ error: { code: 'chatgpt_plan_error', message: e.status ? e.message : 'ChatGPT request failed. Test the connection in AI Integration.' } })); } }
      });
      this.listening = new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(0, '127.0.0.1', resolve); });
    }
    await this.listening;
    let entry = [...this.routes].find(([, r]) => r.id === id && r.model === model);
    if (!entry) { entry = [random(), { id, model }]; this.routes.set(...entry); }
    return { protocol: 'openai-responses', model, baseUrl: 'http://127.0.0.1:' + this.server.address().port, apiKey: entry[0] };
  }
  close() { this.cancel(); for (const controllers of this.inflight.values()) for (const c of controllers) c.abort(); this.server?.close(); this.server?.closeAllConnections(); }
}
module.exports = { ChatGptPlan, planRequest, completedResponse };
