#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const MODULES_DIR = path.resolve(__dirname, '../../modules');

function scaffold(moduleName) {
  const moduleDir = path.join(MODULES_DIR, moduleName);
  const migrationsDir = path.join(moduleDir, 'migrations');

  if (fs.existsSync(moduleDir)) {
    console.error('Error: Module "' + moduleName + '" already exists at ' + moduleDir);
    process.exit(1);
  }

  fs.mkdirSync(moduleDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });

  const manifest = {
    name: moduleName,
    version: '1.0.0',
    author: 'internal',
    dependencies: ['db'],
    provides: [],
    requires: [],
    routes: [],
    functions: [],
    schema: {
      tables: [],
      migrations: []
    },
    events: {
      publishes: [],
      subscribes: []
    }
  };

  fs.writeFileSync(path.join(moduleDir, 'module.json'), JSON.stringify(manifest, null, 2) + '\n');

  const indexJs = [
    "'use strict';",
    '',
    'const moduleJson = require("./module.json");',
    'const db = require("../../shared/services/db");',
    'const log = require("../../shared/services/log");',
    '',
    'module.exports = {',
    '  boot(ctx) {',
    '    log.info("' + moduleName + ' booting", { module: moduleJson.name });',
    '  },',
    '',
    '  teardown(ctx) {',
    '    log.info("' + moduleName + ' tearing down");',
    '  }',
    '};',
    ''
  ].join('\n');

  fs.writeFileSync(path.join(moduleDir, 'index.js'), indexJs);
  fs.writeFileSync(path.join(migrationsDir, '.gitkeep'), '');

  console.log('Created module "' + moduleName + '" at ' + moduleDir);
  console.log('  - module.json');
  console.log('  - index.js');
  console.log('  - migrations/.gitkeep');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Add routes to module.json');
  console.log('  2. Add functions to module.json');
  console.log('  3. Implement handlers in index.js');
  console.log('  4. Create migrations in migrations/');
  console.log('  5. Run: node scripts/cli/migrate.js list');
}

function main() {
  const cmd = process.argv[2];
  const name = process.argv[3];

  if (!cmd || cmd === 'help') {
    console.log('Usage: node scripts/cli/scaffold.js new <module-name>');
    process.exit(0);
  }

  if (cmd !== 'new') {
    console.error('Unknown command: ' + cmd);
    console.log('Usage: node scripts/cli/scaffold.js new <module-name>');
    process.exit(1);
  }

  if (!name) {
    console.error('Error: Module name required. Usage: node scripts/cli/scaffold.js new <module-name>');
    process.exit(1);
  }

  scaffold(name);
}

main();
