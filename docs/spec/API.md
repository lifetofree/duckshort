# API Reference

**Base URL:** `https://duckshort.cc`  
**Stage:** Production (v1.9.3)  
**See also:** `AGENTS.md` (canonical summary table), `docs/spec/TECH_STACK.md` (auth + rate-limit details)

---

## Authentication

Most `/api/*` routes require either:

| Mechanism | Header / Cookie | Where used |
|-----------|-----------------|------------|
| **Bearer token** | `Authorization: Bearer <ADMIN_SECRET>` | API clients (curl, scripts) |
| **HMAC cookie + CSRF** | `admin_token=<HMAC>` cookie + `X-XSRF-TOKEN` header | Browser SPA |

- Cookie-based auth requires the `X-XSRF-TOKEN` header (double-submit CSRF) on state-changing requests.
- The `/api/links` endpoint is **partially public**: anonymous visitors can submit the basic shorten form (`url`, `customId`, `burn_on_read`, `expiresIn`, `password`); admin-only fields (`tag`, `webhook_url`, `utm_*`, `og_*`, `variants`) require auth.
- `/api/stats/global` and `/api/stats/:id` are intentionally unauthenticated (link owner can share the stats URL). Stored `referer` is hostname-only (S-20).
- `/api/auth`, `/api/logout`, `/api/auth/check`, and `/health` have their own auth flow.

Unauthorized: `401 { "error": "Unauthorized" }`  
CSRF mismatch: `403 { "error": "CSRF token mismatch" }`

---

## Auth

### `POST /api/auth`
Login. Rate-limited (`api` pool, 20/hr). On success, sets the `admin_token` cookie and `XSRF-TOKEN` cookie; returns `{ success: true }`. Failed login returns 401.

### `POST /api/logout`
Clears the `admin_token` and `XSRF-TOKEN` cookies. No auth required.

### `GET /api/auth/check`
Returns `{ authenticated: boolean }`. Used by the SPA to decide whether to render the admin UI. Registered after the auth middleware (S-13) so it cannot be bypassed.

---

## Stats

### `GET /api/stats/global`
System-wide visit counters and mood. **No auth** (public).

**Response:**
```json
{
  "totalVisits": 12483,
  "hourlyVisits": 42,
  "mood": "ACTIVE"
}
```

| `mood` | Condition |
|--------|-----------|
| `VIRAL` | hourlyVisits ≥ 50 |
| `BUSY` | hourlyVisits ≥ 10 |
| `ACTIVE` | hourlyVisits ≥ 1 |
| `DORMANT` | hourlyVisits = 0 |

`/api/stats/global` also sets `Cache-Control: public, max-age=30` to absorb polling traffic from the duck-mood UI.

---

### `GET /api/stats/:id?limit=N`
Analytics for a single link. **No auth** (public by design — S-20).

**Query params:**
- `limit` — integer 1–100, default 10. Controls top-N rows for `countries` and `referrers`.

**Response:**
```json
{
  "link": {
    "id": "abc123",
    "original_url": "https://example.com",
    "created_at": "2026-04-01T12:00:00.000Z",
    "expires_at": null,
    "disabled": 0,
    "tag": "campaign-q2"
  },
  "visits": 847,
  "countries": [
    { "country": "TH", "count": 412 },
    { "country": "US", "count": 201 }
  ],
  "referrers": [
    { "referer": "twitter.com", "count": 300 }
  ],
  "sparkline": [12, 0, 45, 88, 102, 44, 23]
}
```

`sparkline` is an array of 7 integers: visit counts for the last 7 days, oldest first (index 0 = 6 days ago, index 6 = today). Sourced from the pre-aggregated `link_stats_daily` table.

`referer` is hostname-only (path/query/fragment stripped).

---

## Links

### `GET /api/links?cursor=<ts>&limit=N`
Cursor-paginated list with 7-day sparkline. Auth required.

**Query params:**
- `cursor` — optional ISO timestamp of the last item from the previous page.
- `limit` — integer 1–100, default 50.

**Response:**
```json
{
  "links": [
    {
      "id": "abc123",
      "original_url": "https://example.com",
      "created_at": "2026-04-01T12:00:00.000Z",
      "expires_at": null,
      "disabled": 0,
      "tag": null,
      "burn_on_read": 0,
      "has_password": 0,
      "custom_domain": null,
      "visits": 42,
      "webhook_url": null,
      "utm_source": null,
      "utm_medium": null,
      "utm_campaign": null,
      "og_title": null,
      "og_description": null,
      "og_image": null,
      "sparkline": [0, 2, 5, 1, 0, 3, 7]
    }
  ],
  "nextCursor": "2026-04-01T11:00:00.000Z"
}
```

When `nextCursor` is `null`, there are no more pages.

---

### `POST /api/links`
Create a new short link. Rate-limited (`api` pool, 20/hr).

The home-page shorten form is **public** — anonymous submissions with only the basic fields are accepted. Admin-only fields require auth + CSRF (see Authentication section).

**Request body:**
```json
{
  "url": "https://example.com",             // required
  "customId": "my-alias",                   // optional, 3-20 chars [a-zA-Z0-9_-]
  "burn_on_read": false,                    // optional
  "expiresIn": 86400,                       // optional, 1..31,536,000 seconds from now
  "password": "secret",                     // optional, ≤ 256 chars, PBKDF2-hashed
  "tag": "campaign",                        // admin-only, max 64 chars
  "utm_source": "twitter",                  // admin-only, max 200 chars
  "utm_medium": "social",                   // admin-only, max 200 chars
  "utm_campaign": "launch",                 // admin-only, max 200 chars
  "webhook_url": "https://hooks.example.com/duck",  // admin-only, https + public IP only
  "og_title": "Check this out",             // admin-only, max 200 chars
  "og_description": "A cool link",          // admin-only, max 500 chars
  "og_image": "https://example.com/img.png",        // admin-only, https only
  "variants": [                             // admin-only, A/B destinations
    { "destination_url": "https://a.example.com", "weight": 2 },
    { "destination_url": "https://b.example.com", "weight": 1 }
  ]
}
```

**Response `201`:**
```json
{ "id": "abc123", "shortUrl": "https://duckshort.cc/abc123" }
```

**Errors:**
- `400` — missing URL, invalid URL scheme, invalid customId format, invalid webhook_url, field-length cap exceeded, password > 256 chars
- `409` — `customId` already taken
- `403` — admin field submitted without CSRF token
- `500` — only on unrecoverable D1 error (id collision retries once)

---

### `PATCH /api/links/:id`
Performs a named action on a link. Auth required.

#### Action: `toggle`
```json
{ "action": "toggle" }
```
Response: `{ "success": true, "disabled": true }`

#### Action: `extend`
Extends expiry. If already expired, extends from now.
```json
{ "action": "extend", "extendHours": 48 }
```
Response: `{ "success": true, "expires_at": "2026-05-17T12:00:00.000Z" }`

#### Action: `set_custom_domain`
Binds or clears a custom domain.
```json
{ "action": "set_custom_domain", "custom_domain": "go.example.com" }
```
Response: `{ "success": true, "custom_domain": "go.example.com" }`

Pass `"custom_domain": null` or `""` to clear.

**Errors:**
- `400` — invalid domain format, unknown action
- `404` — link not found
- `409` — domain in use by another link

---

### `DELETE /api/links/:id`
Deletes a link and cascades to `analytics`, `link_variants`, `geo_redirects`, `link_stats_daily`. Auth required.

Response: `{ "success": true }`

---

### `POST /api/links/bulk-delete`
Deletes multiple links. Auth + rate-limited (`api` pool).

**Request:**
```json
{ "ids": ["abc123", "def456"] }
```
Max `BULK_DELETE_MAX_IDS` (100) per request.

Response: `{ "success": true, "deleted": 2 }`

---

### `GET /api/links/export`
Downloads all links as CSV. Auth required.

**Response:** `Content-Type: text/csv`, attachment filename `duckshort-export.csv`

Columns: `ID, Original URL, Created, Expires, Status, Tag, Visits`

Status values: `active`, `disabled`, `expired`

---

## Variants (A/B)

### `GET /api/links/:id/variants`
Returns all variants for a link. Auth required.

Response:
```json
[
  { "id": "v1abc", "destination_url": "https://a.example.com", "weight": 2 },
  { "id": "v2def", "destination_url": "https://b.example.com", "weight": 1 }
]
```

### `POST /api/links/:id/variants`
Adds a variant. Auth required.

```json
{ "destination_url": "https://c.example.com", "weight": 1 }
```
Response: `{ "id": "v3ghi", "link_id": "abc123", "destination_url": "...", "weight": 1 }`

### `DELETE /api/links/variants/:variantId`
Removes a variant. Auth required.

Response: `{ "success": true }`

---

## Geo-Redirects

### `GET /api/links/:id/geo-redirects`
Returns all geo rules for a link. Auth required.

### `POST /api/links/:id/geo-redirects`
Adds a country-specific redirect rule. Auth required.

```json
{ "country_code": "TH", "destination_url": "https://th.example.com" }
```
`country_code` must be a 2-letter ISO-3166-1 alpha-2 code (uppercased before insert).

**Errors:** `400` (missing fields, invalid country code, invalid URL), `409` (duplicate).

### `DELETE /api/links/geo-redirects/:geoId`
Removes a geo rule. Auth required.

---

## Health

### `GET /health`
Liveness probe. No auth, no rate limit.

**Response `200`:**
```json
{ "status": "ok", "components": { "db": "ok", "rate_limiter": "ok" } }
```
Returns `503` if either component is unreachable.

Headers: `Cache-Control: no-store`.

---

## Public Routes (no auth)

### `GET /:id`
Redirects to the destination URL. Rate-limited (`redirect` pool, 200/hr).

| Condition | Response |
|-----------|---------|
| Not found / disabled | `404` SSR page |
| Expired | `410` SSR page, sets `disabled = 1` |
| Password protected | `302` → `/password/:id` |
| Burn-on-read | Atomically disables, then `302` |
| Normal | `302` to resolved destination |

Analytics + webhook are recorded via `ctx.waitUntil` (non-blocking). Cache API short-circuits hot links for 24h (skipped for burn-on-read).

### `GET /preview/:id`
SSR preview page with the link's OG tags and destination before redirecting. No analytics recorded.

### `GET /password/:id`
SSR form to enter the password for a password-protected link.

### `POST /password/:id`
Verifies the submitted password. Rate-limited (`redirect` pool, 200/hr — S-15). On success, performs the redirect (same logic as `GET /:id`). On failure, re-renders the form with an error.

### `GET /`, `GET /admin`
Served by Workers Static Assets (`c.env.ASSETS.fetch(...)`). Returns the SPA shell.
