# Project History & Resolved Tasks

Archive of completed features, bug fixes, and security improvements.

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
