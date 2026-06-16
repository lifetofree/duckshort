# Tech Stack

**As of:** 2026-05-15  
**Stage:** Production (v1)

---

## Runtime & Deployment

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Worker runtime | Cloudflare Workers | — | Entry: `src/index.tsx` |
| Worker framework | Hono | ^4.0.0 | JSX-capable, edge-native |
| Worker bundler/CLI | Wrangler | ^4.83.0 | Deploy + local dev |
| Frontend SPA | React | ^18.3.1 | `frontend/` directory |
| Frontend bundler | Vite | ^5.4.21 | Via `@vitejs/plugin-react` |
| Frontend hosting | Cloudflare Pages | — | `duckshort.pages.dev` |
| Custom domain | Cloudflare Route | — | `duckshort.cc/*` → Worker |
| Compatibility | `nodejs_compat` flag | 2025-04-15 | Required for `crypto.subtle` |

---

## Backend Dependencies

| Package | Role |
|---------|------|
| `hono` | HTTP router, middleware, JSX SSR |
| `nanoid` | 6-char URL-safe ID generation |

### Cloudflare Bindings

| Binding | Type | Purpose |
|---------|------|---------|
| `DB` | D1 SQLite | Primary data store |
| `RATE_LIMITER` | Durable Object | Per-IP rate limiting (transactional counter) |
| `RATE_LIMIT` | KV Namespace | Bound but unused — legacy, left for future use |

### Secrets

| Name | How to set |
|------|-----------|
| `ADMIN_SECRET` | `wrangler secret put ADMIN_SECRET` |
| `BASE_URL` | `wrangler.toml [vars]` (non-sensitive default: `https://duckshort.cc`) |

---

## Frontend Dependencies

| Package | Version | Role |
|---------|---------|------|
| `react` + `react-dom` | ^18.3.1 | UI framework |
| `react-router-dom` | ^6.30.3 | Client-side routing |
| `tailwindcss` | ^4.2.2 | Utility-first styling |
| `@tailwindcss/vite` | ^4.2.2 | Tailwind v4 Vite integration (no PostCSS needed) |
| `qrcode.react` | ^3.2.0 | QR code rendering |
| `motion` | ^12.38.0 | Animation (replaces `framer-motion`) |
| `autoprefixer` | ^10.5.0 | Listed but unused with Tailwind v4 — candidate for removal |
| `dompurify` | ^3.4.0 | Listed but not imported — candidate for removal |
| `lucide-react` | ^0.577.0 | Listed but not imported — candidate for removal |

### Dev / Test

| Package | Role |
|---------|------|
| `vitest` | Test runner (both Worker + frontend) |
| `@testing-library/react` | Component testing |
| `@cloudflare/vitest-pool-workers` | Worker integration test pool |

---

## Language & Coding Standards

- **TypeScript** throughout — both Worker (`tsconfig.json`) and frontend (`frontend/tsconfig.json`)
- **Strict mode** enabled
- **JSX runtime**: Hono JSX for SSR (`/** @jsxImportSource hono/jsx */`); React JSX for frontend
- **Module system**: ESM (`"type": "module"`)
- **ID generation**: `nanoid` producing 6-char alphanumeric IDs (URL-safe charset)
- **Custom alias format**: `^[a-zA-Z0-9_-]{3,20}$` — enforced by backend (source of truth)
- **Password hashing**: SHA-256 via `crypto.subtle.digest` (no bcrypt; Workers has no native bcrypt)
- **Auth comparison**: Timing-safe via double-SHA-256 before `timingSafeEqual`
- **URL validation**: `new URL()` parse + protocol whitelist (`http:` / `https:` only)
- **Webhook validation**: HTTPS-only + private IP blocklist (127.x, 192.168.x, 10.x, 172.16-31.x)

---

## Scheduled Jobs

| Cron | Handler | Purpose |
|------|---------|---------|
| `0 * * * *` (hourly) | `cleanupExpiredLinks` | Sets `disabled = 1` on all links where `expires_at < now` |

---

## CORS Policy

Allowed origins (exact):
- `https://duckshort.cc`
- `https://duckshort.pages.dev`
- `http://localhost:3030`
- `http://localhost:8787`

Allowed methods: `GET POST PATCH DELETE OPTIONS`  
Allowed headers: `Content-Type Authorization`  
Credentials: `true`

---

## Rate Limiting

- **Mechanism**: Cloudflare Durable Object (`RateLimiter` class)
- **Scope**: Per IP address (from `CF-Connecting-IP` → `X-Forwarded-For` fallback)
- **Limit**: 20 requests per hour
- **Applied to**: `POST /api/links`, `POST /api/links/bulk-delete`
- **Response headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`
- **Constants** (`src/lib/constants.ts`):
  - `RATE_LIMIT_MAX_REQUESTS = 20`
  - `RATE_LIMIT_WINDOW_MS = 3_600_000` (1 hour)

---

## Local Development

```bash
# Worker (port 8787)
npm run dev                    # wrangler dev

# Frontend SPA (port 3030)
cd frontend && npm run dev     # vite

# Tests
npm test                       # Worker tests (vitest-pool-workers)
cd frontend && npm test        # Frontend component tests
```

---

## Known Tech-Debt Items

| ID | Description |
|----|-------------|
| R-08 | `RATE_LIMIT` KV binding is unused — remove or document |
| R-09 | `dompurify`, `lucide-react`, `autoprefixer`, `postcss` unused in frontend |
| F-08 | CSS variable mismatch between Worker SSR (`Layout.tsx`) and frontend (`index.css`) |
