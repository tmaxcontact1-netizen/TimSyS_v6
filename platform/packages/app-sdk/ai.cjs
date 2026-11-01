'use strict';

// All context is prepared and authorised by the app before crossing this boundary.
class TimSysAiClient {
  constructor({ baseUrl, appId, getToken, fetch: fetcher = globalThis.fetch }) {
    const url = new URL(baseUrl);
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('AI client requires HTTPS or loopback');
    if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(appId)) throw new Error('Invalid app ID');
    this.root = url.origin + '/ai-gateway/apps/' + encodeURIComponent(appId);
    this.getToken = getToken;
    this.fetcher = fetcher;
  }
  async request(method, suffix, body) {
    const token = await this.getToken();
    if (!token) throw new Error('A TimSyS user session is required');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 100_000);
    try {
      const response = await this.fetcher(this.root + suffix, { method, redirect: 'error', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json();
      if (!response.ok || result.success === false) {
        const error = new Error(result.error?.message || 'TimSyS AI request failed');
        error.code = result.error?.code; error.status = response.status; throw error;
      }
      return result;
    } finally { clearTimeout(timer); }
  }
  status() { return this.request('GET', ''); }
  registerAdapter(definition) { return this.request('PUT', '/adapter', definition); }
  help(question) { return this.request('POST', '/ask', { mode: 'help', question }); }
  advise(question, evidence) { return this.request('POST', '/ask', { mode: 'advise', question, evidence }); }
  setWatch(settings) { return this.request('PUT', '/watches', settings); }
  watches() { return this.request('GET', '/watches'); }
  publishEvidence(workflow, eventId, evidence) { return this.request('POST', '/events', { workflow, eventId, evidence }); }
  runs() { return this.request('GET', '/runs'); }
  jobs() { return this.request('GET', '/jobs'); }
  notifications() { return this.request('GET', '/notifications'); }
  acknowledge(id, status = 'read') { return this.request('PUT', '/notifications/' + encodeURIComponent(id), { status }); }
}
module.exports = { TimSysAiClient };
