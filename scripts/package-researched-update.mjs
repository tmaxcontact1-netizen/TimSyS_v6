// Research backend updates are part of the TimSyS platform bundle.
// Publish compatible platform and frontend together after consolidated acceptance.
import {fileURLToPath} from 'node:url';
const version=process.argv[2];if(!/^\d{4}\.\d{2}\.\d+(?:[-.][a-z0-9]+)?$/i.test(version||''))throw Error('Usage: node scripts/package-researched-update.mjs RELEASE_VERSION; run consolidated verification and staging first');
process.argv=[process.execPath,fileURLToPath(new URL('./create-update-release.mjs',import.meta.url)),version,'--only=platform,researched'];
await import('./create-update-release.mjs');
