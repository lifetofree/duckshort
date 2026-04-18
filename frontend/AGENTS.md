# DuckShort: Cyber-Duck URL Shortener

DuckShort is a high-performance, edge-native URL shortener with a "Synthwave Mallard" aesthetic. Built on Cloudflare's serverless ecosystem with a neon-futuristic UI.

## Mission
Provide lightning-fast redirects and secure link management with a visually striking, neon-futuristic user experience.

## Core Architecture
- **Backend:** Hono.js 4 on Cloudflare Workers (edge computing, sub-10ms cold starts)
- **Frontend:** React 18 SPA on Cloudflare Pages (served at `duckshort.pages.dev`, proxied via Worker at `duckshort.cc`)
- **Database:** Cloudflare D1 (distributed SQLite)
- **KV:** Cloudflare Workers KV (`RATE_LIMIT` namespace) for per-IP rate limiting
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
| State Management | @tanstack/react-query (QueryClientProvider wired in `main.tsx`) |
| Database | Cloudflare D1 (SQLite) |
| Testing | Vitest — backend via `@cloudflare/vitest-pool-workers`, frontend via jsdom + @testing-library/react |
| Deployment | Cloudflare Workers (backend) + Cloudflare Pages (frontend) |
| CI/CD | GitHub Actions — three workflows (deploy-worker, deploy-frontend, deploy-all) |

**Unused packages (installed, not wired up):** recharts, react-i18next, i18next, react-markdown, react-quill

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
- **Rate Limiting:** `src/middleware/rateLimit.ts` — 20 requests/hour per IP, stored in KV with 1-hour TTL. Returns 429 on breach. Skips gracefully if `RATE_LIMIT` binding is missing.

## Implemented Features

- [x] **Link Generation:** NanoID-based URL shortening, D1 storage
- [x] **Custom Pond Aliases:** Vanity URL support (e.g., `/my-alias`) with collision checking
- [x] **Redirection:** `/:id` with 302 redirect, 404/410 for missing/expired links
- [x] **Link Expiration:** `expires_at` column; expired links auto-disabled on redirect
- [x] **Burn-on-Read:** Self-destructing links that disable after the first successful redirect
- [x] **One-click Disable/Enable:** `PATCH /api/links/:id` with `action: "toggle"`
- [x] **Expiry Extension:** `PATCH /api/links/:id` with `action: "extend"` and `extendHours`
- [x] **Bulk Delete:** `POST /api/links/bulk-delete` with `{ ids: string[] }`
- [x] **Link Tags:** `tag` column for campaign grouping
- [x] **UTM Parameter Injection:** `utm_source/medium/campaign` appended on redirect
- [x] **Webhook on Click:** `webhook_url`; async POST fired via `waitUntil` on each redirect
- [x] **A/B Link Rotation:** `link_variants` table with weighted random destination selection
- [x] **Password-Protected Links:** `password_hash` (SHA-256); redirects to `/password/:id` interstitial
- [x] **Click-through Preview:** `GET /preview/:id` branded interstitial before redirect
- [x] **Stats API:** Per-link visits, top 10 countries, top 10 referrers (`GET /api/stats/:id`)
- [x] **Global Quack Counter:** `GET /api/stats/global` — total visits, hourly visits, duck mood
- [x] **Duck Mood Indicator:** `DORMANT` / `ACTIVE` / `BUSY` / `VIRAL` based on hourly visit count; `DEGRADED` on fetch error
- [x] **QR Code Modal:** `qrcode.react` renders QR for every created short URL + copy to clipboard
- [x] **View Stats Tab:** Interactive stats lookup in `Home.tsx` using `GET /api/stats/:id`
- [x] **Rate Limiting:** Per-IP throttle on link creation via `src/middleware/rateLimit.ts`
- [x] **Scheduled Cleanup:** Cron Trigger executes `cleanupExpiredLinks` via `src/handlers/cleanup.ts`
- [x] **Timing-Safe Auth:** `requireAuth()` awaits `timingSafeEqual` properly
- [x] **Analytics Timestamp:** `analytics.timestamp` column with index for time-based queries
- [x] **Observability:** `wrangler.toml` sets `observability.enabled = true`
- [x] **Encrypted Secrets:** `ADMIN_SECRET` stored via `wrangler secret put`, not in repo
- [x] **Pages Deployment:** `_redirects` + `_headers` in `frontend/public/` for SPA routing and security headers
- [x] **CI/CD Pipelines:** GitHub Actions workflows for Worker and Pages deployment
- [x] **i18n System:** Custom `I18nProvider` + `useTranslation` hook with dot-notation key resolution and `{{param}}` interpolation; English locale at `frontend/src/locales/lang-en.json`
- [x] **Vitest — Backend:** Workers pool tests covering auth, nanoid, redirect, admin, stats, cleanup, burn-on-read, custom-id, variants
- [x] **Vitest — Frontend:** jsdom + @testing-library/react tests covering Home, DuckMoodLogo, Home-extended scenarios

## Not Yet Implemented

- [ ] **Admin Dashboard UI:** `frontend/src/pages/Admin.tsx` exists but is minimal — no full dashboard UI yet
- [ ] **Stats Tab UI:** Tab is intentionally hidden in `Home.tsx` (change `['shorten']` → `['shorten', 'stats']` to re-enable)
- [ ] **Visit Sparkline UI:** 7-day per-link sparkline data available from `GET /api/links` but not rendered
- [ ] **Bulk Export CSV:** Data export functionality for admin
- [ ] **Custom Domains:** Support for per-link custom domain routing
- [ ] **Additional Locales:** Only English (`lang-en.json`) is currently wired; locale-switching UI not built

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
# frontend/.env.local  (gitignored via *.local)
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

# Create KV namespace for rate limiting (run once)
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
│   ├── index.tsx                     # Entry point — routes + scheduled export for cron
│   ├── types.ts                      # Env interface: DB, RATE_LIMIT, ADMIN_SECRET, BASE_URL
│   ├── handlers/
│   │   ├── admin.ts                  # getLinks, createLink, updateLink, deleteLink,
│   │   │                             #   bulkDeleteLinks, getVariants, createVariant, deleteVariant
│   │   ├── burn-on-read.ts           # burnOnRead — disables link after first redirect
│   │   ├── cleanup.ts                # cleanupExpiredLinks — DELETE expired rows (cron)
│   │   ├── password.tsx              # showPasswordEntry, verifyPasswordEntry (SSR)
│   │   ├── preview.tsx               # previewLink (click-through interstitial, SSR)
│   │   ├── redirect.tsx              # redirectLink (302 + UTM + A/B + webhook + analytics)
│   │   └── stats.ts                  # getStats, getGlobalStats (totalVisits + mood)
│   ├── middleware/
│   │   └── rateLimit.ts              # 20 req/hr per IP via KV; graceful skip if KV absent
│   ├── lib/
│   │   ├── auth.ts                   # timingSafeEqual, requireAuth, hashPassword, verifyPassword
│   │   └── nanoid.ts                 # generateId — 8-char Base62 via nanoid
│   └── ui/                           # Hono/JSX SSR pages (interstitials only)
│       ├── Layout.tsx
│       ├── config.json
│       └── pages/
│           ├── PasswordEntry.tsx
│           └── Preview.tsx
│
├── frontend/                         # Frontend — Cloudflare Pages (React 18 SPA)
│   ├── public/
│   │   ├── favicon.ico               # Duck favicon
│   │   ├── _redirects                # Proxy rules to Worker + SPA fallback
│   │   └── _headers                  # Security headers (/*) + Cache-Control (/assets/*)
│   ├── src/
│   │   ├── main.tsx                  # ReactDOM root + I18nProvider + BrowserRouter + QueryClientProvider
│   │   ├── App.tsx                   # Router: / → Home, * → 404
│   │   ├── index.css                 # Tailwind v4 + neon CSS variables + utility classes
│   │   ├── lib/
│   │   │   └── i18n.tsx              # I18nProvider + useTranslation hook (dot-notation, {{param}} interpolation)
│   │   ├── locales/
│   │   │   └── lang-en.json          # English translation strings
│   │   ├── pages/
│   │   │   ├── Home.tsx              # Shortener form + QR modal + quack counter + mood
│   │   │   └── Admin.tsx             # Admin dashboard (minimal, not yet fully built)
│   │   ├── components/
│   │   │   ├── DuckLogo.tsx          # Static neon SVG duck logo
│   │   │   ├── DuckMoodLogo.tsx      # Animated mood-aware logo (DORMANT/ACTIVE/BUSY/VIRAL/ERROR→DEGRADED)
│   │   │   ├── DevModeBar.tsx        # Fixed dev banner — returns null in production
│   │   │   ├── Modal.jsx             # QR code / link-created modal
│   │   │   └── URLShortenerForm.jsx  # Extracted form component
│   │   ├── assets/
│   │   │   └── logo.png              # Duck mascot image
│   │   └── __tests__/
│   │       ├── App.test.tsx
│   │       ├── Home.test.tsx
│   │       ├── Home-extended.test.tsx  # Stats tab, QR modal, clipboard, burn-on-read, custom alias, expiry, mood, quack counter
│   │       └── DuckMoodLogo.test.tsx   # All mood states + ERROR→DEGRADED display
│   ├── index.html                    # Loads Orbitron + JetBrains Mono via Google Fonts
│   ├── vite.config.ts                # base: duckshort.pages.dev (prod), stable filenames, proxy
│   └── package.json
│
├── migrations/
│   ├── 0001_initial.sql              # links + analytics tables + indexes
│   └── 0002_feature_columns.sql      # password_hash, tag, utm_*, webhook_url,
│                                     #   analytics.timestamp, link_variants table
│
├── test/                             # Backend Vitest tests (Workers pool)
│   ├── handlers/
│   │   ├── admin.test.ts
│   │   ├── redirect.test.ts
│   │   ├── stats.test.ts
│   │   ├── cleanup.test.ts           # Cron cleanup handler tests
│   │   ├── burn-on-read.test.ts      # Burn-on-read self-destruct tests
│   │   ├── custom-id.test.ts         # Custom alias collision/validation tests
│   │   └── variants.test.ts          # A/B variant tests
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
├── package.json                      # Backend deps + scripts (wrangler ^3, hono ^4, nanoid ^5)
├── tsconfig.json                     # Backend TS config
├── vitest.config.ts                  # @cloudflare/vitest-pool-workers config
├── wrangler.toml                     # Worker config: name, D1, vars (BASE_URL), observability
├── AGENTS.MD                         # This file
├── BACKLOGS.md                       # Feature gaps
└── ISSUETOFIX.md                     # Resolved bugs and security fixes
```

## Database Schema

### `links`
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | 8-char Base62 NanoID or custom alias |
| original_url | TEXT NOT NULL | |
| created_at | TEXT NOT NULL | ISO 8601 |
| expires_at | TEXT | NULL = never |
| disabled | INTEGER | 0/1 soft delete |
| password_hash | TEXT | SHA-256 hex |
| tag | TEXT | Campaign label |
| utm_source | TEXT | |
| utm_medium | TEXT | |
| utm_campaign | TEXT | |
| webhook_url | TEXT | POST on each click |
| burn_on_read | INTEGER | 0/1 — self-destructs after first redirect |

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

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats/global` | — | Total visits, hourly count, duck mood |
| GET | `/api/stats/:id` | — | Per-link stats (visits, countries, referrers) |
| GET | `/api/links` | Bearer | All links with 7-day sparkline |
| POST | `/api/links` | Bearer | Create short link |
| POST | `/api/links/bulk-delete` | Bearer | Delete multiple links |
| PATCH | `/api/links/:id` | Bearer | Toggle disable or extend expiry |
| DELETE | `/api/links/:id` | Bearer | Delete link |
| GET | `/api/links/:id/variants` | Bearer | List A/B variants |
| POST | `/api/links/:id/variants` | Bearer | Add A/B variant |
| DELETE | `/api/links/variants/:id` | Bearer | Delete variant |
| GET | `/preview/:id` | — | Click-through preview interstitial |
| GET | `/password/:id` | — | Password entry form |
| POST | `/password/:id` | — | Verify password + redirect |
| GET | `/:id` | — | Main redirect (302) |
