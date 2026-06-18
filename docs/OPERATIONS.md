# DuckShort — Operations Runbook

This page is the on-call's reference for routine operational tasks: backups,
restores, schema comparison, and safe prod → local D1 copy for debugging.

> **Prerequisites:** `wrangler` >= 4.x, Cloudflare OAuth login (`wrangler login`)
> OR `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` exported. The scripts
> use the OAuth token by default and fall back to the env vars if set.

## Scripts

| Script | Purpose | One-line usage |
|---|---|---|
| `scripts/db-backup.sh` | Export remote or local D1 to a SQL file | `./scripts/db-backup.sh remote` |
| `scripts/db-restore.sh` | Wipe local D1 and import a SQL file | `./scripts/db-restore.sh backups/production-20260618-100000.sql` |
| `scripts/db-compare.sh` | Schema + data diff between local and remote | `./scripts/db-compare.sh` |
| `scripts/db-clone.sh` | One-shot prod → local D1 copy (interactive) | `./scripts/db-clone.sh` |

## Backup Cadence

| Cadence | Action | Where it lands |
|---|---|---|
| Daily (3 AM UTC, recommended) | `wrangler d1 export duckshort-db --remote --output=backups/production-$(date +%Y%m%d).sql` | Local disk, S3, or Cloudflare R2 |
| Weekly | Compare the latest backup against the live DB with `scripts/db-compare.sh` | Slack `#ops` channel |
| Pre-deploy (any `Wave *` rollout) | Take a fresh backup and store it in `backups/pre-deploy-<branch>-<ts>.sql` | `backups/` directory |

The repo's `.gitignore` excludes the `backups/` directory, so backups never
leak into git. Recommended: push the daily backup to a private R2 bucket
(`wrangler r2 object put duckshort-backups/<date>.sql --file backups/<date>.sql`).

## Restore Procedure (test environment)

```bash
# 1. Stop any running dev worker (it holds the local DB open)
pkill -f "wrangler dev"

# 2. Pick the backup file
ls -1 backups/

# 3. Restore — the script drops all known tables, then re-imports.
./scripts/db-restore.sh backups/production-20260618-100000.sql

# 4. Start the dev worker and verify
npm run dev
curl -sS http://localhost:8787/health
# Expected: {"status":"ok","components":{"db":"ok","rate_limiter":"ok"}}
```

The `db-restore.sh` script is **local-only** — it never touches the remote
DB. Production restores must go through Cloudflare support (D1 is not
user-restoreable from a SQL export; it requires the support team to import
the SQL into a new D1 instance, then update the `database_id` in
`wrangler.toml` and `wrangler secret put`-style re-bind).

## Production → Local Copy (debugging)

`scripts/db-clone.sh` does the full prod → local copy in one command:

```bash
./scripts/db-clone.sh           # interactive, asks for confirmation
./scripts/db-clone.sh --yes     # non-interactive (CI / repeat runs)
./scripts/db-clone.sh --no-keep # throw away the SQL file after import
```

**Steps it runs** (in order, so a failure at any step is recoverable):

1. Guard: `wrangler` + `jq` on PATH; warn if `wrangler dev` is running.
2. Confirm destructive wipe.
3. Export prod → `backups/production-<ts>.sql`.
4. Capture prod row counts for the verify step.
5. Drop all known tables in local D1 (`link_variants`, `geo_redirects`,
   `analytics`, `links`, `counters`, `d1_migrations`).
6. Import the prod SQL into local D1.
7. Read back local row counts and print both side by side.

The script intentionally never touches production. If you need to share the
local copy with a teammate, scrub sensitive data first:

```sql
-- password hashes (PBKDF2 + legacy SHA-256): clear them
UPDATE links SET password_hash = NULL;

-- webhook URLs (may contain auth tokens in the path or query):
UPDATE links SET webhook_url = NULL;

-- custom domains: re-resolved per-environment
UPDATE links SET custom_domain = NULL;
```

## Schema Drift (db-compare.sh)

Run `./scripts/db-compare.sh` when:

- A migration was applied to prod but `wrangler d1 migrations apply
  duckshort-db --local` wasn't run locally.
- A new column is missing from a query result in production.
- After pulling a branch that adds a migration.

The script prints:

- Local + remote table lists
- Local + remote index lists (excluding `sqlite_*`)
- Row counts for `links`, `analytics`, `link_variants`, `geo_redirects`, `counters`
- Migration history for both DBs

Expected output after a clean `npm run dev`: both DBs show the same 5 tables
and 10+ indexes. The local DB will have one extra row in `d1_migrations`
representing the latest migration that the remote hasn't seen yet (until
the next prod deploy).

## Migrations

D1 migrations live in `migrations/NNNN_*.sql`. Naming is strict: four
digits, underscore, snake_case description, `.sql` extension. Add a new
migration:

```bash
# 1. Author the file
$EDITOR migrations/0011_new_feature.sql

# 2. Apply locally (and run the test suite)
npx wrangler d1 migrations apply duckshort-db --local
npm test

# 3. Apply to prod
npx wrangler d1 migrations apply duckshort-db --remote

# 4. Commit
git add migrations/0011_new_feature.sql
git commit -m "feat(db): add new_feature"
```

**Never** edit a migration that has been applied to prod — the file
content is hashed and recorded in `d1_migrations`; editing it causes
the next `wrangler d1 migrations apply` to error out with a "migration
contents do not match" warning. If you need to change the schema, add a
new migration that ALTERs the affected columns.

## Secrets Workflow

| Secret | Where it's set | Where it's used |
|---|---|---|
| `ADMIN_SECRET` | `wrangler secret put ADMIN_SECRET` (encrypted in Cloudflare) | Bearer auth on `/api/*`; PBKDF2 fallback for cookie sessions |
| `SESSION_SECRET` | `wrangler secret put SESSION_SECRET` (1.2, optional) | HMAC key for session cookies |

Rotate either secret by running `wrangler secret put <name>` with a new
value. The next deploy picks it up. Old session cookies signed with the
previous `SESSION_SECRET` are invalidated immediately — users see a
`session_signature_mismatch` log line and the SPA redirects to login.

## Health Monitoring

The `/health` endpoint (3.4) is the canonical probe. It returns 200 with
`{ status: 'ok', components: { db, rate_limiter } }` when both D1 and the
RateLimiter DO are reachable, 503 otherwise. Point Pingdom, UptimeRobot,
or Cloudflare's synthetic monitor at `https://duckshort.cc/health`.

## Incident Response

| Symptom | First action | Where to look |
|---|---|---|
| `/health` returns 503 | Check D1 status in Cloudflare dashboard | `duckshort-db` database view |
| Spike in `auth_failed` log lines | Check the source IP via `auth_failed_context` log | `wrangler tail` / Logpush |
| 429 floods | Verify `RATE_LIMITER` binding in `wrangler.toml` is still configured | `wrangler deployments list` |
| Webhook delivery complaints | Look for `webhook_failed` with `timedOut: true` | Cloudflare logs |
| `redirect_cache__` stale entries | `purgeRedirectCache` runs on update/delete/burn; if it's missing, check `dispatchRedirect` | `src/lib/redirectUtils.ts` |

## Staging Environment

7.1: The `staging` environment is a fully isolated preview stack used to
validate Wave rollouts, PR builds, and migration dry-runs before they hit
production. It uses:

- **Worker**: `duckshort-staging` (separate Workers deployment, no route
  bound — invoked via `staging.duckshort.cc` once a custom domain is set)
- **D1 database**: `duckshort-db-staging` (separate DB; reset between Wave
  rollouts via the restore procedure)
- **Pages project**: `duckshort-staging` (separate project, served at
  `staging.duckshort.pages.dev`)

### One-time setup

```bash
# 1. Create the staging D1 database and capture its id
wrangler d1 create duckshort-db-staging
# Copy the printed id into wrangler.toml's [[env.staging.d1_databases]].database_id

# 2. Create the Pages project
wrangler pages project create duckshort-staging

# 3. Bind a custom domain (optional, but recommended for OAuth cookies)
#    Cloudflare dashboard → Pages → duckshort-staging → Custom domains → staging.duckshort.cc

# 4. Set staging secrets (use a different ADMIN_SECRET from prod!)
wrangler secret put ADMIN_SECRET --env staging
wrangler secret put SESSION_SECRET --env staging

# 5. Apply all migrations to the staging DB
wrangler d1 migrations apply duckshort-db-staging --remote
```

### Deploying

Two paths:

| Trigger | What runs | Where it lands |
|---|---|---|
| PR opened/reopened/synchronized against `develop` | `.github/workflows/deploy-staging.yml` | staging.duckshort.cc |
| `gh workflow run deploy-staging.yml` | same | staging.duckshort.cc |
| Manual local deploy | `wrangler deploy --env staging` | same |

The PR workflow applies all pending D1 migrations, deploys the Worker
with `--env staging`, and uploads the Pages dist to `duckshort-staging`.
It posts the staging URL as a PR comment via the `cloudflare/pages-action`
integration.

### Resetting between Wave rollouts

```bash
# 1. Take a final prod snapshot first (so you can compare)
./scripts/db-backup.sh remote
cp backups/production-*.sql backups/staging-pre-reset-$(date +%Y%m%d).sql

# 2. Drop the staging DB and re-apply migrations
wrangler d1 execute duckshort-db-staging --remote --command "DROP TABLE IF EXISTS analytics, link_variants, geo_redirects, counters, link_stats_daily, links"
wrangler d1 migrations apply duckshort-db-staging --remote
```

### Wiping all staging data (GDPR / "I don't trust this anymore")

```bash
wrangler d1 execute duckshort-db-staging --remote --command \
  "DELETE FROM analytics; DELETE FROM link_variants; DELETE FROM geo_redirects; DELETE FROM counters; DELETE FROM link_stats_daily; DELETE FROM links"
```
