#!/bin/bash

# DuckShort Database Schema Comparison Script
# Usage: ./scripts/db-compare.sh

DB_NAME="duckshort-db"

echo "======================================"
echo "  DATABASE SCHEMA COMPARISON"
echo "======================================"
echo ""

echo "📊 TABLE STRUCTURE COMPARISON"
echo "--------------------------------------"
echo "Local Tables:"
wrangler d1 execute $DB_NAME --local --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --json | jq -r '.results[].name' | grep -v "^_" | sort
echo ""
echo "Production Tables:"
wrangler d1 execute $DB_NAME --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --json | jq -r '.results[].name' | grep -v "^_" | sort
echo ""

echo "🔍 INDEX COMPARISON"
echo "--------------------------------------"
echo "Local Indexes:"
wrangler d1 execute $DB_NAME --local --command="SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name" --json | jq -r '.results[].name' | sort
echo ""
echo "Production Indexes:"
wrangler d1 execute $DB_NAME --remote --command="SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name" --json | jq -r '.results[].name' | sort
echo ""

echo "📈 DATA COUNT COMPARISON"
echo "--------------------------------------"
echo "Local Data:"
wrangler d1 execute $DB_NAME --local --command="SELECT 'links' as table_name, COUNT(*) as count FROM links UNION ALL SELECT 'analytics', COUNT(*) FROM analytics UNION ALL SELECT 'link_variants', COUNT(*) FROM link_variants"
echo ""
echo "Production Data:"
wrangler d1 execute $DB_NAME --remote --command="SELECT 'links' as table_name, COUNT(*) as count FROM links UNION ALL SELECT 'analytics', COUNT(*) FROM analytics UNION ALL SELECT 'link_variants', COUNT(*) FROM link_variants"
echo ""

echo "🗃️  MIGRATION HISTORY"
echo "--------------------------------------"
echo "Local Migrations:"
wrangler d1 execute $DB_NAME --local --command="SELECT name, applied_at FROM d1_migrations ORDER BY id"
echo ""
echo "Production Migrations:"
wrangler d1 execute $DB_NAME --remote --command="SELECT name, applied_at FROM d1_migrations ORDER BY id"
echo ""

echo "✅ Schema comparison complete!"
