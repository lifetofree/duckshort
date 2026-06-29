# Project History & Resolved Tasks

Archive of completed features, bug fixes, and security improvements.

---

## v1.9.3 Enhancements & Fixes (2026-06-26)

### ✅ Additional Locales (Thai) — SDLC-shipped
- **Resolved**: Thai translation file at `frontend/src/locales/lang-th.json` mirrors the `lang-en.json` structure. `I18nProvider` extended to expose `locale` + `setLocale`; active locale persists in `localStorage` under `duckshort_locale`. `LanguageSwitcher` component added to the top-right of the Home page with neon-themed EN/TH pill. Falls back to English for missing keys, then to the raw key. All 144 unit tests pass.
- **Process**: Shipped end-to-end via the `.ai.agents` SDLC framework (PO → PM → Tech Lead → Architect → TDD Coder → Reviewer → DevOps). Artifacts: `docs/BUSINESS_GOALS.md`, `docs/REQUIREMENTS.md`, `docs/USER_JOURNEY.md`, `docs/SYSTEM_DESIGN.md`, `docs/TECH_STACK.md`, `docs/REVIEWS.md`, `STATUS.md`.

### ✅ Workers Static Assets frontend serving
- **Resolved**: `wrangler.toml` adds `[assets] directory = "./frontend/dist" binding = "ASSETS" not_found_handling = "single-page-application"`. The Worker's `GET /`, `GET /admin`, and catch-all routes now delegate to `c.env.ASSETS.fetch(c.req.raw)`. `_redirects` + `_headers` in `frontend/public/` are no longer required for the Worker-served path. PAGES_URL var + `pagesOrigin()` helper removed (no longer needed).

### ✅ Vitest 3 → 4 / vitest-pool-workers 0.16 upgrade (security)
- **Resolved**: `npm audit` brought from 12 → 0 vulnerabilities via PR #18 (squash `976b914`). Package bumps: `@cloudflare/vitest-pool-workers` `^0.5.0` → `^0.16.20`, `vitest` `^2.0.0` → `^4.1.9`, `@vitest/coverage-istanbul` / `@vitest/coverage-v8` `^2.1.9` → `^4.1.9`. Test-infra changes: `vitest.config.ts` → `vitest.config.mts` (rewrite to `defineConfig` + `cloudflareTest()` plugin); `test/helpers/schema.ts` `clearAll()` extended to wipe the rate limiter DO storage (vitest-pool-workers 0.16 + miniflare 4 deliberately persist DO state across `it` blocks).

### ✅ CI restore
- **Resolved**: `.github/workflows/deploy-all.yml` recreated as `workflow_dispatch` only (intentionally not auto-deploying on push to `main` — captured in commit `2c8bde7`). Worker job: install → typecheck → D1 migrations → `wrangler deploy`. Frontend job: install → typecheck → build → `wrangler pages deploy`.

### ✅ Footer version mismatch
- **Fixed in**: `frontend/package.json`
- `version` was still pinned at the project bootstrap value `1.0.0` while the rest of the project was at v1.9.2. Bumped to `1.9.3` so the `V{{version}}` footer (fed by Vite's `__APP_VERSION__` define) renders correctly.

---

## v1.9.0 Enhancements & Fixes (2026-04-21)

### ✅ Custom Domains
- **Resolved**: `custom_domain` column added to `links` via migration `0007_custom_domain.sql`. `PATCH /api/links/:id` handler extended with `action: "set_custom_domain"`. `resolveCustomDomain` middleware created in `src/middleware/customDomain.ts` and registered in `index.tsx` — intercepts non-primary hostnames, resolves the link by domain, and applies full redirect chain (A/B variants, geo-redirects, UTM, burn-on-read, webhooks, analytics). All test schemas updated.

---

## v1.8.0 Enhancements & Fixes (2026-04-21)

### ✅ Geo-Fencing Redirects
- **Resolved**: Migration `0006_geo_redirects.sql` creates `geo_redirects` table. `getGeoRedirects`, `createGeoRedirect`, `deleteGeoRedirect` handlers added to `admin.ts`. `redirect.tsx` applies matching country rule from `cf-ipcountry` header after A/B variant resolution. Admin dashboard UI adds "GEO" button per link and a country-code→URL panel with add/delete controls.

---

## v1.7.0 Enhancements & Fixes (2026-04-21)

### ✅ Neon Heatmap
- **Resolved**: `NeonHeatmap` component added to `frontend/src/components/NeonHeatmap.tsx`. Renders top 20 countries as glowing neon blocks with cyan→magenta color intensity proportional to visit share. No external dependencies. Integrated above the countries list in `StatsView`. Tests updated for duplicate text matches from dual rendering.

---

## v1.6.0 Enhancements & Fixes (2026-04-21)

### ✅ Bulk Export CSV
- **Resolved**: `GET /api/links/export` endpoint added to `src/handlers/admin.ts`. Returns all links as a CSV with columns: ID, Original URL, Created, Expires, Status, Tag, Visits. "EXPORT CSV" button added to the Admin dashboard links tab toolbar (above the search/filter bar). Uses fetch + blob download to handle Bearer auth.

---

## v1.4.0 Enhancements & Fixes (2026-04-21)

### ✅ Visit Sparkline UI
- **Resolved**: `StatsView.tsx` now renders a 7-day bar-chart sparkline above country/referrer stats. `Sparkline` component draws proportional cyan/magenta bars with zero-padding. `GET /api/stats/:id` returns `sparkline: number[]` (7 elements). Stats limit selector dropdown wired in.

### ✅ Stats Limit Selector (Frontend)
- **Resolved**: `StatsView` props expanded with `statsLimit` and `onStatsLimitChange`. Renders a "Top 5/10/25/50/100" select. Section headers display the active limit.

---

## v1.3.0 Enhancements & Fixes (2026-04-17)

### ✅ OG Tag Customization
- **Resolved**: Migration `0005_og_tags.sql` adds `og_title`, `og_description`, `og_image` to `links`. `createLink` accepts these fields. Preview handler fetches and passes them to SSR. `Layout.tsx` renders `<meta property="og:*">` tags.

### ✅ Custom Expiration Input
- **Resolved**: "CUSTOM" option in `ShortenForm.tsx` expiry dropdown reveals a numeric hours input. `Home.tsx` computes `expiresIn` accordingly.

### ✅ Stats Pagination
- **Resolved**: `GET /api/stats/:id` accepts `?limit=N` (1–100, default 10) for country and referrer result counts.

### ✅ Atomic Rate Limiting via Durable Object
- **Resolved**: `src/durableObjects/RateLimiter.ts` uses `storage.transaction()` to atomically check-and-increment per-IP counters, eliminating the KV read-check-write race condition.

### ✅ Shared UTM Utility
- **Resolved**: `injectUtm()` extracted to `src/lib/utm.ts`, imported by both `redirect.tsx` and `password.tsx`.

### ✅ Performance Indexes
- **Resolved**: Migration `0004_performance_indexes.sql` adds three indexes for admin list, tag filter, and analytics queries.

### ✅ Expiry Comparison Bug in Password & Preview Handlers
- **Fixed in**: `src/handlers/password.tsx`, `src/handlers/preview.tsx`
- ISO 8601 `T`-separator vs SQLite space-separator caused all dates to compare as "future". Wrapped with `datetime(expires_at)` to normalize before comparison.

### ✅ A/B Variants Ignored on Password-Protected Links
- **Fixed in**: `src/handlers/password.tsx`
- `verifyPasswordEntry` now runs `pickVariant()` against `link_variants` after password verification, matching `redirect.tsx` behavior.

### ✅ Redundant DB Query in Password Handler
- **Fixed in**: `src/handlers/password.tsx`
- Merged `webhook_url` and `burn_on_read` into the initial SELECT, eliminating the second query.

### ✅ Bulk-Delete Has No Rate Limiting
- **Fixed in**: `src/index.tsx`
- Added `rateLimit` middleware to `POST /api/links/bulk-delete`.

### ✅ `password_hash` / `webhook_url` Exposed in Stats
- **Fixed in**: `src/handlers/stats.ts`
- Replaced `SELECT *` with an explicit column whitelist. Regression tests added.

### ✅ Extracted Frontend Components
- **Resolved**: `Home.tsx` split into `QuackCounter.tsx`, `ShortenForm.tsx`, `StatsView.tsx`, `ResultModal.tsx`, and `frontend/src/types.ts`.

### ✅ Auto-Version Footer
- **Resolved**: `__APP_VERSION__` injected by Vite from `package.json`; footer key updated to `"V{{version}}"`.

### ✅ `@tanstack/react-query` Removed
- **Resolved**: Package uninstalled; `QueryClientProvider` removed from `main.tsx` and all frontend test files.

### ✅ Dead Code Deleted
- **Resolved**: `src/ui/pages/Home.tsx`, `src/ui/pages/Admin.tsx` (unrouted SSR pages with broken asset refs), and `frontend/src/components/URLShortenerForm.tsx` (hardcoded-string placeholder) deleted.

### ✅ New Test Coverage
- **Resolved**: `test/handlers/password.test.ts` (6 tests), `test/handlers/preview.test.ts` (5 tests). All 75 backend tests pass.

---

## v1.1.0 Enhancements (2026-04-16)

### ✅ Custom Pond Aliases (Vanity URLs)
- **Resolved**: Users can specify a custom ID at creation time. The API checks for collisions.

### ✅ Burn-on-Read (Self-Destructing Links)
- **Resolved**: Added `burn_on_read` column. Redirect and Password verification handlers disable the link after the first successful forward.

### ✅ Scheduled cleanup for expired links
- **Resolved**: Cloudflare Workers Cron Trigger executes `cleanupExpiredLinks` to purge expired links.

### ✅ Rate limiting
- **Resolved**: IP-based throttle implemented via Workers KV in `src/middleware/rateLimit.ts`.

### ✅ Stats lookup doesn't handle full URLs
- **Fixed in:** `frontend/src/pages/Home.tsx`
- Users can now paste a full short URL into the stats search box.

### ✅ Missing analytics/webhooks on password-protected links
- **Fixed in:** `src/handlers/password.tsx`
- Webhooks and analytics now trigger on password-protected redirects.

### ✅ Inconsistent expiration timing
- **Fixed in:** Switched to SQLite's `datetime('now')` for edge-wide consistency.

### ✅ Build failure from JSX in .ts file
- **Fixed in:** Renamed `src/handlers/redirect.ts` to `src/handlers/redirect.tsx`.

---

## v1.0.0 Refactoring & Initial Fixes (2026-04-14)

### Security Fixes
- ✅ **Timing-attack-vulnerable authentication**: All auth checks now use `crypto.subtle.timingSafeEqual`.
- ✅ **Admin secret hardcoded in frontend**: Now reads from `VITE_ADMIN_SECRET` env.
- ✅ **Admin secret exposed via DevTools**: Secret stored in module-level variable `_secret`.
- ✅ **User-Agent not truncated**: Now truncated to 255 chars.

### Bug Fixes
- ✅ **Missing GET / route**: Added root handler.
- ✅ **404 page component never rendered**: Fixed return type in handlers.
- ✅ **Missing index on expires_at**: Added migration for index.
- ✅ **Missing composite indexes on analytics**: Added migration for composite indexes.
- ✅ **Shared TypeScript types**: Created `src/types.ts`.
- ✅ **Admin logout**: Implemented logout button.
- ✅ **Standardise CI Node.js version**: All workflows use Node 22.
- ✅ **Enable Cloudflare observability**: Set in `wrangler.toml`.
- ✅ **Error display in Stats tab**: Integrated error banner.
- ✅ **Deduplicate Duck SVG**: Component standardized.

---
