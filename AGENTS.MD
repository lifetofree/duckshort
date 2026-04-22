# DuckShort: Cyber-Duck URL Shortener

DuckShort is a high-performance, edge-native URL shortener with a "Synthwave Mallard" aesthetic. Built on Cloudflare's serverless ecosystem with a neon-futuristic UI.

## Mission
Provide lightning-fast redirects and secure link management with a visually striking, neon-futuristic user experience.

## Core Architecture
- **Backend:** Hono.js 4 on Cloudflare Workers (edge computing, sub-10ms cold starts)
- **Frontend:** React 18 SPA on Cloudflare Pages (served at `duckshort.pages.dev`, proxied via Worker at `duckshort.cc`)
- **Database:** Cloudflare D1 (distributed SQLite)
- **KV:** Cloudflare Workers KV (`RATE_LIMIT` namespace) — used by legacy rate limit path; superseded by Durable Object
- **Durable Objects:** `RateLimiter` DO for atomic per-IP rate limiting via `storage.transaction()`
- **ID Generation:** NanoID (8-character Base62, 62^8 = ~218 trillion combinations)
- **Cron:** Cloudflare Cron Trigger (`0 * * * *`) for scheduled expired-link cleanup

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono.js 4, Cloudflare Workers, TypeScript |
| Frontend | React 18, Vite 5, React Router v6, TailwindCSS v4 + @tailwindcss/vite |
| Animations | motion (Framer Motion v12) via `motion/react` |
| UI Extras | qrcode.react, lucide-react, DOMPurify |
| i18n | Custom `I18nProvider` / `useTranslation` hook (`frontend/src/lib/i18n.tsx`) + `frontend/src/locales/lang-en.json` |
| Database | Cloudflare D1 (SQLite) |
| Testing | Vitest — backend via `@cloudflare/vitest-pool-workers`, frontend via jsdom + @testing-library/react |
| Deployment | Cloudflare Workers (backend) + Cloudflare Pages (frontend) |
| CI/CD | GitHub Actions — three workflows (deploy-worker, deploy-frontend, deploy-all) |

## Branding & Theme: "The Neon Pond"

**Title:** DuckShort | The Neon Pond by Adduckivity

**Color Palette (CSS variables in `frontend/src/index.css`):**
- `--bg-primary: #0B0E14` — main background
- `--bg-secondary: #101520` — card background
- `--bg-tertiary: #141A24` — input background
- `--neon-cyan: #00F2FF` — primary accent
- `--neon-magenta: #FF0055` — action/button color
- `--neon-purple: #bf00ff` — secondary accent
- `--text-primary: #E8E8EC`
- `--text-secondary: #5A6070`

**Tailwind v4 theme tokens** (in `@theme` block): `--color-cyan-500`, `--color-magenta-500`, `--color-bg-primary`, etc.

**Typography:** Orbitron (headings, buttons) + JetBrains Mono (data, inputs, body) loaded via `<link>` in `index.html`

**Utility Classes:** `.neon-glow-cyan` / `.neon-glow-magenta` — text shadow utilities

**Asset:** `frontend/src/assets/logo.png` — duck mascot, displayed circular in the header

## Security Model
- **Bearer Token Auth:** All admin endpoints require `Authorization: Bearer <ADMIN_SECRET>`. Checked via `requireAuth()` in `src/lib/auth.ts`.
- **Timing-Safe Comparison:** `crypto.subtle.timingSafeEqual` (Web Crypto API) prevents timing-based secret inference.
- **Password Hashing:** Link passwords hashed with SHA-256 via Web Crypto (`hashPassword` / `verifyPassword`). bcrypt unavailable in Workers runtime.
- **Enumeration Prevention:** NanoID Base62 prevents sequential guessing.
- **Analytics Safety:** User-Agent and Referer headers truncated to 255 chars before storage.
- **Secrets Management:** `ADMIN_SECRET` stored as an encrypted Cloudflare secret (`wrangler secret put ADMIN_SECRET`), never in `wrangler.toml`.
- **Rate Limiting:** `src/middleware/rateLimit.ts` calls a `RateLimiter` Durable Object which uses `storage.transaction()` for atomic per-IP check-and-increment (20 req/hr cap). Gracefully skips if `RATE_LIMITER` binding is absent.

## Implemented Features

- [x] **Link Generation:** NanoID-based URL shortening, D1 storage
- [x] **Custom Pond Aliases:** Vanity URL support (e.g., `/my-alias`) with collision checking
- [x] **Redirection:** `/:id` with 302 redirect, 404/410 for missing/expired links
- [x] **Link Expiration:** `expires_at` column; expired links auto-disabled on redirect. All expiry comparisons use `datetime(expires_at) < datetime('now')` to normalize the ISO 8601 `T`-separator.
- [x] **Custom Expiration Input:** Expiry dropdown includes a "CUSTOM" option that reveals a numeric hours field in the UI.
- [x] **Burn-on-Read:** Self-destructing links that disable after the first successful redirect or password verification
- [x] **One-click Disable/Enable:** `PATCH /api/links/:id` with `action: "toggle"`
- [x] **Expiry Extension:** `PATCH /api/links/:id` with `action: "extend"` and `extendHours`
- [x] **Bulk Delete:** `POST /api/links/bulk-delete` with `{ ids: string[] }` — rate-limited
- [x] **Link Tags:** `tag` column for campaign grouping
- [x] **UTM Parameter Injection:** `utm_source/medium/campaign` appended on redirect (shared via `src/lib/utm.ts`)
- [x] **Webhook on Click:** `webhook_url`; async POST fired via `waitUntil` on each redirect
- [x] **A/B Link Rotation:** `link_variants` table with weighted random destination selection — applied in both `redirect.tsx` and `password.tsx`
- [x] **Password-Protected Links:** `password_hash` (SHA-256); redirects to `/password/:id` interstitial
- [x] **Click-through Preview:** `GET /preview/:id` branded interstitial before redirect
- [x] **OG Tag Customization:** `og_title`, `og_description`, `og_image` columns on `links`; injected into `<meta property="og:*">` tags on the preview page
- [x] **Stats API:** Per-link visits, top N countries, top N referrers (`GET /api/stats/:id?limit=N`, default 10, max 100)
- [x] **Global Quack Counter:** `GET /api/stats/global` — total visits, hourly visits, duck mood
- [x] **Duck Mood Indicator:** `DORMANT` / `ACTIVE` / `BUSY` / `VIRAL` based on hourly visit count; `ERROR` on fetch failure
- [x] **QR Code Modal:** `qrcode.react` renders QR for every created short URL + copy to clipboard
- [x] **View Stats Tab:** Interactive stats lookup in `Home.tsx` using `GET /api/stats/:id?limit=N` with configurable limit selector (5/10/25/50/100)
- [x] **Atomic Rate Limiting:** Per-IP throttle via `RateLimiter` Durable Object (`storage.transaction()`); applied to `POST /api/links` and `POST /api/links/bulk-delete`
- [x] **Scheduled Cleanup:** Cron Trigger executes `cleanupExpiredLinks` via `src/handlers/cleanup.ts`
- [x] **Timing-Safe Auth:** `requireAuth()` awaits `timingSafeEqual` properly
- [x] **Analytics Timestamp:** `analytics.timestamp` column with index for time-based queries
- [x] **Observability:** `wrangler.toml` sets `observability.enabled = true`
- [x] **Encrypted Secrets:** `ADMIN_SECRET` stored via `wrangler secret put`, not in repo
- [x] **Pages Deployment:** `_redirects` + `_headers` in `frontend/public/` for SPA routing and security headers
- [x] **CI/CD Pipelines:** GitHub Actions workflows for Worker and Pages deployment
- [x] **i18n System:** Custom `I18nProvider` + `useTranslation` hook with dot-notation key resolution and `{{param}}` interpolation; English locale at `frontend/src/locales/lang-en.json`
- [x] **Auto-Version Footer:** `__APP_VERSION__` injected at build time from `package.json` via Vite `define`
- [x] **Vitest — Backend:** Workers pool tests covering auth, nanoid, redirect, admin, stats, cleanup, burn-on-read, custom-id, variants, password, preview (75 tests total)
- [x] **Vitest — Frontend:** jsdom + @testing-library/react tests covering Home, DuckMoodLogo, Home-extended scenarios
- [x] **Visit Sparkline UI:** 7-day bar-chart sparkline rendered in `StatsView.tsx` for per-link stats; backend `GET /api/stats/:id` now returns `sparkline: number[]`
- [x] **Bulk Export CSV:** `GET /api/links/export` returns all links as a CSV download (ID, Original URL, Created, Expires, Status, Tag, Visits); "EXPORT CSV" button in Admin dashboard links tab
- [x] **Neon Heatmap:** Geographic heatmap visualization for country stats — `NeonHeatmap` component renders country blocks with neon glow intensity (cyan→magenta gradient) proportional to visit share; displayed above the countries list in `StatsView`
- [x] **Geo-Fencing Redirects:** `geo_redirects` table (migration `0006_geo_redirects.sql`); `GET/POST /api/links/:id/geo-redirects`, `DELETE /api/links/geo-redirects/:geoId`; `redirect.tsx` checks `cf-ipcountry` header after A/B selection and applies matching country rule; "GEO" button and panel added to Admin dashboard
- [x] **Custom Domains:** Per-link custom domain routing via `custom_domain` column. `PATCH /api/links/:id` accepts `action: "set_custom_domain"` with `custom_domain` string (or `null` to unset). `resolveCustomDomain` middleware intercepts non-primary hostnames, looks up the link by domain, and applies full redirect logic (A/B variants, geo-redirects, UTM, burn-on-read, webhooks, analytics).

## Not Yet Implemented

(none — all documented features are implemented)

## Running Locally

### Start Backend (API + redirects)
```bash
npm run dev
# Runs on http://localhost:8787
# Reads secrets from .dev.vars (not committed)
```

### Start Frontend (React SPA)
```bash
cd frontend && npm run dev
# Runs on http://localhost:3030
# Proxies /api/*, /preview/*, /password/* to http://localhost:8787
```

### Environment Files

**Backend** — `.dev.vars` (gitignored, at project root):
```
ADMIN_SECRET=dev-secret
BASE_URL=http://localhost:8787
```

**Frontend** — leave `VITE_API_URL` empty so requests go through the Vite proxy:
```
# frontend/.env.local  (gitignored via .env.*)
VITE_API_URL=
VITE_ADMIN_SECRET=dev-secret
```

### Running Tests
```bash
# Backend (Workers runtime via miniflare)
npm run test

# Frontend
cd frontend && npm run test
```

## Deployment

### Routing Architecture
- All traffic to `duckshort.cc` is intercepted by the **Worker Route** (`duckshort.cc/*` with `zone_name = "duckshort.cc"` in `wrangler.toml`).
- The Worker handles everything: API, redirects, password/preview interstitials, and the root SPA shell.
- `GET /` dynamically fetches and proxies `https://duckshort.pages.dev/` so the correct JS/CSS asset filenames are always served — no hardcoded hashes.
- Pages `_redirects` provides fallback routing if Pages is accessed directly.

### GitHub Actions Workflows
| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `deploy-all.yml` | Push to `main` | Deploys Worker then Pages (sequential) |
| `deploy-worker.yml` | `workflow_dispatch` | Worker only |
| `deploy-frontend.yml` | `workflow_dispatch` | Pages only |

### Required GitHub Secrets
| Secret | Value |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (Edit Workers + Pages permission) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `VITE_API_URL` | `https://duckshort.cc` |
| `VITE_ADMIN_SECRET` | Same value as `ADMIN_SECRET` Cloudflare secret |

### First-time Setup
```bash
# Set encrypted production secret (run once)
wrangler secret put ADMIN_SECRET

# Create KV namespace for rate limiting (run once, legacy fallback)
wrangler kv namespace create RATE_LIMIT
# Paste returned id into wrangler.toml [[kv_namespaces]]

# Apply D1 schema (run once, then CI handles it)
wrangler d1 migrations apply duckshort-db --remote
# Note: no --yes flag — removed in wrangler v4 (auto-confirms in CI)
```

### Manual Deploy (without CI)
```bash
# Backend
npx wrangler deploy

# Frontend
cd frontend && npm run build
cd .. && npx wrangler pages deploy frontend/dist --project-name duckshort
```

## Project Structure
```
DuckShort/
├── src/                              # Backend — Cloudflare Worker (Hono.js)
│   ├── index.tsx                     # Entry point — routes + scheduled export for cron + RateLimiter DO export
│   ├── types.ts                      # Env interface: DB, RATE_LIMIT, RATE_LIMITER, ADMIN_SECRET, BASE_URL
│   ├── handlers/
│   │   ├── admin.ts                  # getLinks, createLink (og_title/og_description/og_image), updateLink,
│   │   │                             #   deleteLink, bulkDeleteLinks, getVariants, createVariant, deleteVariant
│   │   ├── cleanup.ts                # cleanupExpiredLinks — DELETE expired rows (cron)
│   │   ├── password.tsx              # showPasswordEntry, verifyPasswordEntry (SSR + A/B + UTM + webhook)
│   │   ├── preview.tsx               # previewLink (click-through interstitial, SSR, OG tags)
│   │   ├── redirect.tsx              # redirectLink (302 + UTM + A/B + webhook + analytics)
│   │   └── stats.ts                  # getStats (?limit=N), getGlobalStats (totalVisits + mood)
│   ├── middleware/
│   │   └── rateLimit.ts              # Calls RateLimiter DO stub; graceful skip if binding absent
│   ├── durableObjects/
│   │   └── RateLimiter.ts            # Atomic per-IP rate limiter via storage.transaction()
│   ├── lib/
│   │   ├── auth.ts                   # timingSafeEqual, requireAuth, hashPassword, verifyPassword
│   │   ├── nanoid.ts                 # generateId — 8-char Base62 via nanoid
│   │   └── utm.ts                    # injectUtm() — shared UTM parameter injection
│   └── ui/                           # Hono/JSX SSR pages (interstitials only)
│       ├── Layout.tsx                # <head> with OG meta tags, fonts, neon CSS vars
│       ├── config.json
│       └── pages/
│           ├── PasswordEntry.tsx
│           ├── Preview.tsx           # Accepts ogTitle/ogDescription/ogImage props
│           └── NotFound.tsx
│
├── frontend/                         # Frontend — Cloudflare Pages (React 18 SPA)
│   ├── public/
│   │   ├── favicon.ico               # Duck favicon
│   │   ├── _redirects                # Proxy rules to Worker + SPA fallback
│   │   └── _headers                  # Security headers (/*) + Cache-Control (/assets/*)
│   ├── src/
│   │   ├── main.tsx                  # ReactDOM root + I18nProvider + BrowserRouter
│   │   ├── App.tsx                   # Router: / → Home, * → 404
│   │   ├── index.css                 # Tailwind v4 + neon CSS variables + utility classes
│   │   ├── vite-env.d.ts             # declare const __APP_VERSION__: string
│   │   ├── types.ts                  # StatsData interface (shared by Home + StatsView)
│   │   ├── lib/
│   │   │   └── i18n.tsx              # I18nProvider + useTranslation hook (dot-notation, {{param}} interpolation)
│   │   ├── locales/
│   │   │   └── lang-en.json          # English translation strings (footer: "V{{version}}")
│   │   ├── pages/
│   │   │   ├── Home.tsx              # ~170 lines — delegates to sub-components
│   │   │   └── Admin.tsx             # Coming soon placeholder
│   │   ├── components/
│   │   │   ├── DuckMoodLogo.tsx      # Animated mood-aware logo (DORMANT/ACTIVE/BUSY/VIRAL/ERROR)
│   │   │   ├── DevModeBar.tsx        # Fixed dev banner — returns null in production
│   │   │   ├── QuackCounter.tsx      # Quack count display with milestone detection
│   │   │   ├── ShortenForm.tsx       # URL input, custom alias, expiry dropdown + custom hours, burn-on-read
│   │   │   ├── StatsView.tsx         # Stats form + country/referrer tables
│   │   │   └── ResultModal.tsx       # Short URL display, QR code, copy button
│   │   ├── assets/
│   │   │   └── logo.png              # Duck mascot image
│   │   └── __tests__/
│   │       ├── App.test.tsx
│   │       ├── Home.test.tsx
│   │       ├── Home-extended.test.tsx
│   │       └── DuckMoodLogo.test.tsx
│   ├── index.html                    # Loads Orbitron + JetBrains Mono via Google Fonts
│   ├── vite.config.ts                # define: __APP_VERSION__, proxy, stable filenames
│   └── package.json
│
├── migrations/
│   ├── 0001_initial.sql              # links + analytics tables
│   ├── 0002_feature_columns.sql      # password_hash, tag, utm_*, webhook_url,
│   │                                 #   analytics.timestamp, link_variants table
│   ├── 0003_vanity_and_burn.sql      # burn_on_read column
│   ├── 0004_performance_indexes.sql  # indexes on links(created_at, disabled), links(tag),
│   │                                 #   analytics(link_id, timestamp)
│   ├── 0005_og_tags.sql             # og_title, og_description, og_image columns
│   ├── 0006_geo_redirects.sql      # geo_redirects table for country-based redirects
│   └── 0007_custom_domain.sql      # custom_domain column on links
│
├── test/                             # Backend Vitest tests (Workers pool)
│   ├── handlers/
│   │   ├── admin.test.ts
│   │   ├── redirect.test.ts
│   │   ├── stats.test.ts             # Includes regression tests for password_hash/webhook_url exclusion
│   │   ├── cleanup.test.ts
│   │   ├── burn-on-read.test.ts
│   │   ├── custom-id.test.ts
│   │   ├── variants.test.ts
│   │   ├── password.test.ts          # 6 tests: 404, disabled, expired, form, wrong pw, correct pw
│   │   └── preview.test.ts           # 5 tests: 404, disabled, expired, destination, OG tags
│   └── lib/
│       ├── auth.test.ts
│       └── nanoid.test.ts
│
├── .github/workflows/
│   ├── deploy-all.yml                # push to main: worker then pages (sequential)
│   ├── deploy-worker.yml             # workflow_dispatch: typecheck → test → migrate → deploy
│   └── deploy-frontend.yml           # workflow_dispatch: typecheck → build → pages deploy
│
├── scripts/                          # DB backup/restore helpers
│   ├── db-backup.sh
│   ├── db-compare.sh
│   └── db-restore.sh
│
├── .dev.vars                         # Local secrets — gitignored
├── package.json                      # Backend deps + scripts (wrangler ^4, hono ^4, nanoid ^5)
├── tsconfig.json                     # Backend TS config
├── vitest.config.ts                  # @cloudflare/vitest-pool-workers config
├── wrangler.toml                     # Worker config: name, D1, KV, DO binding + migration, observability
├── AGENTS.MD                         # This file
├── BACKLOGS.md                       # Active feature gaps and improvements
├── CHANGELOG.md                      # Version history
├── HISTORY.md                        # Archived resolved tasks
└── ISSUETOFIX.md                     # Open bugs (currently empty)
```

## Database Schema

### `links`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | 8-char Base62 NanoID or custom alias |
| original_url | TEXT NOT NULL | |
| created_at | TEXT NOT NULL | ISO 8601 |
| expires_at | TEXT | NULL = never; compared via `datetime(expires_at)` |
| disabled | INTEGER | 0/1 soft delete |
| password_hash | TEXT | SHA-256 hex |
| tag | TEXT | Campaign label |
| utm_source | TEXT | |
| utm_medium | TEXT | |
| utm_campaign | TEXT | |
| webhook_url | TEXT | POST on each click |
| burn_on_read | INTEGER | 0/1 — self-destructs after first redirect |
| og_title | TEXT | Custom OG / page title for preview interstitial |
| og_description | TEXT | Custom OG description |
| og_image | TEXT | Custom OG image URL |
| custom_domain | TEXT | Unique custom domain binding (e.g. `link.example.com`); resolved by `resolveCustomDomain` middleware |

### `analytics`
| Column | Type | Notes |
|--------|------|-------|
| link_id | TEXT FK | → links(id) CASCADE |
| country | TEXT | cf-ipcountry header |
| referer | TEXT | Truncated 255 chars |
| user_agent | TEXT | Truncated 255 chars |
| timestamp | TEXT | datetime('now'), indexed |

### `link_variants`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | 8-char Base62 |
| link_id | TEXT FK | → links(id) CASCADE |
| destination_url | TEXT NOT NULL | |
| weight | INTEGER | Default 1 |

### `geo_redirects`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | 8-char Base62 |
| link_id | TEXT FK | → links(id) CASCADE |
| country_code | TEXT | 2-letter ISO code (e.g. US, TH) |
| destination_url | TEXT NOT NULL | Redirect target for this country |

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/global` | — | Total visits, hourly count, duck mood |
| GET | `/api/stats/:id?limit=N` | — | Per-link stats (visits, top N countries/referrers; default 10, max 100) |
| GET | `/api/links` | Bearer | All links with 7-day sparkline |
| POST | `/api/links` | Bearer | Create short link (accepts `og_title`, `og_description`, `og_image`) |
| POST | `/api/links/bulk-delete` | Bearer | Delete multiple links (rate-limited) |
| PATCH | `/api/links/:id` | Bearer | Toggle disable, extend expiry, or set custom domain (`action: "toggle" | "extend" | "set_custom_domain"`) |
| DELETE | `/api/links/:id` | Bearer | Delete link |
| GET | `/api/links/:id/variants` | Bearer | List A/B variants |
| POST | `/api/links/:id/variants` | Bearer | Add A/B variant |
| DELETE | `/api/links/variants/:id` | Bearer | Delete variant |
| GET | `/api/links/export` | Bearer | Export all links as CSV (ID, Original URL, Created, Expires, Status, Tag, Visits) |
| GET | `/api/links/:id/geo-redirects` | Bearer | List geo-redirect rules for a link |
| POST | `/api/links/:id/geo-redirects` | Bearer | Add geo-redirect rule (`country_code`, `destination_url`) |
| DELETE | `/api/links/geo-redirects/:geoId` | Bearer | Delete geo-redirect rule |
| GET | `/preview/:id` | — | Click-through preview interstitial (with OG meta tags) |
| GET | `/password/:id` | — | Password entry form |
| POST | `/password/:id` | — | Verify password + redirect (A/B + UTM + webhook) |
| GET | `/:id` | — | Main redirect (302) |
