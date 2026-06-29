# Tech Stack

**As of:** 2026-06-26  
**Stage:** Production (v1.9.3)  
**See also:** `AGENTS.md` (the canonical project-level tech summary), `docs/SPEC_INDEX.md` for navigation

---

## Runtime & Deployment

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Worker runtime | Cloudflare Workers | — | Entry: `src/index.tsx` |
| Worker framework | Hono | ^4.0.0 (resolved to 4.12.27) | JSX-capable, edge-native |
| Worker bundler/CLI | Wrangler | ^4.83.0 | Deploy + local dev |
| Frontend SPA | React | ^18.3.1 | `frontend/` directory |
| Frontend bundler | Vite | ^5.4.21 | Via `@vitejs/plugin-react` |
| Frontend hosting | Workers Static Assets | — | Bound as `ASSETS`; `not_found_handling = "single-page-application"` |
| Custom domain | Cloudflare Route | — | `duckshort.cc/*` → Worker |
| Compatibility | `nodejs_compat` flag | 2025-04-15 | Required for `crypto.subtle` |

---

## Backend Dependencies

| Package | Role |
|---------|------|
| `hono` | HTTP router, middleware, JSX SSR |
| `nanoid` | 8-char Base62 URL-safe ID generation |

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 SQLite | Primary data store |
| `RATE_LIMITER` | Durable Object | Per-IP rate limiting (transactional counter, two pools: `api:<ip>` 20/hr and `redirect:<ip>` 200/hr) |
| `ASSETS` | Workers Static Assets | Serves `frontend/dist` for `/`, `/admin`, and the SPA fallback |

### Secrets

| Name | How set | Purpose |
|------|---------|---------|
| `ADMIN_SECRET` | `wrangler secret put ADMIN_SECRET` | Bearer auth on `/api/*`; PBKDF2 fallback for cookie sessions |
| `SESSION_SECRET` | `wrangler secret put SESSION_SECRET` | HMAC key for session cookie signing (separate from `ADMIN_SECRET`) |
| `BASE_URL` | `wrangler.toml [vars]` | Non-sensitive default: `https://duckshort.cc` |

---

## Frontend Dependencies

| Package | Version | Role |
|---------|---------|------|
| `react` + `react-dom` | ^18.3.1 | UI framework |
| `react-router-dom` | ^6.30.3 | Client-side routing |
| `tailwindcss` | ^4.2.2 | Utility-first styling |
| `@tailwindcss/vite` | ^4.3.1 | Tailwind v4 Vite integration (no PostCSS needed) |
| `qrcode.react` | ^3.2.0 | QR code rendering |
| `motion` | ^12.41.0 | Animation (via `motion/react`) |
| `@tanstack/react-query` | ^5.101.1 | Server state (QueryClientProvider in `main.tsx`) |
| `@sentry/react` | ^8.55.2 | Frontend error reporting (opt-in via `VITE_SENTRY_DSN`) |

### Dev / Test

| Package | Version | Role |
|---------|---------|------|
| `vitest` (backend) | ^4.1.9 | Backend test runner — Workers pool |
| `vitest` (frontend) | ^2.0.0 | Frontend test runner — jsdom. Major mismatch with backend; tracked in BACKLOGS.md |
| `@cloudflare/vitest-pool-workers` | ^0.16.20 | Worker integration test pool |
| `@testing-library/react` | ^16.0.0 | Component testing |
| `fast-check` | ^3.23.2 | Property-based testing (`pickVariant` distribution) |

---

## Language & Coding Standards

- **TypeScript** throughout — both Worker (`tsconfig.json`) and frontend (`frontend/tsconfig.json`)
- **Strict mode** enabled
- **JSX runtime**: Hono JSX for SSR (`/** @jsxImportSource hono/jsx */`); React JSX for frontend
- **Module system**: ESM (`"type": "module"`)
- **ID generation**: `nanoid` producing 8-char Base62 IDs (URL-safe charset, 62^8 ~ 218 trillion combinations)
- **Custom alias format**: `^[a-zA-Z0-9_-]{3,20}$` — enforced by both frontend and backend
- **Password hashing**: PBKDF2-SHA-256 (100 000 iterations, 32-byte key, random per-link salt) via Web Crypto
- **Auth comparison**: Timing-safe via double-SHA-256 before `crypto.subtle.timingSafeEqual`
- **URL validation**: `new URL()` parse + protocol whitelist (`http:` / `https:` only)
- **Webhook validation**: HTTPS-only + private IP blocklist (127.x, 192.168.x, 10.x, 172.16-31.x, IPv6 ULA, `::ffff:`)

---

## Scheduled Jobs

| Cron | Handler | Purpose |
|------|---------|---------|
| `0 * * * *` (hourly) | `cleanupExpiredLinks` | DELETEs all links where `datetime(expires_at) < datetime('now')` |
| `0 * * * *` (hourly) | `aggregateLinkStatsDaily` | Pre-aggregates per-link daily visit counts into `link_stats_daily` (last 7 days) |
| `0 * * * *` (hourly) | `selfHealTotalVisitsCounter` | Reconciles `counters.total_visits` against the true `analytics` row count |

---

## Security Headers (S-19)

Applied globally via post-handler middleware in `src/index.tsx`. Skips-if-already-set so the Pages `app.get('/')` / catch-all proxy can override.

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'` |

---

## CORS Policy

Explicit allowlist (`src/index.tsx`):

- `https://duckshort.cc`
- `https://duckshort.pages.dev`
- `http://localhost:3030`
- `http://localhost:8787`

Allowed methods: `GET POST PATCH DELETE OPTIONS`  
Allowed headers: `Content-Type Authorization X-XSRF-TOKEN`  
Credentials: `true`

---

## Rate Limiting

- **Mechanism**: Cloudflare Durable Object (`RateLimiter` class) via `storage.transaction()`
- **Scope**: Per IP address (from `CF-Connecting-IP` → `X-Forwarded-For` fallback)
- **Two isolated pools** (P-16):

| Pool | DO ID key | Limit | Applied to |
|------|-----------|-------|------------|
| API | `api:<ip>` | 20 req/hr | `POST /api/links`, `POST /api/links/bulk-delete`, `POST /password/:id` |
| Redirect | `redirect:<ip>` | 200 req/hr | `GET /:id` |

- **Fail-open**: If `RATE_LIMITER` binding is missing, emits a `rate_limit_disabled_binding_missing` warning log and allows all requests.
- **Response headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- **Constants** (`src/lib/constants.ts`):
  - `RATE_LIMIT_MAX_REQUESTS = 20`
  - `RATE_LIMIT_REDIRECT_MAX_REQUESTS = 200`
  - `RATE_LIMIT_WINDOW_MS = 3_600_000` (1 hour)

---

## Session Model

- **Bearer Token**: `Authorization: Bearer <ADMIN_SECRET>` for API clients.
- **HMAC-Signed Cookie**: After login, an `HttpOnly; SameSite=Lax; Secure` cookie (`admin_token`) is set. Value is `HMAC-SHA256(SESSION_SECRET, payload)` plus the payload (`<issuedAt>.<expiresAt>.<csrf>`).
- **Session Lifetime**: 1 hour fixed (`SESSION_MAX_AGE_SECONDS`). Re-issued on each successful login (sliding window).
- **CSRF Protection**: Double-submit token. `XSRF-TOKEN` non-HttpOnly cookie + `X-XSRF-TOKEN` header echo, constant-time compared. Only enforced for cookie-based auth (Bearer has no CSRF attack surface).

---

## Local Development

```bash
# Worker (port 8787)
npm run dev                    # wrangler dev

# Frontend SPA (port 3030)
cd frontend && npm run dev     # vite

# Tests
npm test                       # Worker tests (vitest-pool-workers, vitest 4)
cd frontend && npm test        # Frontend component tests (vitest 2)

# Coverage
npm run test:coverage          # Worker coverage (istanbul)
```

---

## Frontend Serving Architecture

v1.9.3 switched from Cloudflare Pages to **Workers Static Assets** (single deploy unit):

```
wrangler.toml
  [assets]
  directory = "./frontend/dist"
  binding = "ASSETS"
  not_found_handling = "single-page-application"
```

`src/index.tsx` then:

```ts
app.get('/', (c) => c.env.ASSETS.fetch(c.req.raw))
app.get('/admin', (c) => c.env.ASSETS.fetch(c.req.raw))
// ... /preview/:id, /password/:id, /:id, /health, etc.
// Catch-all (must be last):
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw))
```

CSP from Workers Static Assets is forwarded through unchanged (the Worker's S-19 middleware skips if `Content-Security-Policy` is already set). This means SPA-served routes get the production CSP from `_headers` while SSR/API routes get the Worker default.

---

## Staging Environment

`wrangler.toml` `[env.staging]` block: separate D1 DB + Worker deployment, no route bound. Triggered via `wrangler deploy --env staging` or `.github/workflows/deploy-staging.yml` on PR open against `develop`. See `docs/OPERATIONS.md §staging`.

---

## Known Tech-Debt Items

| ID | Description |
|----|-------------|
| BACKLOGS | vitest major mismatch between workspaces (backend 4, frontend 2) |
| BACKLOGS | CORS allowlist is hardcoded — consider dynamic config |
| BACKLOGS | `npm audit` clean (0 vulnerabilities) — keep Dependabot weekly scans enabled |
