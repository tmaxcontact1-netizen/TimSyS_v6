'use strict';

// Provider transport shared by the platform adviser and grounded analysis.
const PROTOCOLS = ['openai-responses', 'gemini', 'openai-chat', 'anthropic-messages', 'generic-json'];
const DEFAULT_URLS = {
  'openai-responses': 'https://api.openai.com',
  gemini: 'https://generativelanguage.googleapis.com',
  'openai-chat': 'https://api.openai.com',
  'anthropic-messages': 'https://api.anthropic.com',
};

function configuration(env = process.env) {
  const protocol = env.TIMSYS_AI_PROTOCOL || env.RESEARCHED_AI_PROTOCOL;
  if (!PROTOCOLS.includes(protocol)) return null;
  return {
    protocol, model: env.TIMSYS_AI_MODEL || env.RESEARCHED_AI_MODEL,
    baseUrl: env.TIMSYS_AI_BASE_URL || env.RESEARCHED_AI_BASE_URL || DEFAULT_URLS[protocol],
    apiKey: env.TIMSYS_AI_API_KEY || env.RESEARCHED_AI_API_KEY || '',
  };
}

function endpoint(config, pathname) {
  const url = new URL(pathname, config.baseUrl);
  if (url.username || url.password || url.search || url.hash) throw new Error('AI_INVALID_ENDPOINT');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('AI_INVALID_ENDPOINT');
  }
  return url;
}

async function boundedJson(response) {
  if (!response.ok) {
    const error = new Error('AI_PROVIDER_HTTP_ERROR');
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  const limit = 2_000_000;
  if (Number(response.headers?.get('content-length')) > limit) throw new Error('AI_RESPONSE_TOO_LARGE');
  // The fallback also supports the repository's existing in-process provider fixtures.
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > limit) throw new Error('AI_RESPONSE_TOO_LARGE');
    return JSON.parse(text);
  }
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('AI_RESPONSE_TOO_LARGE'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function parse(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('AI_EMPTY_RESPONSE');
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

async function generate(config, { system, request, schema, maxOutputTokens = 4096, signal }, fetcher = global.fetch) {
  if (!config?.model || !config.baseUrl) throw new Error('AI_NOT_CONFIGURED');
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  let path, body;
  const input = JSON.stringify(request);
  if (Buffer.byteLength(input) > 160_000) throw new Error('AI_INPUT_TOO_LARGE');
  if (config.protocol === 'gemini') {
    const model = config.model.replace(/^models\//, '');
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('AI_INVALID_MODEL');
    path = '/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    if (config.apiKey) headers['x-goog-api-key'] = config.apiKey;
    body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: { maxOutputTokens, responseMimeType: 'application/json', ...(schema ? { responseJsonSchema: schema } : {}) },
    };
  } else if (config.protocol === 'openai-responses') {
    path = '/v1/responses';
    if (config.apiKey) headers.Authorization = 'Bearer ' + config.apiKey;
    body = { model: config.model, store: false, max_output_tokens: maxOutputTokens,
      input: [{ role: 'system', content: system }, { role: 'user', content: input }],
      text: { format: schema ? { type: 'json_schema', name: 'timsys_adviser', strict: true, schema } : { type: 'json_object' } },
    };
  } else if (config.protocol === 'openai-chat') {
    path = '/v1/chat/completions';
    if (config.apiKey) headers.Authorization = 'Bearer ' + config.apiKey;
    body = { model: config.model, max_tokens: maxOutputTokens, stream: false, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: input }] };
  } else if (config.protocol === 'anthropic-messages') {
    path = '/v1/messages';
    if (config.apiKey) headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = { model: config.model, max_tokens: maxOutputTokens, system: system + (schema ? '\nJSON schema: ' + JSON.stringify(schema) : ''),
      messages: [{ role: 'user', content: input }] };
  } else if (config.protocol === 'generic-json') {
    path = '';
    if (config.apiKey) headers.Authorization = 'Bearer ' + config.apiKey;
    body = { contract: 'timsys.grounded-analysis.v1', model: config.model, system, ...request, ...(schema ? { responseSchema: schema } : {}) };
  } else throw new Error('AI_UNSUPPORTED_PROVIDER');

  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const raw = await boundedJson(await fetcher(endpoint(config, path), { method: 'POST', redirect: 'error', signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, headers, body: JSON.stringify(body) }));
    let value, usage;
    if (config.protocol === 'gemini') {
      const candidate = raw.candidates?.[0];
      if (raw.promptFeedback?.blockReason || !candidate || candidate.finishReason !== 'STOP') throw new Error('AI_INCOMPLETE_OR_REFUSED');
      value = parse(candidate.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join(''));
      usage = { inputTokens: raw.usageMetadata?.promptTokenCount || 0, outputTokens: raw.usageMetadata?.candidatesTokenCount || 0 };
    } else if (config.protocol === 'openai-responses') {
      if (raw.status && raw.status !== 'completed') throw new Error('AI_INCOMPLETE_OR_REFUSED');
      const parts = raw.output?.flatMap(item => item.content || []) || [];
      if (parts.some(part => part.type === 'refusal')) throw new Error('AI_INCOMPLETE_OR_REFUSED');
      value = parse(raw.output_text || parts.filter(part => part.type === 'output_text').map(part => part.text).join(''));
      usage = { inputTokens: raw.usage?.input_tokens || 0, outputTokens: raw.usage?.output_tokens || 0 };
    } else if (config.protocol === 'openai-chat') {
      if (raw.choices?.[0]?.finish_reason && raw.choices[0].finish_reason !== 'stop') throw new Error('AI_INCOMPLETE_OR_REFUSED');
      value = parse(raw.choices?.[0]?.message?.content);
    } else if (config.protocol === 'anthropic-messages') {
      if (raw.stop_reason && raw.stop_reason !== 'end_turn') throw new Error('AI_INCOMPLETE_OR_REFUSED');
      value = parse(raw.content?.filter(part => part.type === 'text').map(part => part.text).join(''));
    } else value = raw.result;
    return { value, usage: usage || { inputTokens: 0, outputTokens: 0 } };
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TypeError') {
      const safe = new Error('AI_PROVIDER_UNAVAILABLE'); safe.retryable = true; throw safe;
    }
    throw error;
  } finally { clearTimeout(timer); }
}

// A conversation retains native provider tool turns (including Gemini thought signatures).
// Tool execution stays in TimSyS, under the requesting user's permissions.
async function converse(config, { system, messages, tools, execute, signal, onProgress = () => {} }, fetcher = global.fetch) {
  if (!config?.model || !config.baseUrl) throw new Error('AI_NOT_CONFIGURED');
  if (!['openai-responses', 'gemini'].includes(config.protocol)) throw new Error('AI_CHAT_PROVIDER_UNSUPPORTED');
  const gemini = config.protocol === 'gemini';
  const model = config.model.replace(/^models\//, '');
  if (gemini && !/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error('AI_INVALID_MODEL');
  const turns = gemini ? messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    : messages.map(m => ({ role: m.role, content: m.content }));
  const headers = { 'Content-Type': 'application/json', ...(config.apiKey ? gemini ? { 'x-goog-api-key': config.apiKey } : { Authorization: 'Bearer ' + config.apiKey } : {}) };
  const deadline = AbortSignal.timeout(240_000);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let callCount = 0;
  for (let step = 0; step < 12; step++) {
    combined.throwIfAborted();
    const body = gemini ? {
      systemInstruction: { parts: [{ text: system }] }, contents: turns,
      tools: [{ functionDeclarations: tools.map(({ name, description, parameters }) => ({ name, description, parameters })) }],
      generationConfig: { maxOutputTokens: 8192 },
    } : {
      model: config.model, store: false, include: ['reasoning.encrypted_content'], instructions: system, input: turns, max_output_tokens: 8192,
      tools: tools.map(t => ({ type: 'function', ...t, strict: false })), parallel_tool_calls: false,
    };
    if (Buffer.byteLength(JSON.stringify(body)) > 500_000) throw new Error('AI_CONTEXT_LIMIT');
    const raw = await boundedJson(await fetcher(endpoint(config, gemini ? '/v1beta/models/' + encodeURIComponent(model) + ':generateContent' : '/v1/responses'), {
      method: 'POST', redirect: 'error', headers, body: JSON.stringify(body), signal: combined,
    }));
    let calls, answer;
    if (gemini) {
      const candidate = raw.candidates?.[0];
      if (!candidate?.content || candidate.finishReason !== 'STOP') throw new Error('AI_INCOMPLETE_OR_REFUSED');
      turns.push(candidate.content);
      calls = (candidate.content.parts || []).filter(p => p.functionCall).map(p => ({ name: p.functionCall.name, args: p.functionCall.args, id: p.functionCall.id }));
      answer = candidate.content.parts.filter(p => !p.thought && p.text).map(p => p.text).join('\n');
    } else {
      if (raw.status !== 'completed') throw new Error('AI_INCOMPLETE_OR_REFUSED');
      turns.push(...(raw.output || []));
      calls = (raw.output || []).filter(p => p.type === 'function_call').map(p => ({ name: p.name, args: JSON.parse(p.arguments), id: p.call_id }));
      answer = (raw.output || []).flatMap(p => p.content || []).filter(p => p.type === 'output_text').map(p => p.text).join('\n');
    }
    if (!calls.length) {
      if (!answer?.trim()) throw new Error('AI_EMPTY_RESPONSE');
      return { text: answer, toolCalls: callCount };
    }
    const results = [];
    for (const call of calls) {
      if (++callCount > 24) throw new Error('AI_TOOL_LIMIT');
      combined.throwIfAborted();
      onProgress(call.name);
      const output = await execute(call.name, call.args);
      combined.throwIfAborted();
      if (gemini) results.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { result: output } } });
      else turns.push({ type: 'function_call_output', call_id: call.id, output: JSON.stringify(output) });
    }
    if (gemini) turns.push({ role: 'user', parts: results });
  }
  throw new Error('AI_TOOL_LIMIT');
}

async function searchWeb(config, query, signal, fetcher = global.fetch) {
  const gemini = config.protocol === 'gemini', headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers[gemini ? 'x-goog-api-key' : 'Authorization'] = (gemini ? '' : 'Bearer ') + config.apiKey;
  const model = config.model.replace(/^models\//, '');
  const request = gemini ? { contents: [{ role: 'user', parts: [{ text: query }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: 4096 } }
    : { model, store: false, input: query, tools: [{ type: 'web_search' }], max_output_tokens: 4096 };
  const deadline = AbortSignal.timeout(90000);
  const raw = await boundedJson(await fetcher(endpoint(config, gemini ? '/v1beta/models/' + encodeURIComponent(model) + ':generateContent' : '/v1/responses'),
    { method: 'POST', redirect: 'error', headers, body: JSON.stringify(request), signal: signal ? AbortSignal.any([signal, deadline]) : deadline }));
  let text, citations, suggestions;
  if (gemini) {
    const candidate = raw.candidates?.[0];
    if (!candidate || candidate.finishReason !== 'STOP') throw new Error('AI_INCOMPLETE_OR_REFUSED');
    text = candidate.content?.parts?.filter(p => p.text && !p.thought).map(p => p.text).join('\n');
    citations = (candidate.groundingMetadata?.groundingChunks || []).filter(c => c.web?.uri).map(c => ({ title: c.web.title, url: c.web.uri }));
    suggestions = candidate.groundingMetadata?.searchEntryPoint?.renderedContent;
  } else {
    if (raw.status !== 'completed') throw new Error('AI_INCOMPLETE_OR_REFUSED');
    const parts = (raw.output || []).flatMap(o => o.content || []).filter(p => p.type === 'output_text');
    text = parts.map(p => p.text).join('\n');
    citations = parts.flatMap(p => p.annotations || []).filter(a => a.type === 'url_citation').map(a => ({ title: a.title, url: a.url }));
  }
  if (!text || !citations.length) throw new Error('AI_WEB_SOURCES_UNAVAILABLE');
  return { text, citations: citations.filter(c => /^https?:\/\//i.test(c.url)), ...(suggestions ? { suggestions } : {}) };
}

module.exports = { PROTOCOLS, DEFAULT_URLS, configuration, generate, converse, boundedJson, searchWeb };
