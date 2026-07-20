#!/bin/bash
# TimSyS v6 Backup Script
# Reads config/session-policy.json for policy
set -e

CONFIG="config/session-policy.json"
DB="./data/timsys.sqlite"
DATE=$(date +%Y%m%d_%H%M%S)

# Check config exists
if [ ! -f "$CONFIG" ]; then
  echo "[ERROR] Run setup-wizard first: node deploy/setup-wizard.js"
  exit 1
fi

# Read backup strategy
IS_CLOUD=$(node -e "const c=require('$CONFIG');console.log(c.backup.isCloud)")
PROVIDER=$(node -e "const c=require('$CONFIG');console.log(c.backup.provider)")
SCHEDULE=$(node -e "const c=require('$CONFIG');console.log(c.backup.schedule)")
RETENTION=$(node -e "const c=require('$CONFIG');console.log(c.backup.retentionDays)")

BACKUP_DIR="./backups/$PROVIDER"
mkdir -p "$BACKUP_DIR"

echo "=== TimSyS Backup ==="
echo "Provider: $PROVIDER"
echo "Schedule: $SCHEDULE"
echo "Retention: $RETENTION days"
echo ""

# Perform backup using VACUUM INTO (atomic, consistent snapshot)
BACKUP_FILE="$BACKUP_DIR/timsys_$DATE.sqlite"
echo "Creating full backup: $BACKUP_FILE"
sqlite3 "$DB" "VACUUM INTO '$BACKUP_FILE';"

# Log the backup
echo "$(date -Iseconds) - Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" >> "backups/backup-log.txt"

# Cleanup old backups
echo "Cleaning up backups older than $RETENTION days..."
find "$BACKUP_DIR" -name "*.sqlite" -mtime "+$RETENTION" -delete

# Cloud sync if applicable
if [ "$IS_CLOUD" = "true" ]; then
  echo "Syncing to cloud provider: $PROVIDER"
  # TODO: Implement based on provider (aws s3 cp, rclone, etc.)
  echo "WARNING: Cloud sync not implemented. Configure for $PROVIDER."
fi

echo "=== Backup Complete ==="
