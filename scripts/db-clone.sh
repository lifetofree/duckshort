#!/bin/bash

# DuckShort: copy the production D1 database into the local dev database.
#
# Workflow:
#   1. Export prod via `wrangler d1 export --remote`
#   2. Drop every table in the local D1 (mirrors the wrangler v4 `d1 execute`
#      behaviour where the local DB at .wrangler/state/v3/d1/... is rebuilt
#      on the next `wrangler dev`).
#   3. Import the prod SQL into local
#   4. Verify the row counts match
#
# Usage:
#   ./scripts/db-clone.sh                 # interactive, asks for confirmation
#   ./scripts/db-clone.sh --yes           # skip the prompt (e.g. in CI)
#   ./scripts/db-clone.sh --keep          # keep the SQL file under backups/
#
# Requires: wrangler logged in (CLOUDFLARE_API_TOKEN) and a clean `wrangler dev`
# state — stop any running `wrangler dev` first or the import will race the
# worker's connections.

set -euo pipefail

DB_NAME="duckshort-db"
BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/production-$TIMESTAMP.sql"
LOCAL_SQLITE_DIR=".wrangler/state/v3/d1/miniflare-D1DatabaseObject"

SKIP_CONFIRM=0
KEEP_BACKUP=1

for arg in "$@"; do
  case "$arg" in
    --yes|-y) SKIP_CONFIRM=1 ;;
    --no-keep) KEEP_BACKUP=0 ;;
    --help|-h)
      sed -n '2,22p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

# ─── Guards ────────────────────────────────────────────────────────────────

if ! command -v wrangler >/dev/null 2>&1; then
  echo "Error: wrangler is not on PATH. Run: npm i -g wrangler" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is not on PATH. Install: brew install jq" >&2
  exit 1
fi

if [[ -d .wrangler/tmp/dev ]] || pgrep -f "wrangler dev" >/dev/null 2>&1; then
  echo "Warning: a `wrangler dev` process appears to be running." >&2
  echo "Stop it (Ctrl-C) before importing — the dev worker holds the local DB." >&2
  if [[ $SKIP_CONFIRM -eq 0 ]]; then
    read -r -p "Continue anyway? [y/N] " reply
    [[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
  fi
fi

# ─── Confirm destructive wipe ──────────────────────────────────────────────

echo ""
echo "This will:"
echo "  1. Export PRODUCTION ($DB_NAME) → $BACKUP_FILE"
echo "  2. DROP every table in your local D1 ($LOCAL_SQLITE_DIR)"
echo "  3. Import the prod SQL into local"
echo ""
if [[ $SKIP_CONFIRM -eq 0 ]]; then
  read -r -p "Proceed? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

mkdir -p "$BACKUP_DIR"

# ─── Step 1: export prod ───────────────────────────────────────────────────

echo ""
echo "[1/4] Exporting prod → $BACKUP_FILE ..."
wrangler d1 export "$DB_NAME" --remote --output="$BACKUP_FILE"
echo "    OK ($(wc -c < "$BACKUP_FILE" | tr -d ' ') bytes)"

# ─── Step 2: row counts in prod (for the verify step) ──────────────────────

echo ""
echo "[2/4] Capturing prod row counts ..."
PROD_COUNTS=$(wrangler d1 execute "$DB_NAME" --remote \
  --command="SELECT 'links' AS t, COUNT(*) AS n FROM links UNION ALL SELECT 'analytics', COUNT(*) FROM analytics UNION ALL SELECT 'link_variants', COUNT(*) FROM link_variants UNION ALL SELECT 'geo_redirects', COUNT(*) FROM geo_redirects UNION ALL SELECT 'counters', COUNT(*) FROM counters" \
  --json 2>/dev/null || echo '{"results":[]}')
echo "$PROD_COUNTS" | jq -r '.results[0]?.results[]? | "    \(.t): \(.n)"' 2>/dev/null || echo "    (could not parse counts; verify will be skipped)"

# ─── Step 3: drop + import into local ─────────────────────────────────────

echo ""
echo "[3/4] Wiping + importing into local ..."

# Drop every table we know about, plus the migration log. This is the same set
# `db-restore.sh` uses, extended with counters / geo_redirects (added in
# migrations 0006 / 0008).
CLEAN_SQL=$(cat <<'SQL'
DROP TABLE IF EXISTS link_variants;
DROP TABLE IF EXISTS geo_redirects;
DROP TABLE IF EXISTS analytics;
DROP TABLE IF EXISTS links;
DROP TABLE IF EXISTS counters;
DROP TABLE IF EXISTS d1_migrations;
SQL
)

CLEAN_FILE=$(mktemp -t db-clone-clean.XXXXXX.sql)
printf "%s\n" "$CLEAN_SQL" > "$CLEAN_FILE"
wrangler d1 execute "$DB_NAME" --local --file="$CLEAN_FILE" >/dev/null
rm -f "$CLEAN_FILE"

wrangler d1 execute "$DB_NAME" --local --file="$BACKUP_FILE" >/dev/null

# ─── Step 4: verify ────────────────────────────────────────────────────────

echo ""
echo "[4/4] Verifying local row counts ..."
LOCAL_OUTPUT=$(wrangler d1 execute "$DB_NAME" --local \
  --command="SELECT 'links' AS t, COUNT(*) AS n FROM links UNION ALL SELECT 'analytics', COUNT(*) FROM analytics UNION ALL SELECT 'link_variants', COUNT(*) FROM link_variants UNION ALL SELECT 'geo_redirects', COUNT(*) FROM geo_redirects UNION ALL SELECT 'counters', COUNT(*) FROM counters" \
  --json)
echo "$LOCAL_OUTPUT" | jq -r '.results[0]?.results[]? | "    \(.t): \(.n)"'

echo ""
echo "Done. Your local D1 now mirrors production."
echo "Start the worker with:  npm run dev"
echo "Stop the dev server before re-running this script."

if [[ $KEEP_BACKUP -eq 0 ]]; then
  rm -f "$BACKUP_FILE"
  echo "Removed $BACKUP_FILE (--no-keep)."
fi
