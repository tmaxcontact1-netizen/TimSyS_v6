'use strict';
const { generate, configuration } = require('../../shared/services/ai-provider');
const cfg = { protocol: 'openai-responses', model: 'fixture', baseUrl: 'https://ai.example.test', apiKey: 'secret' };
const request = { system: 'Return JSON.', request: { evidence: [] } };
describe('AI provider transport boundaries', () => {
  test('uses native Gemini defaults without requiring a compatibility endpoint', () => {
    expect(configuration({ TIMSYS_AI_PROTOCOL: 'gemini', TIMSYS_AI_MODEL: 'chosen' })).toMatchObject({ baseUrl: 'https://generativelanguage.googleapis.com', model: 'chosen' });
  });
  test('rejects an insecure remote endpoint before sending credentials', async () => {
    const fetcher = jest.fn();
    await expect(generate({ ...cfg, baseUrl: 'http://remote.example.test' }, request, fetcher)).rejects.toThrow('AI_INVALID_ENDPOINT');
    expect(fetcher).not.toHaveBeenCalled();
  });
  test('bounds provider output during streaming', async () => {
    const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2_000_001)); controller.close(); } }));
    await expect(generate(cfg, request, async () => response)).rejects.toThrow('AI_RESPONSE_TOO_LARGE');
  });
  test('rejects Gemini truncation and safety blocks', async () => {
    for (const body of [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, { promptFeedback: { blockReason: 'SAFETY' } }]) {
      await expect(generate({ ...cfg, protocol: 'gemini' }, request, async () => new Response(JSON.stringify(body)))).rejects.toThrow('AI_INCOMPLETE_OR_REFUSED');
    }
  });
  test('marks transient errors retryable without returning provider bodies or secrets', async () => {
    await expect(generate(cfg, request, async () => new Response('secret diagnostic', { status: 429 }))).rejects.toMatchObject({ message: 'AI_PROVIDER_HTTP_ERROR', retryable: true });
  });
  test('honours service shutdown cancellation', async () => {
    const stop = new AbortController();
    const pending = generate(cfg, { ...request, signal: stop.signal }, async (_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    stop.abort();
    await expect(pending).rejects.toThrow('AI_PROVIDER_UNAVAILABLE');
  });
});
