# DuckShort: Cyber-Duck URL Shortener

DuckShort is a high-performance, edge-native URL shortener with a "Synthwave Mallard" aesthetic. Built on Cloudflare's serverless ecosystem with a neon-futuristic UI.

## Mission
Provide lightning-fast redirects and secure link management with a visually striking, neon-futuristic user experience.

## Core Architecture
- **Backend:** Hono.js on Cloudflare Workers (edge computing, sub-10ms cold starts)
- **Frontend:** React 18 SPA on Cloudflare Pages (separate deployment)
- **Database:** Cloudflare D1 (distributed SQLite)
- **ID Generation:** NanoID (8-character Base62, 62^8 = ~218 trillion combinations)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono.js 4, Cloudflare Workers, TypeScript |
| Frontend | React 18, Vite 5, React Router v6, TailwindCSS v4 + @tailwindcss/vite |
| Animations | motion (Framer Motion v12) via `motion/react` |
| UI Extras | qrcode.react, lucide-react, DOMPurify |
| Installed but unused | @tanstack/react-query, recharts, react-i18next, i18next, react-markdown, react-quill |
| Database | Cloudflare D1 (SQLite) |
| Testing | Vitest — backend via `@cloudflare/vitest-pool-workers`, frontend via jsdom + @testing-library/react |
| Deployment | Cloudflare Workers (backend) + Cloudflare Pages (frontend) |
| CI/CD | GitHub Actions — two workflows (deploy-worker, deploy-frontend) |

## Branding & Theme: "The Neon Pond"

**Title:** DuckShort | The Neon Pond

**Color Palette (CSS variables in `frontend/src/index.css`):**
- `--bg-primary: #0a0a0f` — main background
- `--bg-secondary: #12121a` — card background
- `--bg-tertiary: #1a1a25` — input background
- `--neon-cyan: #00f5ff` — primary accent
- `--neon-magenta: #ff00ff` — action/button color
- `--neon-purple: #bf00ff` — secondary accent
- `--text-primary: #ffffff`
- `--text-secondary: #a0a0b0`

**Tailwind v4 theme tokens** (in `@theme` block):
- `--color-cyan-500`, `--color-magenta-500`, `--color-bg-primary`, etc.

**Typography:** Orbitron (headings, buttons) + JetBrains Mono (data, inputs, body) loaded via `<link>` in `index.html`

**Utility Classes:**
- `.glass-card` — glassmorphic dark panel
- `.glass-card-neon` — high-intensity neon border panel
- `.input-neon` — dark input, cyan border on focus
- `.btn-neon` — cyan→magenta gradient button with glow
- `.neon-glow-cyan` / `.neon-glow-magenta` — text shadow utilities
- `.neon-border-cyan` / `.neon-border-magenta` — box shadow utilities

**Asset:** `frontend/src/assets/logo.png` — duck mascot, displayed circular in the header

## Security Model
- **Bearer Token Auth:** All admin endpoints require `Authorization: Bearer <ADMIN_SECRET>`. Checked via `requireAuth()` in `src/lib/auth.ts`.
- **Timing-Safe Comparison:** `crypto.subtle.timingSafeEqual` (Web Crypto API) prevents timing-based secret inference.
- **Password Hashing:** Link passwords hashed with SHA-256 via Web Crypto (`hashPassword` / `verifyPassword`). bcrypt unavailable in Workers runtime.
- **Enumeration Prevention:** NanoID Base62 prevents sequential guessing.
- **Analytics Safety:** User-Agent and Referer headers truncated to 255 chars before storage.
- **Secrets Management:** `ADMIN_SECRET` stored as an encrypted Cloudflare secret (`wrangler secret put ADMIN_SECRET`), never in `wrangler.toml`.

## Feature Roadmap

### Implemented
- [x] **Link Generation:** NanoID-based URL shortening, D1 storage
- [x] **Redirection:** `/:id` with 302 redirect, 404/410 for missing/expired links
- [x] **Link Expiration:** `expires_at` column; expired links auto-disabled on redirect
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
- [x] **Duck Mood Indicator:** `DORMANT` / `ACTIVE` / `BUSY` / `VIRAL` based on hourly visit count
- [x] **QR Code Modal:** `qrcode.react` renders QR for every created short URL + copy to clipboard
- [x] **Timing-Safe Auth:** `requireAuth()` awaits `timingSafeEqual` properly
- [x] **Analytics Timestamp:** `analytics.timestamp` column with index for time-based queries
- [x] **Vitest — Backend:** Workers pool tests covering auth, nanoid, redirect, admin, stats
- [x] **Vitest — Frontend:** jsdom + @testing-library/react tests
- [x] **Pages Deployment:** `_redirects` + `_headers` in `frontend/public/` for SPA routing and security headers
- [x] **Observability:** `wrangler.toml` sets `observability.enabled = true`
- [x] **CI/CD Pipelines:** GitHub Actions workflows for Worker and Pages deployment
- [x] **Encrypted Secrets:** `ADMIN_SECRET` stored via `wrangler secret put`, not in repo

### Not Yet Implemented
- [ ] **Admin React Page:** `/admin` route exists in React Router but no component (SSR placeholder only)
- [ ] **View Stats Tab:** Stats tab in Home.tsx is currently hidden (state + API intact, UI hidden)
- [ ] **Visit Sparkline UI:** 7-day per-link sparkline data available from `GET /api/links` but not rendered
- [ ] **Bulk Export CSV:** Not yet wired up
- [ ] **Custom Domains:** No `custom_domain` column or route matching
- [ ] **Rate Limiting:** No per-IP throttle on link creation
- [ ] **Scheduled Cleanup:** No Cron Trigger to hard-delete expired links

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

Two independent deployments triggered by GitHub Actions on push to `main`.

### Required GitHub Secrets
| Secret | Value |
|--------|-------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token (Edit Workers permission) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `VITE_API_URL` | `https://duckshort.cc` (worker URL for frontend build) |
| `VITE_ADMIN_SECRET` | Same value as `ADMIN_SECRET` Cloudflare secret |

### First-time Setup
```bash
# Set encrypted production secret (run once)
wrangler secret put ADMIN_SECRET

# Apply D1 schema (run once, then CI handles it)
wrangler d1 migrations apply duckshort-db --remote --yes
```

### Manual Deploy (without CI)
```bash
# Backend
npm run deploy

# Frontend
cd frontend && npm run build
wrangler pages deploy dist --project-name=duckshort --branch main
```

## Project Structure
```
DuckShort/
├── src/                              # Backend — Cloudflare Worker (Hono.js)
│   ├── index.tsx                     # Entry point — all route registration (14 routes)
│   ├── types.ts                      # Env interface: DB, ADMIN_SECRET, BASE_URL
│   ├── handlers/
│   │   ├── admin.ts                  # getLinks, createLink, updateLink, deleteLink,
│   │   │                             #   bulkDeleteLinks, getVariants, createVariant, deleteVariant
│   │   ├── password.tsx              # showPasswordEntry, verifyPasswordEntry (SSR)
│   │   ├── preview.tsx               # previewLink (click-through interstitial, SSR)
│   │   ├── redirect.ts               # redirectLink (302 + UTM + A/B + webhook + analytics)
│   │   └── stats.ts                  # getStats, getGlobalStats (with duck mood)
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
│   │   ├── favicon.svg               # Neon duck SVG favicon
│   │   ├── _redirects                # /* → /index.html 200 (SPA fallback)
│   │   └── _headers                  # Security headers + asset caching
│   ├── src/
│   │   ├── main.tsx                  # ReactDOM root + BrowserRouter + QueryClientProvider
│   │   ├── App.tsx                   # Router: / → Home, * → 404
│   │   ├── index.css                 # Tailwind v4 + neon CSS variables + utility classes
│   │   ├── pages/
│   │   │   └── Home.tsx              # URL shortener form + QR modal + quack counter
│   │   ├── components/
│   │   │   └── DuckLogo.tsx          # Neon SVG duck logo component
│   │   ├── lib/
│   │   │   └── utils.ts              # cn() class merge helper
│   │   ├── assets/
│   │   │   └── logo.png              # Duck mascot (circular in header)
│   │   └── __tests__/
│   │       ├── App.test.tsx
│   │       └── Home.test.tsx
│   ├── index.html                    # Loads Orbitron + JetBrains Mono via Google Fonts
│   ├── vite.config.ts                # Tailwind v4 plugin + dev proxy + vitest config
│   ├── tailwind.config.js            # Legacy (unused by Tailwind v4, kept for reference)
│   ├── postcss.config.js             # autoprefixer only (tailwindcss removed, handled by Vite)
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
│   │   └── stats.test.ts
│   └── lib/
│       ├── auth.test.ts
│       └── nanoid.test.ts
│
├── .github/workflows/
│   ├── deploy-worker.yml             # typecheck → test → migrate (--yes) → deploy
│   └── deploy-frontend.yml           # typecheck → test → build → pages deploy
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
| id | TEXT PK | 8-char Base62 NanoID |
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
