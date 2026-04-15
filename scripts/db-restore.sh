#!/bin/bash

# DuckShort Database Restore Script
# Usage: ./scripts/db-restore.sh <backup-file.sql>

BACKUP_FILE=$1
DB_NAME="duckshort-db"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup-file.sql>"
    echo "Example: $0 backups/production-20260415-202909.sql"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Restoring database from $BACKUP_FILE..."

# Clean existing data
echo "Cleaning existing database..."
cat > /tmp/clean.sql << 'CLEAN_EOF'
DROP TABLE IF EXISTS link_variants;
DROP TABLE IF EXISTS analytics;
DROP TABLE IF EXISTS links;
DROP TABLE IF EXISTS d1_migrations;
CLEAN_EOF

wrangler d1 execute $DB_NAME --local --file=/tmp/clean.sql

# Import backup
echo "Importing backup data..."
wrangler d1 execute $DB_NAME --local --file=$BACKUP_FILE

echo "Database restore complete!"

# Verify
echo "Verifying import..."
wrangler d1 execute $DB_NAME --local --command="SELECT COUNT(*) as link_count FROM links"
wrangler d1 execute $DB_NAME --local --command="SELECT COUNT(*) as analytics_count FROM analytics"
