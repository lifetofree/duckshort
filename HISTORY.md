# Project History & Resolved Tasks

Archive of completed features, bug fixes, and security improvements.

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
