#!/bin/bash
# TimSyS v6 Database Rollback Script
set -e

echo "=== TimSyS Rollback Script ==="

if [ -f ".env" ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

export NODE_ENV=${NODE_ENV:-production}
export DB_PATH=${DB_PATH:-./data/timsys.sqlite}

# Get current migration version
CURRENT=$(node -e "
const db = require('./shared/services/db');
const r = db.query('SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 1');
console.log(r.rows.length > 0 ? r.rows[0].version : 'none');
")

echo "Current migration: $CURRENT"
echo "WARNING: This will rollback ALL migrations and recreate the database."
echo "Continue? (yes/no)"
read CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Rollback cancelled"
  exit 0
fi

# Backup current database
BACKUP="data/timsys.sqlite.backup.$(date +%Y%m%d_%H%M%S)"
cp "$DB_PATH" "$BACKUP"
echo "Backup created: $BACKUP"

# Remove database files
rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"

# Re-run migrations
echo "Re-running migrations..."
node scripts/cli/migrate.js

echo "=== Rollback Complete ==="
