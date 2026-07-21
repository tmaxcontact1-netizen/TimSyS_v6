#!/usr/bin/env bash
# TimSyS Application Spawner
# Copies a clean TimSyS engine into a new application folder.
# Usage: bash Tools/spawn_app.sh <NewAppName>
# Example: bash Tools/spawn_app.sh ChurchOS

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: bash Tools/spawn_app.sh <NewAppName>"
  echo "Example: bash Tools/spawn_app.sh ChurchOS"
  exit 1
fi

APP_NAME="$1"
APP_NAME_LOWER=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]_')
SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_ROOT="$HOME/$APP_NAME"

echo "=== Spawning $APP_NAME from TimSyS ==="
echo "Source: $SOURCE_ROOT"
echo "Target: $TARGET_ROOT"
echo ""

# 1. Check target doesn't exist
if [[ -d "$TARGET_ROOT" ]]; then
  echo "ERROR: $TARGET_ROOT already exists"
  exit 1
fi

# 2. Copy
cp -r "$SOURCE_ROOT" "$TARGET_ROOT"

# 3. Clean copied artifacts (fresh start)
cd "$TARGET_ROOT"
rm -rf .git node_modules
rm -f data/*.sqlite* .env test-results.txt config/session-policy.json
rm -rf backups

# 4. Fix architecture map script to auto-detect root
sed -i 's|PROJECT_ROOT=".*"|PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." \&\& pwd)"|' Tools/update_architecture_map.sh

# 5. Replace path references in docs
sed -i "s|/home/[^ ]*/TimSyS_v6|$TARGET_ROOT|g" \
  CONTEXT.md HANDOVER.md DECISIONS.md ARCHITECTURE_MAP.md 2>/dev/null || true
sed -i "s|TimSyS_v6|$APP_NAME|g" \
  CONTEXT.md HANDOVER.md DECISIONS.md 2>/dev/null || true

# 6. Update package.json
node -e "
var fs = require('fs');
var pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = '$APP_NAME_LOWER';
pkg.scripts = pkg.scripts || {};
pkg.scripts.test = 'jest';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# 7. Update DB path defaults in deploy scripts
sed -i "s|timsys\.sqlite|$APP_NAME_LOWER.sqlite|g" \
  deploy/migrate.sh deploy/rollback.sh deploy/backup.sh \
  deploy/production.env.example 2>/dev/null || true

# 8. Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# 9. Run tests
echo ""
echo "Running tests..."
npm test

# 10. Regenerate architecture map
echo ""
echo "Regenerating architecture map..."
bash Tools/update_architecture_map.sh

# 11. Done
echo ""
echo "=== Spawn Complete ==="
echo "Location: $TARGET_ROOT"
echo ""
echo "Next steps:"
echo "  1. Open $TARGET_ROOT in VS Code"
echo "  2. git init && git add -A && git commit -m 'Initial $APP_NAME build from TimSyS'"
echo "  3. Run setup wizard: node deploy/setup-wizard.js"
echo "  4. Start building $APP_NAME modules in /modules/"