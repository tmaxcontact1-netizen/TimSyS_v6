const pkg = require('../../package.json');
pkg.scripts = pkg.scripts || {};
pkg.scripts['migrate:list'] = 'node scripts/cli/migrate.js list';
pkg.scripts['migrate:run'] = 'node scripts/cli/migrate.js run';
pkg.scripts['migrate:rollback'] = 'node scripts/cli/migrate.js rollback';
require('fs').writeFileSync('../../package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Updated package.json');