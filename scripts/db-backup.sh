#!/bin/bash

# DuckShort Database Backup Script
# Usage: ./scripts/db-backup.sh [remote|local]

DB_TYPE=${1:-remote}
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_NAME="duckshort-db"

mkdir -p $BACKUP_DIR

if [ "$DB_TYPE" = "remote" ]; then
    echo "Exporting remote D1 database..."
    wrangler d1 export $DB_NAME --remote --output=$BACKUP_DIR/production-$TIMESTAMP.sql
    echo "Export complete: $BACKUP_DIR/production-$TIMESTAMP.sql"
else
    echo "Exporting local D1 database..."
    wrangler d1 export $DB_NAME --local --output=$BACKUP_DIR/local-$TIMESTAMP.sql
    echo "Export complete: $BACKUP_DIR/local-$TIMESTAMP.sql"
fi
