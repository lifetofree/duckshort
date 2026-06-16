# Issues To Fix

Full codebase audit — 44 issues across 5 categories.

---

## BUGS

### B-01. Custom ID validation mismatch between frontend and backend
- **Files:** `frontend/src/components/ShortenForm.tsx:65`, `frontend/src/pages/Admin.tsx:218`, `src/handlers/admin.ts:73`
- Frontend validates `3-50` chars: `/^[a-zA-Z0-9_-]{3,50}$/`
- Backend validates `3-20` chars: `/^[a-zA-Z0-9_-]{3,20}$/`
- A user can type a 30-char alias that passes frontend validation but gets rejected by the API.
- **Fix:** Align both to `3-20`.
- **STATUS (2026-06-16):** Already resolved. `frontend/src/lib/constants.ts` exports `CUSTOM_ID_REGEX = /^[a-zA-Z0-9_-]{3,20}$/` and `CUSTOM_ID_MAX_LENGTH = 20`; `ShortenForm.tsx` and `Admin.tsx` both import and use them. Backend regex at `src/handlers/admin.ts:73` is also `{3,20}`. Aligned.

### B-02. Admin statsLimit state race condition
- **File:** `frontend/src/pages/Admin.tsx:1560-1563`
- `setStatsLimit` is called, then `fetchLinkStats` is called immediately after — but React state hasn't updated yet, so `fetchLinkStats` uses the **old** `statsLimit` value.
- **Fix:** Pass the new limit directly: `fetchLinkStats(selectedLinkForStats!, Number(e.target.value))` and update `fetchLinkStats` to accept a limit parameter.
- **STATUS (2026-06-16):** Already resolved. The `onChange` handler at `Admin.tsx:1560-1565` already passes `newLimit` directly to `fetchLinkStats`, and `fetchLinkStats` accepts a `limit` parameter (B-07).

### B-03. Sparkline division by zero in Admin
- **File:** `frontend/src/pages/Admin.tsx:1505-1506`
- `Math.max(...link.sparkline)` returns `0` when all 7 values are `0`, causing `val / 0` → `Infinity` → bar renders with `Infinity%` height.
- **Fix:** `const peak = Math.max(...link.sparkline, 1)` (guard with minimum of 1).
- **STATUS (2026-06-16):** Already resolved. `Admin.tsx:1505` already has `const peak = Math.max(...link.sparkline, 1)`.

### B-04. Catch-all proxy caches all frontend routes for 1 hour
- **File:** `src/index.tsx:88`
- `Cache-Control: public, max-age=3600` on the catch-all proxy means stale HTML/JS can be served for up to 1 hour after a deployment. Users may see broken UI referencing old asset filenames.
- **Fix:** Use `Cache-Control: public, max-age=0, must-revalidate` or a short `max-age=60` for HTML responses only.
- **STATUS (2026-06-16):** Already resolved. `src/index.tsx:88` already branches on `isHtml` and returns `public, max-age=0, must-revalidate` for HTML responses; non-HTML inherits the upstream `Cache-Control` or falls back to a 1-hour TTL only for non-HTML content-addressed assets.

### B-05. `getLinks` doesn't return key columns
- **File:** `src/handlers/admin.ts:11`
- `SELECT id, original_url, created_at, expires_at, disabled, tag` omits `burn_on_read`, `password_hash` (presence), `webhook_url`, `utm_*`, `custom_domain`. The Admin dashboard can't display or filter by these fields.
- **Fix:** Add the missing columns to the SELECT and expose them in the response.
- **STATUS (2026-06-16):** Resolved. SELECT in `src/handlers/admin.ts:11` now includes `burn_on_read`, `has_password` (via `CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END`), `custom_domain`, `webhook_url`, `utm_source`, `utm_medium`, `utm_campaign`, `og_title`, `og_description`, `og_image`. Covered by the new test in `test/handlers/security.test.ts` (`Admin: getLinks returns extended columns (B-05)`).

### B-06. StatsView redundant client-side slice
- **File:** `frontend/src/components/StatsView.tsx:141`
- `stats.countries.slice(0, statsLimit)` is unnecessary — the backend already applies `LIMIT` in the SQL query.
- **Fix:** Remove `.slice()` or document the intent (defensive).
- **STATUS (2026-06-16):** Already resolved. The component renders `stats.countries.map(...)` directly with no `.slice()` call.

### B-07. `fetchLinkStats` called with old `statsLimit` in Admin
- **File:** `frontend/src/pages/Admin.tsx:803`
- `fetchLinkStats(link.id)` always uses the `statsLimit` state value at call time. If the user changed the dropdown and then clicks STATS, it may use the wrong limit.
- **Fix:** Accept `limit` as a parameter.
- **STATUS (2026-06-16):** Already resolved. `fetchLinkStats` is defined at `Admin.tsx:393` as `(linkId: string, limit: number = statsLimit)`. All call sites (`:577`, `:803`, `:1476`, `:1565`) pass an explicit `limit` value.

---

## SECURITY

### S-01. `verifyPassword` uses plain string comparison — timing attack
- **File:** `src/lib/auth.ts:46`
- `return computed === hash` — a standard `===` comparison, which short-circuits on first differing byte. An attacker can measure response time to progressively guess the SHA-256 hash byte-by-byte.
- **Fix:** Use `timingSafeEqual(computed, hash)` for the password verification too.

### S-02. `timingSafeEqual` leaks ADMIN_SECRET length
- **File:** `src/lib/auth.ts:5`
- `if (aBytes.length !== bBytes.length) return false` — an attacker can brute-force the *length* of the secret by observing which attempt lengths get past this check (timing difference before the constant-time comparison).
- **Fix:** Hash both inputs with a fast hash (e.g., SHA-256) before comparing so lengths are always equal, or pad both to a fixed length.

### S-03. `VITE_ADMIN_SECRET` embedded in frontend bundle
- **Files:** `frontend/src/pages/Home.tsx:12`, `frontend/src/pages/Admin.tsx:5`
- `import.meta.env.VITE_ADMIN_SECRET` is replaced at build time and shipped in the JS bundle. Anyone who inspects `assets/index.js` can read the admin secret in plaintext.
- **Fix:** Never embed the secret in the frontend. Use a session-based auth flow: POST credentials to a `/api/auth` endpoint that returns an HttpOnly cookie. Alternatively, accept that this is a single-user tool and document the risk.

### S-04. Admin auth bypass via localStorage
- **File:** `frontend/src/pages/Admin.tsx:113-118`
- `localStorage.getItem('admin_authenticated') === 'true'` — anyone can open DevTools and set this value to bypass the login screen entirely. The page then sends API requests with the embedded `VITE_ADMIN_SECRET` (see S-03), so this alone doesn't grant access, but it defeats the login UI's purpose.
- **Fix:** Remove localStorage bypass. Always require login, or use a server-issued session token stored in HttpOnly cookie.

### S-05. Admin login uses plaintext comparison
- **File:** `frontend/src/pages/Admin.tsx:90`
- `loginInput === ADMIN_SECRET` — client-side plaintext comparison. Combined with S-03, this means the secret is both in the bundle *and* compared without any hashing.
- **Fix:** Send the input to a backend `/api/auth` endpoint and validate server-side.

### S-06. No URL validation on `original_url`
- **File:** `src/handlers/admin.ts:66`
- Only checks `!body.url` — allows `javascript:alert(1)`, `data:text/html,...`, and other dangerous schemes. These could be used for XSS when the URL is displayed in the admin dashboard or preview page.
- **Fix:** Validate with `new URL(body.url)` and restrict to `http:` / `https:` schemes.

### S-07. Webhook URL SSRF risk
- **File:** `src/handlers/redirect.tsx:103`, `src/handlers/password.tsx:116`, `src/middleware/customDomain.ts:119`
- `webhook_url` is user-supplied and not validated. An attacker could set it to `http://169.254.169.254/latest/meta-data/` (AWS metadata) or an internal service. The Worker's `fetch()` will follow it.
- **Fix:** Validate webhook URL at creation time — reject private IPs, link-local, localhost. Restrict to `https:` scheme.

### S-08. CORS allows any origin
- **File:** `src/index.tsx:17-21`
- `origin: (origin) => origin ?? '*'` — any website can make cross-origin requests to the API, including authenticated admin endpoints (if the secret is leaked).
- **Fix:** Restrict to `https://duckshort.cc`, `https://duckshort.pages.dev`, and `http://localhost:*` in dev.

### S-09. Unescaped user content in SSR pages
- **Files:** `src/ui/pages/Preview.tsx:19`, `src/ui/pages/PasswordEntry.tsx:21`
- `destination` and `error` are rendered directly into HTML. If a user creates a link with `original_url` containing `<script>` tags, the Hono JSX renderer does escape by default, but `PasswordEntry` uses `style="..."` string attributes (non-JSX style syntax) where injection could occur.
- **Fix:** Audit all SSR templates to ensure Hono JSX escaping is active. Migrate string-style attributes to JSX objects.

### S-10. No rate limiting on admin auth
- The `requireAuth` function has no rate limit. An attacker can brute-force the `ADMIN_SECRET` via rapid API requests.
- **Fix:** Apply rate limiting to all authenticated endpoints, or add a dedicated auth-rate-limiter.

### S-11. SQL `LIMIT` via string interpolation in stats
- **File:** `src/handlers/stats.ts:24,27`
- `` LIMIT ${limit} `` — while `limit` is parsed as int first (`parseInt` + bounds check), this is still a bad practice that could become a vulnerability if the parsing logic changes.
- **Fix:** Use parameterized `LIMIT ?` (D1 supports this).

---

## REDUNDANT / DEAD CODE

### R-01. `pickVariant` function duplicated 3 times
- **Files:** `src/handlers/redirect.tsx:22-30`, `src/handlers/password.tsx:25-33`, `src/middleware/customDomain.ts:23-31`
- Identical function copy-pasted across 3 files.
- **Fix:** Extract to `src/lib/variants.ts` and import.

### R-02. `VariantRow` interface duplicated 3 times
- **Files:** Same as R-01.
- **Fix:** Move to a shared `src/types.ts` or the new `src/lib/variants.ts`.

### R-03. `LinkRow` interface duplicated 3 times
- **Files:** `src/handlers/redirect.tsx:6-15`, `src/handlers/password.tsx:9-18`, `src/middleware/customDomain.ts:5-16`
- **Fix:** Move to `src/types.ts`.

### R-04. Full redirect logic duplicated 3 times
- **Files:** `src/handlers/redirect.tsx`, `src/handlers/password.tsx`, `src/middleware/customDomain.ts`
- A/B variant selection, geo-redirect lookup, UTM injection, burn-on-read, webhook firing, analytics insertion — all copy-pasted.
- **Fix:** Extract into a shared `resolveDestination()` function and a shared `recordAnalytics()` function.

### R-05. Unused legacy frontend files
- `frontend/src/components/Modal.jsx` — superseded by `ResultModal.tsx`
- `frontend/src/components/Modal.css` — unused
- `frontend/src/components/URLShortenerForm.jsx` — superseded by `ShortenForm.tsx`
- `frontend/src/components/URLShortenerForm.css` — unused
- `frontend/src/components/DuckLogo.tsx` — superseded by `DuckMoodLogo.tsx`
- `frontend/src/main.jsx` — superseded by `main.tsx`
- **Fix:** Delete all 6 files.

### R-06. Unused `screens/` directory
- `frontend/src/screens/adduckivity-landing.html`
- `frontend/src/screens/adduckivity-landing.png`
- Not referenced anywhere in the codebase.
- **Fix:** Delete the entire `screens/` directory.

### R-07. Unused `src/ui/config.json`
- Not imported by any file. Superseded by the i18n system.
- **Fix:** Delete.

### R-08. Unused KV namespace binding
- **File:** `wrangler.toml:15-17`
- `RATE_LIMIT` KV namespace is bound but never used in code. Rate limiting was migrated to a Durable Object.
- **Fix:** Remove `[[kv_namespaces]]` block from `wrangler.toml` (or keep for future use but document).

### R-09. Unused npm packages
- **File:** `frontend/package.json`
- `dompurify` is listed as a dependency but never imported in any source file.
- `lucide-react` is listed but not imported in any source file.
- `autoprefixer` and `postcss` are listed but Tailwind v4 with `@tailwindcss/vite` doesn't need them.
- **Fix:** Remove unused dependencies.

### R-10. Duplicated expiry options constant
- `frontend/src/components/ShortenForm.tsx:29-36` defines `EXPIRY_OPTIONS`
- `frontend/src/pages/Admin.tsx:79-86` defines identical `EXPIRY_OPTIONS`
- **Fix:** Extract to a shared constants file.

---

## PERFORMANCE

### P-01. `getGlobalStats` does full table scan
- **File:** `src/handlers/stats.ts:62`
- `SELECT COUNT(*) FROM analytics` scans every row. With millions of analytics records, this will be slow.
- **Fix:** Maintain a counter in KV or a separate `counters` table, or cache the result with a short TTL.

### P-02. `getLinks` sparkline query is expensive
- **File:** `src/handlers/admin.ts:16-22`
- Queries all analytics rows from the last 7 days, groups by `link_id` + `day`. With many links and high traffic, this is a heavy query run on every admin page load.
- **Fix:** Add pagination to `getLinks`. Consider pre-aggregating sparkline data (e.g., daily cron job that writes to a `link_stats_daily` table).

### P-03. No pagination on `getLinks`
- **File:** `src/handlers/admin.ts:10-12`
- Returns ALL links with `ORDER BY created_at DESC` — no LIMIT. As link count grows, this becomes increasingly slow and transfers large payloads.
- **Fix:** Add cursor-based or offset pagination (`?cursor=xxx&limit=50`).

### P-04. Redirect handler makes 3 sequential DB queries
- **File:** `src/handlers/redirect.tsx:35-87`
- Link lookup → variant lookup → geo-redirect lookup. The variant and geo queries could run in parallel (`Promise.all`) since they're independent.
- **Fix:** `const [variantsResult, geoRedirect] = await Promise.all([...])`.

### P-05. Frontend polls global stats every 30s even when tab is hidden
- **File:** `frontend/src/pages/Home.tsx:53`
- `setInterval(fetchGlobalStats, 30_000)` runs even when the browser tab is in the background, wasting resources and network.
- **Fix:** Use `document.visibilityState` to pause polling when the tab is hidden, or use `requestAnimationFrame`-based throttling.

### P-06. `exportLinks` LEFT JOIN with analytics subquery
- **File:** `src/handlers/admin.ts:254-261`
- `LEFT JOIN (SELECT link_id, COUNT(*) as visits FROM analytics GROUP BY link_id)` — this subquery scans the entire analytics table every time export is called.
- **Fix:** Pre-compute visit counts or add a `visits` column on the `links` table that increments on each redirect.

### P-07. Admin.tsx sorts links client-side on every render
- **File:** `frontend/src/pages/Admin.tsx:1467`
- `.sort((a, b) => b.sparkline.reduce(...) - a.sparkline.reduce(...))` — computes `reduce` for every link on every render. With many links this is O(n) extra work per render.
- **Fix:** Memoize with `useMemo`, or sort on the backend.

### P-08. `bulkDeleteLinks` creates one prepared statement per ID
- **File:** `src/handlers/admin.ts:205-208`
- Creates N separate prepared statements for N IDs. D1 `batch()` handles this, but a single `DELETE FROM links WHERE id IN (?, ?, ...)` would be slightly more efficient.
- **Fix:** Use `IN` clause with parameterized placeholders.

### P-09. `getStats` makes 5 sequential DB queries
- **File:** `src/handlers/stats.ts:18-47`
- 4 parallel queries + 1 sequential sparkline query = 5 total. The sparkline query could be combined with the existing parallel batch.
- **Fix:** Move the sparkline query into the `Promise.all` batch.

### P-10. No caching layer for hot redirect paths
- Every `/:id` redirect hits D1. For viral links, this could be thousands of requests per second, each causing a D1 read.
- **Fix:** Cache frequently-accessed links in KV with a short TTL (e.g., 60s). Check KV first, fall back to D1, write-through to KV.

---

## REFACTOR

### F-01. Admin.tsx is 1667 lines — monolith component
- **File:** `frontend/src/pages/Admin.tsx`
- Contains login form, link table, create form, stats dashboard, link-stats detail, variant panel, geo-redirect panel — all in one file with ~20 state variables.
- **Fix:** Split into components: `AdminLogin.tsx`, `LinkTable.tsx`, `CreateLinkForm.tsx`, `LinkStatsPanel.tsx`, `VariantPanel.tsx`, `GeoRedirectPanel.tsx`, `GlobalStats.tsx`.

### F-02. Home.tsx manages too many state variables
- **File:** `frontend/src/pages/Home.tsx`
- 13 `useState` calls. State management is scattered and hard to follow.
- **Fix:** Extract into custom hooks (`useShortenForm`, `useStatsView`, `useGlobalStats`) or use `useReducer`.

### F-03. Shared redirect logic should be a single module
- As noted in R-04, redirect + analytics + webhook logic is copy-pasted across 3 handlers.
- **Fix:** Create `src/lib/redirect.ts` with:
  - `resolveDestination(linkId, originalUrl)` — handles A/B + geo
  - `recordAnalytics(linkId, country, referer, ua, webhookUrl)` — handles analytics + webhook
  - `handleBurnOnRead(linkId, burnOnRead)` — handles atomic disable

### F-04. Backend auth middleware pattern
- Every admin handler starts with the same 2 lines: `const auth = await requireAuth(...)` + `if (auth) return auth`.
- **Fix:** Create a Hono middleware that runs `requireAuth` and returns 401 if unauthorized, eliminating the boilerplate:
  ```ts
  app.use('/api/*', authMiddleware)
  ```

### F-05. Inline styles everywhere in frontend
- Nearly every element uses `style={{ ... }}` with duplicated style objects. Makes the code hard to read and maintain.
- **Fix:** Use Tailwind classes (already installed) or extract common styles into CSS classes / `styleTypes.ts` constants.

### F-06. No React error boundary
- **File:** `frontend/src/main.tsx`
- Any render error in a component will crash the entire app with a white screen.
- **Fix:** Wrap `<App />` in a React Error Boundary component that shows a fallback UI.

### F-07. `RateLimiter` DO can be simplified
- **File:** `src/durableObjects/RateLimiter.ts`
- Uses `storage.transaction()` for a simple counter + timestamp. The `count` and `resetAt` are always written together.
- **Fix:** Consider using `storage.transaction()` with `getMultiple`/`putMultiple` for atomicity, or simplify to a single JSON value.

### F-08. Inconsistent SSR styling between Layout.tsx and frontend index.css
- `src/ui/Layout.tsx` defines CSS variables with different values than `frontend/src/index.css`:
  - Layout: `--bg-primary: #0a0a0f`, `--neon-magenta: #ff00ff`
  - Frontend: `--bg-primary: #0B0E14`, `--neon-magenta: #FF0055`
- SSR interstitial pages (password, preview, 404) have a different visual appearance than the SPA.
- **Fix:** Unify the color palette. Extract shared CSS variables into a single source of truth.

---

# Audit 2026-06-16 — Re-audit of main branch

Follow-up audit after the prior 44 issues. Some prior items are still open, others were partially addressed. New findings are tagged with new IDs (S-12..15, P-11..14, F-09..13, R-11..12). Re-opened items are explicitly noted as "STILL OPEN".

---

## SECURITY (still open from prior audit)

### S-03 (STILL OPEN). `VITE_ADMIN_SECRET` embedded in frontend bundle
- **Files:** `frontend/src/pages/Home.tsx:11`, `frontend/src/pages/Admin.tsx:5`, `frontend/src/components/ShortenForm.tsx:6`
- `import.meta.env.VITE_ADMIN_SECRET` is replaced at build time and shipped in the JS bundle. After `vite build`, the value is plain text in `dist/assets/index.js`.
- **Fix:** Replace the in-bundle secret with a server-issued session. Add `POST /api/auth` that compares input to `ADMIN_SECRET` server-side and returns a short-lived, `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Remove `VITE_ADMIN_SECRET` from `frontend/.env.production` and every component.

### S-04 (STILL OPEN). Admin auth bypass via localStorage
- **File:** `frontend/src/pages/Admin.tsx:53-55`
- `localStorage.getItem('admin_authenticated')` flag combined with the embedded secret means anyone with DevTools can mark themselves "authenticated"; the API then accepts the leaked secret.
- **Fix:** Remove the localStorage flag. Use the HttpOnly session cookie from S-03. `requireAuth` only needs to check the cookie.

### S-05 (STILL OPEN). Admin login uses plaintext comparison
- **File:** `frontend/src/pages/Admin.tsx:90` (approx.)
- `loginInput === ADMIN_SECRET` — client-side plaintext comparison. With S-03 in place, the secret is both in the bundle *and* compared without any hashing.
- **Fix:** Send the input to a backend `/api/auth` endpoint and validate server-side (see S-03).

### S-10 (STILL OPEN). No rate limiting on admin auth
- `requireAuth` runs on every `/api/*` route, but `rateLimit` middleware is only wired to `POST /api/links` and `POST /api/links/bulk-delete`. An attacker can brute-force `ADMIN_SECRET` via `/api/links?limit=...` or any other authenticated endpoint.
- **Fix:** Apply `rateLimit` to every `/api/*` route (with an exception for the public `/api/stats/global`), or add a dedicated stricter auth-attempt limiter.

### S-11 (STILL OPEN). SQL `LIMIT` via string interpolation
- **File:** `src/handlers/stats.ts:24, 27`
- `LIMIT ${limit}` is safe today because `limit` is `parseInt`'d and bounded first, but the pattern is a footgun.
- **Fix:**
  ```ts
  .bind(id, limit)
  ```

### S-12 (NEW). Catch-all proxy returns 1-hour stale cache
- **File:** `src/index.tsx:88`
- `Cache-Control: public, max-age=3600` on the catch-all branch means HTML/JS responses can be served stale for up to an hour after a Pages deploy. Users keep hitting the Worker-cached HTML referencing old asset filenames and may see a broken UI.
- **Fix:** Mirror the same policy used for the explicit `/` and `/admin` routes: `public, max-age=0, must-revalidate` for HTML. Assets (content-addressed filenames) can keep their long TTL; route the asset passthrough through the same `isHtml` check.

---

## REDUNDANT / DEAD CODE (still open / new)

### R-08 (STILL OPEN). Unused `RATE_LIMIT` KV namespace binding
- **File:** `wrangler.toml:15-17`
- The `RATE_LIMIT` binding is declared but never read in code. Rate limiting was migrated to a Durable Object. Either repurpose the binding as a hot-path redirect cache (see P-14) or remove the `[[kv_namespaces]]` block.

### R-09 (STILL OPEN). Unused npm packages in `frontend/package.json`
- `dompurify` and `@types/dompurify` — listed but never imported.
- `lucide-react` — listed but never imported.
- `autoprefixer` and `postcss` — listed but Tailwind v4 with `@tailwindcss/vite` does not need them.
- Per `frontend/AGENTS.md`, `recharts`, `react-i18next`, `i18next`, `react-markdown`, `react-quill` are also installed but unwired.
- **Fix:** `cd frontend && npm uninstall <pkg>` for each. Use `npx depcheck` to find all dead deps.

### R-10 (STILL OPEN). Duplicated `EXPIRY_OPTIONS` constant
- `frontend/src/lib/constants.ts` defines `EXPIRY_OPTIONS` (good) but `frontend/src/pages/Admin.tsx` still defines an identical array locally.
- **Fix:** Import `EXPIRY_OPTIONS` from `lib/constants.ts` in Admin.tsx and delete the local copy.

### R-11 (NEW). Missing ESLint config in `frontend/`
- `frontend/package.json` defines `"lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"` but no `eslint` package is in `devDependencies` and no `.eslintrc*` / `eslint.config.js` exists. The script will fail (or use a global eslint with no config).
- **Fix:** Add `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks` to `frontend/devDependencies`, create a flat config, and verify the script runs.

### R-12 (NEW). Outdated test-config schema in `vitest.config.ts`
- `vitest.config.ts` declares `d1Databases: ['DB']` only, but recent migrations add tables and the `test/handlers/*.test.ts` suite seeds rows that may not survive a parallel run (each test creates the schema via `applyD1Migrations`).
- **Fix:** Add `compatibilityDate` / `compatibilityFlags` to `poolOptions.workers.miniflare` and confirm the tests are still passing (113/113 was the prior count). Document the per-file test isolation in `AGENTS.md`.

---

## PERFORMANCE

### P-09 (STILL OPEN). `getStats` runs 4 parallel queries + 1 sequential
- **File:** `src/handlers/stats.ts:18-47`
- The sparkline query is chained after the `Promise.all` batch even though it's independent. Wastes a round-trip.
- **Fix:** Move the sparkline query into the `Promise.all` block (it's a 5th small parameterised query).

### P-10 (STILL OPEN). No hot-path cache for viral links
- **File:** `src/handlers/redirect.tsx:14-22`
- Every `/:id` redirect is a D1 read. A single viral link can saturate D1 read quota.
- **Fix:** Add a KV write-through in `redirectLink`: `await env.RATE_LIMIT.get(id, { cacheTtl: 60 })`. Fall back to D1, then `env.RATE_LIMIT.put(id, JSON.stringify(row), { expirationTtl: 60 })`. Invalidates automatically on `updateLink` / `deleteLink` / burn-on-read. This also justifies keeping the `RATE_LIMIT` binding (resolves R-08).

### P-11 (NEW). `getGlobalStats` does full table scan
- **File:** `src/handlers/stats.ts:62`
- `SELECT COUNT(*) FROM analytics` scans every row. After a year of production traffic this scans hundreds of MB.
- **Fix:** Cache the response in KV with a 30-60s TTL, or maintain a counter in a `counters` table that's incremented in `recordAnalytics` (best-effort) and reconciled hourly by the existing cron job.

### P-12 (NEW). `getLinks` has no pagination
- **File:** `src/handlers/admin.ts:10-12`
- `SELECT … FROM links ORDER BY created_at DESC` returns every link, plus a 7-day sparkline query. Tests pass only because the test DB is empty.
- **Fix:** Cursor-based pagination: `?cursor=<created_at,id>&limit=50` with `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 51`. The `idx_links_created_disabled` index already covers this.

### P-13 (NEW). `exportLinks` joins a full-table subquery
- **File:** `src/handlers/admin.ts:254-261`
- `LEFT JOIN (SELECT link_id, COUNT(*) FROM analytics GROUP BY link_id)` scans the entire `analytics` table on every export.
- **Fix:** Same counter table as P-11, or `SUM(1)` per `link_id` and keep a `visits` column on `links` that the `recordAnalytics` insert bumps.

### P-14 (NEW). `bulkDeleteLinks` issues N prepared statements
- **File:** `src/handlers/admin.ts:205-208`
- `body.variants.map(...).map(...)` builds N `DELETE` statements. D1 `batch()` accepts this, but `DELETE FROM links WHERE id IN (?, ?, ...)` with a single statement is cheaper and easier to count (`meta.changes`).
- **Fix:** Build a single statement with N placeholders and call `.run()` once.

---

## REFACTOR

### F-01 (STILL OPEN). `Admin.tsx` is 1670 lines — monolith
- **File:** `frontend/src/pages/Admin.tsx`
- 1670 lines, ~20 `useState` hooks, mixes login, links table, create form, stats dashboard, link-stats detail, variants panel, geo-redirects panel, CSV export, search/filter, global stats, and logout.
- **Fix:** Split into `AdminLogin.tsx`, `LinksTable.tsx`, `CreateLinkForm.tsx`, `LinkStatsPanel.tsx`, `VariantsPanel.tsx` (collapsible per row), `GeoRedirectsPanel.tsx` (collapsible per row), and a small `AdminPage.tsx` shell that owns routing/tab state.

### F-02 (STILL OPEN). `Home.tsx` has 13 useState calls
- **File:** `frontend/src/pages/Home.tsx`
- State is scattered across two distinct concerns (shorten form + stats view) and one cross-cutting concern (global stats).
- **Fix:** Extract `useShortenForm`, `useStatsView`, and `useGlobalStats` custom hooks. `@tanstack/react-query` is already a dependency per `AGENTS.md` and is wired in `main.tsx` — adopt it for `useGlobalStats` and the stats view so polling + visibility-pause are encapsulated.

### F-03 (STILL OPEN). Redirect logic still copy-pasted across 3 handlers
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

### F-04 (STILL OPEN). Auth boilerplate in every admin handler
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

### F-05 (STILL OPEN). Inline `style={{ … }}` everywhere
- `Home.tsx`, `Admin.tsx`, `ShortenForm.tsx`, `StatsView.tsx`, `ResultModal.tsx` all use large inline style objects. Tailwind v4 is already installed but barely used.
- **Fix:** Promote recurring style groups (`--bg-tertiary` panels, neon-button variants, jetbrains-mono labels) into CSS classes in `frontend/src/index.css` (e.g., `.panel`, `.label-mono`). Use Tailwind utility classes where they read well.

### F-08 (PARTIALLY ADDRESSED). Inconsistent SSR styling
- The neon-magenta / bg-primary values now match between `Layout.tsx` and `frontend/src/index.css` (great), but `--bg-secondary: #12141C` (Layout) still differs from `--bg-secondary: #101520` (frontend), and `--neon-purple: #BF00FF` (Layout) vs `#bf00ff` (frontend, lowercase). Cosmetic but visible in SSR interstitials.
- **Fix:** Single source of truth for the palette. Move the `:root { … }` block into a `frontend/src/styles/theme.css`, import it from the SPA, and inline the same values in `Layout.tsx` (the SSR pages have no bundler, so a verbatim copy is acceptable).

### F-09 (NEW). Stats: `getLinks` row projection is incomplete
- **File:** `src/handlers/admin.ts:11`
- The prior audit (B-05) flagged missing `utm_*`, `webhook_url`, `og_*`. The current SELECT now adds `burn_on_read`, `has_password`, `custom_domain` (good), but still omits `utm_source/medium/campaign`, `webhook_url`, and `og_*`. The Admin dashboard renders this row directly, so those fields are invisible in Admin.
- **Fix:** Add the missing columns to the SELECT and to the JSON response.

### F-10 (NEW). `RateLimiter` DO could be one-shot
- **File:** `src/durableObjects/RateLimiter.ts`
- The DO accepts a `fetch()` with no path, increments a counter, and returns JSON. The "fake URL" `https://internal/check` in the middleware is a smell.
- **Fix:** Either use the `getSince`/`putMultiple` style, or just keep the current design but rename the endpoint to a typed RPC (e.g., `await stub.checkLimit()` via `rpc` style). Low priority — the design works.

### F-11 (NEW). `recordAnalytics` swallows webhook errors silently
- **File:** `src/lib/redirectUtils.ts:60-72`
- Webhook failures are dropped on the floor with a bare `try { … } catch { }`. This is intentional ("fire-and-forget") but makes diagnosing broken webhooks impossible.
- **Fix:** Log to console with a small rate-limit (e.g., once per 60s per link_id) so production logs are useful without flooding.

### F-12 (NEW). `resolveCustomDomain` bypasses rate limit
- **File:** `src/middleware/customDomain.ts`
- Custom-domain redirects run inside the middleware and never go through the `rateLimit` middleware (which is only on `POST /api/links` and bulk-delete). For custom-domain links, an attacker could spam redirects to inflate a link's analytics.
- **Fix:** Rate-limit the `redirectLink` path too, or weight analytics on a separate counter.

### F-13 (NEW). `bulkDeleteLinks` ignores partial failures
- **File:** `src/handlers/admin.ts:201-216`
- `D1.batch` reports per-statement results. The handler returns `success: true, deleted: ids.length` even if some DELETEs no-op'd (id didn't exist). The Admin UI may then desync from the server.
- **Fix:** Inspect `result.meta.changes` per statement (or just the aggregate) and return `{ success: true, deleted: <actual> }` and a `404` for IDs that did not exist.

---

## Suggested Implementation Order

| Step | Effort | Risk | Items |
|------|--------|------|-------|
| 1 | XS | Low | S-11 (parameterised LIMIT), S-12 (cache-control), R-10 (move `EXPIRY_OPTIONS`) |
| 2 | S  | Low | F-04 (auth middleware) — removes ~22 lines per handler |
| 3 | S  | Low | R-09 / R-11 (prune unused deps, add ESLint) |
| 4 | M  | Med | F-03 (collapse 3 redirect handlers via `loadLinkRow` + `dispatchRedirect`) |
| 5 | M  | Med | F-01 (split `Admin.tsx` into 5-6 files), F-02 (extract hooks / adopt react-query for global stats) |
| 6 | L  | Med | S-03 / S-04 / S-05 / S-10 (HttpOnly session cookie + rate-limit on auth) |
| 7 | M  | Med | P-10 / P-11 / P-12 (KV cache for hot redirects + counters + pagination) |
| 8 | S  | Low | F-08 (unify color palette), F-09 (complete `getLinks` projection), P-09 (sparkline in Promise.all) |
| 9 | S  | Low | F-13 (bulk-delete partial failures), F-11 (webhook log throttling) |
