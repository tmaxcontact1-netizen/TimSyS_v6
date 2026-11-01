const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { ChatGptPlan, planRequest, completedResponse } = require('./chatgpt-plan.cjs');
const { AiCredentialVault } = require('./ai-credential-vault.cjs');
const safeStorage = { isEncryptionAvailable: () => true, encryptString: v => Buffer.from(v).reverse(), decryptString: v => Buffer.from(v).reverse().toString() };
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fixture', alg: 'RS256', use: 'sig' };
function jwt(claims) {
  const data = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ iss: 'https://auth.openai.com', aud: 'issued-client', sub: 'subject', exp: Date.now() / 1000 + 3600, email: 'test@example.invalid', ...claims })).toString('base64url');
  return data + '.' + crypto.sign('sha256', Buffer.from(data), privateKey).toString('base64url');
}
const finished = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] };
const sse = events => new Response(events.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join(''), { headers: { 'Content-Type': 'text/event-stream' } });
async function fixture(t, overrides = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-plan-test-'));
  let auth, refreshes = 0, inference = 0, modelHeaders, tokenParams;
  const plan = new ChatGptPlan({ file: path.join(root, 'session.enc'), safeStorage,
    openExternal: async address => {
      auth = new URL(address);
      const callback = new URL(auth.searchParams.get('redirect_uri'));
      callback.search = new URLSearchParams({ state: 'wrong', code: 'code', client_id: 'issued-client' }).toString();
      assert.equal((await fetch(callback)).status, 400);
      callback.searchParams.set('state', auth.searchParams.get('state'));
      assert.equal((await fetch(callback)).status, 200);
    },
    fetcher: async (url, options = {}) => {
      if (url.endsWith('/.well-known/openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', jwks_uri: 'https://auth.openai.com/jwks', revocation_endpoint: 'https://auth.openai.com/revoke' });
      if (url.endsWith('/jwks')) return Response.json({ keys: [jwk] });
      if (url.endsWith('/revoke')) return new Response(null, { status: 200 });
      if (url.endsWith('/oauth/token')) {
        tokenParams = new URLSearchParams(options.body);
        const refresh = tokenParams.get('grant_type') === 'refresh_token'; if (refresh) refreshes++;
        if (!refresh) {
          assert.equal(tokenParams.get('client_id'), 'issued-client');
          assert.equal(tokenParams.get('redirect_uri'), auth.searchParams.get('redirect_uri'));
          assert.equal(crypto.createHash('sha256').update(tokenParams.get('code_verifier')).digest('base64url'), auth.searchParams.get('code_challenge'));
        }
        return Response.json({ token_type: 'Bearer', access_token: 'access-secret-' + refreshes, refresh_token: 'refresh-secret-' + refreshes, expires_in: 3600, scope: 'openid chatgpt.tokens.use.direct', ...(!refresh ? { id_token: jwt({ nonce: auth.searchParams.get('nonce'), ...overrides.claims }) } : {}), ...overrides.tokens });
      }
      if (url.endsWith('/models')) { modelHeaders = options.headers; return Response.json({ models: [{ slug: 'hidden', visibility: 'hide' }, { slug: 'plan-model', display_name: 'Plan Model', visibility: 'list' }] }); }
      if (url.endsWith('/responses')) { inference++; assert.match(options.headers.Authorization, /^Bearer access-secret-/); const body = JSON.parse(options.body); assert.equal(body.stream, true); assert.equal(body.store, false); assert.equal(body.max_output_tokens, undefined); return sse([{ type: 'response.completed', response: finished }]); }
      throw Error('Unexpected fixture endpoint');
    }
  });
  t.after(async () => { plan.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { plan, root, getAuth: () => auth, counts: () => ({ refreshes, inference }), getModelHeaders: () => modelHeaders };
}
test('official browser OAuth validates state, PKCE and signed identity; public metadata contains no credentials', async t => {
  const f = await fixture(t), id = await f.plan.signIn();
  assert.equal(f.getAuth().searchParams.get('client_id'), 'dynamic_agent_client');
  assert.equal(f.getAuth().searchParams.get('agent_name_hint'), 'TimSyS');
  const host = f.getAuth().searchParams.get('ext_agent_host_id'); assert.match(host, /^urn:uuid:/);
  assert.deepEqual(await f.plan.models(id), [{ slug: 'plan-model', name: 'Plan Model' }]);
  assert.equal((await f.plan.test(id, 'plan-model')).status, 'verified');
  assert.equal(JSON.stringify(await f.plan.status()).includes('secret'), false);
  assert.equal((await fs.readFile(f.plan.file, 'utf8')).includes('access-secret'), false);
  await f.plan.signIn(id);
  assert.equal(f.getAuth().searchParams.get('client_id'), 'issued-client');
  assert.equal(f.getAuth().searchParams.has('agent_name_hint'), false);
  assert.equal(f.getAuth().searchParams.get('ext_agent_host_id'), host);
  assert.equal(f.getAuth().searchParams.has('id_token_hint'), true);
});
test('invalid identity and absent plan scope never create a usable account', async t => {
  for (const overrides of [{ claims: { nonce: 'wrong' } }, { claims: { aud: 'wrong' } }, { claims: { exp: 1 } }, { tokens: { scope: 'openid' } }]) {
    const f = await fixture(t, overrides); await assert.rejects(f.plan.signIn()); assert.equal((await f.plan.status()).accounts.length, 0);
  }
});
test('forged signatures and switching identity during reauthorization are rejected', async t => {
  const f = await fixture(t), id = await f.plan.signIn();
  const forged = jwt({}); const parts = forged.split('.');
  parts[1] = Buffer.from(JSON.stringify({ iss: 'https://auth.openai.com', aud: 'issued-client', sub: 'attacker', exp: Date.now() / 1000 + 3600 })).toString('base64url');
  await assert.rejects(f.plan.identity(parts.join('.'), 'issued-client', null), /signature/);
  await assert.rejects(f.plan.identity(jwt({ sub: 'different' }), 'issued-client', null, (await f.plan.read()).accounts[0]), /validation/);
  assert.equal((await f.plan.status()).accounts[0].id, id);
});
test('cancelling the browser attempt releases the listener and permits a fresh attempt', async t => {
  const f = await fixture(t); let opened;
  const wait = new Promise(resolve => { opened = resolve; });
  f.plan.openExternal = async () => opened();
  const signingIn = f.plan.signIn(); await wait;
  await assert.rejects(f.plan.signIn(), /already in progress/);
  f.plan.cancel(); await assert.rejects(signingIn, /cancelled/);
  assert.equal((await f.plan.status()).signingIn, false);
  assert.equal((await f.plan.status()).accounts.length, 0);
});
test('rotating refresh is serialized and sign-out retains registration without credentials', async t => {
  const f = await fixture(t), id = await f.plan.signIn();
  await f.plan.change(data => { data.accounts[0].tokens.expiresAt = 0; });
  const values = await Promise.all(Array.from({ length: 5 }, () => f.plan.access(id)));
  assert.equal(f.counts().refreshes, 1); assert.ok(values.every(v => v === 'access-secret-1'));
  assert.equal(await f.plan.signOut(id), 'Signed out of ChatGPT.');
  assert.equal((await f.plan.status()).accounts[0].connected, false);
  await assert.rejects(f.plan.access(id), /reconnect/);
  await f.plan.signIn(id); assert.equal(await f.plan.access(id), 'access-secret-1');
});
test('plan requests remove unsupported fields and namespace read tools while preserving conversation items', () => {
  const body = planRequest({ model: 'x', input: [{ role: 'system', content: 'rules' }, { type: 'function_call_output', call_id: 'c', output: '{}' }], tools: [{ type: 'function', name: 'read_records', parameters: { type: 'object' } }, { type: 'web_search' }], max_output_tokens: 500, temperature: 1, previous_response_id: 'old' });
  assert.equal(body.input[0].role, 'developer'); assert.equal(body.input[1].call_id, 'c');
  assert.equal(body.tools[1].type, 'namespace'); assert.equal(body.tools[1].tools[0].name, 'read_records');
  assert.equal(body.max_output_tokens, undefined); assert.equal(body.temperature, undefined); assert.equal(body.previous_response_id, undefined);
});
test('stream requires completed response and reports plan limits after HTTP success', async () => {
  assert.deepEqual(await completedResponse(sse([{ type: 'response.completed', response: finished }])), finished);
  await assert.rejects(completedResponse(sse([{ type: 'response.output_text.delta', delta: 'partial' }])), /disconnected/);
  await assert.rejects(completedResponse(sse([{ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'secret raw provider message' } } }])), e => /allowance/.test(e.message) && !e.message.includes('secret'));
});
test('recognizes completed response data despite missing or mismatched transport headers', async () => {
  const event = { type: 'response.completed', response: finished };
  const streamed = await completedResponse(new Response('data: ' + JSON.stringify(event) + '\n\n', { headers: { 'Content-Type': 'application/json' } }));
  assert.equal(streamed.timsysTransport, 'sse');
  const json = await completedResponse(Response.json({ ...finished, object: 'response', id: 'resp_fixture' }));
  assert.equal(json.timsysTransport, 'json-response');
  assert.equal((await completedResponse(Response.json(event))).timsysTransport, 'json-event');
  await assert.rejects(completedResponse(Response.json({ ...finished, object: 'response', id: 'resp_fixture', status: 'in_progress' })), /did not complete/);
  await assert.rejects(completedResponse(Response.json({ status: 'completed', output: finished.output })), /without a completed Responses result/);
  await assert.rejects(completedResponse(Response.json({ error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'private contents' } })), e => /allowance/.test(e.message) && !e.message.includes('private'));
  await assert.rejects(completedResponse(new Response('<html>Sign in first</html>')), /unexpected response format/);
});
test('retains completed stream items when final summary omits output, without accepting interrupted streams', async () => {
  const item = finished.output[0];
  const done = { type: 'response.output_item.done', output_index: 0, item };
  const final = { type: 'response.completed', response: { status: 'completed', output: [] } };
  assert.deepEqual((await completedResponse(sse([done, final]))).output, [item]);
  await assert.rejects(completedResponse(sse([done])), /disconnected/);
  await assert.rejects(completedResponse(sse([done, { type: 'response.incomplete' }])), /did not complete/);
  assert.deepEqual((await completedResponse(sse([{ type: 'response.output_item.added', output_index: 0, item }, final]))).output, []);
  assert.deepEqual((await completedResponse(sse([done, { type: 'response.completed', response: finished }]))).output, finished.output);
});
test('local service rejects untrusted requests and remains bound to account/model; vault preserves API alternative', async t => {
  const f = await fixture(t), id = await f.plan.signIn();
  const env = await f.plan.environment(id, 'plan-model');
  const url = env.baseUrl + '/v1/responses';
  assert.equal((await fetch(url, { method: 'POST', body: '{}' })).status, 403);
  const options = { method: 'POST', headers: { Authorization: 'Bearer ' + env.apiKey }, body: JSON.stringify({ model: 'plan-model', input: 'Hi' }) };
  assert.equal((await fetch(url, { ...options, headers: { ...options.headers, Origin: 'https://evil.invalid' } })).status, 403);
  assert.equal((await fetch(url, { ...options, body: JSON.stringify({ model: 'different', input: 'Hi' }) })).status, 400);
  assert.equal((await (await fetch(url, options)).json()).status, 'completed');
  const vault = new AiCredentialVault({ file: path.join(f.root, 'profiles.json'), safeStorage, resolvePlan: (...args) => f.plan.environment(...args) });
  const api = await vault.save({ name: 'API', protocol: 'openai-responses', model: 'api-model', baseUrl: 'https://api.openai.com', apiKey: 'api-secret' });
  await vault.save({ name: 'Plan', protocol: 'chatgpt-plan', accountId: id, model: 'plan-model', baseUrl: 'https://api.openai.com' });
  assert.equal((await vault.activeEnvironment()).TIMSYS_AI_API_KEY, env.apiKey);
  await vault.activate(api.id); assert.equal((await vault.activeEnvironment()).TIMSYS_AI_API_KEY, 'api-secret');
  await f.plan.signOut(id); assert.equal((await fetch(url, options)).status, 403);
});
