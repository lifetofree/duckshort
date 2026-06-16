# Database Schema

**Engine:** Cloudflare D1 (SQLite)  
**Database name:** `duckshort-db`  
**Database ID:** `cbb432e6-7252-461d-83ff-d792be1413fb`  
**Migrations:** `migrations/0001_initial.sql` → `migrations/0007_custom_domain.sql`

---

## Tables

### `links`

Primary table. One row per shortened URL.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | — | Short alias (nanoid 6-char or custom 3-20 char) |
| `original_url` | TEXT NOT NULL | — | Destination URL (http/https only) |
| `created_at` | TEXT NOT NULL | — | ISO-8601 UTC timestamp |
| `expires_at` | TEXT | NULL | ISO-8601 UTC; NULL = never expires |
| `disabled` | INTEGER | 0 | 1 = link is inactive (manual or expired) |
| `password_hash` | TEXT | NULL | SHA-256 hex digest; NULL = no password |
| `tag` | TEXT | NULL | Free-text label for admin filtering |
| `utm_source` | TEXT | NULL | Injected into destination URL on redirect |
| `utm_medium` | TEXT | NULL | Injected into destination URL on redirect |
| `utm_campaign` | TEXT | NULL | Injected into destination URL on redirect |
| `webhook_url` | TEXT | NULL | HTTPS URL called on each redirect (fire-and-forget) |
| `burn_on_read` | INTEGER | 0 | 1 = disable atomically on first successful redirect |
| `og_title` | TEXT | NULL | OpenGraph title shown in preview page |
| `og_description` | TEXT | NULL | OpenGraph description |
| `og_image` | TEXT | NULL | OpenGraph image URL |
| `custom_domain` | TEXT | NULL | Custom hostname (e.g. `go.example.com`); unique |

**Indexes:**

| Name | Columns | Type |
|------|---------|------|
| `idx_links_expires_at` | `(expires_at)` | regular |
| `idx_links_created_disabled` | `(created_at DESC, disabled)` | regular |
| `idx_links_tag` | `(tag)` | regular |
| `idx_links_custom_domain` | `(custom_domain) WHERE custom_domain IS NOT NULL` | unique |

---

### `analytics`

Append-only event log. One row per redirect event.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `link_id` | TEXT NOT NULL | — | FK → `links.id` ON DELETE CASCADE |
| `country` | TEXT | NULL | ISO-3166-1 alpha-2 from `cf-ipcountry` header |
| `referer` | TEXT | NULL | `Referer` header, truncated to 255 chars |
| `user_agent` | TEXT | NULL | `User-Agent` header, truncated to 255 chars |
| `timestamp` | TEXT | `datetime('now')` | ISO-8601 UTC |

**Indexes:**

| Name | Columns |
|------|---------|
| `idx_analytics_link_id_country` | `(link_id, country)` |
| `idx_analytics_link_id_referer` | `(link_id, referer)` |
| `idx_analytics_timestamp` | `(timestamp)` |
| `idx_analytics_link_timestamp` | `(link_id, timestamp)` |

> **No primary key** on `analytics`. Rows are immutable after insert.

---

### `link_variants`

A/B routing destinations for a link. Weight-based random selection on redirect.

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | TEXT PK | — | nanoid 6-char |
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
| `id` | TEXT PK | — | nanoid 6-char |
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

- **Expiry**: `expires_at` is checked at redirect time. Expired links are set `disabled = 1` and return HTTP 410.
- **Scheduled cleanup**: Cron runs hourly and bulk-sets `disabled = 1` for all expired links.
- **Burn-on-read**: `UPDATE links SET disabled = 1 WHERE id = ? AND disabled = 0` — atomic, uses `changes` count to detect race.
- **Cascade deletes**: Deleting a `links` row cascades to `analytics`, `link_variants`, and `geo_redirects`.

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
