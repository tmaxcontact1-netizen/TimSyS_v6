#!/bin/bash
# TimSyS v6 Database Migration Runner
set -e

echo "=== TimSyS Migration Runner ==="

# Check environment
if [ -f ".env" ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

export NODE_ENV=${NODE_ENV:-production}
export DB_PATH=${DB_PATH:-./data/timsys.sqlite}

# Verify database exists
if [ ! -f "$DB_PATH" ]; then
  echo "Database not found at $DB_PATH"
  echo "Creating initial database..."
  node -e "const db = require('./shared/services/db'); console.log('Database initialized');"
fi

# Run migrations
echo "Running migrations..."
node scripts/cli/migrate.js

# Verify schema
echo "Verifying schema..."
node -e "
const db = require('./shared/services/db');
const result = db.query('SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1');
if (result.rows.length > 0) {
  console.log('Latest migration:', result.rows[0].version);
} else {
  console.log('No migrations found');
}
"

echo "=== Migration Complete ==="
