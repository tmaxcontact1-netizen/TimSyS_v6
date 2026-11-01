'use strict';
const helper = require('../../helpers/test-server');
const { TimSysAiClient } = require('../../../packages/app-sdk/ai.cjs');

describe('shared AI adviser full backend path', () => {
  let server, token, client, db, originalFetch, savedEnv;
  let responseMode = 'normal', calls = [];
  const evidence = [{ id: 'source:1', content: 'New evidence needs review.' }];
  beforeAll(async () => {
    savedEnv = Object.fromEntries(['TIMSYS_AI_PROTOCOL', 'TIMSYS_AI_MODEL', 'TIMSYS_AI_BASE_URL', 'TIMSYS_AI_API_KEY'].map(key => [key, process.env[key]]));
    process.env.TIMSYS_AI_PROTOCOL = 'openai-responses';
    process.env.TIMSYS_AI_MODEL = 'fixture-model';
    process.env.TIMSYS_AI_BASE_URL = 'https://provider.example.test';
    process.env.TIMSYS_AI_API_KEY = 'fixture-secret';
    originalFetch = global.fetch;
    global.fetch = jest.fn(async (url, options) => {
      if (!String(url).startsWith('https://provider.example.test')) return originalFetch(url, options);
      const body = JSON.parse(options.body);
      calls.push({ url: String(url), body, headers: options.headers });
      if (responseMode === 'outage') return new Response('{}', { status: 503 });
      const request = body.contents ? JSON.parse(body.contents[0].parts[0].text) : JSON.parse(body.input[1].content);
      const answer = { summary: responseMode === 'quiet' ? 'No action needed.' : 'Review the new evidence.', recommendations: ['Inspect the source.'],
        confidence: 0.7, evidenceIds: [responseMode === 'invented' ? 'invented:id' : request.evidence[0].id], limitations: [], needsAttention: responseMode !== 'quiet' };
      if (responseMode === 'refused') return new Response(JSON.stringify({ status: 'incomplete' }));
      return new Response(JSON.stringify(body.contents ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 40 } } :
        { status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(answer) }] }], usage: { input_tokens: 100, output_tokens: 40 } }));
    });
    server = await helper.createTestServer('ai_adviser');
    token = (await server.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
    db = require('../../../shared/services/db');
    client = new TimSysAiClient({ baseUrl: server.baseUrl, appId: 'researched', getToken: () => token });
  });
  afterAll(async () => {
    if (server) await server.cleanup();
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  });
  beforeEach(() => { responseMode = 'normal'; });
  const route = '/ai-gateway/apps/researched';
  async function readyJobs() {
    db.query('UPDATE ai_watches SET last_run_at=NULL');
    db.query("UPDATE ai_watch_jobs SET available_at=0 WHERE state='queued'");
  }
  async function waitForJob(id, expected) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const job = (await client.jobs()).jobs.find(item => item.id === id);
      if (expected.includes(job.state)) return job;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Watch job did not reach ' + expected.join(','));
  }
  test('available across apps, no watches enabled, provider setup separate from availability', async () => {
    for (const appId of ['researched', 'principal-ed', 'dressed', 'tradeed']) {
      const response = await server.makeRequest('GET', '/ai-gateway/apps/' + appId, null, token);
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({ available: true, watchDefault: false, modes: ['help', 'advise', 'watch'] });
    }
    expect((await client.watches()).watches).toEqual([]);
    expect((await client.publishEvidence('source-imported', 'disabled:1', evidence)).queued).toBe(false);
    delete process.env.TIMSYS_AI_MODEL;
    expect((await client.status()).available).toBe(true);
    await expect(client.help('What can I do?')).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    process.env.TIMSYS_AI_MODEL = 'fixture-model';
  });
  test('help and advice use native OpenAI structured output and persist results with citations', async () => {
    const help = await client.help('How do I start?');
    expect(help.answer.evidenceIds[0]).toMatch(/^researched:/);
    const result = await client.advise('What changed?', evidence);
    expect(result.answer.evidenceIds).toEqual(['source:1']);
    expect(calls.at(-1).body).toMatchObject({ store: false, text: { format: { type: 'json_schema', strict: true } } });
    const saved = (await client.runs()).runs.find(item => item.id === result.runId);
    expect(saved.status).toBe('completed');
    expect(saved.result.summary).toBe(result.answer.summary);
    expect(JSON.stringify(saved)).not.toContain('fixture-secret');
  });
  test('native Gemini uses its API-key header and schema, and preserves the same result contract', async () => {
    process.env.TIMSYS_AI_PROTOCOL = 'gemini';
    const result = await client.advise('Explain this', evidence);
    expect(result.provider).toBe('gemini');
    expect(calls.at(-1).url).toMatch(/v1beta\/models\/fixture-model:generateContent$/);
    expect(calls.at(-1).headers['x-goog-api-key']).toBe('fixture-secret');
    expect(calls.at(-1).body.generationConfig.responseJsonSchema.required).toContain('evidenceIds');
    process.env.TIMSYS_AI_PROTOCOL = 'openai-responses';
  });
  test('rejects ungrounded output, refusals and invalid evidence before accepting a result', async () => {
    responseMode = 'invented';
    await expect(client.advise('Explain', evidence)).rejects.toMatchObject({ code: 'AI_UNSUPPORTED_CITATION' });
    responseMode = 'refused';
    await expect(client.advise('Explain', evidence)).rejects.toMatchObject({ code: 'AI_INCOMPLETE_OR_REFUSED' });
    const before = calls.length;
    await expect(client.advise('Explain', [...evidence, ...evidence])).rejects.toMatchObject({ code: 'AI_DUPLICATE_EVIDENCE' });
    expect(calls.length).toBe(before);
  });
  test('authenticates requests, isolates apps and owners, and protects adapter configuration', async () => {
    expect((await server.makeRequest('POST', route + '/ask', { mode: 'help', question: 'Help' })).status).toBe(401);
    const jwt = require('jsonwebtoken');
    const restricted = jwt.sign({ userId: 'other-user', permissions: ['ai:researched:use'] }, process.env.JWT_SECRET);
    expect((await server.makeRequest('GET', '/ai-gateway/apps/dressed', null, restricted)).status).toBe(403);
    expect((await server.makeRequest('GET', route + '/runs', null, restricted)).data.runs).toEqual([]);
    expect((await server.makeRequest('PUT', route + '/adapter', {}, restricted)).status).toBe(403);
  });
  test('watches incoming evidence through the durable worker, suppresses duplicates and reports notifications', async () => {
    await client.setWatch({ workflow: 'source-imported', instructions: 'Flag meaningful evidence changes.', enabled: true, cooldownSeconds: 30 });
    const job = await client.publishEvidence('source-imported', 'import:1', evidence);
    expect(job.queued).toBe(true);
    expect((await client.publishEvidence('source-imported', 'import:1', evidence)).duplicate).toBe(true);
    expect((await client.publishEvidence('source-imported', 'import:2', evidence)).duplicate).toBe(true);
    const completed = await waitForJob(job.jobId, ['completed']);
    expect(completed.run_id).toBeTruthy();
    const notices = (await client.notifications()).notifications;
    expect(notices).toHaveLength(1);
    expect(notices[0].answer.evidenceIds).toEqual(['source:1']);
    await client.acknowledge(notices[0].id);
    expect((await client.notifications()).notifications[0].status).toBe('read');
    const same = await client.publishEvidence('source-imported', 'import:3', [{ id: 'source:2', content: 'Another observation.' }]);
    await readyJobs();
    await waitForJob(same.jobId, ['completed']);
    expect((await client.notifications()).notifications).toHaveLength(1);
    responseMode = 'quiet';
    const quiet = await client.publishEvidence('source-imported', 'import:4', [{ id: 'source:3', content: 'Nothing actionable.' }]);
    await readyJobs();
    await waitForJob(quiet.jobId, ['completed']);
    expect((await client.notifications()).notifications).toHaveLength(1);
  });
  test('retries provider failures, recovers an expired lease and cancels pending work when disabled', async () => {
    responseMode = 'outage';
    const job = await client.publishEvidence('source-imported', 'retry:1', [{ id: 'retry:1', content: 'Retry evidence.' }]);
    await readyJobs();
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const row = db.query('SELECT * FROM ai_watch_jobs WHERE id=?', [job.jobId]).rows[0];
      if (row.attempts === 1 && row.state === 'queued') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(db.scalar('SELECT attempts FROM ai_watch_jobs WHERE id=?', [job.jobId])).toBe(1);
    responseMode = 'normal';
    db.query("UPDATE ai_watch_jobs SET state='running',lease_until=0 WHERE id=?", [job.jobId]);
    await readyJobs();
    // The worker's recovery requeues the leased job; clear its retry delay as well.
    db.query('UPDATE ai_watch_jobs SET available_at=0 WHERE id=?', [job.jobId]);
    expect((await waitForJob(job.jobId, ['completed'])).attempts).toBe(2);
    const pending = await client.publishEvidence('source-imported', 'cancel:1', [{ id: 'cancel:1', content: 'Do not process.' }]);
    await client.setWatch({ workflow: 'source-imported', instructions: 'Disabled', enabled: false });
    expect((await client.jobs()).jobs.find(item => item.id === pending.jobId).state).toBe('cancelled');
    expect(db.scalar('SELECT evidence_json FROM ai_watch_jobs WHERE id=?', [pending.jobId])).toBe('[]');
  });
});
