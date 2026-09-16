import { copyFile, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const [configArgument, primaryArgument] = process.argv.slice(2);
if (!configArgument || !primaryArgument) {
  throw new Error('Usage: node scripts/switch-memecoined-paper-rpc.mjs <path-to-config-.env> <primary-rpc-url>');
}
const configFile = resolve(configArgument);
if (basename(configFile) !== '.env' || basename(dirname(configFile)) !== 'config' ||
    basename(dirname(dirname(configFile))) !== 'memecoined') {
  throw new Error('Refusing to edit anything except the MemeCoin\'Ed persistent config/.env');
}
const primary = new URL(primaryArgument);
if (primary.protocol !== 'https:' || primary.username || primary.password || primary.hash) {
  throw new Error('Primary RPC must be a clean HTTPS URL');
}
const original = await readFile(configFile, 'utf8');
const match = original.match(/^SOLANA_PRIMARY_RPC_URL=(.*)$/m);
const fallback = original.match(/^SOLANA_FALLBACK_RPC_URL=(.*)$/m);
if (!match || !fallback) throw new Error('Both independent Solana RPC settings must exist');
const fallbackUrl = new URL(fallback[1].trim().replace(/^['"]|['"]$/g, ''));
if (primary.hostname === fallbackUrl.hostname) throw new Error('Primary and fallback RPC hosts must differ');
if (match[1].trim().replace(/^['"]|['"]$/g, '') === primary.href) {
  process.stdout.write('Primary RPC already configured; no change made.\n');
  process.exit(0);
}
async function probe(url) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok || (await response.json()).result !== 'ok') {
    throw new Error(`RPC health probe failed for ${new URL(url).hostname}`);
  }
}
await Promise.all([probe(primary.href), probe(fallbackUrl.href)]);
const updated = original.replace(/^SOLANA_PRIMARY_RPC_URL=.*$/m, `SOLANA_PRIMARY_RPC_URL=${primary.href}`);
const backup = join(dirname(configFile), `.env.rpc-backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const temporary = join(dirname(configFile), `.env.rpc-update-${process.pid}`);
await copyFile(configFile, backup);
try {
  await writeFile(temporary, updated, { encoding: 'utf8', flag: 'wx' });
  await rename(temporary, configFile);
} catch (error) {
  throw new Error(`RPC config update failed; original preserved in ${backup}`, { cause: error });
}
process.stdout.write(`Primary RPC switched to ${primary.hostname}; fallback remains ${fallbackUrl.hostname}. A backup was saved. Restart MemeCoin'Ed to load it.\n`);
