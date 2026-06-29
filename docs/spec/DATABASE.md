# Database Schema

**Engine:** Cloudflare D1 (SQLite)  
**Database name:** `duckshort-db`  
**Database ID:** `cbb432e6-7252-461d-83ff-d792be1413fb`  
**Migrations:** `migrations/0001_initial.sql` → `migrations/0011_link_stats_daily.sql`  
**See also:** `AGENTS.md` (canonical summary), `docs/spec/TECH_STACK.md`

---

## Tables

### `links`

Primary table. One row per shortened URL.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | — | Short alias (nanoid 8-char Base62 or custom 3-20 char) |
| `original_url` | TEXT NOT NULL | — | Destination URL (http/https only) |
| `created_at` | TEXT NOT NULL | — | ISO-8601 UTC timestamp |
| `expires_at` | TEXT | NULL | ISO-8601 UTC; NULL = never expires |
| `disabled` | INTEGER | 0 | 1 = link is inactive (manual or expired) |
| `password_hash` | TEXT | NULL | PBKDF2-SHA-256 hash (100k iterations, per-link salt); NULL = no password |
| `tag` | TEXT | NULL | Free-text label for admin filtering |
| `utm_source` | TEXT | NULL | Injected into destination URL on redirect |
| `utm_medium` | TEXT | NULL | Injected into destination URL on redirect |
| `utm_campaign` | TEXT | NULL | Injected into destination URL on redirect |
| `webhook_url` | TEXT | NULL | HTTPS URL called on each redirect (5s timeout via AbortController) |
| `burn_on_read` | INTEGER | 0 | 1 = disable atomically on first successful redirect |
| `og_title` | TEXT | NULL | OpenGraph title shown in preview page |
| `og_description` | TEXT | NULL | OpenGraph description |
| `og_image` | TEXT | NULL | OpenGraph image URL |
| `custom_domain` | TEXT | NULL | Custom hostname (e.g. `go.example.com`); unique |
| `visits` | INTEGER | 0 | Incremented in `recordAnalytics` for O(1) visit lookups |
| `daily_sparkline_cache_at` | TEXT | NULL | Timestamp of last `link_stats_daily` aggregation |

**Indexes:**

| Name | Columns | Type |
|------|---------|------|
| `idx_links_expires_at` | `(expires_at)` | regular |
| `idx_links_created_disabled` | `(created_at DESC, disabled)` | regular |
| `idx_links_tag` | `(tag)` | regular |
| `idx_links_custom_domain` | `(custom_domain) WHERE custom_domain IS NOT NULL` | unique |
| `idx_links_visits` | `(visits DESC)` | regular |

---

### `analytics`

Append-only event log. One row per redirect event.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT | NULL | 16-char hex token (indexed PK for GDPR-style single-row deletion) |
| `link_id` | TEXT NOT NULL | — | FK → `links.id` ON DELETE CASCADE |
| `country` | TEXT | NULL | ISO-3166-1 alpha-2 from `cf-ipcountry` header |
| `referer` | TEXT | NULL | Referer **hostname only** (path/query/fragment stripped), truncated to 255 chars |
| `user_agent` | TEXT | NULL | `User-Agent` header, truncated to 255 chars |
| `timestamp` | TEXT | `datetime('now')` | ISO-8601 UTC |

**Indexes:**

| Name | Columns |
|------|---------|
| `idx_analytics_id` | `(id)` |
| `idx_analytics_link_id_country` | `(link_id, country)` |
| `idx_analytics_link_id_referer` | `(link_id, referer)` |
| `idx_analytics_timestamp` | `(timestamp)` |
| `idx_analytics_link_timestamp` | `(link_id, timestamp)` |

> The `id` column is populated with a 16-char hex token for new rows. Legacy rows (pre-migration 0009) have NULL `id`.

---

### `link_variants`

A/B routing destinations for a link. Weight-based random selection on redirect.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | — | nanoid 8-char Base62 |
| `link_id` | TEXT NOT NULL | — | FK → `links.id` ON DELETE CASCADE |
| `destination_url` | TEXT NOT NULL | — | Alternate destination (http/https) |
| `weight` | INTEGER | 1 | Relative weight for random selection |

**Indexes:**

| Name | Columns |
|------|---------|
| `idx_link_variants_link_id` | `(link_id)` |

> If variants exist, they **replace** `original_url` as the redirect target (before geo override).

---

### `geo_redirects`

Per-link country-based redirect overrides.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | — | nanoid 8-char Base62 |
| `link_id` | TEXT NOT NULL | — | FK → `links.id` ON DELETE CASCADE |
| `country_code` | TEXT NOT NULL | — | ISO-3166-1 alpha-2 uppercase (e.g. `TH`, `US`) |
| `destination_url` | TEXT NOT NULL | — | Country-specific destination |

**Indexes:**

| Name | Columns | Type |
|------|---------|------|
| `idx_geo_redirects_link_id` | `(link_id)` | regular |
| `idx_geo_redirects_link_country` | `(link_id, country_code)` | unique |

> Geo overrides take **highest priority** — they override both `original_url` and any A/B variant.

---

### `counters`

Aggregate counters cached for fast lookups.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | TEXT PK | — | Counter name (e.g. `total_visits`) |
| `value` | INTEGER | 0 | Incremented atomically in `recordAnalytics` |

---

### `link_stats_daily`

Pre-aggregated daily visit counts per link. Populated by hourly cron (`aggregateLinkStatsDaily`).

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `link_id` | TEXT NOT NULL | — | FK → `links.id` ON DELETE CASCADE |
| `day` | TEXT NOT NULL | — | `YYYY-MM-DD` |
| `count` | INTEGER | 0 | Visit count for that day |

**Primary key:** `(link_id, day)`  
**Indexes:** `idx_link_stats_daily_day`, `idx_link_stats_daily_link_day`

> `getStats` and `getLinks` read from this table for the 7-day sparkline. They fall back to aggregating `analytics` on-demand if the cron hasn't run yet.

---

## Destination Resolution Order

When a redirect fires, the destination is resolved in this priority order:

```
1. Geo redirect match (country_code == cf-ipcountry)
        ↓ if no match
2. A/B variant (weighted random from link_variants)
        ↓ if no variants
3. original_url (the link's base destination)
        ↓ always applied last
4. UTM parameters injected into final URL
```

---

## Data Lifecycle

- **Expiry**: `expires_at` is checked at redirect time. Expired links return HTTP 410.
- **Scheduled cleanup**: Cron runs hourly and **DELETEs** all links where `datetime(expires_at) < datetime('now')`. (Previously set `disabled = 1`; changed in B-08 to avoid soft-delete accumulation.)
- **Burn-on-read**: `UPDATE links SET disabled = 1 WHERE id = ? AND disabled = 0` — atomic, uses `changes` count to detect race.
- **Counter self-heal**: `selfHealTotalVisitsCounter` cron reconciles `counters.total_visits` against the true `analytics` row count (skipped when analytics = 0 to avoid zeroing the counter on fresh deploys).
- **Cascade deletes**: Deleting a `links` row cascades to `analytics`, `link_variants`, `geo_redirects`, and `link_stats_daily`.

---

## Migration History

| File | Change |
|------|--------|
| `0001_initial.sql` | `links`, `analytics` tables, base indexes |
| `0002_feature_columns.sql` | `password_hash`, `tag`, UTM, `webhook_url`, `timestamp` on analytics, `link_variants` |
| `0003_vanity_and_burn.sql` | `burn_on_read` column |
| `0004_performance_indexes.sql` | Composite indexes on `links` and `analytics` |
| `0005_og_tags.sql` | `og_title`, `og_description`, `og_image` columns |
| `0006_geo_redirects.sql` | `geo_redirects` table |
| `0007_custom_domain.sql` | `custom_domain` column + unique index |
| `0008_visits_counters.sql` | `visits` column on `links`, `counters` table, backfill from analytics |
| `0009_analytics_id.sql` | `id` column + index on `analytics` for GDPR-style single-row deletion |
| `0010_analytics_link_country_index.sql` | Composite indexes `(link_id, country)` and `(link_id, referer)` |
| `0011_link_stats_daily.sql` | `link_stats_daily` table, `daily_sparkline_cache_at` on `links` |
