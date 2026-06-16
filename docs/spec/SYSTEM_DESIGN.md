# System Design

**DuckShort** — URL shortener on Cloudflare Workers + D1 + Pages  
**Stage:** Production v1  
**As of:** 2026-05-15

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
                         │                                      │
                         │  Route handlers:                     │
                         │  • /api/*   → admin handlers         │
                         │  • /:id     → redirectLink           │
                         │  • /preview/:id → previewLink        │
                         │  • /password/:id → SSR password form │
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
              │  link_variants│  │  sliding   │  │  /admin          │
              │  geo_redirects│  │  counter   │  │  /assets/*       │
              └───────────────┘  └────────────┘  └───────────────────┘
```

---

## Request Flow: Short Link Redirect (`GET /:id`)

```
Request: GET /abc123
         │
         ├── resolveCustomDomain() middleware
         │   └── Host == duckshort.cc → skip (primary host), pass through
         │
         ├── redirectLink handler
         │   ├── DB: SELECT link row WHERE id = 'abc123'
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
         │       ├── INSERT INTO analytics (link_id, country, referer, ua, timestamp)
         │       └── POST webhook_url if set (fire-and-forget, errors ignored)
```

---

## Request Flow: Custom Domain

```
Request: GET / (Host: go.example.com)
         │
         ├── resolveCustomDomain() middleware fires
         │   ├── Host != duckshort.cc → proceed with custom domain lookup
         │   ├── DB: SELECT link WHERE custom_domain = 'go.example.com'
         │   ├── Link found → run same redirect logic as /:id handler
         │   │   (disable check, expiry check, burn-on-read, password, resolveDestination, analytics)
         │   └── Link not found → pass through to normal route matching
```

---

## Request Flow: Admin API

```
Request: POST /api/links
         │
         ├── rateLimit middleware
         │   ├── Extract IP from CF-Connecting-IP header
         │   ├── Get Durable Object stub for this IP
         │   ├── DO.fetch('https://internal/check')
         │   │   └── Atomic transaction: increment counter, check limit
         │   └── Allowed → set X-RateLimit-* headers, continue
         │       Blocked → 429 with Retry-After
         │
         └── createLink handler
             ├── requireAuth(env, Authorization header, cookie)
             │   ├── Bearer token → timingSafeEqual(token, ADMIN_SECRET)
             │   └── Cookie admin_token → same check
             ├── Validate body fields
             ├── DB: INSERT INTO links
             ├── DB (batch): INSERT INTO link_variants (if provided)
             └── Response: { id, shortUrl }
```

---

## Component Hierarchy

### Worker (`src/`)

```
src/
├── index.tsx               — Hono app, route wiring, cron export
├── types.ts                — Env interface, RedirectLinkRow interface
├── handlers/
│   ├── admin.ts            — getLinks, createLink, updateLink, deleteLink,
│   │                         bulkDeleteLinks, getVariants, createVariant,
│   │                         deleteVariant, exportLinks,
│   │                         getGeoRedirects, createGeoRedirect, deleteGeoRedirect
│   ├── redirect.tsx        — redirectLink (short link dispatch)
│   ├── stats.ts            — getStats, getGlobalStats
│   ├── password.tsx        — showPasswordEntry, verifyPasswordEntry
│   ├── preview.tsx         — previewLink
│   └── cleanup.ts          — cleanupExpiredLinks (cron)
├── middleware/
│   ├── rateLimit.ts        — Durable Object rate limiter middleware
│   └── customDomain.ts     — Custom domain resolution middleware
├── lib/
│   ├── auth.ts             — requireAuth, hashPassword, verifyPassword, timingSafeEqual
│   ├── nanoid.ts           — generateId() → 6-char URL-safe ID
│   ├── constants.ts        — RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS
│   ├── redirectUtils.ts    — resolveDestination, recordAnalytics, handleBurnOnRead,
│   │                         isSafeUrl, isSafeWebhookUrl
│   ├── utm.ts              — injectUtm()
│   └── variants.ts         — pickVariant(), VariantRow interface
├── durableObjects/
│   └── RateLimiter.ts      — Sliding-window counter via DO storage transactions
└── ui/
    ├── Layout.tsx           — Base HTML shell for SSR pages
    └── pages/
        ├── NotFound.tsx     — 404 / 410 SSR page
        ├── PasswordEntry.tsx — Password form SSR page
        └── Preview.tsx      — Link preview SSR page
```

### Frontend SPA (`frontend/src/`)

```
frontend/src/
├── main.tsx                — App entry, React root, ErrorBoundary wrap
├── App.tsx                 — Router: / → Home, /admin → Admin
├── pages/
│   ├── Home.tsx            — Public UI: shorten form + global stats + link stats
│   └── Admin.tsx           — Admin dashboard (monolith, 1600+ lines — F-01)
├── components/
│   ├── ShortenForm.tsx     — URL input, options, submit
│   ├── ResultModal.tsx     — Success modal with short URL + QR code
│   ├── StatsView.tsx       — Per-link stats: visits, countries, referrers, sparkline
│   ├── NeonHeatmap.tsx     — Country visit heatmap visualization
│   ├── QuackCounter.tsx    — Animated global visit counter
│   ├── DuckMoodLogo.tsx    — Duck logo that changes mood (DORMANT/ACTIVE/BUSY/VIRAL)
│   ├── DevModeBar.tsx      — Dev environment indicator bar
│   └── ErrorBoundary.tsx   — React error boundary for crash isolation
├── lib/
│   ├── constants.ts        — API_BASE_URL and shared constants
│   ├── i18n.tsx            — I18nProvider + useTranslation hook
│   └── utils.ts            — Shared utilities
├── locales/
│   └── lang-en.json        — English translation strings
└── types.ts                — Shared TypeScript interfaces
```

---

## Cloudflare Infrastructure

| Resource | Name / ID | Binding |
|----------|-----------|---------|
| Worker | `duckshort` | — |
| D1 Database | `duckshort-db` / `cbb432e6-...` | `DB` |
| Durable Object | `RateLimiter` class | `RATE_LIMITER` |
| KV Namespace | `8bb561a78e63471ba5d89daa37ba8fb5` | `RATE_LIMIT` (unused) |
| Pages project | `duckshort` | — |
| Custom domain | `duckshort.cc` | Route: `duckshort.cc/*` |

---

## Frontend → Worker Proxy

The Worker serves as a unified entry point for both the API and the frontend SPA.

| URL pattern | How served |
|-------------|------------|
| `GET /` | Worker fetches `https://duckshort.pages.dev/` and streams response |
| `GET /admin` | Worker fetches `https://duckshort.pages.dev/admin/` |
| `GET /assets/*` or any other path | Catch-all fetches from `https://duckshort.pages.dev{path}` |
| HTML responses | `Cache-Control: public, max-age=0, must-revalidate` |
| Non-HTML (JS/CSS/images) | Pass-through `Cache-Control` from Pages (content-addressed, long-lived) |

This architecture means a single domain (`duckshort.cc`) serves all traffic. Pages is a private CDN backing store, not directly user-facing.

---

## Auth Model (Current State)

```
Client (Admin SPA)
  │
  ├── Login: reads VITE_ADMIN_SECRET from Vite env (build-time embed)  [S-03]
  ├── Stores: admin_token cookie in browser after login
  │
  └── API calls: sends cookie OR Authorization: Bearer header
                         │
              Worker requireAuth()
                ├── Checks Bearer token via timingSafeEqual(token, ADMIN_SECRET)
                └── Checks admin_token cookie via timingSafeEqual(token, ADMIN_SECRET)
```

> **Known security gap (S-03, S-04, S-05):** The admin secret is embedded in the frontend bundle. See `ISSUESTOFIX.md` for mitigation plan.

---

## Known Gaps & Planned Work

| Category | Item | Reference |
|----------|------|-----------|
| Bug | Custom ID validation mismatch (frontend 3-50, backend 3-20) | B-01 |
| Bug | Sparkline division by zero | B-03 |
| Security | Admin secret in JS bundle | S-03 |
| Security | `verifyPassword` timing attack | S-01 |
| Security | No rate limit on admin auth endpoints | S-10 |
| Performance | No pagination on `getLinks` | P-03 |
| Performance | No KV caching for hot redirect paths | P-10 |
| Refactor | `Admin.tsx` 1600-line monolith | F-01 |
| Feature | Additional locales (Thai etc.) | BACKLOGS |
| Feature | Admin search/filter | BACKLOGS |

Full issue list: `ISSUESTOFIX.md`  
Full backlog: `BACKLOGS.md`
