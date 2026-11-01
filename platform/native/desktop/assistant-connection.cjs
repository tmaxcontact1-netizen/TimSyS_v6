// A real, bounded generation probe. No user records or conversation are sent.
async function testConnection(env, fetcher = global.fetch) {
  const provider = env.TIMSYS_AI_PROTOCOL, model = env.TIMSYS_AI_MODEL;
  const gemini = provider === 'gemini';
  if (!['gemini', 'openai-responses'].includes(provider) || !model || !env.TIMSYS_AI_API_KEY) throw Error('Save a provider, model ID and API key first.');
  const url = new URL(gemini ? '/v1beta/models/' + encodeURIComponent(model.replace(/^models\//, '')) + ':generateContent' : '/v1/responses', env.TIMSYS_AI_BASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('The connection test requires a secure provider URL.');
  const prompt = 'This is a connection test. Reply with only OK.';
  let response;
  try {
    response = await fetcher(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', [gemini ? 'x-goog-api-key' : 'Authorization']: (gemini ? '' : 'Bearer ') + env.TIMSYS_AI_API_KEY },
      body: JSON.stringify(gemini ? { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1024 } }
        : { model, input: prompt, store: false, max_output_tokens: 1024 }) });
  } catch (error) { throw Error(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'Connection test timed out. Try again.' : 'Could not reach the provider. Check your internet connection and try again.'); }
  if (!response.ok) {
    if (response.status === 429) {
      const explanations = {
        credit_balance_exhausted: 'OpenAI reports that the API organization has no prepaid credit remaining.',
        organization_spend_limit_exceeded: 'OpenAI reports an enforced organization spending cap.',
        project_spend_limit_exceeded: 'OpenAI reports an enforced spending cap on the API key’s project.',
        organization_usage_limit_exceeded: 'OpenAI reports its assigned usage ceiling for this API organization.',
        usage_limit_exceeded: 'OpenAI reports a usage ceiling without identifying a more specific limit.',
        insufficient_quota: 'OpenAI reports insufficient API quota for this key’s project or organization. This does not establish an unpaid bill; check that the key belongs to the intended funded API project.',
        rate_limit_exceeded: 'OpenAI reports a request or token throughput limit. This is not a billing diagnosis.',
        slow_down: 'OpenAI asked for slower requests. This is not a billing diagnosis.',
        RESOURCE_EXHAUSTED: 'Gemini reports an exhausted resource quota. Check the model’s project quota.',
      };
      let detail;
      try {
        const reader = response.body.getReader(); let size = 0; const chunks = [];
        try { while (true) { const {done,value} = await reader.read(); if(done) break; size += value.byteLength; if(size > 65536) { await reader.cancel(); throw Error('Large error response'); } chunks.push(Buffer.from(value)); } }
        finally { reader.releaseLock(); }
        detail = JSON.parse(Buffer.concat(chunks).toString()).error;
      } catch { /* Preserve an honest, non-specific diagnosis for unreadable errors. */ }
      const code = [detail?.code, detail?.status, detail?.type].find(value => Object.hasOwn(explanations, value));
      const retry = response.headers.get('retry-after');
      const wait = /^\d{1,6}$/.test(retry || '') ? ` Retry after at least ${retry} seconds.` : '';
      throw Error(code ? `${explanations[code]} Provider code: ${code}.${wait}` : 'The provider returned HTTP 429 without a recognised cause. This alone does not establish a billing or exhausted-credit problem.' + wait);
    }
    // Do not echo provider bodies: authentication failures may contain secrets.
    const messages = { 400: 'The provider rejected the request. Check the exact API model ID and API key.', 401: 'The API key was rejected. Check or replace the key.', 403: 'Access denied. Check the API key permissions and model access.', 404: 'Model not found or unavailable to this account. Enter the exact API model ID.' };
    throw Error(messages[response.status] || `The provider could not complete the test (HTTP ${response.status}). Try again.`);
  }
  const raw = await response.json();
  const text = gemini ? raw.candidates?.[0]?.content?.parts?.filter(p => !p.thought && p.text).map(p => p.text).join('')
    : raw.output?.flatMap(o => o.content || []).filter(p => p.type === 'output_text').map(p => p.text).join('');
  if (!text?.trim() || (gemini ? raw.candidates[0].finishReason !== 'STOP' : raw.status !== 'completed')) throw Error('The provider accepted the request but did not complete a text reply. Connection not verified; check the model or retry.');
  return { status: 'verified', checkedAt: new Date().toISOString(), provider, model };
}
module.exports = { testConnection };
