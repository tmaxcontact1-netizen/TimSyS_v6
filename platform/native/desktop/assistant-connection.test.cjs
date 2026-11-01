const test = require('node:test'), assert = require('node:assert/strict');
const { testConnection } = require('./assistant-connection.cjs');
const env = { TIMSYS_AI_PROTOCOL:'openai-responses', TIMSYS_AI_MODEL:'model', TIMSYS_AI_API_KEY:'secret', TIMSYS_AI_BASE_URL:'https://api.openai.com' };
test('verifies an actual completed reply and sends no application data', async () => {
  const result = await testConnection(env, async (url, request) => {
    assert.equal(url.pathname, '/v1/responses');
    const body = JSON.parse(request.body);
    assert.equal(body.store, false); assert.equal(body.model, 'model'); assert.ok(body.max_output_tokens <= 1024);
    assert.equal(body.input, 'This is a connection test. Reply with only OK.');
    return Response.json({ status:'completed', output:[{content:[{type:'output_text',text:'OK'}]}] });
  });
  assert.equal(result.status,'verified'); assert.ok(!JSON.stringify(result).includes('secret'));
});
test('validates Gemini replies through native generation', async () => {
  assert.equal((await testConnection({...env,TIMSYS_AI_PROTOCOL:'gemini',TIMSYS_AI_BASE_URL:'https://generativelanguage.googleapis.com'}, async (url,request) => {
    assert.equal(url.pathname,'/v1beta/models/model:generateContent'); assert.equal(request.headers['x-goog-api-key'],'secret');
    return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:'OK'}]}}]});
  })).status,'verified');
});
test('reports authentication, model and billing failures without exposing provider response bodies', async () => {
  for(const [status,message] of [[401,/key was rejected/],[404,/Model not found/],[429,/billing/]]) await assert.rejects(testConnection(env,async()=>new Response('secret',{status})),message);
  await assert.rejects(testConnection(env,async()=>Response.json({status:'incomplete',output:[]})),/not verified/);
});
test('distinguishes throughput limits from quota and spending caps without echoing sensitive provider text', async () => {
  for (const code of ['rate_limit_exceeded','insufficient_quota','project_spend_limit_exceeded']) {
    await assert.rejects(testConnection(env,async()=>Response.json({error:{code,message:'secret key and private account details'}},{status:429,headers:{'retry-after':'20'}})),error=>{
      assert.ok(error.message.includes('Provider code: '+code));
      assert.ok(error.message.includes('20 seconds'));
      assert.ok(!error.message.includes('secret'));
      if(code==='rate_limit_exceeded') assert.ok(error.message.includes('not a billing diagnosis'));
      return true;
    });
  }
});
