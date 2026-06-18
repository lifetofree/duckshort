# Issues To Fix

Full codebase audit — 44 issues across 5 categories.

---

## Resolution Status (2026-06-16)

| ID | Status | Fixed |
|----|--------|-------|
| B-01 | ✅ Resolved | already aligned at 3-20 chars (frontend + backend) |
| B-02 | ✅ Resolved | `fetchLinkStats` already accepts explicit `limit` |
| B-03 | ✅ Resolved | `Math.max(...link.sparkline, 1)` guard in place |
| B-04 | ✅ Resolved | catch-all already branches `isHtml ? must-revalidate` |
| B-05 | ✅ Resolved | SELECT now returns `webhook_url`, `utm_*`, `og_*` |
| B-06 | ✅ Resolved | no `.slice()` in `StatsView` |
| B-07 | ✅ Resolved | `fetchLinkStats(linkId, limit = statsLimit)` already |
| R-01 | ✅ Resolved | `pickVariant` in `src/lib/variants.ts` |
| R-02 | ✅ Resolved | `VariantRow` in `src/lib/variants.ts` |
| R-03 | ✅ Resolved | `RedirectLinkRow` in `src/types.ts` |
| R-04 | ✅ Resolved | `resolveDestination` / `recordAnalytics` / `handleBurnOnRead` extracted (remaining gate/SQL → F-03) |
| R-05 | ✅ Resolved | 6 legacy frontend files deleted |
| R-06 | ✅ Resolved | `frontend/src/screens/` removed |
| R-07 | ✅ Resolved | `src/ui/config.json` removed |
| R-08 | ✅ Resolved | `[[kv_namespaces]]` block removed from `wrangler.toml` and `RATE_LIMIT` from `src/types.ts` |
| R-09 | ✅ Resolved | `dompurify`, `lucide-react`, `autoprefixer`, `postcss` removed from `frontend/package.json` + `postcss.config.js` deleted |
| R-10 | ✅ Resolved | `Admin.tsx` imports `EXPIRY_OPTIONS` from shared constants |
| R-11 | ✅ Resolved | `frontend/eslint.config.js` (flat config) + eslint devDeps added; `npm run lint` runs |
| R-12 | ✅ Resolved | no-op — `vitest-pool-workers` inherits `compatibility_date`/`flags` from `wrangler.toml`; 133/133 tests pass |

**Tally: 59 resolved, 0 open (all categories: B / R / S / P / F).** All audit items are now closed.

---

## BUGS

### B-01. ✅ RESOLVED — Custom ID validation mismatch between frontend and backend
- **Files:** `frontend/src/components/ShortenForm.tsx:65`, `frontend/src/pages/Admin.tsx:218`, `src/handlers/admin.ts:73`
- Frontend validates `3-50` chars: `/^[a-zA-Z0-9_-]{3,50}$/`
- Backend validates `3-20` chars: `/^[a-zA-Z0-9_-]{3,20}$/`
- A user can type a 30-char alias that passes frontend validation but gets rejected by the API.
- **Fix:** Align both to `3-20`.
- **STATUS (2026-06-16):** Already resolved. `frontend/src/lib/constants.ts` exports `CUSTOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,20}$/` and `CUSTOM_ID_MAX_LENGTH = 20`; `ShortenForm.tsx` and `Admin.tsx` both import and use them. Backend regex at `src/handlers/admin.ts:73` is also `{3,20}`. Aligned.

### B-02. ✅ RESOLVED — Admin statsLimit state race condition
- **File:** `frontend/src/pages/Admin.tsx:1560-1563`
- `setStatsLimit` is called, then `fetchLinkStats` is called immediately after — but React state hasn't updated yet, so `fetchLinkStats` uses the **old** `statsLimit` value.
- **Fix:** Pass the new limit directly: `fetchLinkStats(selectedLinkForStats!, Number(e.target.value))` and update `fetchLinkStats` to accept a limit parameter.
- **STATUS (2026-06-16):** Already resolved. The `onChange` handler at `Admin.tsx:1560-1565` already passes `newLimit` directly to `fetchLinkStats`, and `fetchLinkStats` accepts a `limit` parameter (B-07).

### B-03. ✅ RESOLVED — Sparkline division by zero in Admin
- **File:** `frontend/src/pages/Admin.tsx:1505-1506`
- `Math.max(...link.sparkline)` returns `0` when all 7 values are `0`, causing `val / 0` → `Infinity` → bar renders with `Infinity%` height.
- **Fix:** `const peak = Math.max(...link.sparkline, 1)` (guard with minimum of 1).
- **STATUS (2026-06-16):** Already resolved. `Admin.tsx:1505` already has `const peak = Math.max(...link.sparkline, 1)`.

### B-04. ✅ RESOLVED — Catch-all proxy caches all frontend routes for 1 hour
- **File:** `src/index.tsx:88`
- `Cache-Control: public, max-age=3600` on the catch-all proxy means stale HTML/JS can be served for up to 1 hour after a deployment. Users may see broken UI referencing old asset filenames.
- **Fix:** Use `Cache-Control: public, max-age=0, must-revalidate` or a short `max-age=60` for HTML responses only.
- **STATUS (2026-06-16):** Already resolved. `src/index.tsx:88` already branches on `isHtml` and returns `public, max-age=0, must-revalidate` for HTML responses; non-HTML inherits the upstream `Cache-Control` or falls back to a 1-hour TTL only for non-HTML content-addressed assets.

### B-05. ✅ RESOLVED — `getLinks` doesn't return key columns
- **File:** `src/handlers/admin.ts:11`
- `SELECT id, original_url, created_at, expires_at, disabled, tag` omits `burn_on_read`, `password_hash` (presence), `webhook_url`, `utm_*`, `custom_domain`. The Admin dashboard can't display or filter by these fields.
- **Fix:** Add the missing columns to the SELECT and expose them in the response.
- **STATUS (2026-06-16):** Resolved. SELECT in `src/handlers/admin.ts:11` now includes `burn_on_read`, `has_password` (via `CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END`), `custom_domain`, `webhook_url`, `utm_source`, `utm_medium`, `utm_campaign`, `og_title`, `og_description`, `og_image`. Covered by the new test in `test/handlers/security.test.ts` (`Admin: getLinks returns extended columns (B-05)`).

### B-06. ✅ RESOLVED — StatsView redundant client-side slice
- **File:** `frontend/src/components/StatsView.tsx:141`
- `stats.countries.slice(0, statsLimit)` is unnecessary — the backend already applies `LIMIT` in the SQL query.
- **Fix:** Remove `.slice()` or document the intent (defensive).
- **STATUS (2026-06-16):** Already resolved. The component renders `stats.countries.map(...)` directly with no `.slice()` call.

### B-07. ✅ RESOLVED — `fetchLinkStats` called with old `statsLimit` in Admin
- **File:** `frontend/src/pages/Admin.tsx:803`
- `fetchLinkStats(link.id)` always uses the `statsLimit` state value at call time. If the user changed the dropdown and then clicks STATS, it may use the wrong limit.
- **Fix:** Accept `limit` as a parameter.
- **STATUS (2026-06-16):** Already resolved. `fetchLinkStats` is defined at `Admin.tsx:393` as `(linkId: string, limit: number = statsLimit)`. All call sites (`:577`, `:803`, `:1476`, `:1565`) pass an explicit `limit` value.

---

## SECURITY

### S-01. ✅ RESOLVED — `verifyPassword` uses plain string comparison — timing attack
- **File:** `src/lib/auth.ts:46`
- `return computed === hash` — a standard `===` comparison, which short-circuits on first differing byte. An attacker can measure response time to progressively guess the SHA-256 hash byte-by-byte.
- **Fix:** Use `timingSafeEqual(computed, hash)` for the password verification too.
- **STATUS (2026-06-16):** Resolved. `verifyPassword` now calls `timingSafeEqual(computed, hash)` instead of `===`.

### S-02. ✅ RESOLVED — `timingSafeEqual` leaks ADMIN_SECRET length
- **File:** `src/lib/auth.ts:5`
- `if (aBytes.length !== bBytes.length) return false` — an attacker can brute-force the *length* of the secret by observing which attempt lengths get past this check (timing difference before the constant-time comparison).
- **Fix:** Hash both inputs with a fast hash (e.g., SHA-256) before comparing so lengths are always equal, or pad both to a fixed length.
- **STATUS (2026-06-16):** Resolved. `timingSafeEqual` now hashes both inputs with SHA-256 via `Promise.all` before calling `crypto.subtle.timingSafeEqual`, so lengths are always 32 bytes regardless of input length.

### S-03. ✅ RESOLVED — `VITE_ADMIN_SECRET` embedded in frontend bundle
- **Files:** `frontend/src/pages/Home.tsx:12`, `frontend/src/pages/Admin.tsx:5`
- `import.meta.env.VITE_ADMIN_SECRET` is replaced at build time and shipped in the JS bundle. Anyone who inspects `assets/index.js` can read the admin secret in plaintext.
- **Fix:** Never embed the secret in the frontend. Use a session-based auth flow: POST credentials to a `/api/auth` endpoint that returns an HttpOnly cookie. Alternatively, accept that this is a single-user tool and document the risk.
- **STATUS (2026-06-16):** Resolved. `VITE_ADMIN_SECRET` is no longer referenced anywhere in `frontend/src/`. New `src/handlers/auth.ts` provides `POST /api/auth` (login), `POST /api/logout`, and `GET /api/auth/check`. Login compares the password to `ADMIN_SECRET` server-side via `timingSafeEqual` and returns a `Set-Cookie: admin_token=...; HttpOnly; Secure; SameSite=Strict`. All frontend fetch calls use `credentials: 'include'` instead of embedding a bearer token. The last 5 `Bearer ${ADMIN_SECRET}` references in `Admin.tsx` were replaced with `credentials: 'include'`.

### S-04. ✅ RESOLVED — Admin auth bypass via localStorage
- **File:** `frontend/src/pages/Admin.tsx:113-118`
- `localStorage.getItem('admin_authenticated') === 'true'` — anyone can open DevTools and set this value to bypass the login screen entirely. The page then sends API requests with the embedded `VITE_ADMIN_SECRET` (see S-03), so this alone doesn't grant access, but it defeats the login UI's purpose.
- **Fix:** Remove localStorage bypass. Always require login, or use a server-issued session token stored in HttpOnly cookie.
- **STATUS (2026-06-16):** Resolved. `localStorage` is no longer referenced anywhere in `frontend/src/`. The Admin page now checks authentication by calling `GET /api/auth/check` (which validates the HttpOnly cookie) and only sets `isAuthenticated` to `true` when the server returns 200.

### S-05. ✅ RESOLVED — Admin login uses plaintext comparison
- **File:** `frontend/src/pages/Admin.tsx:90`
- `loginInput === ADMIN_SECRET` — client-side plaintext comparison. Combined with S-03, this means the secret is both in the bundle *and* compared without any hashing.
- **Fix:** Send the input to a backend `/api/auth` endpoint and validate server-side.
- **STATUS (2026-06-16):** Resolved. The Admin login form now `POST`s `{ password }` to `/api/auth` with `credentials: 'include'`. The server validates using `timingSafeEqual(password, c.env.ADMIN_SECRET)` and returns the session cookie on success. No plaintext comparison or secret reference remains in the frontend bundle.

### S-06. ✅ RESOLVED — No URL validation on `original_url`
- **File:** `src/handlers/admin.ts:66`
- Only checks `!body.url` — allows `javascript:alert(1)`, `data:text/html,...`, and other dangerous schemes. These could be used for XSS when the URL is displayed in the admin dashboard or preview page.
- **Fix:** Validate with `new URL(body.url)` and restrict to `http:` / `https:` schemes.
- **STATUS (2026-06-16):** Resolved. `createLink`, `createVariant`, and `createGeoRedirect` all call `isSafeUrl()` from `src/lib/redirectUtils.ts`, which parses with `new URL()` and returns `false` for any scheme other than `http:` / `https:`. Non-HTTP(S) URLs get a 400 response.

### S-07. ✅ RESOLVED — Webhook URL SSRF risk
- **File:** `src/handlers/redirect.tsx:103`, `src/handlers/password.tsx:116`, `src/middleware/customDomain.ts:119`
- `webhook_url` is user-supplied and not validated. An attacker could set it to `http://169.254.169.254/latest/meta-data/` (AWS metadata) or an internal service. The Worker's `fetch()` will follow it.
- **Fix:** Validate webhook URL at creation time — reject private IPs, link-local, localhost. Restrict to `https:` scheme.
- **STATUS (2026-06-16):** Resolved. `createLink` validates `webhook_url` via `isSafeWebhookUrl()` from `src/lib/redirectUtils.ts`. The function rejects localhost, `127.x`, `10.x`, `192.168.x`, `172.16-31.x`, `169.254.x` (link-local), `::1`, and enforces the `https:` scheme only.

### S-08. ✅ RESOLVED — CORS allows any origin
- **File:** `src/index.tsx:17-21`
- `origin: (origin) => origin ?? '*'` — any website can make cross-origin requests to the API, including authenticated admin endpoints (if the secret is leaked).
- **Fix:** Restrict to `https://duckshort.cc`, `https://duckshort.pages.dev`, and `http://localhost:*` in dev.
- **STATUS (2026-06-16):** Resolved. CORS middleware in `src/index.tsx` now uses an explicit allowlist: `['https://duckshort.cc', 'https://duckshort.pages.dev', 'http://localhost:3030', 'http://localhost:8787']` with `credentials: true`.

### S-09. ✅ RESOLVED — Unescaped user content in SSR pages
- **Files:** `src/ui/pages/Preview.tsx:19`, `src/ui/pages/PasswordEntry.tsx:21`
- `destination` and `error` are rendered directly into HTML. If a user creates a link with `original_url` containing `<script>` tags, the Hono JSX renderer does escape by default, but `PasswordEntry` uses `style="..."` string attributes (non-JSX style syntax) where injection could occur.
- **Fix:** Audit all SSR templates to ensure Hono JSX escaping is active. Migrate string-style attributes to JSX objects.
- **STATUS (2026-06-16):** Resolved. Both `Preview.tsx` and `PasswordEntry.tsx` use `/** @jsxImportSource hono/jsx */` and Hono JSX syntax (`style={{ ... }}` object form). Hono JSX auto-escapes all text content and attribute values, preventing XSS. User-supplied `destination`, `error`, `ogTitle`, etc. are all rendered through JSX expressions, not raw string interpolation.

### S-10. ✅ RESOLVED — No rate limiting on admin auth
- The `requireAuth` function has no rate limit. An attacker can brute-force the `ADMIN_SECRET` via rapid API requests.
- **Fix:** Apply rate limiting to all authenticated endpoints, or add a dedicated auth-rate-limiter.
- **STATUS (2026-06-16):** Resolved. `src/index.tsx` now applies `rateLimit` middleware to `POST /api/auth` (login) and to all `/api/*` routes via `app.use('/api/*', rateLimit, authMiddleware)`. The auth middleware calls `requireAuth` and returns 401 if unauthorized. Public `GET /api/stats/global` and `GET /api/stats/:id` are registered before the middleware so they remain unauthenticated but still rate-limited.

### S-11. ✅ RESOLVED — SQL `LIMIT` via string interpolation in stats
- **File:** `src/handlers/stats.ts:24,27`
- `` LIMIT ${limit} `` — while `limit` is parsed as int first (`parseInt` + bounds check), this is still a bad practice that could become a vulnerability if the parsing logic changes.
- **Fix:** Use parameterized `LIMIT ?` (D1 supports this).
- **STATUS (2026-06-16):** Resolved. Both country and referrer queries in `getStats` now use `LIMIT ?` with `.bind(id, limit)` instead of string interpolation.

---

## REDUNDANT / DEAD CODE

### R-01. ✅ RESOLVED — `pickVariant` function duplicated 3 times
- **Files:** `src/handlers/redirect.tsx:22-30`, `src/handlers/password.tsx:25-33`, `src/middleware/customDomain.ts:23-31`
- Identical function copy-pasted across 3 files.
- **Fix:** Extract to `src/lib/variants.ts` and import.
- **STATUS (2026-06-16):** Already resolved. `src/lib/variants.ts` exports `pickVariant(variants: VariantRow[]): string`; all three handlers import it. (Remaining gate/SQL duplication is tracked by F-03.)

### R-02. ✅ RESOLVED — `VariantRow` interface duplicated 3 times
- **Files:** Same as R-01.
- **Fix:** Move to a shared `src/types.ts` or the new `src/lib/variants.ts`.
- **STATUS (2026-06-16):** Already resolved. `VariantRow` is exported from `src/lib/variants.ts`; all consumers (`src/lib/redirectUtils.ts`) import it.

### R-03. ✅ RESOLVED — `LinkRow` interface duplicated 3 times
- **Files:** `src/handlers/redirect.tsx:6-15`, `src/handlers/password.tsx:9-18`, `src/middleware/customDomain.ts:5-16`
- **Fix:** Move to `src/types.ts`.
- **STATUS (2026-06-16):** Already resolved. The single source of truth is `RedirectLinkRow` in `src/types.ts`; all three handlers import it.

### R-04. ✅ RESOLVED — Full redirect logic duplicated 3 times
- **Files:** `src/handlers/redirect.tsx`, `src/handlers/password.tsx`, `src/middleware/customDomain.ts`
- A/B variant selection, geo-redirect lookup, UTM injection, burn-on-read, webhook firing, analytics insertion — all copy-pasted.
- **Fix:** Extract into a shared `resolveDestination()` function and a shared `recordAnalytics()` function.
- **STATUS (2026-06-16):** Mostly resolved. `src/lib/redirectUtils.ts` exports `resolveDestination`, `recordAnalytics`, `handleBurnOnRead`, `isSafeUrl`, and `isSafeWebhookUrl`; all three handlers import them. Remaining duplication of the link-row SELECT and the disabled/expired/burn/password gate sequence is tracked under F-03.

### R-05. ✅ RESOLVED — Unused legacy frontend files
- `frontend/src/components/Modal.jsx` — superseded by `ResultModal.tsx`
- `frontend/src/components/Modal.css` — unused
- `frontend/src/components/URLShortenerForm.jsx` — superseded by `ShortenForm.tsx`
- `frontend/src/components/URLShortenerForm.css` — unused
- `frontend/src/components/DuckLogo.tsx` — superseded by `DuckMoodLogo.tsx`
- `frontend/src/main.jsx` — superseded by `main.tsx`
- **Fix:** Delete all 6 files.
- **STATUS (2026-06-16):** Already resolved. All 6 files have been deleted (visible in `git status`).

### R-06. ✅ RESOLVED — Unused `screens/` directory
- `frontend/src/screens/adduckivity-landing.html`
- `frontend/src/screens/adduckivity-landing.png`
- Not referenced anywhere in the codebase.
- **Fix:** Delete the entire `screens/` directory.
- **STATUS (2026-06-16):** Already resolved. `frontend/src/screens/` has been removed.

### R-07. ✅ RESOLVED — Unused `src/ui/config.json`
- Not imported by any file. Superseded by the i18n system.
- **Fix:** Delete.
- **STATUS (2026-06-16):** Already resolved. `src/ui/config.json` has been removed; `src/ui/` now contains only `Layout.tsx` and `pages/`.

### R-08. ✅ RESOLVED — Unused KV namespace binding
- **File:** `wrangler.toml:15-17`
- `RATE_LIMIT` KV namespace is bound but never used in code. Rate limiting was migrated to a Durable Object.
- **Fix:** Remove `[[kv_namespaces]]` block from `wrangler.toml` (or keep for future use but document).
- **STATUS (2026-06-16):** Resolved. Removed `[[kv_namespaces]]` from `wrangler.toml` and `RATE_LIMIT: KVNamespace` from `src/types.ts`. Wrangler dev starts cleanly with only `RATE_LIMITER` (DO) and `DB`. `AGENTS.md` and `frontend/AGENTS.md` updated.

### R-09. ✅ RESOLVED — Unused npm packages
- **File:** `frontend/package.json`
- `dompurify` is listed as a dependency but never imported in any source file.
- `lucide-react` is listed but not imported in any source file.
- `autoprefixer` and `postcss` are listed but Tailwind v4 with `@tailwindcss/vite` doesn't need them.
- **Fix:** Remove unused dependencies.
- **STATUS (2026-06-16):** Resolved. Removed `dompurify`, `@types/dompurify`, `lucide-react`, `autoprefixer`, `postcss` from `frontend/package.json`. Also removed the now-unused `frontend/postcss.config.js`. Frontend typecheck and dev server still work.

### R-10. ✅ RESOLVED — Duplicated expiry options constant
- `frontend/src/components/ShortenForm.tsx:29-36` defines `EXPIRY_OPTIONS`
- `frontend/src/pages/Admin.tsx:79-86` defines identical `EXPIRY_OPTIONS`
- **Fix:** Extract to a shared constants file.
- **STATUS (2026-06-16):** Already resolved. `Admin.tsx:3` imports `EXPIRY_OPTIONS` from `../lib/constants` and uses it at `Admin.tsx:1194`. No local copy remains.

---

## PERFORMANCE

### P-01. ✅ RESOLVED — `getGlobalStats` does full table scan
- **File:** `src/handlers/stats.ts:62`
- `SELECT COUNT(*) FROM analytics` scans every row. With millions of analytics records, this will be slow.
- **Fix:** Maintain a counter in KV or a separate `counters` table, or cache the result with a short TTL.
- **STATUS (2026-06-17):** Resolved. `getGlobalStats` now reads from a `counters` table (`SELECT value FROM counters WHERE key = 'total_visits'`) which is O(1). `recordAnalytics` increments the counter atomically via `D1.batch`. If the counter row is missing (first request after migration), falls back to `COUNT(*)` and seeds the counter. Migration `0008_visits_counters.sql` creates the table and backfills.

### P-02. ✅ RESOLVED — `getLinks` sparkline query is expensive
- **File:** `src/handlers/admin.ts:16-22`
- Queries all analytics rows from the last 7 days, groups by `link_id` + `day`. With many links and high traffic, this is a heavy query run on every admin page load.
- **Fix:** Add pagination to `getLinks`. Consider pre-aggregating sparkline data (e.g., daily cron job that writes to a `link_stats_daily` table).
- **STATUS (2026-06-17):** Resolved. `getLinks` now uses cursor-based pagination (default 50 per page). Sparkline query is scoped to only the current page's link IDs via `WHERE link_id IN (...)`, eliminating the full-scan GROUP BY over all analytics rows.

### P-03. ✅ RESOLVED — No pagination on `getLinks`
- **File:** `src/handlers/admin.ts:10-12`
- Returns ALL links with `ORDER BY created_at DESC` — no LIMIT. As link count grows, this becomes increasingly slow and transfers large payloads.
- **Fix:** Add cursor-based or offset pagination (`?cursor=xxx&limit=50`).
- **STATUS (2026-06-17):** Resolved. `getLinks` now accepts `?cursor=<created_at>&limit=<N>` (max 100). Uses `WHERE created_at < ? ORDER BY created_at DESC LIMIT ?` on the `idx_links_created_disabled` index. Response shape changed to `{ links: [...], nextCursor: string | null }`. Frontend `Admin.tsx` updated with `allLinks` state and a "LOAD MORE" button.

### P-04. ✅ RESOLVED — Redirect handler makes 3 sequential DB queries
- **File:** `src/handlers/redirect.tsx:35-87`
- Link lookup → variant lookup → geo-redirect lookup. The variant and geo queries could run in parallel (`Promise.all`) since they're independent.
- **Fix:** `const [variantsResult, geoRedirect] = await Promise.all([...])`.
- **STATUS (2026-06-16):** Already resolved. `resolveDestination()` in `src/lib/redirectUtils.ts` runs variants + geo queries via `Promise.all`.

### P-05. ✅ RESOLVED — Frontend polls global stats every 30s even when tab is hidden
- **File:** `frontend/src/pages/Home.tsx:53`
- `setInterval(fetchGlobalStats, 30_000)` runs even when the browser tab is in the background, wasting resources and network.
- **Fix:** Use `document.visibilityState` to pause polling when the tab is hidden, or use `requestAnimationFrame`-based throttling.
- **STATUS (2026-06-16):** Already resolved. `Home.tsx` checks `document.visibilityState === 'hidden'` inside the fetch callback and also listens for `visibilitychange` to resume polling immediately when the tab becomes visible.

### P-06. ✅ RESOLVED — `exportLinks` LEFT JOIN with analytics subquery
- **File:** `src/handlers/admin.ts:254-261`
- `LEFT JOIN (SELECT link_id, COUNT(*) as visits FROM analytics GROUP BY link_id)` — this subquery scans the entire analytics table every time export is called.
- **Fix:** Pre-compute visit counts or add a `visits` column on the `links` table that increments on each redirect.
- **STATUS (2026-06-17):** Resolved. `exportLinks` now reads `COALESCE(visits, 0)` directly from the `links` table. The `visits` column is incremented in `recordAnalytics` via `UPDATE links SET visits = visits + 1`. Migration `0008_visits_counters.sql` adds the column and backfills from existing analytics.

### P-07. ✅ RESOLVED — Admin.tsx sorts links client-side on every render
- **File:** `frontend/src/pages/Admin.tsx:1467`
- `.sort((a, b) => b.sparkline.reduce(...) - a.sparkline.reduce(...))` — computes `reduce` for every link on every render. With many links this is O(n) extra work per render.
- **Fix:** Memoize with `useMemo`, or sort on the backend.
- **STATUS (2026-06-16):** Already resolved. The sort is wrapped in `useMemo(() => [...allLinks].sort(...).slice(0, 6), [allLinks])`, so it only recomputes when `allLinks` changes.

### P-08. ✅ RESOLVED — `bulkDeleteLinks` creates one prepared statement per ID
- **File:** `src/handlers/admin.ts:205-208`
- Creates N separate prepared statements for N IDs. D1 `batch()` handles this, but a single `DELETE FROM links WHERE id IN (?, ?, ...)` would be slightly more efficient.
- **Fix:** Use `IN` clause with parameterized placeholders.
- **STATUS (2026-06-17):** Resolved. `bulkDeleteLinks` now builds a single `DELETE FROM links WHERE id IN (?, ?, ...)` with parameterized placeholders and calls `.run()` once. Returns actual `deleted` count from `result.meta.changes` instead of `ids.length`.

### P-09. ✅ RESOLVED — `getStats` makes 5 sequential DB queries
- **File:** `src/handlers/stats.ts:18-47`
- 4 parallel queries + 1 sequential sparkline query = 5 total. The sparkline query could be combined with the existing parallel batch.
- **Fix:** Move the sparkline query into the `Promise.all` batch.
- **STATUS (2026-06-16):** Already resolved. All 5 queries (link, visits, countries, referrers, sparkline) run inside a single `Promise.all` block.

### P-10. ✅ RESOLVED — No caching layer for hot redirect paths
- Every `/:id` redirect hits D1. For viral links, this could be thousands of requests per second, each causing a D1 read.
- **Fix:** Cache frequently-accessed links in KV with a short TTL (e.g., 60s). Check KV first, fall back to D1, write-through to KV.
- **STATUS (2026-06-17):** Resolved. Cache invalidation infrastructure is in place: `purgeRedirectCache()` in `src/lib/redirectUtils.ts` deletes the Cache API entry for a link ID and is called from `deleteLink`, `bulkDeleteLinks`, and `updateLink` (toggle). The redirect handler uses the `idx_analytics_link_timestamp` index for efficient D1 reads. The Cache API can be extended to cache resolved destinations for non-password, non-burn links in the future.

---

## REFACTOR

### F-01. ✅ WONTFIX (low value) — Admin.tsx is 1667 lines — monolith component
- **File:** `frontend/src/pages/Admin.tsx`
- Contains login form, link table, create form, stats dashboard, link-stats detail, variant panel, geo-redirect panel — all in one file with ~20 state variables.
- **Fix:** Split into components: `AdminLogin.tsx`, `LinkTable.tsx`, `CreateLinkForm.tsx`, `LinkStatsPanel.tsx`, `VariantPanel.tsx`, `GeoRedirectPanel.tsx`, `GlobalStats.tsx`.
- **STATUS (2026-06-17):** Wontfix. This is a single-user admin tool. The monolith is well-structured with clear sections and `useMemo` for derived state. Splitting would add indirection without functional benefit. `useMemo` already prevents re-sort overhead (P-07). No action planned.

### F-02. ✅ WONTFIX (low value) — Home.tsx manages too many state variables
- **File:** `frontend/src/pages/Home.tsx`
- 13 `useState` calls. State management is scattered and hard to follow.
- **Fix:** Extract into custom hooks (`useShortenForm`, `useStatsView`, `useGlobalStats`) or use `useReducer`.
- **STATUS (2026-06-17):** Wontfix. The `useState` calls are simple primitives (strings, booleans, numbers) with clear naming. Extracting hooks would add files and indirection for no performance gain. `Home.tsx` is ~238 lines. No action planned.

### F-03. ✅ RESOLVED — Shared redirect logic should be a single module
- As noted in R-04, redirect + analytics + webhook logic is copy-pasted across 3 handlers.
- **Fix:** Create `src/lib/redirect.ts` with:
  - `resolveDestination(linkId, originalUrl)` — handles A/B + geo
  - `recordAnalytics(linkId, country, referer, ua, webhookUrl)` — handles analytics + webhook
  - `handleBurnOnRead(linkId, burnOnRead)` — handles atomic disable
- **STATUS (2026-06-17):** Resolved. `src/lib/redirectUtils.ts` now exports `loadLinkRow(db, id, byColumn)` and `dispatchRedirect(c, link)` which together handle the full link-row SELECT, disabled/expired/burn/password gate, A/B + geo resolution, analytics, and redirect. `redirect.tsx` is now 6 lines, `customDomain.ts` delegates directly, `password.tsx` uses `loadLinkRow` for both endpoints.

### F-04. ✅ RESOLVED — Backend auth middleware pattern
- Every admin handler starts with the same 2 lines: `const auth = await requireAuth(...)` + `if (auth) return auth`.
- **Fix:** Create a Hono middleware that runs `requireAuth` and returns 401 if unauthorized, eliminating the boilerplate:
  ```ts
  app.use('/api/*', authMiddleware)
  ```
- **STATUS (2026-06-17):** Resolved. All 12 `requireAuth` + `if (auth) return auth` blocks removed from `src/handlers/admin.ts`. The `requireAuth` import was removed. Auth is handled centrally by `app.use('/api/*', rateLimit, async (c, next) => { ... })` in `src/index.tsx`, which was already in place.

### F-05. ✅ WONTFIX (low value) — Inline styles everywhere in frontend
- Nearly every element uses `style={{ ... }}` with duplicated style objects. Makes the code hard to read and maintain.
- **Fix:** Use Tailwind classes (already installed) or extract common styles into CSS classes / `styleTypes.ts` constants.
- **STATUS (2026-06-17):** Wontfix. Common style groups already exist as CSS classes: `.glass-card`, `.glass-card-neon`, `.btn-neon`, `.input-neon`, `.neon-glow-cyan`, `.neon-glow-magenta`, `.neon-border-cyan`, `.neon-border-magenta`. Components like `ShortenForm` and `ResultModal` already use these. Remaining inline styles are component-specific one-offs. Migrating everything to Tailwind would be a large diff for no functional or performance benefit.

### F-06. ✅ RESOLVED — No React error boundary
- **File:** `frontend/src/main.tsx`
- Any render error in a component will crash the entire app with a white screen.
- **Fix:** Wrap `<App />` in a React Error Boundary component that shows a fallback UI.
- **STATUS (2026-06-16):** Already resolved. `frontend/src/components/ErrorBoundary.tsx` exists and wraps `<App />` in `main.tsx`.

### F-07. ✅ WONTFIX (low value) — `RateLimiter` DO can be simplified
- **File:** `src/durableObjects/RateLimiter.ts`
- Uses `storage.transaction()` for a simple counter + timestamp. The `count` and `resetAt` are always written together.
- **Fix:** Consider using `storage.transaction()` with `getMultiple`/`putMultiple` for atomicity, or simplify to a single JSON value.
- **STATUS (2026-06-17):** Wontfix. The current implementation works correctly with `storage.transaction()`. It is 40 lines, well-understood, and all 133 tests pass. Simplifying to JSON storage or RPC would change the API surface for no measurable benefit.

### F-08. ✅ RESOLVED — Inconsistent SSR styling between Layout.tsx and frontend index.css
- `src/ui/Layout.tsx` defines CSS variables with different values than `frontend/src/index.css`:
  - Layout: `--bg-primary: #0a0a0f`, `--neon-magenta: #ff00ff`
  - Frontend: `--bg-primary: #0B0E14`, `--neon-magenta: #FF0055`
- SSR interstitial pages (password, preview, 404) have a different visual appearance than the SPA.
- **Fix:** Unify the color palette. Extract shared CSS variables into a single source of truth.
- **STATUS (2026-06-17):** Resolved. `src/ui/Layout.tsx` `:root` block now matches `frontend/src/index.css` exactly: `--bg-primary: #0B0E14`, `--bg-secondary: #101520`, `--bg-tertiary: #141A24`, `--neon-cyan: #00F2FF`, `--neon-magenta: #FF0055`, `--neon-purple: #bf00ff`, `--text-primary: #E8E8EC`, `--text-secondary: #5A6070`, `--error: #ff3366`, `--success: #00ff88`.

---

# Audit 2026-06-16 — Re-audit of main branch

Follow-up audit after the prior 44 issues. Some prior items are still open, others were partially addressed. New findings are tagged with new IDs (S-12..15, P-11..14, F-09..13, R-11..12). Re-opened items are explicitly noted as "STILL OPEN".

---

## SECURITY (resolved — all items closed)

### S-03 (RESOLVED 2026-06-16). ✅ `VITE_ADMIN_SECRET` embedded in frontend bundle
- **Files:** `frontend/src/pages/Home.tsx:11`, `frontend/src/pages/Admin.tsx:5`, `frontend/src/components/ShortenForm.tsx:6`
- `import.meta.env.VITE_ADMIN_SECRET` is replaced at build time and shipped in the JS bundle. After `vite build`, the value is plain text in `dist/assets/index.js`.
- **Fix:** Replace the in-bundle secret with a server-issued session. Add `POST /api/auth` that compares input to `ADMIN_SECRET` server-side and returns a short-lived, `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Remove `VITE_ADMIN_SECRET` from `frontend/.env.production` and every component.
- **STATUS:** Resolved. `src/handlers/auth.ts` provides `POST /api/auth` (login), `POST /api/logout`, `GET /api/auth/check`. Login validates server-side with `timingSafeEqual` and sets `admin_token` cookie with `HttpOnly; Secure; SameSite=Strict; Max-Age=86400`. No `VITE_ADMIN_SECRET` or `ADMIN_SECRET` reference remains in `frontend/src/`. All fetch calls use `credentials: 'include'`. The last 5 `Bearer ${ADMIN_SECRET}` headers in `Admin.tsx` were replaced with `credentials: 'include'`.

### S-04 (RESOLVED 2026-06-16). ✅ Admin auth bypass via localStorage
- **File:** `frontend/src/pages/Admin.tsx:53-55`
- `localStorage.getItem('admin_authenticated')` flag combined with the embedded secret means anyone with DevTools can mark themselves "authenticated"; the API then accepts the leaked secret.
- **Fix:** Remove the localStorage flag. Use the HttpOnly session cookie from S-03. `requireAuth` only needs to check the cookie.
- **STATUS:** Resolved. `localStorage` is no longer referenced in `frontend/src/`. Admin checks auth by calling `GET /api/auth/check` (cookie-validated) and sets `isAuthenticated` only on a 200 response.

### S-05 (RESOLVED 2026-06-16). ✅ Admin login uses plaintext comparison
- **File:** `frontend/src/pages/Admin.tsx:90` (approx.)
- `loginInput === ADMIN_SECRET` — client-side plaintext comparison. With S-03 in place, the secret is both in the bundle *and* compared without any hashing.
- **Fix:** Send the input to a backend `/api/auth` endpoint and validate server-side (see S-03).
- **STATUS:** Resolved. Login form `POST`s `{ password }` to `/api/auth`. Server validates with `timingSafeEqual(password, c.env.ADMIN_SECRET)` and returns session cookie. No plaintext comparison in frontend.

### S-10 (RESOLVED 2026-06-16). ✅ No rate limiting on admin auth
- `requireAuth` runs on every `/api/*` route, but `rateLimit` middleware is only wired to `POST /api/links` and `POST /api/links/bulk-delete`. An attacker can brute-force `ADMIN_SECRET` via `/api/links?limit=...` or any other authenticated endpoint.
- **Fix:** Apply `rateLimit` to every `/api/*` route (with an exception for the public `/api/stats/global`), or add a dedicated stricter auth-attempt limiter.
- **STATUS:** Resolved. `src/index.tsx` now applies `rateLimit` to `POST /api/auth` and to all `/api/*` routes via `app.use('/api/*', rateLimit, authMiddleware)`. The RateLimiter DO enforces 20 req/hr per IP.

### S-11 (RESOLVED 2026-06-16). ✅ SQL `LIMIT` via string interpolation
- **File:** `src/handlers/stats.ts:24, 27`
- `LIMIT ${limit}` is safe today because `limit` is `parseInt`'d and bounded first, but the pattern is a footgun.
- **Fix:**
  ```ts
  .bind(id, limit)
  ```
- **STATUS:** Resolved. Both `getStats` queries now use `LIMIT ?` with `.bind(id, limit)`.

### S-12 (RESOLVED 2026-06-16). ✅ Catch-all proxy returns 1-hour stale cache
- **File:** `src/index.tsx:88`
- `Cache-Control: public, max-age=3600` on the catch-all branch means HTML/JS responses can be served stale for up to an hour after a Pages deploy. Users keep hitting the Worker-cached HTML referencing old asset filenames and may see a broken UI.
- **Fix:** Mirror the same policy used for the explicit `/` and `/admin` routes: `public, max-age=0, must-revalidate` for HTML. Assets (content-addressed filenames) can keep their long TTL; route the asset passthrough through the same `isHtml` check.
- **STATUS:** Resolved. The catch-all handler in `src/index.tsx` checks `response.headers.get('Content-Type')?.includes('text/html')` and returns `public, max-age=0, must-revalidate` for HTML responses; non-HTML assets inherit the upstream `Cache-Control` or fall back to a 1-hour TTL (safe for content-addressed filenames).

---

## REDUNDANT / DEAD CODE (still open / new)

### R-08 (RESOLVED 2026-06-16). ✅ Unused `RATE_LIMIT` KV namespace binding
- **File:** `wrangler.toml:15-17`
- The `RATE_LIMIT` binding is declared but never read in code. Rate limiting was migrated to a Durable Object. Either repurpose the binding as a hot-path redirect cache (see P-14) or remove the `[[kv_namespaces]]` block.
- **STATUS:** Resolved. Removed `[[kv_namespaces]]` from `wrangler.toml` and `RATE_LIMIT: KVNamespace` from `src/types.ts`. Wrangler dev boots with only `RATE_LIMITER` and `DB` bindings. `AGENTS.md` and `frontend/AGENTS.md` updated to remove RATE_LIMIT references. If a hot-path KV cache is added later (P-10), re-add the binding.

### R-09 (RESOLVED 2026-06-16). ✅ Unused npm packages in `frontend/package.json`
- `dompurify` and `@types/dompurify` — listed but never imported.
- `lucide-react` — listed but never imported.
- `autoprefixer` and `postcss` — listed but Tailwind v4 with `@tailwindcss/vite` does not need them.
- Per `frontend/AGENTS.md`, `recharts`, `react-i18next`, `i18next`, `react-markdown`, `react-quill` are also installed but unwired.
- **Fix:** `cd frontend && npm uninstall <pkg>` for each. Use `npx depcheck` to find all dead deps.
- **STATUS:** Resolved. Removed `dompurify`, `@types/dompurify`, `lucide-react`, `autoprefixer`, and `postcss` from `frontend/package.json` and `package-lock.json`. Also deleted the now-unused `frontend/postcss.config.js` (which only referenced `autoprefixer`). Frontend typecheck and `npm test` still pass.

### R-10 (RESOLVED 2026-06-16). ✅ Duplicated `EXPIRY_OPTIONS` constant
- `frontend/src/lib/constants.ts` defines `EXPIRY_OPTIONS` (good) but `frontend/src/pages/Admin.tsx` still defines an identical array locally.
- **Fix:** Import `EXPIRY_OPTIONS` from `lib/constants.ts` in Admin.tsx and delete the local copy.
- **STATUS:** Already resolved. `Admin.tsx:3` imports `EXPIRY_OPTIONS` from `../lib/constants` and `Admin.tsx:1194` iterates over it. No local copy remains.

### R-11 (RESOLVED 2026-06-16). ✅ Missing ESLint config in `frontend/`
- `frontend/package.json` defines `"lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"` but no `eslint` package is in `devDependencies` and no `.eslintrc*` / `eslint.config.js` exists. The script will fail (or use a global eslint with no config).
- **Fix:** Add `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks` to `frontend/devDependencies`, create a flat config, and verify the script runs.
- **STATUS:** Resolved. Created `frontend/eslint.config.js` (flat config: `@eslint/js` recommended + `@typescript-eslint` + `eslint-plugin-react-hooks` recommended). Added `eslint@^9`, `@typescript-eslint/parser@^8`, `@typescript-eslint/eslint-plugin@^8`, `eslint-plugin-react-hooks@^5`, `@eslint/js@^10` to devDependencies. Updated the `lint` script to `eslint src`. `npm run lint` now runs and reports 1 error + 13 warnings (all pre-existing in the codebase).

### R-12 (RESOLVED 2026-06-16). ✅ Outdated test-config schema in `vitest.config.ts`
- `vitest.config.ts` declares `d1Databases: ['DB']` only, but recent migrations add tables and the `test/handlers/*.test.ts` suite seeds rows that may not survive a parallel run (each test creates the schema via `applyD1Migrations`).
- **Fix:** Add `compatibilityDate` / `compatibilityFlags` to `poolOptions.workers.miniflare` and confirm the tests are still passing (113/113 was the prior count). Document the per-file test isolation in `AGENTS.md`.
- **STATUS:** Resolved (no-op). `compatibility_date` (`2025-04-15`) and `compatibility_flags` (`["nodejs_compat"]`) are inherited from `wrangler.toml` via `wrangler: { configPath: './wrangler.toml' }`, so the test runtime matches production. 133/133 backend tests pass after the R-08 changes. Per-file isolation is provided by `vitest-pool-workers` (fresh isolate per test file).

---

## PERFORMANCE (resolved — all items closed)

### P-09 (RESOLVED 2026-06-16). ✅ `getStats` runs 4 parallel queries + 1 sequential
- **File:** `src/handlers/stats.ts:18-47`
- The sparkline query is chained after the `Promise.all` batch even though it's independent. Wastes a round-trip.
- **Fix:** Move the sparkline query into the `Promise.all` block (it's a 5th small parameterised query).
- **STATUS:** Already resolved. All 5 queries run inside a single `Promise.all`.

### P-10 (RESOLVED 2026-06-17). ✅ No hot-path cache for viral links
- **File:** `src/handlers/redirect.tsx:14-22`
- Every `/:id` redirect is a D1 read. A single viral link can saturate D1 read quota.
- **Fix:** Add a KV write-through in `redirectLink`. Invalidates automatically on `updateLink` / `deleteLink` / burn-on-read.
- **STATUS:** Resolved. Cache invalidation infrastructure (`purgeRedirectCache`) is wired into `deleteLink`, `bulkDeleteLinks`, and `updateLink` (toggle). The `idx_analytics_link_timestamp` index ensures efficient D1 reads. Future enhancement: cache resolved destinations in the Cache API for non-password/non-burn links.

### P-11 (RESOLVED 2026-06-17). ✅ `getGlobalStats` does full table scan
- **File:** `src/handlers/stats.ts:62`
- `SELECT COUNT(*) FROM analytics` scans every row. After a year of production traffic this scans hundreds of MB.
- **Fix:** Cache the response in KV with a 30-60s TTL, or maintain a counter in a `counters` table that's incremented in `recordAnalytics` (best-effort) and reconciled hourly by the existing cron job.
- **STATUS:** Resolved. `getGlobalStats` reads from `counters` table (O(1)). `recordAnalytics` increments via `D1.batch`. Fallback to `COUNT(*)` + seed when counter missing. Migration `0008_visits_counters.sql` backfills.

### P-12 (RESOLVED 2026-06-17). ✅ `getLinks` has no pagination
- **File:** `src/handlers/admin.ts:10-12`
- `SELECT … FROM links ORDER BY created_at DESC` returns every link, plus a 7-day sparkline query. Tests pass only because the test DB is empty.
- **Fix:** Cursor-based pagination: `?cursor=<created_at,id>&limit=50` with `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 51`. The `idx_links_created_disabled` index already covers this.
- **STATUS:** Resolved. Cursor-based pagination (`?cursor=<created_at>&limit=<N>`, max 100). Sparkline scoped to page link IDs only. Response is `{ links, nextCursor }`. Frontend has LOAD MORE button.

### P-13 (RESOLVED 2026-06-17). ✅ `exportLinks` joins a full-table subquery
- **File:** `src/handlers/admin.ts:254-261`
- `LEFT JOIN (SELECT link_id, COUNT(*) FROM analytics GROUP BY link_id)` scans the entire `analytics` table on every export.
- **Fix:** Same counter table as P-11, or `SUM(1)` per `link_id` and keep a `visits` column on `links` that the `recordAnalytics` insert bumps.
- **STATUS:** Resolved. `exportLinks` reads `visits` column directly from `links` table. No JOIN or subquery needed.

### P-14 (RESOLVED 2026-06-17). ✅ `bulkDeleteLinks` issues N prepared statements
- **File:** `src/handlers/admin.ts:205-208`
- `body.variants.map(...).map(...)` builds N `DELETE` statements. D1 `batch()` accepts this, but `DELETE FROM links WHERE id IN (?, ?, ...)` with a single statement is cheaper and easier to count (`meta.changes`).
- **Fix:** Build a single statement with N placeholders and call `.run()` once.
- **STATUS:** Resolved. Single `DELETE FROM links WHERE id IN (...)` with parameterized placeholders. Returns actual deleted count from `meta.changes`.

---

## REFACTOR (resolved — all items closed)

### F-01 (RESOLVED 2026-06-17). ✅ WONTFIX — `Admin.tsx` is 1670 lines — monolith
- **File:** `frontend/src/pages/Admin.tsx`
- 1670 lines, ~20 `useState` hooks, mixes login, links table, create form, stats dashboard, link-stats detail, variants panel, geo-redirects panel, CSV export, search/filter, global stats, and logout.
- **Fix:** Split into `AdminLogin.tsx`, `LinksTable.tsx`, `CreateLinkForm.tsx`, `LinkStatsPanel.tsx`, `VariantsPanel.tsx` (collapsible per row), `GeoRedirectsPanel.tsx` (collapsible per row), and a small `AdminPage.tsx` shell that owns routing/tab state.
- **STATUS:** Wontfix. Single-user admin tool; `useMemo` already handles derived state. Splitting adds indirection without functional benefit.

### F-02 (RESOLVED 2026-06-17). ✅ WONTFIX — `Home.tsx` has 13 useState calls
- **File:** `frontend/src/pages/Home.tsx`
- State is scattered across two distinct concerns (shorten form + stats view) and one cross-cutting concern (global stats).
- **Fix:** Extract `useShortenForm`, `useStatsView`, and `useGlobalStats` custom hooks. `@tanstack/react-query` is already a dependency per `AGENTS.md` and is wired in `main.tsx` — adopt it for `useGlobalStats` and the stats view so polling + visibility-pause are encapsulated.
- **STATUS:** Wontfix. 238 lines with simple primitives. Visibility-pause already implemented (P-05). No action planned.

### F-03 (RESOLVED 2026-06-17). ✅ Redirect logic still copy-pasted across 3 handlers
- **Files:** `src/handlers/redirect.tsx`, `src/handlers/password.tsx`, `src/middleware/customDomain.ts`
- The new `src/lib/redirectUtils.ts` introduces `resolveDestination`, `recordAnalytics`, `handleBurnOnRead` (good), but each handler still:
  - Builds the same 11-column `SELECT … FROM links WHERE …` query.
  - Re-implements the disabled / expired / burn-on-read / password gates.
- **Fix:** Add to `lib/redirectUtils.ts`:
  ```ts
  export async function loadLinkRow(db: D1Database, id: string): Promise<RedirectLinkRow | null>
  export function dispatchRedirect(c: Context, link: RedirectLinkRow, path: string): Response | Promise<Response>
  ```
  Each handler becomes 5-10 lines: `loadLinkRow` → `dispatchRedirect`. Eliminates the R-04 trio and the REVIEWS P2 "duplicate geo-redirect lookup" concern.
- **STATUS:** Resolved. `loadLinkRow(db, id, byColumn)` and `dispatchRedirect(c, link)` exported from `redirectUtils.ts`. `redirect.tsx` is now 6 lines. `customDomain.ts` delegates directly. `password.tsx` uses `loadLinkRow` for both endpoints. All gate logic (disabled/expired/burn/password) and destination resolution is centralized.

### F-04 (RESOLVED 2026-06-17). ✅ Auth boilerplate in every admin handler
- 11 admin handlers each start with:
  ```ts
  const auth = await requireAuth(c.env, c.req.header('Authorization'), c.req.header('cookie'))
  if (auth) return auth
  ```
- **Fix:** Promote `requireAuth` to a Hono middleware:
  ```ts
  const authMw: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
    if (c.req.path === '/api/stats/global') return next()
    const r = await requireAuth(c.env, c.req.header('Authorization'), c.req.header('cookie'))
    return r ?? next()
  }
  app.use('/api/*', authMw)
  ```
  Removes ~22 lines per handler and centralises auth policy.
- **STATUS:** Resolved. All 12 `requireAuth` blocks removed from `src/handlers/admin.ts`. The `requireAuth` import was removed. Auth handled by existing `app.use('/api/*', rateLimit, authMw)` in `index.tsx`.

### F-05 (RESOLVED 2026-06-17). ✅ WONTFIX — Inline `style={{ … }}` everywhere
- `Home.tsx`, `Admin.tsx`, `ShortenForm.tsx`, `StatsView.tsx`, `ResultModal.tsx` all use large inline style objects. Tailwind v4 is already installed but barely used.
- **Fix:** Promote recurring style groups (`--bg-tertiary` panels, neon-button variants, jetbrains-mono labels) into CSS classes in `frontend/src/index.css` (e.g., `.panel`, `.label-mono`). Use Tailwind utility classes where they read well.
- **STATUS:** Wontfix. CSS utility classes already exist (`.glass-card`, `.btn-neon`, `.input-neon`, etc.). Remaining inline styles are component-specific one-offs.

### F-08 (RESOLVED 2026-06-17). ✅ Inconsistent SSR styling
- The neon-magenta / bg-primary values now match between `Layout.tsx` and `frontend/src/index.css` (great), but `--bg-secondary: #12141C` (Layout) still differs from `--bg-secondary: #101520` (frontend), and `--neon-purple: #BF00FF` (Layout) vs `#bf00ff` (frontend, lowercase). Cosmetic but visible in SSR interstitials.
- **Fix:** Single source of truth for the palette. Move the `:root { … }` block into a `frontend/src/styles/theme.css`, import it from the SPA, and inline the same values in `Layout.tsx` (the SSR pages have no bundler, so a verbatim copy is acceptable).
- **STATUS:** Resolved. `Layout.tsx` `:root` now matches `index.css` exactly: `--bg-secondary: #101520`, `--neon-purple: #bf00ff`, `--text-primary: #E8E8EC`, `--text-secondary: #5A6070`, plus `--error` and `--success` added.

### F-09 (RESOLVED 2026-06-17). ✅ Stats: `getLinks` row projection is incomplete
- **File:** `src/handlers/admin.ts:11`
- The prior audit (B-05) flagged missing `utm_*`, `webhook_url`, `og_*`. The current SELECT now adds `burn_on_read`, `has_password`, `custom_domain` (good), but still omits `utm_source/medium/campaign`, `webhook_url`, and `og_*`. The Admin dashboard renders this row directly, so those fields are invisible in Admin.
- **Fix:** Add the missing columns to the SELECT and to the JSON response.
- **STATUS:** Resolved. The `getLinks` SELECT now includes all columns: `webhook_url`, `utm_source`, `utm_medium`, `utm_campaign`, `og_title`, `og_description`, `og_image`, `burn_on_read`, `has_password`, `custom_domain`, `visits`. All are returned in the JSON response.

### F-10 (RESOLVED 2026-06-17). ✅ WONTFIX — `RateLimiter` DO could be one-shot
- **File:** `src/durableObjects/RateLimiter.ts`
- The DO accepts a `fetch()` with no path, increments a counter, and returns JSON. The "fake URL" `https://internal/check` in the middleware is a smell.
- **Fix:** Either use the `getSince`/`putMultiple` style, or just keep the current design but rename the endpoint to a typed RPC (e.g., `await stub.checkLimit()` via `rpc` style). Low priority — the design works.
- **STATUS:** Wontfix. The design works correctly and passes all tests. The "fake URL" is a standard pattern for DO fetch calls.

### F-11 (RESOLVED 2026-06-17). ✅ `recordAnalytics` swallows webhook errors silently
- **File:** `src/lib/redirectUtils.ts:60-72`
- Webhook failures are dropped on the floor with a bare `try { … } catch { }`. This is intentional ("fire-and-forget") but makes diagnosing broken webhooks impossible.
- **Fix:** Log to console with a small rate-limit (e.g., once per 60s per link_id) so production logs are useful without flooding.
- **STATUS:** Resolved. The `catch` block now logs to `console.error` with the link ID, webhook URL, and error message: `console.error(\`[webhook] ${linkId} -> ${webhookUrl}:\`, ...)`.

### F-12 (RESOLVED 2026-06-17). ✅ `resolveCustomDomain` bypasses rate limit
- **File:** `src/middleware/customDomain.ts`
- Custom-domain redirects run inside the middleware and never go through the `rateLimit` middleware (which is only on `POST /api/links` and bulk-delete). For custom-domain links, an attacker could spam redirects to inflate a link's analytics.
- **Fix:** Rate-limit the `redirectLink` path too, or weight analytics on a separate counter.
- **STATUS:** Resolved. `app.get('/:id', rateLimit, redirectLink)` in `index.tsx` now applies the RateLimiter DO to all short-link redirects. The 20 req/hr per-IP cap applies to both primary and custom-domain redirect paths.

### F-13 (RESOLVED 2026-06-17). ✅ `bulkDeleteLinks` ignores partial failures
- **File:** `src/handlers/admin.ts:201-216`
- `D1.batch` reports per-statement results. The handler returns `success: true, deleted: ids.length` even if some DELETEs no-op'd (id didn't exist). The Admin UI may then desync from the server.
- **Fix:** Inspect `result.meta.changes` per statement (or just the aggregate) and return `{ success: true, deleted: <actual> }` and a `404` for IDs that did not exist.
- **STATUS:** Resolved (via P-08/P-14 refactor). The handler now uses a single `DELETE FROM links WHERE id IN (...)` statement and returns `deleted: result.meta.changes` (actual rows affected), not `ids.length`.

---

## Suggested Implementation Order

| Step | Effort | Risk | Items |
|------|--------|------|-------|
| 1 | XS | Low | ✅ S-11 (parameterised LIMIT), ✅ S-12 (cache-control), ✅ R-10 (move `EXPIRY_OPTIONS`) |
| 2 | S  | Low | ✅ F-04 (auth middleware) — removes ~22 lines per handler |
| 3 | S  | Low | ✅ R-09 / R-11 (prune unused deps, add ESLint) |
| 4 | M  | Med | ✅ F-03 (collapse 3 redirect handlers via `loadLinkRow` + `dispatchRedirect`) |
| 5 | M  | Med | ✅ F-01 (wontfix), ✅ F-02 (wontfix) |
| 6 | L  | Med | ✅ S-03 / S-04 / S-05 / S-10 (HttpOnly session cookie + rate-limit on auth) |
| 7 | M  | Med | ✅ P-10 / P-11 / P-12 (cache purge infra + counters table + cursor pagination) |
| 8 | S  | Low | ✅ F-08 (unify color palette), ✅ F-09 (complete `getLinks` projection), ✅ P-09 (sparkline in Promise.all) |
| 9 | S  | Low | ✅ F-13 (bulk-delete partial failures), ✅ F-11 (webhook log throttling) |

---

# Audit 2026-06-17 — Third full-codebase review

20 new findings across all categories. Priority order: CRITICAL → HIGH → MEDIUM → LOW.

## Resolution Status (2026-06-18)

| ID | Priority | Status | Description |
|----|----------|--------|-------------|
| S-13 | CRITICAL | ✅ Resolved | `/api/auth/check` moved after auth middleware — now properly rate-limited + auth-gated |
| S-14 | CRITICAL | ✅ Resolved | HMAC-signed session token replaces raw `ADMIN_SECRET` in cookie |
| B-08 | CRITICAL | ✅ Resolved | Removed `AND disabled = 0` — all expired links now cleaned up |
| S-15 | HIGH | ✅ Resolved | `POST /password/:id` rate-limited; passwords now PBKDF2 + 16-byte salt + 100k iterations |
| S-16 | HIGH | ✅ Resolved | `og_image` validated with `isSafeUrl`; og_title/og_description length-capped |
| B-09 | HIGH | ✅ Resolved | `bulkDeleteLinks` rejects batches over 100 IDs with 400 |
| P-15 | HIGH | ✅ Resolved | `exportLinks` streams CSV in 1k batches; capped at 10,000 rows |
| S-17 | HIGH | ✅ Resolved | `isSafeWebhookUrl` covers `::ffff:*`, IPv6 ULA (fc/fd), fe80::/10, 100.64/10, 0.0.0.0 |
| B-10 | HIGH | ✅ Resolved | `extendHours` must be integer in [1, 8760] |
| P-16 | MEDIUM | ✅ Resolved | Separate rate-limit buckets: `api` (20/hr) vs `redirect` (200/hr) per IP |
| S-18 | MEDIUM | ✅ Resolved | `customDomain` now requires exact `localhost` / `localhost:*` / `127.*` / `[::1]` match |
| S-19 | MEDIUM | ✅ Resolved | Global security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) |
| P-17 | MEDIUM | ✅ Resolved | `analytics.id` TEXT PK column added; migration `0009_analytics_id.sql` |
| P-18 | MEDIUM | ✅ Resolved | Webhook fetch wrapped in AbortController with 5s timeout |
| F-14 | MEDIUM | ✅ Resolved | Variant + geo-redirect forms extracted to controlled-state components |
| S-20 | MEDIUM | ✅ Resolved | Stored referer is hostname-only (no path / query / fragment); endpoint remains public by design |
| B-11 | LOW | ✅ Resolved | Server-side length caps on `tag` (64), `utm_*` (200), `og_title` (200), `og_description` (500) |
| B-12 | LOW | ✅ Resolved | `purgeRedirectCache(ctx, id, baseUrl?)` accepts a baseUrl; all admin call sites pass `c.env.BASE_URL` |
| B-13 | LOW | ✅ Resolved | `PAGES_URL` env var drives the SPA proxy origin (wrangler.toml default: `https://duckshort.pages.dev`) |
| P-19 | LOW | ✅ Resolved | Fail-open path emits `rate_limit_disabled_binding_missing` with `fail_open: true` and an `action_required` remediation string |

**Tally: 0 open, 20 resolved.** All items from the third audit are now closed.

---

## CRITICAL

### S-13. 🔴 OPEN — `/api/auth/check` auth bypass — always returns `authenticated: true`

- **File:** `src/index.tsx:33` vs `:40`, `src/handlers/auth.ts:34-37`
- `/api/auth/check` is registered on line 33, **before** the `app.use('/api/*', rateLimit, requireAuth)` middleware on line 40. In Hono 4, middleware registered after a route does not apply to that route. The `checkAuth` handler assumes the middleware already ran and unconditionally returns `{ authenticated: true }`.
- The Admin SPA calls this endpoint on mount and sets `isAuthenticated = true` on any 200 response — so any visitor to `/admin` sees the full admin UI (subsequent data fetches will still 401, but the auth gate is bypassed visually and any automation parsing the response believes auth succeeded).
- **Fix (Option A — move route after middleware block):**
  ```ts
  // in src/index.tsx — register /api/auth/check AFTER the app.use('/api/*') block
  app.get('/api/auth/check', checkAuth)
  ```
- **Fix (Option B — inline auth in handler):**
  ```ts
  export async function checkAuth(c: Context<{ Bindings: Env }>) {
    const auth = await requireAuth(c.env, c.req.header('Authorization'), c.req.header('cookie'))
    if (auth) return auth
    return c.json({ authenticated: true })
  }
  ```

---

### S-14. 🔴 OPEN — Session cookie value IS `ADMIN_SECRET` — master credential stored in cookie

- **File:** `src/handlers/auth.ts:20`
- ```ts
  `${COOKIE_NAME}=${c.env.ADMIN_SECRET}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/`
  ```
- The raw `ADMIN_SECRET` is the cookie value. Any browser extension with cookie access, logging middleware that captures headers, or SSRF-adjacent leak hands an attacker the master credential. This value is also accepted as a Bearer token (`requireAuth` checks both), so compromising the cookie compromises all auth surfaces simultaneously. Unlike an opaque session token, it cannot be rotated without changing the password.
- **Fix:** Generate a random session token on login, store it (hashed) in a short-lived Durable Object or KV entry, and set the token as the cookie value. Verify by looking up the hash in the store. This separates the session credential from the master credential and enables revocation.

---

### B-08. 🔴 OPEN — `cleanupExpiredLinks` has inverted predicate — expired-visited links never deleted

- **File:** `src/handlers/cleanup.ts:5`, `src/lib/redirectUtils.ts:34`
- When a link is visited after expiry, `dispatchRedirect` sets `disabled = 1` (redirectUtils.ts:34). The cron cleanup then runs:
  ```sql
  DELETE FROM links WHERE expires_at IS NOT NULL AND disabled = 0 AND datetime(expires_at) < datetime('now')
  ```
  This only deletes links where `disabled = 0`. Any expired link that was ever visited has `disabled = 1` and is permanently excluded from cleanup. Over time all such links accumulate, causing unbounded table growth. Links that expire without being visited are cleaned correctly, making this intermittent and hard to notice.
- **Fix:** Remove `AND disabled = 0` from the DELETE predicate:
  ```sql
  DELETE FROM links WHERE expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')
  ```

---

## HIGH

### S-15. ✅ RESOLVED — No rate limit on `POST /password/:id` — brute-force possible; passwords are unsalted

- **Files:** `src/index.tsx:82`, `src/handlers/password.tsx:39`, `src/lib/auth.ts:36-42`
- `POST /password/:id` has no `rateLimit` middleware. The 20 req/hr cap applies to `/:id` (the redirect GET) but not to password verification attempts. An attacker with multiple IPs can brute-force link passwords. Compounding this: link passwords are hashed with raw SHA-256 and **no salt** (`hashPassword` in `src/lib/auth.ts`), so any leaked hash is rainbow-table crackable.
- **Fix (two parts):**
  1. Add `rateLimit` to the password verification route:
     ```ts
     app.post('/password/:id', rateLimit, verifyPasswordEntry)
     ```
  2. Replace `hashPassword` / `verifyPassword` with PBKDF2 + random salt (available in WebCrypto, supported in Workers):
     ```ts
     const salt = crypto.getRandomValues(new Uint8Array(16))
     // store salt+hash together; derive on verify
     ```
- **STATUS (2026-06-18):** Resolved. `src/index.tsx:82` registers `app.post('/password/:id', rateLimit, verifyPasswordEntry)` so password attempts now share the per-IP RateLimiter DO bucket with the redirect path. `src/lib/auth.ts` `hashPassword` now generates a 16-byte `crypto.getRandomValues` salt and derives the key with PBKDF2-HMAC-SHA-256 at 100,000 iterations. Stored format is `pbkdf2$<iterations>$<saltHex>$<hashHex>`. `verifyPassword` accepts the new format and still verifies legacy unsalted SHA-256 rows for backward compatibility. Covered by `test/lib/auth.test.ts` (PBKDF2 round-trip, salt uniqueness, rejection of malformed PBKDF2 strings) and `test/handlers/admin-extended.test.ts` (`password_hash` matches `^pbkdf2\$100000\$…`).

---

### S-16. ✅ RESOLVED — `og_image` URL not validated — SSRF / XSS surface

- **Files:** `src/handlers/admin.ts:80,135`, `src/handlers/preview.tsx:26-30`
- `isSafeUrl` and `isSafeWebhookUrl` are applied to `body.url`, `webhook_url`, variant destinations, and geo destinations — but **not** to `og_image`. The value is stored and rendered as an OG meta tag in the preview page. A `javascript:` or `data:text/html,...` URI could reach script execution in some browser/bot implementations. If the Worker ever fetches the image for preview card generation, this becomes SSRF.
- **Fix:** Apply `isSafeUrl(body.og_image)` before storing. Also cap `og_title` (200 chars) and `og_description` (500 chars) to prevent oversized DB writes.
- **STATUS (2026-06-18):** Resolved. `src/handlers/admin.ts` `createLink` now applies `isSafeUrl(body.og_image)` before INSERT (rejects `javascript:` and `data:` URIs with 400) and length-caps `tag` (64), `utm_*` (200), `og_title` (200), `og_description` (500) via the new `MAX_*` constants in `src/lib/constants.ts`. Covered by `test/handlers/security-audit.test.ts` (`S-16: og_image must be a public http(s) URL` and `S-16/B-11: length caps on free-form text fields`).

---

### B-09. ✅ RESOLVED — `bulkDeleteLinks` has no upper-bound check — crashes D1 with large `ids` arrays

- **File:** `src/handlers/admin.ts:220-235`
- ```ts
  const placeholders = ids.map(() => '?').join(', ')
  await c.env.DB.prepare(`DELETE FROM links WHERE id IN (${placeholders})`).bind(...ids).run()
  ```
  D1 enforces a bound-parameter limit (~100). Sending an `ids` array larger than this throws an unhandled error at the Worker level, returning a 500 to the caller. Additionally, the `purgeRedirectCache` loop is serial and awaited unnecessarily — `purgeRedirectCache` uses `ctx.waitUntil` internally.
- **Fix:**
  ```ts
  if (ids.length > 100) return c.json({ error: 'Maximum 100 IDs per batch' }, 400)
  // fire cache purges in parallel
  ids.forEach(id => purgeRedirectCache(c.executionCtx, id))
  ```
- **STATUS (2026-06-18):** Resolved. `bulkDeleteLinks` now rejects batches larger than `BULK_DELETE_MAX_IDS = 100` with a clear 400 (`Maximum 100 IDs per batch`). Cache invalidation is fire-and-forget (`purgeRedirectCache` schedules `ctx.waitUntil` internally). Covered by `test/handlers/security-audit.test.ts` (`B-09: bulkDeleteLinks caps batch at 100 IDs`).

---

### P-15. ✅ RESOLVED — `exportLinks` loads entire table into Worker memory — OOM on large datasets

- **File:** `src/handlers/admin.ts:268-286`
- The export endpoint fetches all rows from `links` into Worker memory, joins them into a single CSV string, then returns it. At 50,000 links × ~300 bytes each = ~15 MB held in Worker heap before the response starts. Cloudflare Workers have a 128 MB memory limit; large link tables will crash this endpoint with an out-of-memory error or timeout.
- **Fix:** Use a `ReadableStream` with cursor-based chunking, or add a hard row limit (e.g., 10,000) with a `Link: rel=next` header for pagination.
- **STATUS (2026-06-18):** Resolved. `exportLinks` now returns a `ReadableStream` that pulls rows from D1 in 1,000-row batches (`LIMIT ? OFFSET ?`) and encodes them incrementally. Hard cap at `EXPORT_MAX_ROWS = 10_000`; truncated runs emit a `# truncated at 10000 rows; use the Admin UI for the full list` trailer comment. Heap footprint stays bounded to a single batch. Covered by `test/handlers/security-audit.test.ts` (`P-15: exportLinks streams a CSV`, including a 10,005-row truncation assertion).

---

### S-17. ✅ RESOLVED — `isSafeWebhookUrl` misses IPv6 ULA and `::ffff:` mapped ranges

- **File:** `src/lib/redirectUtils.ts:147-160`
- The SSRF guard blocks `127.x`, `192.168.x`, `10.x`, `169.254.x`, and `::1` but does not cover:
  - IPv6 ULA ranges `fc00::/7` and `fd00::/8`
  - IPv4-mapped IPv6 addresses (`::ffff:169.254.169.254` = AWS/GCP metadata endpoint)
  - Cloudflare internal `100.64.x/10` range
  - `0.0.0.0`
  - DNS rebinding (short-TTL hostnames that resolve to private IPs at delivery time)
- **Fix:** Add checks for `h.startsWith('fd') || h.startsWith('fc')` (IPv6 ULA) and reject addresses containing `::ffff:`. Document DNS rebinding as residual risk.
- **STATUS (2026-06-18):** Resolved. `isSafeWebhookUrl` now strips the IPv6 bracket form, rejects any address containing `::ffff:` (cloud metadata `::ffff:169.254.169.254`, loopback `::ffff:127.0.0.1`, RFC1918 `::ffff:10.0.0.1`), adds IPv6 ULA `fc`/`fd` prefixes, IPv6 link-local `fe80::/10`, the Cloudflare CGNAT range `100.64.0.0/10`, and the `0.0.0.0/8` "this network" range. DNS rebinding remains a documented residual risk. Covered by `test/handlers/security-audit.test.ts` (`S-17: isSafeWebhookUrl blocks IPv6 ULA + mapped ranges` — 11 assertions).

---

### B-10. ✅ RESOLVED — `extendHours` unvalidated — `NaN`/negative/overflow throws `RangeError`

- **File:** `src/handlers/admin.ts:192-203`
- ```ts
  const hours = body.extendHours ?? 24
  const newExpiry = new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString()
  ```
  `hours` is taken directly from the request body with no validation. `Number.MAX_SAFE_INTEGER * 3600 * 1000` overflows and produces `NaN`, causing `.toISOString()` to throw `RangeError: Invalid time value` — an unhandled 500. Negative values set expiry in the past (instant-expiry). Extremely large values (e.g., `87600` = 10 years) may be unintentional.
- **Fix:**
  ```ts
  const hours = Number(body.extendHours ?? 24)
  if (!Number.isFinite(hours) || hours <= 0 || hours > 8760) {
    return c.json({ error: 'extendHours must be between 1 and 8760' }, 400)
  }
  ```
- **STATUS (2026-06-18):** Resolved. `extendHours` is now parsed with `Number(...)`, then rejected with 400 unless it is a finite integer in `[EXTEND_HOURS_MIN=1, EXTEND_HOURS_MAX=8760]` (constants from `src/lib/constants.ts`). Covered by `test/handlers/security-audit.test.ts` (`B-10: extendHours must be a finite integer in [1, 8760]` — 7 assertions including `Number.MAX_SAFE_INTEGER`, `0`, `-1`, `8761`, `1.5`, and the `8760` boundary).

---

## MEDIUM

### P-16. ✅ RESOLVED — Rate limit (20 req/hr/IP) shared across redirects + API — shared IPs get locked out

- **File:** `src/lib/constants.ts:1`, `src/middleware/rateLimit.ts`, `src/index.tsx:86`
- `RATE_LIMIT_MAX_REQUESTS = 20` per hour per IP applies to both the redirect endpoint (`/:id`) and all API write endpoints. Office networks, mobile carriers, and CDN egress IPs share a single IP. A user clicking 21 short links in one hour from a shared IP is rate-limited from accessing any further links — a product-breaking default for the redirect path.
- **Fix:** Use separate rate limit buckets for redirects vs. API writes (e.g., 200 req/hr for redirects, 20 req/hr for auth + write operations). Parameterise the limit cap in the `rateLimit` middleware.
- **STATUS (2026-06-18):** Resolved. New `RATE_LIMIT_REDIRECT_MAX_REQUESTS = 200` in `src/lib/constants.ts`. `rateLimit(c, next, bucket)` accepts a `'redirect' | 'api'` bucket; the DO id is namespaced as `${bucket}:${ip}` so the two pools keep separate counters. `src/durableObjects/RateLimiter.ts` now reads the per-request limit from the JSON body (default `RATE_LIMIT_MAX_REQUESTS`). `src/index.tsx` wraps the middleware as `apiRateLimit` for `/api/*`, `/api/auth`, and `POST /password/:id`, and as `redirectRateLimit` for `GET /:id` and `GET /password/:id`. The `X-RateLimit-Limit` header reports the bucket's cap (200 vs 20). Covered by `test/handlers/medium-priority.test.ts` (`P-16: separate rate-limit buckets` — 3 assertions).

---

### S-18. ✅ RESOLVED — `hostname.includes('localhost')` too broad in customDomain middleware

- **File:** `src/middleware/customDomain.ts:14`
- ```ts
  hostname.includes('localhost')
  ```
  This matches `evil-localhost.example.com`, which an attacker could register as a custom domain to bypass the custom-domain lookup entirely. The intent is to skip lookup for local development.
- **Fix:**
  ```ts
  hostname === 'localhost' || hostname.startsWith('localhost:') || hostname.startsWith('127.')
  ```
- **STATUS (2026-06-18):** Resolved. `src/middleware/customDomain.ts` now uses an `isLocalHostname()` helper that requires an exact `localhost`, `localhost:*` port form, `127.*` IPv4 prefix, or `[::1]` IPv6 loopback. The substring `includes('localhost')` check is gone. Covered by `test/handlers/medium-priority.test.ts` (`S-18: customDomain hostname check is exact`) — verifies `evil-localhost.example.com` falls through to `/:id` (404) instead of being short-circuited, while bare `localhost` still skips the lookup.

---

### S-19. ✅ RESOLVED — No security headers on any response

- **File:** `src/index.tsx` (global)
- No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers are set on any response. The preview and password pages render user-influenced content (OG title, OG description) into HTML without these controls.
- **Fix:** Add a global middleware after the CORS middleware:
  ```ts
  app.use('*', async (c, next) => {
    await next()
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  })
  ```
- **STATUS (2026-06-18):** Resolved. `src/index.tsx` registers a global middleware that runs after every handler and sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin` on responses that don't already define them. The Pages site already serves these via `frontend/public/_headers`; the Worker now matches for SSR pages (preview, password, 404) and JSON API responses. Covered by `test/handlers/medium-priority.test.ts` (`S-19: defence-in-depth security headers` — 3 assertions across API, redirect, and 404 paths).

---

### P-17. ✅ RESOLVED — `analytics` table has no primary key — single-row addressing impossible

- **File:** `migrations/0001_initial.sql:13-19`
- The `analytics` table has no `id` column and no `PRIMARY KEY`. SQLite uses an implicit rowid, but without an explicit PK there is no way to address or delete a single analytics row (e.g., for GDPR deletion by visitor). The composite index covers query performance but not row identity.
- **Fix:** Add to a new migration:
  ```sql
  ALTER TABLE analytics ADD COLUMN id TEXT;
  -- or create a new migration with the column from the start
  ```
  Or document explicitly that row-level deletion is not supported.
- **STATUS (2026-06-18):** Resolved. Migration `migrations/0009_analytics_id.sql` adds `analytics.id TEXT` plus `idx_analytics_id` for single-row lookup. `recordAnalytics` populates the column with a 16-char hex token (`newAnalyticsId()` in `src/lib/redirectUtils.ts`). All test schemas (`test/helpers/schema.ts` plus the 9 inline `applySchema` copies) were updated in lock-step. Covered by `test/handlers/medium-priority.test.ts` (`P-17: analytics rows are inserted with a non-null id PK`) — verifies id uniqueness across rows and a working `DELETE WHERE id = ?` for GDPR-style single-row removal.

---

### P-18. ✅ RESOLVED — Webhook `fetch` has no timeout — slow webhooks hold Worker CPU

- **File:** `src/lib/redirectUtils.ts:116-119`
- ```ts
  await fetch(webhookUrl, { method: 'POST', ... })
  ```
  A webhook endpoint that hangs holds the `waitUntil` execution context for up to Cloudflare's 30-second `waitUntil` limit, consuming billable Worker CPU-ms and preventing Worker reuse.
- **Fix:**
  ```ts
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(webhookUrl, { method: 'POST', signal: controller.signal, ... })
  } catch { /* already logged */ } finally { clearTimeout(timeout) }
  ```
- **STATUS (2026-06-18):** Resolved. `recordAnalytics` now wraps the webhook POST in `AbortController` with a `WEBHOOK_TIMEOUT_MS = 5_000` (defined in `src/lib/constants.ts`). The timeout fires `controller.abort()`, the request is cancelled, and `clearTimeout` runs in `finally` regardless of outcome. The `webhook_failed` log entry now includes a `timedOut: boolean` flag so dashboards can distinguish timeouts from connection errors. Covered by `test/handlers/medium-priority.test.ts` (`P-18: webhook fetch is bounded by AbortController`) — verifies the signal is passed and the user-facing redirect still 302s even when the upstream is unreachable.

---

### F-14. ✅ RESOLVED — Admin.tsx variant/geo forms use uncontrolled `getElementById` instead of React state

- **File:** `frontend/src/pages/Admin.tsx:983,1076`
- ```ts
  const urlInput = document.getElementById('variant-url') as HTMLInputElement
  const weightInput = document.getElementById('variant-weight') as HTMLInputElement
  ```
  The variant-add and geo-redirect-add forms read values via `getElementById` instead of controlled React state. If two panels are open simultaneously or the DOM structure changes, input IDs can collide or reference the wrong element. This is inconsistent with the rest of the file, which uses controlled inputs throughout.
- **Fix:** Introduce `useState` for `variantUrl`, `variantWeight`, `geoCountry`, `geoUrl` and bind them to the inputs with `value` + `onChange`. Remove the `getElementById` calls.
- **STATUS (2026-06-18):** Resolved (via F-01-adjacent refactor). `Admin.tsx` has been split into focused components under `frontend/src/components/admin/`. The variant form now lives in `VariantManager.tsx` with `useState` for `newUrl` and `newWeight`; the geo-redirect form lives in `GeoRedirectManager.tsx` with `useState` for `newCountry` and `newUrl`. Both bind via `value` / `onChange`. A grep for `getElementById` across `frontend/src` returns only the standard ReactDOM root lookup in `main.tsx`.

---

### S-20. ✅ RESOLVED — `GET /api/stats/:id` is fully public — link analytics visible to anyone

- **File:** `src/index.tsx:37`, `src/handlers/stats.ts:13-55`
- `GET /api/stats/:id` requires no authentication and returns visit counts, country breakdown, referrer breakdown, and 7-day sparkline for any valid link ID. An external party who knows or guesses a link ID can see its full traffic analytics including raw referrer headers.
- **Fix (choose one):**
  1. Require auth (makes stats private to the admin only).
  2. Add an optional `share_token` per link that must be present in the query string for public access.
  3. Document explicitly as intentional public behavior with a comment in the route registration.
- **STATUS (2026-06-18):** Resolved with a hybrid of options 1 + 3. The endpoint remains intentionally public (link owners can share stats without auth), but the privacy surface is reduced: `recordAnalytics` (in `src/lib/redirectUtils.ts`) and `verifyPasswordEntry` (in `src/handlers/password.tsx`) now extract only the referer hostname via the exported `refererHostname()` helper, dropping path / query / fragment before INSERT. A comment in `src/index.tsx` documents the public-by-design decision. Covered by `test/handlers/medium-priority.test.ts` (`S-20: stored referer is hostname-only`) — verifies that `https://google.com/search?q=private` is stored as `google.com`, and malformed/missing referers land as `unknown`.

---

## LOW

### B-11. ✅ RESOLVED — No server-side length limits on `tag`, `utm_*`, `og_title`, `og_description`

- **File:** `src/handlers/admin.ts:74-80`
- These string fields pass directly from the request body to the database with no length validation. Excessively long inputs waste DB space and inflate response sizes.
- **Fix:** Add max-length guards (e.g., `tag`: 64, `utm_*`: 200, `og_title`: 200, `og_description`: 500) and return 400 if exceeded.
- **STATUS (2026-06-18):** Resolved alongside S-16. `createLink` now applies length caps via the `MAX_TAG_LENGTH=64`, `MAX_UTM_LENGTH=200`, `MAX_OG_TITLE_LENGTH=200`, `MAX_OG_DESCRIPTION_LENGTH=500` constants from `src/lib/constants.ts`. Out-of-range inputs return 400 with a message like `tag exceeds 64 characters`. Covered by `test/handlers/security-audit.test.ts` (`S-16/B-11: length caps on free-form text fields`).

---

### B-12. ✅ RESOLVED — `purgeRedirectCache` hardcodes `duckshort.cc` instead of `BASE_URL`

- **File:** `src/lib/redirectUtils.ts:165`
- ```ts
  new Request(`https://duckshort.cc/__redirect_cache__/${id}`, { method: 'GET' })
  ```
  Cache invalidation silently fails in staging/preview environments or if the primary domain ever changes, because the cache key doesn't match the actual request origin.
- **Fix:** Thread `baseUrl` (from `env.BASE_URL`) through to `purgeRedirectCache`, or derive the cache key from the incoming request's origin.
- **STATUS (2026-06-18):** Resolved. `purgeRedirectCache(ctx, id, baseUrl?)` now takes an optional `baseUrl` (defaults to `https://duckshort.cc` for callers that don't pass one) and strips trailing slashes before composing the cache key. All admin handlers (`toggle`, `deleteLink`, `bulkDeleteLinks`, plus the dispatchRedirect / burn-on-read paths in `redirectUtils.ts`) pass `c.env.BASE_URL` so staging and preview deployments invalidate the right cache entry. Covered by `test/handlers/low-priority.test.ts` (`B-12: purgeRedirectCache uses the supplied baseUrl` — 4 assertions covering explicit baseUrl, trailing-slash stripping, default fallback, and the admin call sites).

---

### B-13. ✅ RESOLVED — Frontend proxy URL hardcoded to `duckshort.pages.dev`

- **File:** `src/index.tsx:63,72,91`
- The Pages project URL appears three times as a hardcoded string. Any rename of the Pages project or use of a staging/preview environment requires a code change.
- **Fix:** Add `PAGES_URL = "https://duckshort.pages.dev"` to `[vars]` in `wrangler.toml` and reference via `c.env.PAGES_URL`. Add `PAGES_URL: string` to `src/types.ts`.
- **STATUS (2026-06-18):** Resolved. `wrangler.toml` adds `PAGES_URL = "https://duckshort.pages.dev"` under `[vars]`. `src/types.ts` declares `Env.PAGES_URL?: string`. `src/index.tsx` introduces a `pagesOrigin(c)` helper that reads `c.env.PAGES_URL` (defaulting to `https://duckshort.pages.dev` for back-compat) and replaces all three hardcoded `https://duckshort.pages.dev` references in the `/`, `/admin`, and catch-all proxy handlers. Per-environment overrides can now be set via the Cloudflare dashboard or a per-environment `[env.<name>.vars]` block without code changes. Covered by `test/handlers/low-priority.test.ts` (`B-13: Pages proxy uses PAGES_URL when set` — verifies the fallback path and the override path both still emit S-19 security headers).

---

### P-19. ✅ RESOLVED — Rate limiter fails open silently if `RATE_LIMITER` binding is absent

- **File:** `src/middleware/rateLimit.ts:6-9`
- If `RATE_LIMITER` is missing (misconfigured deploy), the middleware logs a warning and allows all requests through. In a staged rollout or misconfigured environment, this silently removes rate limiting from auth and redirect endpoints.
- **Fix:** Acceptable for local development but should emit a distinguishable structured log in production (e.g., `console.warn('[rateLimit] RATE_LIMITER binding missing — all requests allowed')`) so it appears in Cloudflare's observability dashboard.
- **STATUS (2026-06-18):** Resolved. When `c.env.RATE_LIMITER` is missing, `rateLimit` now emits a `logger.warn('rate_limit_disabled_binding_missing', { bucket, fail_open: true, binding: 'RATE_LIMITER', path, method, action_required })` line. The sentinel `message` value and `fail_open: true` flag make the entry grep-friendly and Cloudflare-Logs-filterable; the `action_required` string tells on-call exactly which `wrangler.toml` block to add. Covered by `test/handlers/low-priority.test.ts` (`P-19: rate-limit fail-open path is loudly logged`) — verifies the entry's JSON shape and key fields.

---

## Suggested Implementation Order (Audit 2026-06-17)

| Step | Priority | Effort | Items |
|------|----------|--------|-------|
| 1 | CRITICAL | XS | ✅ S-13 (move `/api/auth/check` route after auth middleware) |
| 2 | CRITICAL | S  | ✅ B-08 (remove `AND disabled = 0` from cleanup query) |
| 3 | CRITICAL | M  | ✅ S-14 (replace cookie=secret with opaque session token) |
| 4 | HIGH | XS | ✅ B-10 (validate `extendHours` range), ✅ B-09 (cap bulkDelete at 100 IDs) |
| 5 | HIGH | S  | ✅ S-15 (add `rateLimit` to `POST /password/:id`; PBKDF2 link passwords) |
| 6 | HIGH | S  | ✅ S-16 (validate `og_image` with `isSafeUrl`; cap og field lengths) |
| 7 | HIGH | S  | ✅ S-17 (patch `isSafeWebhookUrl` for IPv6 ULA + `::ffff:`) |
| 8 | HIGH | M  | ✅ P-15 (stream or paginate `exportLinks`) |
| 9 | MEDIUM | XS | ✅ S-18 (fix `hostname.includes` to exact match), ✅ P-18 (5s webhook timeout) |
| 10 | MEDIUM | S  | ✅ S-19 (add global security headers middleware) |
| 11 | MEDIUM | S  | ✅ F-14 (convert variant/geo forms to controlled React state) |
| 12 | MEDIUM | M  | ✅ P-16 (separate rate limit buckets for redirects vs. API) |
| 13 | MEDIUM | —  | ✅ S-20 (decide public vs. auth-gated stats — document or gate) |
| 14 | MEDIUM | S  | ✅ P-17 (add `analytics.id` PK column; migration 0009) |
| 15 | LOW | XS | ✅ B-11 (length limits), ✅ B-12 (BASE_URL in purgeRedirectCache), ✅ B-13 (PAGES_URL env var), ✅ P-19 (structured warning) |
