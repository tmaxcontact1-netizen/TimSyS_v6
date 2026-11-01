const { searchWeb } = require('../../shared/services/ai-provider');
describe('assistant web research', () => {
  test('OpenAI native search retains cited URLs', async () => {
    let request;
    const result = await searchWeb({ protocol: 'openai-responses', model: 'fixture', baseUrl: 'https://fixture.test' }, 'A public question', undefined, async (url, options) => {
      request = JSON.parse(options.body);
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Public finding', annotations: [{ type: 'url_citation', title: 'Source', url: 'https://example.com' }] }] }] });
    });
    expect(request.tools).toEqual([{ type: 'web_search' }]); expect(request.store).toBe(false);
    expect(result.citations[0].url).toBe('https://example.com');
  });
  test('Gemini native grounding preserves sources and search suggestions', async () => {
    let request;
    const result = await searchWeb({ protocol: 'gemini', model: 'fixture', baseUrl: 'https://fixture.test' }, 'A public question', undefined, async (url, options) => {
      request = JSON.parse(options.body);
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Public finding' }] }, groundingMetadata: { groundingChunks: [{ web: { title: 'Source', uri: 'https://example.com' } }], searchEntryPoint: { renderedContent: '<div>Search suggestions</div>' } } }] });
    });
    expect(request.tools).toEqual([{ google_search: {} }]);
    expect(result.citations[0].url).toBe('https://example.com'); expect(result.suggestions).toContain('Search suggestions');
  });
  test('does not present an ungrounded response as web research', async () => {
    await expect(searchWeb({ protocol: 'openai-responses', model: 'fixture', baseUrl: 'https://fixture.test' }, 'question', undefined,
      async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: 'Unverified' }] }] }))).rejects.toThrow('AI_WEB_SOURCES_UNAVAILABLE');
  });
});
