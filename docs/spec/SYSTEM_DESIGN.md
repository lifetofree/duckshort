# System Design

**DuckShort** — URL shortener on Cloudflare Workers + D1 + Pages  
**Stage:** Production v1 — post-3rd audit, all 64 ISSUESTOFIX items closed  
**As of:** 2026-06-18

> Refreshed in Wave 1 of `docs/PLAN_IMPROVEMENT.md` (item 8.1). Reflects the
> current state after the rate-limit bucket split, HMAC session model, PBKDF2
> password hashing, security headers, analytics PK, webhook timeout, and the
> new `/health` endpoint.

---

## Architecture Overview

```
                         ┌─────────────────────────────────────┐
Browser / API client ───▶│  Cloudflare Route: duckshort.cc/*   │
                         └──────────────┬──────────────────────┘
                                        │
                         ┌──────────────▼──────────────────────┐
                         │       Cloudflare Worker              │
                         │       src/index.tsx (Hono)           │
                         │                                      │
                         │  Middleware stack (all routes):      │
                         │  1. logger()                         │
                         │  2. cors()                           │
                         │  3. resolveCustomDomain()            │
                         │  4. S-19 security-headers post-      │
                         │     handler (nosniff/frame/referrer) │
                         │                                      │
                         │  Route groups:                       │
                         │  • /api/*   → admin handlers         │
                         │     (apiRateLimit middleware)        │
                         │  • /:id     → redirectLink           │
                         │     (redirectRateLimit middleware)   │
                         │  • /preview/:id → previewLink        │
                         │  • /password/:id → SSR password form │
                         │  • /health  → health check (3.4)     │
                         │  • / /admin → proxy to Pages         │
                         │  • * → catch-all proxy to Pages      │
                         └──┬──────────┬─────────────┬─────────┘
                            │          │             │
              ┌─────────────▼─┐  ┌─────▼──────┐  ┌──▼───────────────┐
              │  D1 SQLite DB │  │  Durable   │  │  Cloudflare Pages │
              │  duckshort-db │  │  Object    │  │  duckshort.pages  │
              │               │  │  RateLimiter│  │  .dev (React SPA) │
              │  links        │  │            │  │                   │
              │  analytics    │  │  per-IP    │  │  /               │
              │   (id PK)     │  │  sliding   │  │  /admin          │
              │  link_variants│  │  counter   │  │  /assets/*       │
              │  geo_redirects│  │  keyed by  │  │                   │
              │  counters     │  │  api|ip /  │  │                   │
              │               │  │  redirect|ip│  │                   │
              └───────────────┘  └────────────┘  └───────────────────┘
```

### P-16: Two rate-limit buckets share one DO class

A single `RateLimiter` Durable Object serves both pools; the bucket key is
encoded in the DO id (`api:<ip>` for the `apiRateLimit` middleware, capped at
`RATE_LIMIT_MAX_REQUESTS = 20/hr`; `redirect:<ip>` for the `redirectRateLimit`
middleware, capped at `RATE_LIMIT_REDIRECT_MAX_REQUESTS = 200/hr`). The
limit for the bucket is passed in the DO request body — the class itself
does not know which pool it is serving.

### S-19: Security headers post-handler

After every `await next()` the response gets three headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. CSP is tracked as a separate item (1.1, planned for Wave 2).

---

## Request Flow: Short Link Redirect (`GET /:id`)

```
Request: GET /abc123
         │
         ├── resolveCustomDomain() middleware
         │   └── Host == duckshort.cc → skip (primary host), pass through
         │       Host == custom domain → SELECT link WHERE custom_domain = ?
         │         then run the same redirect logic as /:id
         │
         ├── redirectLink handler
         │   ├── B-12: loadLinkRow() — D1 SELECT for the link row
         │   ├── Check: not found / disabled → 404 SSR
         │   ├── Check: expired → UPDATE disabled=1, 410 SSR
         │   ├── Check: burn_on_read → UPDATE disabled=1 (atomic), verify change
         │   ├── Check: password_hash → 302 /password/abc123
         │   │
         │   ├── resolveDestination()
         │   │   ├── DB (parallel):
         │   │   │   ├── SELECT link_variants WHERE link_id = 'abc123'
         │   │   │   └── SELECT geo_redirects WHERE link_id = 'abc123' AND country_code = ?
         │   │   ├── Pick variant (weighted random) or fallback to original_url
         │   │   ├── Apply geo override if country matched
         │   │   └── Inject UTM params into final URL
         │   │
         │   ├── 302 → destination
         │   │
         │   └── recordAnalytics() [ctx.waitUntil — non-blocking]
         │       ├── INSERT INTO analytics (id, link_id, country, referer,
         │       │   user_agent, timestamp)  — id = newAnalyticsId() (16-char hex)
         │       │   [P-17: id is the primary key for GDPR-style deletion]
         │       │   [S-20: referer stored as hostname only]
         │       ├── UPDATE links SET visits = visits + 1
         │       ├── UPDATE counters SET value = value + 1 WHERE key = 'total_visits'
         │       └── P-18: POST webhook_url if set (AbortController timeout 5_000 ms)
         │           — timedOut flag in webhook_failed log
         │
         └── redirectRateLimit middleware
             └── DO.fetch({ bucket: 'redirect', limit: 200 })
                 on 429 → 429 with Retry-After (B-10 fix shape)
```

### B-12: BASE_URL cache key for `purgeRedirectCache`

When `dispatchRedirect` writes a Cache API entry for a hot link, the cache
key is `${BASE_URL}/__redirect_cache__/${id}`. Admin write paths
(`updateLink`, `deleteLink`, `bulkDeleteLinks`) purge with the same key so
the read-side cache stays consistent with the DB.

---

## Request Flow: Custom Domain

```
Request: GET / (Host: go.example.com)
         │
         ├── resolveCustomDomain() middleware fires
         │   ├── S-18: isLocalHostname(host) — exact match for `localhost`,
         │   │   `localhost:*`, `127.*`, `[::1]` (no more substring match)
         │   ├── Host != primary && !local → SELECT link WHERE custom_domain = host
         │   ├── Link found → run the same redirect logic as /:id handler
         │   │   (disable check, expiry check, burn-on-read, password,
         │   │    resolveDestination, analytics)
         │   └── Link not found → pass through to normal route matching
```

---

## Request Flow: Admin API

```
Request: POST /api/links
         │
         ├── apiRateLimit middleware (P-16)
         │   ├── Extract IP from CF-Connecting-IP header
         │   ├── DO id = `api:${ip}` — separate counter from redirects
         │   ├── DO.fetch({ bucket: 'api', limit: 20 })
         │   │   └── Atomic transaction: increment counter, check limit
         │   └── Allowed → set X-RateLimit-* headers, continue
         │       Blocked → 429 with Retry-After
         │
         └── createLink handler
             ├── requireAuthFromContext(c) (1.3)
             │   ├── Cookie admin_token (HttpOnly, SameSite=Lax, Secure)
             │   │   └── HMAC-SHA256 verify with SESSION_SECRET via
             │   │       crypto.subtle.timingSafeEqual (S-15)
             │   │       1h lifetime (SESSION_MAX_AGE_SECONDS = 3600)
             │   │       Re-issued by `login` on each successful auth
             │   ├── Fallback: Authorization: Bearer <ADMIN_SECRET>
             │   │   └── timingSafeEqual(token, ADMIN_SECRET)
             │   └── Failure → logger.warn('auth_failed', { reason, path, method, ip })
             ├── Validate body fields (MAX_URL_LENGTH, MAX_PASSWORD_LENGTH, …)
             ├── DB: INSERT INTO links
             ├── DB (batch): INSERT INTO link_variants (if provided)
             └── Response: { id, shortUrl }
```

---

## Request Flow: Health Check (3.4)

```
Request: GET /health
         │
         └── health handler (unauthenticated, no rate limit)
             ├── DB: SELECT 1 → ok / failed
             ├── DO: get stub, send noop fetch → ok / failed
             ├── 200 + { status: 'ok', components: { db, rate_limiter } }
             │   Cache-Control: no-store
             └── on any component failed → 503 + { status: 'degraded', components }
```

Use it for Cloudflare's health check, Pingdom, UptimeRobot, or any synthetic
monitor. The Worker does **not** apply rate limits or auth to this endpoint.

---

## Component Hierarchy

### Worker (`src/`)

```
src/
├── index.tsx               — Hono app, route wiring, cron export, RateLimiter DO export
├── types.ts                — Env interface (PAGES_URL?, ADMIN_SECRET, BASE_URL, DB, RATE_LIMITER)
├── handlers/
│   ├── admin.ts            — getLinks, createLink, updateLink, deleteLink,
│   │                         bulkDeleteLinks, getVariants, createVariant,
│   │                         deleteVariant, exportLinks,
│   │                         getGeoRedirects, createGeoRedirect, deleteGeoRedirect
│   ├── auth.ts             — login (sets HttpOnly cookie), logout
│   ├── cleanup.ts          — cleanupExpiredLinks (cron 0 * * * *)
│   ├── health.ts           — health (3.4) — DB + DO probes
│   ├── password.tsx        — showPasswordEntry, verifyPasswordEntry (SSR + A/B + UTM + webhook)
│   ├── preview.tsx         — previewLink
│   ├── redirect.tsx        — redirectLink (calls dispatchRedirect)
│   └── stats.ts            — getStats (?limit=N), getGlobalStats
├── middleware/
│   ├── rateLimit.ts        — rateLimit(c, next, bucket) wrapper; DO id = `${bucket}:${ip}`
│   └── customDomain.ts     — resolveCustomDomain, isLocalHostname (S-18)
├── durableObjects/
│   └── RateLimiter.ts      — Sliding-window counter via DO storage transactions;
│                              limit is passed in the request body (P-16)
├── lib/
│   ├── auth.ts             — timingSafeEqual, requireAuth, requireAuthFromContext,
│   │                         generateSessionToken, verifySessionToken, hashPassword (PBKDF2),
│   │                         verifyPassword, pbkdf2
│   ├── constants.ts        — Literal-typed constants (RATE_LIMIT_MAX_REQUESTS = 20,
│   │                         RATE_LIMIT_REDIRECT_MAX_REQUESTS = 200, SESSION_MAX_AGE_SECONDS = 3600,
│   │                         MAX_URL_LENGTH, MAX_PASSWORD_LENGTH, WEBHOOK_TIMEOUT_MS = 5_000, …)
│   ├── dbTypes.ts          — LinkRow, LinkRowWithSparkline, RedirectLinkRow,
│   │                         AnalyticsRow, VariantRow, GeoRedirectRow, CounterRow
│   ├── env.ts              — pagesOrigin(env), baseUrl(env), stripTrailingSlash(url)
│   ├── logger.ts           — logger.info / .warn / .error (JSON line, no PII)
│   ├── nanoid.ts           — generateId() — 8-char Base62 (62^8 ≈ 218T)
│   ├── redirectUtils.ts    — dispatchRedirect, resolveDestination, recordAnalytics,
│   │                         handleBurnOnRead, isSafeUrl, isSafeWebhookUrl,
│   │                         newAnalyticsId, refererHostname (S-20), purgeRedirectCache
│   ├── utm.ts              — injectUtm()
│   └── variants.ts         — pickVariant()
└── ui/                     — Hono/JSX SSR pages (interstitials only)
    ├── Layout.tsx
    ├── config.json
    └── pages/
        ├── NotFound.tsx
        ├── PasswordEntry.tsx
        └── Preview.tsx
```

### Frontend SPA (`frontend/src/`)

```
frontend/src/
├── main.tsx                — App entry, React root, I18nProvider wrap, ErrorBoundary wrap
├── App.tsx                 — Router: / → Home, /admin → Admin (lazy)
├── pages/
│   ├── Home.tsx            — Public UI: shorten form + global stats + per-link stats
│   └── Admin.tsx           — Admin dashboard (lazy, code-split per tab)
├── components/
│   ├── ShortenForm.tsx     — URL input, options, submit
│   ├── ResultModal.tsx     — Success modal with short URL + QR code (qrcode.react)
│   ├── StatsView.tsx       — Per-link stats: visits, countries, referrers, sparkline
│   ├── NeonHeatmap.tsx     — Country visit heatmap visualization
│   ├── QuackCounter.tsx    — Animated global visit counter (useQuery)
│   ├── DuckMoodLogo.tsx    — Duck logo that changes mood (DORMANT/ACTIVE/BUSY/VIRAL)
│   ├── DevModeBar.tsx      — Dev environment indicator bar
│   ├── ErrorBoundary.tsx   — React error boundary for crash isolation
│   ├── LinkCreateForm.tsx, LinkTable.tsx, GeoRedirectManager.tsx, … (admin tabs)
│   ├── LinkDetailPanel.tsx, PerLinkStatsView.tsx, GlobalStatsView.tsx
│   └── AdminAuthGate.tsx
├── hooks/
│   ├── useShortenForm.ts   — 2.4: extracted from Home.tsx
│   ├── useStatsView.ts     — 2.4: extracted from Home.tsx
│   └── useGlobalStats.ts   — 2.4: extracted from Home.tsx
├── lib/
│   ├── constants.ts        — API_BASE_URL and shared frontend caps
│   ├── i18n.tsx            — I18nProvider + useTranslation hook
│   ├── queryClient.ts      — @tanstack/react-query singleton
│   └── utils.ts            — Shared utilities
├── locales/
│   └── lang-en.json        — English translation strings
└── types.ts                — Shared TypeScript interfaces
```

---

## Cloudflare Infrastructure

| Resource | Name / ID | Binding | Notes |
|----------|-----------|---------|-------|
| Worker | `duckshort` | — | Routes `duckshort.cc/*` |
| D1 Database | `duckshort-db` / `cbb432e6-7252-461d-83ff-d792be1413fb` | `DB` | 8 tables, 10+ indexes |
| Durable Object | `RateLimiter` class | `RATE_LIMITER` | Per-bucket sliding window |
| Pages project | `duckshort` | — | SPA at `duckshort.pages.dev` |
| Custom domain | `duckshort.cc` | Route | `duckshort.cc/*` |
| Variable | `BASE_URL` | `https://duckshort.cc` | Override via `wrangler secret put` |
| Variable | `PAGES_URL` (B-13) | `https://duckshort.pages.dev` | Override in dashboard |
| Secret | `ADMIN_SECRET` | — | `wrangler secret put ADMIN_SECRET` |
| Secret | `SESSION_SECRET` (1.2, Wave 2) | — | HMAC key for session tokens |

> The previously planned `RATE_LIMIT` KV namespace is **not** in `wrangler.toml`.
> Rate limiting is Durable-Object-only; if the binding is missing the
> `rateLimit` middleware fails open with a `rate_limit_disabled_binding_missing`
> log (P-19).

---

## Database Schema (8 tables, 10+ indexes)

### `links`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | 8-char Base62 NanoID or custom alias |
| original_url | TEXT NOT NULL | capped at `MAX_URL_LENGTH` (8 KB) |
| created_at | TEXT NOT NULL | ISO 8601 |
| expires_at | TEXT | NULL = never; compared via `datetime(expires_at) < datetime('now')` |
| disabled | INTEGER | 0/1 soft delete |
| password_hash | TEXT | PBKDF2-SHA-256 (100 000 iter, 16-byte salt, 32-byte key) |
| tag | TEXT | Campaign label |
| utm_source/medium/campaign | TEXT | Injected on redirect |
| webhook_url | TEXT | POST on each click (P-18: 5 000 ms timeout) |
| burn_on_read | INTEGER | 0/1 — self-destructs after first redirect |
| og_title/description/image | TEXT | Preview interstitial / OG meta |
| custom_domain | TEXT | Unique per-link host (e.g. `link.example.com`) |
| visits | INTEGER | O(1) per-link visit count, incremented in `recordAnalytics` |

### `analytics`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK (P-17) | 16-char hex from `newAnalyticsId()`. Enables GDPR-style `DELETE WHERE id = ?` |
| link_id | TEXT FK | → links(id) CASCADE |
| country | TEXT | cf-ipcountry header |
| referer | TEXT | **Hostname only** (S-20: no path/query/fragment) |
| user_agent | TEXT | Truncated 255 chars |
| timestamp | TEXT | ISO 8601 UTC; indexed for time-based queries |

**Indexes** (migrations 0004 / 0009 / 0010):
- `idx_analytics_link_timestamp` (link_id, timestamp) — sparkline + mood queries
- `idx_analytics_id` — GDPR-style lookup
- `idx_analytics_link_country` — getStats `GROUP BY country`
- `idx_analytics_link_referer` — getStats `GROUP BY referer`

### `link_variants`, `geo_redirects`, `counters`
Standard supporting tables (migrations 0002 / 0006 / 0008). `counters` is the
O(1) source of truth for global metrics (P-01 / P-11); `getGlobalStats` reads
`total_visits` from the counter and falls back to `COUNT(*)` if the row
doesn't exist.

---

## Auth Model (Post-Wave 1)

```
Client (Admin SPA)                                Worker
  │                                                 │
  ├── POST /api/auth/login { ADMIN_SECRET } ────▶  │
  │                                                 ├── verifyPassword() — PBKDF2
  │                                                 ├── timingSafeEqual against ADMIN_SECRET
  │                                                 ├── generateSessionToken(SESSION_SECRET)
  │                                                 │   payload = nonce.ts, hmac = HMAC-SHA256(payload)
  │                                                 └── Set-Cookie: admin_token=<token>;
  │                                                     HttpOnly; Secure; SameSite=Lax;
  │                                                     Max-Age=3600; Path=/
  │                                                 │
  │   Subsequent admin calls:                      │
  ├── Cookie: admin_token=<token> ──────────────▶  │
  │                                                 ├── verifySessionToken() — HMAC verify + age check
  │                                                 ├── requireAuthFromContext(c) — logs failure reason
  │                                                 └── Continue to handler
  │
  └── API client (curl, scripts):
      └── Authorization: Bearer <ADMIN_SECRET> ─▶  timingSafeEqual against ADMIN_SECRET
                                                     (no session cookie created; per-call check)
```

- **Session lifetime:** 1h fixed (`SESSION_MAX_AGE_SECONDS` in `src/lib/constants.ts`).
  The `login` handler re-issues the cookie on every successful login — an
  active admin has a sliding 1h session.
- **No secrets in the bundle:** `ADMIN_SECRET` and `SESSION_SECRET` live only
  in the Cloudflare secret store. The frontend never embeds them — the
  `login` flow exchanges a one-time secret for an HttpOnly cookie via `POST /api/auth/login`.
- **Failure signals:** 1.3 — every failed auth attempt logs
  `auth_failed` with a `reason` discriminator (`bearer_mismatch`,
  `session_expired`, `session_signature_mismatch`, `cookie_missing`,
  `no_credentials`, `admin_secret_unset`) plus `path`, `method`, `ip`.
  Feed this into Logpush to alert on brute force.

---

## Observability

- **Worker logs:** `wrangler tail` / Cloudflare Logpush — `logger.*` emits
  one JSON line per call.
- **`/health`:** 3.4 — synthetic monitor target. Returns 200 with per-component
  status, 503 on any failure. Not rate-limited, not authenticated.
- **Failed auth:** 1.3 — `auth_failed` event with reason + path + IP.
- **Rate-limit fail-open:** P-19 — `rate_limit_disabled_binding_missing` with
  `bucket`, `binding`, `path`, `method`, `action_required`. Filter on this
  in Logpush to know when the `RATE_LIMITER` binding is missing.
- **Webhook failures:** P-18 — `webhook_failed` log carries `timedOut` flag
  in addition to the existing `error` message.
- **Cloudflare analytics:** `wrangler.toml` sets `observability.enabled = true`.

---

## Audit Cadence

The repo runs a 3-pass audit cycle on the `ISSUESTOFIX.md` backlog:

1. **Open issues:** items discovered from a `git log` review, user reports,
   or runtime errors. Tracked with severity (HIGH / MEDIUM / LOW).
2. **First pass:** HIGH items closed in a dedicated PR per severity tier.
3. **Second / third pass:** MEDIUM and LOW items batched into a single
   Wave 1 / Wave 2 / Wave 3 implementation cycle.
4. **Post-audit plan:** `docs/PLAN_IMPROVEMENT.md` enumerates the next wave
   of improvements that are not bugs but better-best-practice upgrades.

As of 2026-06-18: **0 open, 64 resolved** across three audit cycles.

---

## Post-Audit State (replaces "Known Gaps")

All items previously listed in the "Known Gaps & Planned Work" table are
resolved. See `ISSUESTOFIX.md` for the audit trail and
`docs/PLAN_IMPROVEMENT.md` for the next wave.

| Originally flagged | Resolution | Where it landed |
|--------------------|------------|-----------------|
| Admin secret in JS bundle (S-03) | Cookie + `/api/auth/login` | `src/handlers/auth.ts` |
| `verifyPassword` timing attack (S-01) | `crypto.subtle.timingSafeEqual` on SHA-256 hashes | `src/lib/auth.ts` |
| No rate limit on admin auth (S-10) | `apiRateLimit` middleware on `/api/*` | `src/middleware/rateLimit.ts` |
| Custom ID validation mismatch (B-01) | `CUSTOM_ID_REGEX` shared between frontend and backend | `src/lib/constants.ts` |
| Sparkline division by zero (B-03) | Default to 0 on empty `analytics` rows | `src/handlers/stats.ts` |
| No pagination on `getLinks` (P-03) | Cursor-based pagination + sparkline in one query | `src/handlers/admin.ts` |
| No KV caching for hot redirects (P-10) | Cache API hook in `dispatchRedirect` + `purgeRedirectCache` | `src/lib/redirectUtils.ts` |
| `Admin.tsx` 1600-line monolith (F-01) | Component extraction + per-tab lazy imports | `frontend/src/pages/Admin.tsx` |

---

## See Also

- `AGENTS.MD` — current security model, project structure, run instructions
- `docs/spec/DATABASE.md` — full schema reference
- `docs/spec/API.md` — endpoint reference
- `docs/spec/TECH_STACK.md` — tech stack and rationale
- `ISSUESTOFIX.md` — resolved issue history (3 cycles, 64 items)
- `docs/PLAN_IMPROVEMENT.md` — next wave of improvements (Wave 1 / 2 / 3)
- `scripts/db-clone.sh` — copy production D1 → local for safe testing
