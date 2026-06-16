# API Reference

**Base URL:** `https://duckshort.cc`  
**Auth:** All `/api/*` routes require either:
- `Authorization: Bearer <ADMIN_SECRET>` header, or
- `admin_token=<ADMIN_SECRET>` cookie

Unauthorized requests receive `401 { "error": "Unauthorized" }`.

---

## Stats

### `GET /api/stats/global`

Returns system-wide visit counters and a mood indicator. No auth required (public).

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

---

### `GET /api/stats/:id?limit=N`

Returns analytics for a single link. Auth required.

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
    { "referer": "https://twitter.com", "count": 300 }
  ],
  "sparkline": [12, 0, 45, 88, 102, 44, 23]
}
```

`sparkline` is an array of 7 integers: visit counts for the last 7 days, oldest first (index 0 = 6 days ago, index 6 = today).

---

## Links

### `GET /api/links`

Returns all links with 7-day sparklines. Auth required.

**Response:** Array of link objects:
```json
[
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
    "sparkline": [0, 2, 5, 1, 0, 3, 7]
  }
]
```

> **Note (B-05):** `utm_*`, `webhook_url` are not currently returned. Known gap.

---

### `POST /api/links`

Creates a new short link. Auth + rate-limited (20 req/hr per IP).

**Request body:**
```json
{
  "url": "https://example.com",             // required
  "customId": "my-alias",                   // optional, 3-20 chars [a-zA-Z0-9_-]
  "burn_on_read": false,                    // optional
  "expiresIn": 86400,                       // optional, seconds from now
  "password": "secret",                     // optional, stored as SHA-256
  "tag": "campaign",                        // optional, free-text label
  "utm_source": "twitter",                  // optional
  "utm_medium": "social",                   // optional
  "utm_campaign": "launch",                 // optional
  "webhook_url": "https://hooks.example.com/duck",  // optional, https + public IP only
  "og_title": "Check this out",             // optional
  "og_description": "A cool link",          // optional
  "og_image": "https://example.com/img.png",        // optional
  "variants": [                             // optional, A/B destinations
    { "destination_url": "https://a.example.com", "weight": 2 },
    { "destination_url": "https://b.example.com", "weight": 1 }
  ]
}
```

**Response `201`:**
```json
{
  "id": "abc123",
  "shortUrl": "https://duckshort.cc/abc123"
}
```

**Errors:**
- `400` — missing URL, invalid URL scheme, invalid customId format, invalid webhook_url
- `409` — `customId` already taken

---

### `PATCH /api/links/:id`

Performs a named action on a link. Auth required.

#### Action: `toggle`
Enables/disables the link.
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

Deletes a link and cascades to `analytics`, `link_variants`, `geo_redirects`. Auth required.

Response: `{ "success": true }`

---

### `POST /api/links/bulk-delete`

Deletes multiple links. Auth + rate-limited.

**Request:**
```json
{ "ids": ["abc123", "def456"] }
```

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

---

### `POST /api/links/:id/variants`

Adds a variant. Auth required.

```json
{ "destination_url": "https://c.example.com", "weight": 1 }
```

Response: `{ "id": "v3ghi", "link_id": "abc123", "destination_url": "...", "weight": 1 }`

---

### `DELETE /api/links/variants/:variantId`

Removes a variant. Auth required.

Response: `{ "success": true }`

---

## Geo-Redirects

### `GET /api/links/:id/geo-redirects`

Returns all geo rules for a link. Auth required.

```json
[
  { "id": "g1abc", "country_code": "TH", "destination_url": "https://th.example.com" }
]
```

---

### `POST /api/links/:id/geo-redirects`

Adds a country-specific redirect rule. Auth required.

```json
{ "country_code": "TH", "destination_url": "https://th.example.com" }
```

`country_code` must be a 2-letter ISO-3166-1 alpha-2 code.

Response: `{ "id": "g2def", "link_id": "abc123", "country_code": "TH", "destination_url": "..." }`

**Errors:**
- `400` — missing fields, invalid country code, invalid URL
- `409` — duplicate (link already has a rule for this country)

---

### `DELETE /api/links/geo-redirects/:geoId`

Removes a geo rule. Auth required.

Response: `{ "success": true }`

---

## Public Routes (no auth)

### `GET /:id`

Redirects to the destination URL.

| Condition | Response |
|-----------|---------|
| Not found / disabled | `404` SSR page |
| Expired | `410` SSR page, sets `disabled = 1` |
| Password protected | `302` → `/password/:id` |
| Burn-on-read | Atomically disables, then `302` |
| Normal | `302` to resolved destination |

Analytics are recorded after the redirect via `ctx.waitUntil` (non-blocking).

---

### `GET /preview/:id`

SSR preview page showing the link's OG tags and destination before redirecting. No analytics recorded.

---

### `GET /password/:id`

SSR form to enter the password for a password-protected link.

### `POST /password/:id`

Verifies the submitted password. On success, performs the redirect (same logic as `GET /:id`). On failure, re-renders the form with an error.
