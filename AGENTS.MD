# DuckShort: Cyber-Duck URL Shortener

DuckShort is a high-performance, edge-native URL shortener with a "Synthwave Mallard" aesthetic. It's built for the modern web using Cloudflare's serverless ecosystem.

## 🚀 Mission
Provide lightning-fast redirects and secure link management with a visually striking, neon-futuristic user experience.

## 🏗 Core Architecture
- **Backend:** Hono.js on Cloudflare Workers (edge computing, sub-10ms cold starts)
- **Frontend:** React 18 SPA on Cloudflare Pages (separate deployment)
- **Database:** Cloudflare D1 (distributed SQLite)
- **ID Generation:** NanoID (8-character Base62, collision-resistant)

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Hono.js 4 on Cloudflare Workers |
| Frontend | React 18 (TypeScript), Vite 5, React Router v6, TanStack Query v5, Tailwind CSS v3 |
| Frontend extras | qrcode.react, lucide-react, react-markdown, DOMPurify, recharts, react-i18next |
| Database | Cloudflare D1 (SQLite) |
| Testing | Vitest — backend via `@cloudflare/vitest-pool-workers`, frontend via jsdom + @testing-library/react |
| Deployment | Cloudflare Workers (backend) + Cloudflare Pages (frontend) |

## 🎨 Branding & Theme: "The Neon Pond"
- **Color Palette:** `#0B0E14` background, `#00F2FF` cyan accents, `#FF0055` neon-red actions
- **Typography:** *Orbitron* for headings, *JetBrains Mono* for data
- **Asset:** `frontend/src/assets/logo.png` — duck mascot used in both frontend and SSR pages

## 🔒 Security Model
- **Bearer Token Auth:** All admin endpoints require `Authorization: Bearer <ADMIN_SECRET>`. Checked via `requireAuth()` in `src/lib/auth.ts`.
- **Timing-Safe Comparison:** `crypto.subtle.timingSafeEqual` (Web Crypto API) prevents timing-based secret inference.
- **Password Hashing:** Link passwords hashed with SHA-256 via Web Crypto (`hashPassword` / `verifyPassword` in `src/lib/auth.ts`). bcrypt is unavailable in the Workers runtime.
- **Enumeration Prevention:** NanoID Base62 prevents sequential guessing.
- **Analytics Safety:** User-Agent and Referer headers truncated to 255 chars before storage.
- **Dev Secret:** `ADMIN_SECRET = "dev-secret"` in `wrangler.toml [vars]` for local dev. Override with `.dev.vars`.

## 📅 Feature Roadmap

### ✅ Implemented
- [x] **Link Generation:** NanoID-based URL shortening, D1 storage
- [x] **Redirection:** `/:id` with 302 redirect, 404/410 for missing/expired links
- [x] **Link Expiration:** `expires_at` column; expired links auto-disabled on redirect
- [x] **One-click Disable/Enable:** `PATCH /api/links/:id` with `action: "toggle"`
- [x] **Expiry Extension:** `PATCH /api/links/:id` with `action: "extend"` and `extendHours`
- [x] **Bulk Delete:** `POST /api/links/bulk-delete` with `{ ids: string[] }`
- [x] **Link Tags:** `tag` column for campaign grouping
- [x] **UTM Parameter Injection:** `utm_source/medium/campaign` appended to destination URL on redirect
- [x] **Webhook on Click:** `webhook_url` column; async POST fired via `waitUntil` on each redirect
- [x] **A/B Link Rotation:** `link_variants` table with weighted random destination selection
- [x] **Password-Protected Links:** `password_hash` column (SHA-256); redirects to `/password/:id` interstitial
- [x] **Click-through Preview:** `GET /preview/:id` branded interstitial showing destination before redirect
- [x] **Stats API:** Per-link visits, top countries, top referrers (`GET /api/stats/:id`)
- [x] **Global Quack Counter:** `GET /api/stats/global` — total visits, hourly visits, duck mood
- [x] **Duck Mood Indicator:** `DORMANT` / `ACTIVE` / `BUSY` / `VIRAL` based on hourly visit count
- [x] **QR Code in Modal:** `qrcode.react` renders QR for every created short URL
- [x] **Timing-Safe Auth:** `requireAuth()` is async and properly awaits `timingSafeEqual`
- [x] **Analytics Timestamp:** `analytics.timestamp` column with index for time-based queries
- [x] **Vitest — Backend:** Workers pool tests in `test/` covering auth, nanoid, redirect, admin, stats
- [x] **Vitest — Frontend:** jsdom + @testing-library/react tests in `frontend/src/__tests__/`
- [x] **Pages Deployment:** `_redirects` + `_headers` in `frontend/public/` for SPA routing and security headers
- [x] **Observability:** `wrangler.toml` sets `observability.enabled = true`

### ❌ Not Yet Implemented
- [ ] **Admin React Page:** `/admin` route exists in React Router but has no component yet (SSR placeholder at `src/ui/pages/Admin.tsx` still referenced)
- [ ] **Visit Sparkline:** 7-day per-link sparkline data available from `GET /api/links` but not rendered in UI
- [ ] **Bulk Export CSV:** API supports bulk delete but CSV export is client-side only — not yet wired up
- [ ] **Custom Domains:** Per-link vanity domain support (no `custom_domain` column or route matching)
- [ ] **Rate Limiting:** No per-IP throttle on link creation
- [ ] **Scheduled Cleanup:** No Cron Trigger to hard-delete expired links from D1
- [ ] **Admin Search/Filter:** No search or sort on the admin links table

## 🏃 Running Locally

### Start Backend (API + redirects)
```bash
npm run dev
# Runs on http://localhost:8787
```

### Start Frontend (React SPA)
```bash
cd frontend && npm run dev
# Runs on http://localhost:3030
# Proxies /api/*, /preview/*, /password/* to http://localhost:8787
```

### Environment Files
- **Backend:** `wrangler.toml [vars]` sets `ADMIN_SECRET = "dev-secret"` and `BASE_URL = "http://localhost:8787"`. Override sensitive values with `.dev.vars`.
- **Frontend:** `frontend/.env.local` (or `.env`) must contain:
  ```
  VITE_API_URL=http://localhost:8787
  VITE_ADMIN_SECRET=dev-secret
  ```

### Running Tests
```bash
# Backend (Workers runtime via miniflare)
npm run test

# Frontend
cd frontend && npm run test
```

## 🌐 Deployment

Two separate deployments — backend and frontend are independent.

### Backend (Cloudflare Worker)
```bash
# Apply D1 migrations first
wrangler d1 migrations apply duckshort-db --remote

# Deploy Worker
npm run deploy

# Set production secrets
wrangler secret put ADMIN_SECRET
wrangler secret put BASE_URL   # e.g. https://go.yourdomain.com
```

### Frontend (Cloudflare Pages)
```bash
cd frontend && npm run build
wrangler pages deploy dist --project-name=duckshort --branch main
```
Set `VITE_API_URL` and `VITE_ADMIN_SECRET` as environment variables in the Pages dashboard or via the deploy workflow.

## 📁 Project Structure
```
DuckShort/
├── src/                              # Backend — Cloudflare Worker (Hono.js)
│   ├── handlers/
│   │   ├── admin.ts                  # getLinks, createLink, updateLink, deleteLink,
│   │   │                             #   bulkDeleteLinks, getVariants, createVariant, deleteVariant
│   │   ├── password.ts               # showPasswordEntry, verifyPasswordEntry
│   │   ├── preview.ts                # previewLink (click-through interstitial)
│   │   ├── redirect.ts               # redirectLink (302 + UTM + A/B + webhook + analytics)
│   │   └── stats.ts                  # getStats, getGlobalStats
│   ├── lib/
│   │   ├── auth.ts                   # timingSafeEqual, requireAuth, hashPassword, verifyPassword
│   │   └── nanoid.ts                 # generateId (8-char Base62)
│   ├── ui/                           # Hono/JSX SSR pages (interstitials only)
│   │   ├── pages/
│   │   │   ├── Admin.tsx             # Legacy SSR admin shell (references /assets/admin.js)
│   │   │   ├── Home.tsx              # Legacy SSR home shell (references /assets/index.js)
│   │   │   └── NotFound.tsx          # 404 page
│   │   ├── config.json
│   │   └── Layout.tsx                # Shared HTML shell (Orbitron + JetBrains Mono fonts)
│   ├── types.ts                      # Shared `Env` interface (DB, ADMIN_SECRET, BASE_URL)
│   └── index.tsx                     # Worker entry point — all route registration
│
├── frontend/                         # Frontend — Cloudflare Pages (React SPA)
│   ├── public/
│   │   ├── _redirects                # /* → /index.html 200 (SPA fallback)
│   │   └── _headers                  # Security headers + asset caching
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── App.test.tsx          # Route rendering tests
│   │   │   └── Home.test.tsx         # HomePage unit tests (fetch mock)
│   │   ├── assets/
│   │   │   └── logo.png              # Duck mascot
│   │   ├── components/               # Legacy JSX components (pre-TypeScript)
│   │   │   ├── Modal.jsx
│   │   │   ├── URLShortenerForm.jsx
│   │   │   └── URLShortenerForm.tsx
│   │   ├── pages/
│   │   │   └── Home.tsx              # URL shortener form + QR modal + quack counter
│   │   ├── screens/                  # Design reference assets (not deployed)
│   │   ├── test/
│   │   │   └── setup.ts              # @testing-library/jest-dom import
│   │   ├── App.tsx                   # Router: / → Home, /admin → Admin (pending), * → 404
│   │   ├── index.css
│   │   └── main.tsx                  # ReactDOM root + BrowserRouter + QueryClientProvider
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts                # Vite + dev proxy + Vitest (jsdom) config
│
├── migrations/
│   ├── 0001_initial.sql              # links + analytics tables + all base indexes
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
├── .github/
│   └── workflows/
│       ├── deploy-worker.yml         # CI: typecheck → test → migrate → deploy Worker
│       ├── deploy-frontend.yml       # CI: lint → typecheck → test → build → deploy Pages
│       └── deploy-all.yml
│
├── .dev.vars                         # Local secrets (not committed)
├── package.json                      # Backend deps + test/deploy scripts
├── tsconfig.json                     # Backend TS config (Workers types, hono/jsx)
├── vitest.config.ts                  # @cloudflare/vitest-pool-workers config
├── wrangler.toml                     # Worker config (D1 binding, vars, observability)
├── AGENTS.MD                         # This file
├── BACKLOGS.md                       # Feature gaps and improvement backlog
└── ISSUETOFIX.md                     # Known bugs and security issues
```
