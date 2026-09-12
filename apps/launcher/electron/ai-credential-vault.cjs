const path = require('node:path');
const { randomUUID } = require('node:crypto');
const fsp = require('node:fs/promises');

const PROTOCOLS = new Set(['openai-responses', 'openai-chat', 'anthropic-messages', 'generic-json']);

class AiCredentialVault {
  constructor({ file, safeStorage }) {
    this.file = file;
    this.safeStorage = safeStorage;
  }

  async read() {
    try {
      const parsed = JSON.parse(await fsp.readFile(this.file, 'utf8'));
      return parsed?.version === 1 && Array.isArray(parsed.profiles) ? parsed : { version: 1, activeProfileId: null, profiles: [] };
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, activeProfileId: null, profiles: [] };
      throw error;
    }
  }

  publicProfile(profile, activeProfileId) {
    return {
      id: profile.id, name: profile.name, protocol: profile.protocol, model: profile.model,
      baseUrl: profile.baseUrl, hasApiKey: Boolean(profile.encryptedApiKey),
      active: profile.id === activeProfileId, updatedAt: profile.updatedAt,
    };
  }

  async list() {
    const data = await this.read();
    return { encryptionAvailable: this.safeStorage.isEncryptionAvailable(), profiles: data.profiles.map((profile) => this.publicProfile(profile, data.activeProfileId)) };
  }

  validate(value) {
    if (!value || !PROTOCOLS.has(value.protocol)) throw new Error('Unsupported AI provider protocol');
    for (const key of ['name', 'model', 'baseUrl']) if (!String(value[key] || '').trim()) throw new Error(`${key} is required`);
    const endpoint = new URL(value.baseUrl);
    const local = ['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname);
    if (endpoint.protocol !== 'https:' && !(local && endpoint.protocol === 'http:')) throw new Error('Hosted AI providers require HTTPS');
  }

  async save(value) {
    this.validate(value);
    const data = await this.read(), existing = value.id ? data.profiles.find((profile) => profile.id === value.id) : null;
    if (value.apiKey && !this.safeStorage.isEncryptionAvailable()) throw new Error('Operating-system credential encryption is unavailable');
    const profile = {
      id: existing?.id || randomUUID(), name: String(value.name).trim(), protocol: value.protocol,
      model: String(value.model).trim(), baseUrl: String(value.baseUrl).trim(),
      encryptedApiKey: value.apiKey ? this.safeStorage.encryptString(value.apiKey).toString('base64') : existing?.encryptedApiKey || null,
      updatedAt: new Date().toISOString(),
    };
    data.profiles = data.profiles.filter((item) => item.id !== profile.id);
    data.profiles.push(profile);
    if (value.active !== false) data.activeProfileId = profile.id;
    await this.write(data);
    return this.publicProfile(profile, data.activeProfileId);
  }

  async activate(id) {
    const data = await this.read();
    if (id !== null && !data.profiles.some((profile) => profile.id === id)) throw new Error('AI provider profile not found');
    data.activeProfileId = id;
    await this.write(data);
    return this.list();
  }

  async remove(id) {
    const data = await this.read();
    if (!data.profiles.some((profile) => profile.id === id)) throw new Error('AI provider profile not found');
    data.profiles = data.profiles.filter((profile) => profile.id !== id);
    if (data.activeProfileId === id) data.activeProfileId = null;
    await this.write(data);
    return this.list();
  }

  async activeEnvironment() {
    const data = await this.read(), profile = data.profiles.find((item) => item.id === data.activeProfileId);
    if (!profile) return {};
    let apiKey = '';
    if (profile.encryptedApiKey) {
      if (!this.safeStorage.isEncryptionAvailable()) throw new Error('Operating-system credential encryption is unavailable');
      apiKey = this.safeStorage.decryptString(Buffer.from(profile.encryptedApiKey, 'base64'));
    }
    return {
      RESEARCHED_AI_PROFILE_ID: profile.id, RESEARCHED_AI_PROTOCOL: profile.protocol,
      RESEARCHED_AI_MODEL: profile.model, RESEARCHED_AI_BASE_URL: profile.baseUrl,
      TIMSYS_AI_PROFILE_ID: profile.id, TIMSYS_AI_PROTOCOL: profile.protocol,
      TIMSYS_AI_MODEL: profile.model, TIMSYS_AI_BASE_URL: profile.baseUrl,
      ...(apiKey ? { TIMSYS_AI_API_KEY: apiKey } : {}),
      ...(apiKey ? { RESEARCHED_AI_API_KEY: apiKey } : {}),
    };
  }

  async write(data) {
    await fsp.mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${process.pid}.tmp`;
    await fsp.writeFile(temporary, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fsp.rename(temporary, this.file);
  }
}

module.exports = { AiCredentialVault };
