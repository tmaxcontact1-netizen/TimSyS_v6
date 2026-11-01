const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const fsp = require('node:fs/promises');
const { AiCredentialVault } = require('./ai-credential-vault.cjs');

test('stores encrypted provider credentials and only exposes safe metadata', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'timsys-ai-vault-'));
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: (v) => Buffer.from(`wrapped:${v}`), decryptString: (v) => v.toString().slice(8) };
  const vault = new AiCredentialVault({ file: path.join(root, 'profiles.json'), safeStorage });
  const saved = await vault.save({ name: 'OpenAI', protocol: 'openai-responses', model: 'model', baseUrl: 'https://api.openai.com', apiKey: 'very-secret' });
  assert.equal(saved.hasApiKey, true);
  assert.equal(JSON.stringify(await vault.list()).includes('very-secret'), false);
  assert.equal((await vault.activeEnvironment()).RESEARCHED_AI_API_KEY, 'very-secret');
  assert.equal((await fsp.readFile(path.join(root, 'profiles.json'), 'utf8')).includes('very-secret'), false);
});

test('rejects plaintext credential persistence when encryption is unavailable', async () => {
  const vault = new AiCredentialVault({ file: path.join(os.tmpdir(), 'unused-ai-vault.json'), safeStorage: { isEncryptionAvailable: () => false } });
  await assert.rejects(vault.save({ name: 'Remote', protocol: 'openai-chat', model: 'model', baseUrl: 'https://example.test', apiKey: 'secret' }), /encryption is unavailable/);
});

test('activates native Gemini for the platform and Research’Ed without exposing the key', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'timsys-gemini-vault-'));
  const vault = new AiCredentialVault({ file: path.join(root, 'profiles.json'), safeStorage: {
    isEncryptionAvailable: () => true, encryptString: v => Buffer.from(v).reverse(), decryptString: v => Buffer.from(v).reverse().toString(),
  } });
  await vault.save({ name: 'Gemini', protocol: 'gemini', model: 'chosen-model', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'test-gemini-key' });
  const environment = await vault.activeEnvironment();
  assert.equal(environment.TIMSYS_AI_PROTOCOL, 'gemini');
  assert.equal(environment.RESEARCHED_AI_PROTOCOL, 'gemini');
  assert.equal(environment.TIMSYS_AI_API_KEY, 'test-gemini-key');
  assert.equal(JSON.stringify(await vault.list()).includes('test-gemini-key'), false);
});
