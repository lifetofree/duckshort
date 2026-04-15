# DuckShort: Cyber-Duck URL Shortener

DuckShort is a high-performance, edge-native URL shortener with a "Synthwave Mallard" aesthetic. It's built for the modern web using Cloudflare's serverless ecosystem.

## 🚀 Mission
Provide lightning-fast redirects and secure link management with a visually striking, neon-futuristic user experience.

## 🏗 Core Architecture
- **Platform:** [Cloudflare Workers](https://workers.cloudflare.com/) (Edge computing for sub-10ms cold starts).
- **Database:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (Distributed SQLite for global persistence).
- **ID Generation:** NanoID (8-character Base62, collision-resistant).
- **UI Framework:** [Hono/JSX](https://hono.dev/docs/guides/jsx) (Server-side rendering for zero hydration lag).

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (TypeScript), Vite, React Router v6, TanStack Query v5, Tailwind CSS v3 |
| Frontend extras | react-i18next, react-quill, react-markdown, DOMPurify, qrcode.react, recharts, lucide-react |
| Backend | Hono.js on Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) via `DatabaseClient` wrapper |
| Rate Limiting | Cloudflare KV (distributed rate limit tracking) |
| Validation | Zod + `@hono/zod-validator` |
| Testing | Vitest (frontend + backend) |
| Deployment | Cloudflare Pages (frontend) + Cloudflare Workers (backend) |

## 🎨 Branding & Theme: "The Neon Pond"
- **Mascot:** A minimalist white duck with a backward red cap and glowing cyber-visor.
- **Color Mood:** Deep space black background (`#0B0E14`), glowing cyber-cyan grid (`#00F2FF`), and neon-red action buttons (`#FF0055`).
- **Typography:** Geometric *Orbitron* for headings and *JetBrains Mono* for high-tech data.

## 🔒 Security Model
- **Stateless Authentication:** Administrative actions (POST, DELETE) are protected by a shared `ADMIN_SECRET` stored in Cloudflare environment variables.
- **Timing-Safe Comparison:** Auth checks use `crypto.subtle.timingSafeEqual` (via `src/lib/auth.ts`) to prevent timing-based secret inference.
- **Development Secret:** `dev-secret` for local development (configured in `wrangler.toml` `[vars]` and `.dev.vars`).
- **Enumeration Prevention:** Randomized NanoID generation prevents malicious actors from guessing sequential link patterns.
- **Analytics Safety:** User-Agent and Referer headers are truncated to 255 characters before storage to prevent DB bloat from malicious requests.

## 📅 Feature Roadmap

### ✅ Implemented
- [x] **Project Foundation:** Hono setup, D1 migrations, and Vitest configuration.
- [x] **"Neon Pond" UI:** Custom SVG mascot and responsive landing page layout.
- [x] **Type Safety:** Full TypeScript implementation with shared `Bindings` type (`src/types.ts`) across all handlers.
- [x] **Link Generation:** NanoID-based URL shortening and D1 storage.
- [x] **Redirection:** Fast `/:id` route with visit tracking and styled 404 page for missing/expired links.
- [x] **Stats API:** Securely view link click counts and analytics breakdown.
- [x] **Admin Dashboard:** Protected UI for managing and deleting links, with logout support.
- [x] **Advanced Stats View:** Integrated link analysis (visits, top countries, top referrers) on the home page.
- [x] **Private Telemetry:** Server-side analytics using HTTP 302 redirects and background processing (`waitUntil`).
- [x] **Link Expiration:** Automatically disable links after a set duration.
- [x] **Modal UI:** Short URL displayed in popup modal with copy and close buttons.
- [x] **Error Display:** Inline error messages for unauthorized and network errors in both Shorten and Stats tabs.
- [x] **Dev Mode Banner:** Yellow topbar warning in development environment.
- [x] **Timing-Safe Auth:** `crypto.subtle.timingSafeEqual` for all protected endpoints.
- [x] **Database Indexes:** Indexes on `expires_at`, `(link_id, country)`, and `(link_id, referer)` for fast redirect and stats queries.
- [x] **Observability:** Cloudflare Workers observability enabled for production error and latency visibility.

### ❌ Not Yet Implemented
- [ ] **Custom Domains:** Per-link vanity domain support (requires route matching and `custom_domain` column).
- [ ] **Rate Limiting:** Per-IP throttle on link creation (can be handled via Cloudflare WAF rules).
- [ ] **Scheduled Cleanup:** Cron Trigger to hard-delete expired links from D1.
- [ ] **Admin Search/Filter:** Search and sort on the admin links table.

## 🏃‍♂️ Running Locally

### Start Backend (API)
```bash
npm run dev
# Runs on http://localhost:8383
```

### Start Frontend
```bash
cd frontend && npm run dev
# Runs on http://localhost:3030
# Proxies /api/* to http://localhost:8383
```

### Environment Files
- **Backend:** `wrangler.toml` `[vars]` sets `ADMIN_SECRET = "dev-secret"` for local dev. Optionally override with `.dev.vars`.
- **Frontend:** `frontend/.env.development` must contain:
  ```
  VITE_API_URL=http://localhost:8383
  VITE_ADMIN_SECRET=dev-secret
  ```

## 🌐 Custom Domain Setup
To use your own domain (e.g., `d.uck.sh`) with DuckShort:
1. **Cloudflare Dashboard:** Go to `Workers & Pages` → `duckshort` → `Settings` → `Domains & Routes` → `Add Custom Domain`.
2. **Base URL Secret:** Set the production base URL:
   ```bash
   wrangler secret put BASE_URL
   # Enter: https://your-domain.com
   ```
3. **Deploy:** `npm run deploy`

## 📁 Project Structure
```
DuckShort/
├── src/                        # Backend (Hono/Workers)
│   ├── handlers/
│   │   ├── admin.tsx           # createLink, deleteLink, listLinks
│   │   ├── redirect.tsx        # redirectLink (302 + async analytics)
│   │   └── stats.tsx           # getStats (visits, countries, referrers)
│   ├── lib/
│   │   ├── auth.ts             # timingSafeEqual helper
│   │   └── nanoid.ts           # 8-char Base62 ID generator
│   ├── ui/                     # Server-rendered Hono/JSX pages
│   │   ├── components/Duck.tsx
│   │   ├── pages/Admin.tsx
│   │   ├── pages/Home.tsx
│   │   ├── pages/NotFound.tsx
│   │   └── Layout.tsx
│   ├── types.ts                # Shared Bindings type
│   └── index.tsx               # Worker entry point & route registration
├── frontend/                   # React SPA
│   ├── src/App.tsx             # Main component (shorten + stats tabs, modal)
│   ├── vite.config.ts          # Vite + proxy to :8383
│   └── package.json
├── migrations/
│   ├── 0000_init.sql           # links table
│   ├── 0001_analytics.sql      # analytics table
│   ├── 0002_link_expiration.sql # expires_at column
│   ├── 0003_add_expires_index.sql    # index on expires_at
│   └── 0004_add_analytics_indexes.sql # composite indexes for stats queries
├── wrangler.toml               # Worker config (D1 binding, vars, observability)
├── AGENTS.MD                   # This file
├── ISSUETOFIX.md               # Known bugs and security issues
└── BACKLOGS.md                 # Feature gaps and improvement backlog
```
