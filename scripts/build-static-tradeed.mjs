import {access} from 'node:fs/promises';
await access(new URL('../apps/tradeed/frontend/index.html',import.meta.url));
