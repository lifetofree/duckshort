# Issues To Fix

Bugs and security issues identified during code review (2026-04-14).
Items marked ✅ were resolved in the refactoring pass on 2026-04-14.

---

## Security

### ✅ [HIGH] Timing-attack-vulnerable authentication
- **Fixed in:** `src/lib/auth.ts`, `src/handlers/admin.tsx`, `src/handlers/stats.tsx`
- All auth checks now use `crypto.subtle.timingSafeEqual` via the shared `timingSafeEqual()` helper.

### ✅ [MEDIUM] Admin secret hardcoded in frontend
- **Fixed in:** `frontend/src/App.tsx`
- Now reads from `import.meta.env.VITE_ADMIN_SECRET`. Shows an inline error and aborts if unset.
- CI workflow injects `VITE_ADMIN_SECRET` at build time.

### ✅ [MEDIUM] Admin secret exposed via DevTools
- **Fixed in:** `src/ui/pages/Admin.tsx`
- Secret is stored in a JS module-level variable (`_secret`) and never serialised into HTML attributes.
- `deleteLink(id)` no longer receives the secret as an argument visible in the DOM.

### ✅ [LOW] User-Agent not truncated in analytics
- **Fixed in:** `src/handlers/redirect.tsx`
- `User-Agent` and `Referer` headers are now truncated to 255 characters before DB insert.

---

## Bugs

### ✅ [HIGH] Missing `GET /` route handler
- **Fixed in:** `src/index.tsx`
- Added `app.get('/', (c) => c.text('DuckShort is running!'))` before the `/:id` wildcard. Fixes the failing test.

### ✅ [MEDIUM] 404 page component never rendered
- **Fixed in:** `src/handlers/redirect.tsx`
- Returns `c.html(<NotFound />, 404)` instead of a raw JSON response.

### ✅ [MEDIUM] Missing index on `expires_at`
- **Fixed in:** `migrations/0003_add_expires_index.sql`
- `CREATE INDEX IF NOT EXISTS idx_links_expires ON links(expires_at)`

### ✅ [LOW] Missing composite indexes on analytics queries
- **Fixed in:** `migrations/0004_add_analytics_indexes.sql`
- Added `idx_analytics_link_country ON analytics(link_id, country)` and `idx_analytics_link_referer ON analytics(link_id, referer)`.

### ✅ [MEDIUM] Stats lookup doesn't handle full URLs
- **Fixed in:** `frontend/src/pages/Home.tsx`
- Users can now paste a full short URL (e.g., `https://duckshort.cc/abc123`) into the stats search box, and it will correctly extract the ID.

### ✅ [MEDIUM] Missing analytics/webhooks on password-protected links
- **Fixed in:** `src/handlers/password.tsx`
- Successful password-protected redirects now correctly fire the `webhook_url` and record analytics, matching the behavior of standard redirects.

### ✅ [LOW] Inconsistent expiration timing
- **Fixed in:** `src/handlers/redirect.tsx`, `src/handlers/preview.tsx`, `src/handlers/password.tsx`
- Switched from JS-based `new Date()` checks to SQLite's `datetime('now')` for edge-wide consistency.

### ✅ [LOW] Build failure from JSX in .ts file
- **Fixed in:** Renamed `src/handlers/redirect.ts` to `src/handlers/redirect.tsx` to correctly support JSX rendering for the themed NotFound component.

---

## Code Inconsistencies

### ✅ [LOW] CI Node.js version mismatch
- **Fixed in:** CI workflow configuration
- Both workflows now use Node 22. `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` removed.

### [LOW] Inline scripts in SSR pages
- **Files**: `src/ui/pages/Home.tsx:126`, `src/ui/pages/Admin.tsx`
- **Status**: Partially addressed — Admin.tsx secret handling fixed. Full extraction to static `.js` files remains a backlog item.
- Blocked on adding `serveStatic` configuration to `wrangler.toml`.
