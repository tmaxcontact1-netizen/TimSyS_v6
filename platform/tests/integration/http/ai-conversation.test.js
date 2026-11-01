'use strict';
const helper = require('../../helpers/test-server');
describe('conversational assistant', () => {
  let server, token, fetchBefore, saved, db, mode = 'records', seen = [], toolOverride, toolSequence;
  beforeAll(async () => {
    saved = { ...process.env }; fetchBefore = global.fetch;
    Object.assign(process.env, { TIMSYS_AI_PROTOCOL: 'openai-responses', TIMSYS_AI_MODEL: 'fixture', TIMSYS_AI_BASE_URL: 'https://assistant.test' });
    global.fetch = async (url, opts) => {
      if (!String(url).startsWith('https://assistant.test')) return fetchBefore(url, opts);
      const body = JSON.parse(opts.body); seen.push(body);
      if (toolSequence) {
        const count = body.input.filter(item => item.type === 'function_call_output').length;
        const next = toolSequence[count];
        return Response.json({ status: 'completed', output: next ? [{ type: 'function_call', name: next.name, arguments: JSON.stringify(next.args), call_id: 'research' + count }] : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'The stored MCF report has deterministic proposals, not confirmed human coding [S2]. I read one supporting passage, unit-20 on page2 [S3]; the remaining units have not been examined.' }] }] });
      }
      if (mode === 'wait') return new Promise((resolve, reject) => opts.signal.addEventListener('abort', () => reject(opts.signal.reason), { once: true }));
      const gemini = Boolean(body.contents), last = gemini ? body.contents.at(-1) : body.input.at(-1);
      const done = gemini ? last.parts?.some(p => p.functionResponse) : last.type === 'function_call_output';
      const call = toolOverride || { name: 'read_records', args: { path: '/students', query: { q: 'Ada' } } };
      const text = done ? 'Found the student [S1].' : 'Let us explore your question.';
      return new Response(JSON.stringify(gemini ? { candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: mode === 'records' && !done ? [{ functionCall: call, thoughtSignature: 'preserved-signature' }] : [{ text }] } }] } :
        { status: 'completed', output: mode === 'records' && !done ? [{ type: 'function_call', name: call.name, arguments: JSON.stringify(call.args), call_id: 'call1' }] : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] }));
    };
    server = await helper.createTestServer('ai_conversations');
    token = (await server.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
    db = require('../../../shared/services/db');
    db.query("INSERT INTO students(student_id,first_name,last_name,date_of_birth,sex,enrollment_date) VALUES('ai-student','Ada','Lovelace','2010-01-01','Female','2025-09-01')");
  });
  afterAll(async () => { if (server) await server.cleanup(); global.fetch = fetchBefore; for (const key of Object.keys(process.env)) if (key.startsWith('TIMSYS_AI_')) delete process.env[key]; Object.assign(process.env, saved); });
  async function create(tok = token) { return (await server.makeRequest('POST', '/ai-gateway/conversations', { appId: 'timsys' }, tok)).data.id; }
  async function wait(id) {
    for (let i = 0; i < 60; i++) {
      const result = await server.makeRequest('GET', '/ai-gateway/conversations/' + id, null, token);
      if (result.data.messages?.at(-1)?.status !== 'running') return result.data;
      await new Promise(r => setTimeout(r, 50));
    }
    throw new Error('Assistant did not complete');
  }
  test('reads actual records, returns inspectable sources, and keeps conversational history', async () => {
    const id = await create();
    expect((await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/messages', { text: 'Find Ada' }, token)).status).toBe(200);
    const result = await wait(id), answer = result.messages.at(-1);
    expect(answer.status).toBe('completed'); expect(answer.sources[0].data.students[0].first_name).toBe('Ada');
    mode = 'chat';
    await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/messages', { text: 'Help me think about this' }, token);
    await wait(id);
    expect(seen.at(-1).input.some(m => m.content === 'Find Ada')).toBe(true);
    expect(seen.at(-1).input.at(-1).content).toBe('Help me think about this');
  });
  test('Gemini returns native tool responses and preserves signatures', async () => {
    mode = 'records'; process.env.TIMSYS_AI_PROTOCOL = 'gemini';
    const id = await create(); await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/messages', { text: 'Find Ada' }, token);
    expect((await wait(id)).messages.at(-1).status).toBe('completed');
    const turns = seen.at(-1).contents;
    expect(turns[1].parts[0].thoughtSignature).toBe('preserved-signature');
    expect(turns[2].parts[0].functionResponse.response.result.data.students[0].first_name).toBe('Ada');
    process.env.TIMSYS_AI_PROTOCOL = 'openai-responses';
  });
  test('isolates owners and checks data permissions for each tool', async () => {
    const jwt = require('jsonwebtoken');
    const restricted = jwt.sign({ userId: 'limited', permissions: ['ai:researched:use'] }, process.env.JWT_SECRET);
    const id = await create();
    expect((await server.makeRequest('GET', '/ai-gateway/conversations/' + id, null, restricted)).status).toBe(404);
    expect((await server.makeRequest('DELETE', '/ai-gateway/conversations/' + id, null, restricted)).status).toBe(404);
    const other = await create(restricted);
    await server.makeRequest('POST', '/ai-gateway/conversations/' + other + '/messages', { text: 'Find Ada' }, restricted);
    for (let i = 0; i < 30 && !seen.at(-1)?.input?.some(m => m.type === 'function_call_output' && m.output.includes('permission denied')); i++) await new Promise(r => setTimeout(r, 50));
    expect(seen.at(-1).input.at(-1).output).toContain('permission denied');
    expect(seen.at(-1).input.at(-1).output).not.toContain('Lovelace');
    expect((await server.makeRequest('GET', '/ai-gateway/conversations')).status).toBe(401);
  });
  test('stops in-flight generation and rejects duplicate sends', async () => {
    mode = 'wait'; const id = await create();
    await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/messages', { text: 'Think' }, token);
    expect((await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/messages', { text: 'Again' }, token)).status).toBe(409);
    await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/cancel', {}, token);
    expect((await wait(id)).messages.at(-1).status).toBe('cancelled');
    await server.makeRequest('DELETE', '/ai-gateway/conversations/' + id, null, token);
    expect((await server.makeRequest('GET', '/ai-gateway/conversations/' + id, null, token)).status).toBe(404);
  });
  test('desktop bridge reads independent app data and rejects remote origins and unlisted endpoints', async () => {
    const http = require('node:http'); let requests = 0;
    let responseStatus = 200; const received = [];
    const source = http.createServer((req, res) => { requests++; received.push({ url: req.url, method: req.method, authorization: req.headers.authorization }); res.statusCode = responseStatus; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ items: [{ id: 'unit-stable-1', title: 'Synthetic study', passage: 'An exact supporting passage.', locator: { page: 2 }, storage_path: 'private-path' }], total: 21, nextOffset: 20 })); });
    await new Promise(resolve => source.listen(0, '127.0.0.1', resolve));
    process.env.TIMSYS_DESKTOP_TOKEN = 'test-desktop-bridge-token-32-characters';
    const config = { protocol: 'openai-responses', model: 'fixture', baseUrl: 'https://assistant.test', appUrls: { researched: 'http://127.0.0.1:' + source.address().port }, appTokens: { researched: 'research-bridge-secret-32-characters' } };
    const configure = body => fetchBefore(server.baseUrl + '/ai-gateway/assistant/configuration', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-TimSyS-Desktop-Token': process.env.TIMSYS_DESKTOP_TOKEN }, body: JSON.stringify(body) });
    try {
      expect((await server.makeRequest('POST', '/ai-gateway/assistant/configuration', config, token)).status).toBe(403);
      expect((await configure({ ...config, appUrls: { researched: 'https://remote.example' } })).status).toBe(400);
      expect((await configure(config)).status).toBe(200);
      mode = 'records'; toolOverride = { name: 'read_app_records', args: { app: 'researched', path: '/api/assistant/projects/:id', id: 'a84aa5c6-a873-47d0-8852-ecfe01b33879', query: { section: 'units', offset: '20' } } };
      const id = await create(); await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/messages', { text: 'Explore my research' }, token);
      const result = await wait(id);
      expect(result.messages.at(-1).sources[0].data.items[0].title).toBe('Synthetic study');
      expect(result.messages.at(-1).sources[0].data.items[0].id).toBe('unit-stable-1');
      expect(result.messages.at(-1).sources[0].data.nextOffset).toBe(20);
      expect(received[0]).toEqual({ method: 'GET', url: '/api/assistant/projects/a84aa5c6-a873-47d0-8852-ecfe01b33879?section=units&offset=20&limit=20&contentOffset=0', authorization: 'Bearer research-bridge-secret-32-characters' });
      expect(JSON.stringify(result)).not.toContain('private-path');
      expect(JSON.stringify(result)).not.toContain(config.appTokens.researched);
      toolOverride.args.path = '/api/evidence';
      const denied = await create(); await server.makeRequest('POST', '/ai-gateway/conversations/' + denied + '/messages', { text: 'Read settings' }, token); await wait(denied);
      expect(requests).toBe(1);
      toolOverride.args.path = '/api/assistant/projects/:id';
      toolOverride.args.query = { section: 'decisions', coderId: 'bypass' };
      const bypass = await create(); await server.makeRequest('POST', '/ai-gateway/conversations/' + bypass + '/messages', { text: 'Read another coder' }, token); await wait(bypass);
      expect(requests).toBe(1);
      toolOverride.args.query = { section: 'summary' }; responseStatus = 403;
      const blind = await create(); await server.makeRequest('POST', '/ai-gateway/conversations/' + blind + '/messages', { text: 'Read blind report' }, token);
      const deniedResult = await wait(blind);
      expect(deniedResult.messages.at(-1).sources).toEqual([]);
      expect(seen.at(-1).input.at(-1).output).toContain('Blind-review restrictions');
      expect(requests).toBe(2);
    } finally { toolOverride = null; await new Promise(resolve => source.close(resolve)); }
  });
  test('interprets a stored report through separate cited report and passage reads with explicit partial coverage', async () => {
    const http = require('node:http'), requests = [];
    const projectId = 'a84aa5c6-a873-47d0-8852-ecfe01b33879';
    const source = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://localhost'); requests.push(url);
      const section = url.searchParams.get('section');
      const items = section === 'summary' ? [{ id: projectId, availableSections: ['report', 'units'] }] : section === 'report' ? [{ runId: 'pinned-run', method: 'deterministic', humanDecisions: 0, evidenceUnitIds: ['unit-20'] }] : [{ id: 'unit-20', original_text: 'Teachers explain their professional learning.', locator: { page: 2 } }];
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ contract: 'researched.assistant.v1', projectId, projectRevision: 3, section, content: JSON.stringify(items), total: section === 'units' ? 25 : 1, offset: section === 'units' ? 20 : 0, nextOffset: section === 'units' ? 21 : null, nextContentOffset: null }));
    });
    await new Promise(resolve => source.listen(0, '127.0.0.1', resolve));
    try {
      const configuration = await fetchBefore(server.baseUrl + '/ai-gateway/assistant/configuration', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'X-TimSyS-Desktop-Token': process.env.TIMSYS_DESKTOP_TOKEN }, body: JSON.stringify({ protocol: 'openai-responses', model: 'fixture', baseUrl: 'https://assistant.test', appUrls: { researched: 'http://127.0.0.1:' + source.address().port }, appTokens: { researched: 'research-bridge-secret-32-characters' } }) });
      expect(configuration.status).toBe(200);
      toolSequence = ['summary', 'report', 'units'].map(section => ({ name: 'read_app_records', args: { app: 'researched', path: '/api/assistant/projects/:id', id: projectId, query: { section, offset: section === 'units' ? '20' : '0' } } }));
      const id = await create(); await server.makeRequest('POST', '/ai-gateway/conversations/' + id + '/messages', { text: 'Interpret my MCF report and retrieve supporting evidence.' }, token);
      const answer = (await wait(id)).messages.at(-1);
      expect(answer.status).toBe('completed'); expect(answer.sources).toHaveLength(3);
      expect(JSON.parse(answer.sources[2].data.content)[0].id).toBe('unit-20');
      expect(answer.sources[2].data.nextOffset).toBe(21);
      expect(answer.content).toContain('remaining units have not been examined');
      expect(requests.map(url => url.searchParams.get('section'))).toEqual(['summary', 'report', 'units']);
      expect(JSON.stringify(seen.at(-1))).toContain('Keep source passages, deterministic matches, AI proposals and confirmed human decisions distinct');
      expect(JSON.stringify(seen.at(-1))).toContain('Deterministic candidates and local no-match results do not establish semantic assessment');
      expect(JSON.stringify(seen.at(-1))).toContain('semanticAssessedUnits, semanticUnresolvedUnits');
    } finally { toolSequence = null; await new Promise(resolve => source.close(resolve)); }
  });
});

