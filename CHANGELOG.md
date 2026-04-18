# Changelog

All notable changes to the DuckShort project will be documented in this file.

## [1.3.0] - 2026-04-17

### Added
- **i18n for Duck Mood Labels and Quack Counter:** Extracted hardcoded static text from `DuckMoodLogo.tsx` and `QuackCounter.tsx` into i18n translation keys. `DuckMoodLogo` now uses `duckMood.dormant/active/busy/viral/degraded`; `QuackCounter` uses `quackCounter.served` with `{{count}}` interpolation. New keys added to `lang-en.json`.
- **Powered By i18n:** "Powered by Adduckivity" in `Home.tsx` footer extracted to `poweredBy` translation key.
- **Thai Translation Template:** Created `frontend/src/locales/lang-th.md` containing all static text extracted from frontend components, organized by i18n structure, ready for locale file creation when i18n system supports locale switching.
- **OG Tag Customization:** New `og_title`, `og_description`, `og_image` columns on `links` (migration `0005_og_tags.sql`). `POST /api/links` accepts these fields; `GET /preview/:id` fetches and passes them to the SSR `Preview.tsx` template. `Layout.tsx` injects `<meta property="og:*">` and `<meta name="description">` tags into the `<head>`.
- **Custom Expiration Input:** "CUSTOM" option added to the expiry dropdown in `ShortenForm.tsx`. Selecting it reveals a numeric input (hours). `Home.tsx` converts the custom hours to seconds before sending `expiresIn` to the API.
- **Stats Pagination:** `GET /api/stats/:id` now accepts an optional `?limit=N` query parameter (1–100, default 10) controlling how many top countries and referrers are returned.
- **Rate Limiter Durable Object:** `src/durableObjects/RateLimiter.ts` implements atomic per-IP rate limiting using `storage.transaction()`. Replaces the non-atomic KV read-check-write in `src/middleware/rateLimit.ts`. Binding and migration added to `wrangler.toml`.
- **Shared UTM Utility:** `src/lib/utm.ts` exports a single `injectUtm()` function used by both `redirect.tsx` and `password.tsx`, eliminating the duplicated implementation.
- **Performance Indexes:** Migration `0004_performance_indexes.sql` adds indexes on `links(created_at DESC, disabled)`, `links(tag)`, and `analytics(link_id, timestamp)`.
- **Auto-Version Footer:** Frontend footer now shows the actual `package.json` version via Vite's `define` (`__APP_VERSION__`). `lang-en.json` footer key changed from `"V1.0.0-PROTOTYPE"` to `"V{{version}}"`.
- **Extracted Frontend Components:** `Home.tsx` (formerly ~860 lines) split into `QuackCounter.tsx`, `ShortenForm.tsx`, `StatsView.tsx`, `ResultModal.tsx`, and `frontend/src/types.ts` (shared `StatsData` interface).
- **New Backend Tests:** `test/handlers/password.test.ts` (6 tests covering 404/disabled/expired/HTML form/wrong password/correct password) and `test/handlers/preview.test.ts` (5 tests covering 404/disabled/expired/destination display/OG tags).
- **i18n Keys:** Added `home.shortenForm.expiryOptions.custom` and `home.shortenForm.customExpiryPlaceholder` to `lang-en.json`.

### Fixed
- **Expiry Comparison Bug in Password & Preview Handlers:** `expires_at < datetime('now')` was a raw string comparison. JavaScript's `new Date().toISOString()` stores dates with a `T` separator (`2026-04-17T12:00:00.000Z`) while SQLite's `datetime('now')` uses a space (`2026-04-17 12:00:00`). Because `T` > ` ` in ASCII, ISO-format dates always compared as "in the future". Fixed in both `password.tsx` queries and `preview.tsx` by wrapping: `datetime(expires_at) < datetime('now')`.
- **A/B Variants Ignored on Password-Protected Links:** `verifyPasswordEntry` always redirected to `original_url`. Ported the `pickVariant()` call and `link_variants` query from `redirect.tsx` into `password.tsx`.
- **Redundant DB Query in Password Handler:** `verifyPasswordEntry` issued a second `SELECT webhook_url FROM links` that duplicated data from the first query. Merged `webhook_url` and `burn_on_read` into the initial SELECT.
- **Bulk-Delete Lacks Rate Limiting:** `POST /api/links/bulk-delete` now has the `rateLimit` middleware applied, matching all other mutating routes.
- **`password_hash` / `webhook_url` Exposed in Stats:** `src/handlers/stats.ts` used `SELECT *`, leaking sensitive columns. Replaced with an explicit column whitelist. Regression tests added to `test/handlers/stats.test.ts`.
- **`DuckMood` Unused Import:** Removed `{ type DuckMood }` from `frontend/src/__tests__/DuckMoodLogo.test.tsx` (TS error 6133).
- **`__APP_VERSION__` Not Found:** Added `declare const __APP_VERSION__: string` to `frontend/src/vite-env.d.ts`.

### Changed
- **Rate Limiting Backend:** `src/middleware/rateLimit.ts` now calls a Durable Object stub instead of doing KV read-check-write. `RATE_LIMITER` binding added to `src/types.ts` and `wrangler.toml`. Graceful fallback if binding absent.
- **`@tanstack/react-query` Removed:** Package uninstalled; `QueryClientProvider` wrapper removed from `main.tsx` and all three frontend test files.
- **`.gitignore` Expanded:** Changed `.env` + `.env.local` to `.env` + `.env.*` to cover all env variant files (`.env.production`, `.env.staging`, etc.).
- **Dead Code Deleted:** `src/ui/pages/Home.tsx` and `src/ui/pages/Admin.tsx` — SSR pages with no routes and broken asset references — deleted. `frontend/src/components/URLShortenerForm.tsx` (TSX placeholder with hardcoded strings) also deleted.

## [1.2.0] - 2026-04-16

### Added
- **Duck Mood Indicator (Feature 13):** `DuckMoodLogo` component replaces the static logo. Logo expression and status pill change based on system health — states: `DORMANT`, `ACTIVE`, `BUSY`, `VIRAL`, `ERROR`. Badge emoji animates with spring transition.
- **Quack Counter (Feature 12):** Total redirect count displayed on the home page, sourced from `GET /api/stats/global`. Detects milestone thresholds (1k, 5k, 10k … 10M) and highlights them.
- **Rate Limiting:** Per-IP throttle (20 req/hr) on link creation via `src/middleware/rateLimit.ts` backed by Cloudflare KV. Gracefully skips if `RATE_LIMIT` binding is absent.
- **Scheduled Expired Link Cleanup:** Cron trigger (`0 * * * *`) runs `cleanupExpiredLinks` which executes `DELETE … WHERE datetime(expires_at) < datetime('now')`.
- **GitHub Actions CI/CD:** Three workflows — `deploy-worker.yml` (worker only, `workflow_dispatch`), `deploy-frontend.yml` (pages only, `workflow_dispatch`), `deploy-all.yml` (both in sequence on push to `main`).
- **Worker Dynamic Root Proxy:** `GET /` now fetches `https://duckshort.pages.dev/` at request time and proxies the response, so asset filenames are always current — no more hardcoded hashes.
- **Stable Vite Asset Filenames:** Disabled Rollup content hashing; output is always `assets/index.js` and `assets/index.css`. Eliminates the need to update the Worker whenever the frontend redeploys.

### Fixed
- **Blank Page at duckshort.cc:** Root cause was duplicate `Access-Control-Allow-Origin` headers (`*, *, *`). The `_headers` file was adding CORS headers that stacked with Cloudflare Pages' automatic `*` header. Removed manual CORS entries from `_headers` — Pages handles them automatically.
- **Short Link 404s:** Worker Route `duckshort.cc/*` was not enabling `workers_dev`. Fixed by ensuring `workers_dev = true` is at the **top level** of `wrangler.toml`, not nested inside a section block.
- **ISO 8601 Expiry Comparison Bug:** JS `new Date().toISOString()` stores dates with a `T` separator (e.g. `2026-04-16T12:00:00.000Z`). SQLite `datetime('now')` uses a space separator. Lexicographic comparison always treated ISO dates as "in the future". Fixed by wrapping both sides: `datetime(expires_at) < datetime('now')` in both `redirect.tsx` and `cleanup.ts`.
- **`app.request is not a function` in Tests:** Changing the Worker export to `{ fetch, scheduled }` broke tests that called `app.request()`. Fixed all test files to use `app.fetch(new Request(url, init), env, ctx)`.
- **Wrangler v4 `--yes` Flag Removed:** CI migration step was failing with "Unknown argument: yes". Removed the flag — wrangler v4 auto-confirms in non-interactive environments.

### Changed
- **`_headers` Cleanup:** Removed the malformed `/* … */` wrapper (parsed as a route rule, not a comment). File now has two clean sections: security headers for `/*` and `Cache-Control: immutable` for `/assets/*`.
- **Worker Export Shape:** Changed from `export default app` to `export default { fetch: app.fetch, scheduled }` to support cron triggers.
- **`VITE_API_URL` in CI:** Changed from `https://duckshort.chonlaphon.workers.dev` to `https://duckshort.cc` after Worker Route took over the domain.

## [1.1.0] - 2026-04-16

### Added
- **Custom Pond Aliases (Vanity URLs):** Users can now specify a custom short ID (e.g., `/my-brand`) when creating a link. Includes duplicate collision checking.
- **Burn-on-Read (Self-Destruction):** Optional toggle for links to disable themselves immediately after the first successful redirect or password verification.
- **Themed SSR Error Pages:** Custom 404/Expired/Not Found pages with the "Neon Pond" aesthetic (Magenta/Cyan/Orbitron).
- **Scheduled Link Cleanup:** Background cron trigger (`0 * * * *`) that automatically purges expired links from D1.
- **Global Stats Refresh:** Frontend now polls global "Quack" counts and "Duck Mood" every 30 seconds.

### Changed
- **Wrangler v4 Migration:** Upgraded the worker runtime and CLI to Wrangler ^4.83.0.
- **Edge-Native Expiry:** Switched expiration checks to use SQLite's `datetime('now')` for consistent timing across all edge nodes.
- **Improved Stats Lookup:** The stats search form now extracts the ID if a full URL is pasted.
- **Frontend Theme Sync:** Unified the "Neon Pond" palette across the SPA and SSR components via CSS variables in `Layout.tsx`.

### Fixed
- **Password Analytics:** Fixed a bug where password-protected links were not firing webhooks or recording analytics.
- **JSX Build Error:** Renamed `redirect.ts` to `redirect.tsx` to fix a syntax error when rendering JSX components.
- **Rate Limit Safety:** Added a fallback check to skip rate limiting gracefully if the KV namespace is not configured.
- **Mobile Styling:** Fixed padding issues on the 404 and Home pages when the development bar is active.

## [1.0.0] - 2026-04-14

### Added
- Initial release with Hono.js + D1 + React.
- Basic link shortening and A/B rotation.
- Timing-safe admin authentication.
- Cyber-Duck "Neon Pond" visual theme.
