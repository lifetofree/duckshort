# DuckShort — Improvement Plan

Generated 2026-06-18 by a full-codebase review of `develop` (post-3rd audit, all 64 audit items closed). The plan captures the **next wave** of improvements beyond the audit backlog. Each item lists the problem, the proposed change, effort, and risk.

## Executive Summary

| Area | Health | Top Priority |
|------|--------|--------------|
| Security | Strong (auth, SSRF, rate limit, PBKDF2, headers all in place) | Session token rotation, CSP, observability for failed auth |
| Performance | Good (counters, pagination, hot-path cache hooks) | Actual KV cache implementation, D1 read reduction, bundle size |
| Reliability | Adequate | Retry/back-off for webhook, error boundaries, observability for SPA |
| Code Quality | Good (Admin monolith split, shared `redirectUtils`) | Consolidate `DIST_*` constants, type-safe env, refactor remaining duplication |
| Testing | 133+ tests across 17 files, strong coverage | Add integration tests for the Worker entry, frontend E2E, property-based tests |
| Operations | 3 CI workflows, 9 migrations, env-driven config | Backups runbook, staging environment, dependency update bot |

The project is in solid shape. The recommendations below are "good-to-great" improvements, not bug fixes.

---

## 1. Security Hardening (medium priority)

### 1.1 Add Content-Security-Policy header

**Problem:** The global security-header middleware (S-19) sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`, but no CSP. SSR pages (`/preview/:id`, `/password/:id`, `/404`) and the SPA itself are missing a defense-in-depth layer against XSS even though Hono JSX auto-escapes.

**Proposed change:** Add a CSP middleware after S-19:

```ts
app.use('*', async (c, next) => {
  await next()
  if (!c.res.headers.get('Content-Security-Policy')) {
    c.res.headers.set('Content-Security-Policy',
      "default-src 'self'; img-src 'self' https: data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'"
    )
  }
})
```

Relax `script-src` for the SPA's Vite-injected chunks (`'self'` is fine because Vite emits hashed filenames), and `'unsafe-inline'` for styles is only needed if Tailwind emits inline styles. Verify by viewing a deployed page and tightening iteratively.

**Effort:** S  ·  **Risk:** Med (CSP breakage shows up as a white screen)

### 1.2 Rotate `ADMIN_SECRET` independently from session secrets

**Problem:** `ADMIN_SECRET` doubles as the HMAC key for session tokens. Rotating it logs out every active session and forces an operator to manually update both Cloudflare and the browser cookie.

**Proposed change:** Add a second secret `SESSION_SECRET` (32 random bytes, `wrangler secret put SESSION_SECRET`). Use `SESSION_SECRET` to sign session tokens and keep `ADMIN_SECRET` only for the Bearer path. Rotate `SESSION_SECRET` independently.

**Effort:** S  ·  **Risk:** Low (additive)

### 1.3 Failed-auth log enrichment

**Problem:** `requireAuth` returns 401 silently. There is no signal in `logger.*` for failed attempts, IP, path, or reason (missing header vs. bad bearer vs. expired session).

**Proposed change:** Inside `requireAuth`, emit a `logger.warn('auth_failed', { ip, path, reason })` line. Add a Cloudflare Logpush alert on `event=auth_failed` rate > 10/min from a single IP to detect brute force.

**Effort:** S  ·  **Risk:** Low

### 1.4 CSRF token for cookie-authed state-changing requests

**Problem:** `POST /api/links`, `PATCH /api/links/:id`, `POST /api/links/bulk-delete` use the `admin_token` cookie (`SameSite=Strict` mitigates CSRF, but only for cross-site `POST`s — same-site sub-domains are exempt). A future product page on `*.duckshort.cc` could exfiltrate the cookie.

**Proposed change:** Generate a CSRF token at login, set it as a non-HttpOnly `XSRF-TOKEN` cookie, and require the SPA to echo it back as `X-XSRF-TOKEN` header on every state-changing request. Reject mismatches with 403.

**Effort:** M  ·  **Risk:** Med (must coordinate with frontend)

### 1.5 Reduce session token lifetime to 1 hour sliding

**Problem:** `SESSION_MAX_AGE = 24h` is generous. A stolen cookie stays valid for a day.

**Proposed change:** Reduce to 1h fixed, and re-issue on activity. Add a `Max-Age=3600` and re-issue in the response if the token is older than 30 minutes.

**Effort:** S  ·  **Risk:** Low (UX: admin must re-login hourly, acceptable for a single-user tool)

---

## 2. Performance (high priority)

### 2.1 Activate the Cache API for viral-link redirects

**Problem:** `purgeRedirectCache` is wired into `deleteLink`, `bulkDeleteLinks`, `updateLink` (toggle), and `dispatchRedirect`, but the redirect handler does not **read** from the cache. Every `GET /:id` is still a D1 lookup.

**Proposed change:** In `redirectLink` (via `dispatchRedirect`), before calling `loadLinkRow`, check `caches.default.match(new Request(BASE_URL + '/__redirect_cache__/' + id))`. On hit, return the cached 302 immediately. Invalidation already works. Skip the cache for password, burn-on-read, or recently disabled links.

**Effort:** M  ·  **Risk:** Med (stale-while-revalidate semantics need care)

### 2.2 Reduce the Admin dashboard's first-paint cost

**Problem:** `Admin.tsx` issues a `GET /api/links` (with sparkline query) plus a `GET /api/stats/global` on mount. For an admin with thousands of links the first page is `O(N)` over `links` plus a subquery.

**Proposed change:**
- Lazy-load the Admin page (already `lazy()` in `App.tsx`, good)
- Split the initial fetch: render the empty dashboard shell immediately, fire the links fetch in the background, show a skeleton
- Cache `GET /api/stats/global` for 30s with a `Cache-Control: public, max-age=30` header (it changes slowly)

**Effort:** M  ·  **Risk:** Low

### 2.3 Drop unused packages from `frontend/package.json`

**Problem:** `frontend/AGENTS.md` lists `recharts, react-i18next, i18next, react-markdown, react-quill` as "installed, not wired up". These inflate `node_modules` (~30 MB) and the production bundle (any inadvertent import becomes a leak).

**Proposed change:** Run `npx depcheck` in `frontend/`, uninstall anything not imported, then run `npm run build` and `npm run test` to confirm nothing breaks. Re-add only the ones with a near-term roadmap.

**Effort:** S  ·  **Risk:** Low

### 2.4 Code-split the Admin bundle

**Problem:** The Admin page bundle contains `LinkTable`, `LinkCreateForm`, `GeoRedirectManager`, `VariantManager`, `PerLinkStatsView`, `GlobalStatsView`, `AdminAuthGate`. Vite emits one ~200 KB chunk for it.

**Proposed change:** Use `React.lazy` with named imports for each tab (`import('./admin/LinkTable')`). Vite will emit per-tab chunks. Reduces initial Home page cost when the user is not on `/admin`.

**Effort:** S  ·  **Risk:** Low

### 2.5 Replace `Date.now()` math in hot path with column-driven queries

**Problem:** `getStats` and `getLinks` compute `sevenDaysAgo` and `oneHourAgo` in JS for every request. D1 can do `date('now', '-7 days')` server-side, which is faster on large result sets and easier to read.

**Proposed change:** Replace the JS-computed `ISO` strings with `date('now', '-7 days')` in SQL. Use the same pattern for `is_expired` (already in use via `datetime(expires_at) < datetime('now')`).

**Effort:** S  ·  **Risk:** Low

---

## 3. Reliability and Observability (medium priority)

### 3.1 Add Sentry (or compatible) for frontend errors

**Problem:** `ErrorBoundary.tsx` catches render errors but only shows a fallback UI. Production errors are invisible.

**Proposed change:** Integrate `@sentry/react` (small, well-supported). Send uncaught errors to Sentry with `release=__APP_VERSION__` (already injected at build time). Cloudflare Workers errors are visible via the existing `observability.enabled = true`; the SPA is the blind spot.

**Effort:** S  ·  **Risk:** Low (privacy: do not log URL or password fields)

### 3.2 Worker-side rate-limit metrics

**Problem:** `rateLimit` middleware emits no metric. There is no way to alert on rate-limit saturation in Cloudflare's analytics.

**Proposed change:** Emit `logger.info('rate_limit_check', { bucket, ip_hash, allowed, remaining })` at a sampled rate (e.g., 1 in 10) or only on `!allowed`. Create a Logpush alert for `event=rate_limit_check && allowed=false` rate.

**Effort:** S  ·  **Risk:** Low

### 3.3 Webhook delivery retries

**Problem:** A single webhook POST is fire-and-forget. If the consumer is down, the click is lost.

**Proposed change:** Add a `webhook_attempts` table and a Cron Trigger (`*/5 * * * *`) that retries up to 5 times with exponential back-off. Mark `delivered = 1` on 2xx response.

**Effort:** L  ·  **Risk:** Med (durable retries need careful schema design)

### 3.4 Health check endpoint

**Problem:** No `/health` route. Cloudflare's health checks would 404. External monitors (Pingdom, UptimeRobot) need a target.

**Proposed change:** Add `GET /health` that returns 200 with `{ status: 'ok', db: 'ok', rate_limiter: 'ok' }` after a quick `SELECT 1` and a no-op DO fetch. Do not authenticate it.

**Effort:** S  ·  **Risk:** Low

### 3.5 SPA release tagging

**Problem:** The footer shows `V{{version}}` but there is no release channel (main vs. develop vs. feature). Hard to tell which build is live.

**Proposed change:** Add `VITE_RELEASE_CHANNEL` env var, default `main`. Inject into the build and the footer.

**Effort:** S  ·  **Risk:** Low

---

## 4. Code Quality and DX (medium priority)

### 4.1 Type-safe `Env` access

**Problem:** `c.env.PAGES_URL` is typed as `string | undefined` in the `Env` interface. Several call sites use it as a string after a fallback. TypeScript can prove the fallback is correct only with `??` everywhere.

**Proposed change:** Wrap reads in a tiny helper:

```ts
export function pagesOrigin(env: Env): string {
  return (env.PAGES_URL ?? 'https://duckshort.pages.dev').replace(/\/+$/, '')
}
```

Place in `src/lib/env.ts`. Replace all `pagesOrigin(c)` call sites with `pagesOrigin(c.env)`. Eliminates `c.env.*` access in route handlers and makes future env additions a single-file change.

**Effort:** S  ·  **Risk:** Low

### 4.2 Consolidate all `DIST_*` constants in `src/lib/constants.ts`

**Problem:** `RATE_LIMIT_MAX_REQUESTS`, `EXTEND_HOURS_MIN/MAX`, `BULK_DELETE_MAX_IDS`, `EXPORT_MAX_ROWS`, `MAX_*_LENGTH`, `WEBHOOK_TIMEOUT_MS` are already in `constants.ts`. But `RATE_LIMIT_WINDOW_MS` is a number, not a constant — make it a typed const so it shows up in IDEs.

**Proposed change:** Add `as const` to all exports. Add a `MAX_PASSWORD_LENGTH` (mirror the front-end cap). Add `MAX_URL_LENGTH` (currently unvalidated — 8 KB cap is reasonable).

**Effort:** S  ·  **Risk:** Low

### 4.3 Replace ad-hoc inline types with shared `db.ts` row interfaces

**Problem:** `getLinks` and `getStats` declare ad-hoc row types inline (`{ id, original_url, ... }`). `RedirectLinkRow` is already shared. Inconsistent typing across the codebase.

**Proposed change:** Add a `src/lib/dbTypes.ts` exporting `LinkRow`, `LinkRowWithSparkline`, `AnalyticsRow`, `VariantRow`, `GeoRedirectRow`. Use throughout handlers.

**Effort:** S  ·  **Risk:** Low

### 4.4 Refactor `Home.tsx` into custom hooks

**Problem:** `Home.tsx` (240 lines) has 13 `useState` calls mixing shorten form, stats view, and global stats. The audit marked this WONTFIX but the complexity is growing.

**Proposed change:** Extract `useShortenForm`, `useStatsView`, `useGlobalStats` (the latter already partially done via `useQuery`). Move network calls behind `useQuery` for consistent retry/cache.

**Effort:** M  ·  **Risk:** Low

### 4.5 ESLint rules and pre-commit

**Problem:** ESLint is configured (R-11) but not enforced in CI. There is no pre-commit hook.

**Proposed change:**
- Add `npm run lint` step to `deploy-worker.yml` and `deploy-frontend.yml`
- Add a `lint.yml` workflow that fails on any `eslint` error
- Add a `husky` + `lint-staged` setup so commits auto-format and auto-fix

**Effort:** S  ·  **Risk:** Low

### 4.6 Document the dispatchRedirect contract

**Problem:** `dispatchRedirect` in `redirectUtils.ts` is the single point where A/B + geo + UTM + analytics + burn + webhook converge. It is well-named but the contract (when does it 404 vs 410 vs 302?) is implicit.

**Proposed change:** Add a JSDoc block listing each return kind (`not_found`, `expired`, `password`, `burned_out`, `redirect`) and the conditions. Add a `__tests__/contract.test.ts` that locks the contract.

**Effort:** S  ·  **Risk:** Low

---

## 5. Testing (medium priority)

### 5.1 End-to-end test for the SPA

**Problem:** Frontend tests are jsdom-based unit tests. There is no real-browser end-to-end coverage.

**Proposed change:** Add Playwright (Cloudflare has a Workers-friendly preset). One E2E spec covering: load `/`, paste URL, see QR modal, open `/admin`, log in, create a link, see it in the list, click it, land on the original URL. Runs in CI on PR.

**Effort:** L  ·  **Risk:** Med (Playwright in CI requires a `pnpm` cache and a host for the Worker)

### 5.2 Property-based tests for `pickVariant`

**Problem:** `pickVariant` is a weighted random selector. Unit tests can verify `sum = weights` and `len > 0`, but a property test (e.g., 10 000 trials and assert each weight is hit ~proportionally) catches off-by-one bugs.

**Proposed change:** Add `fast-check` and write a property test for `pickVariant`. Lock distribution within ±5% tolerance.

**Effort:** S  ·  **Risk:** Low

### 5.3 Migration test helper

**Problem:** Test files include 9 inline `applySchema` copies. The audit migration `0009_analytics_id.sql` was applied in lock-step, which is fragile.

**Proposed change:** Extract a `test/helpers/schema.ts` that runs all migrations in order. Replace the inline copies with one import. Reduces drift.

**Effort:** S  ·  **Risk:** Low

### 5.4 Add a `vitest --coverage` gate in CI

**Problem:** No coverage baseline. Refactors can silently drop coverage.

**Proposed change:** Add `vitest run --coverage` step to `deploy-worker.yml`. Configure thresholds in `vitest.config.ts` (e.g., 80% lines). Allow the threshold to start low and ratchet up.

**Effort:** S  ·  **Risk:** Low

### 5.5 Visual regression for the Admin dashboard

**Problem:** Neon theming is visual. Refactoring `index.css` can break the look without any test failing.

**Proposed change:** Add `chromatic` or `playwright + pixelmatch` for the Admin tabs and Home page. Trigger on PR. Skips the marketing surface.

**Effort:** L  ·  **Risk:** Med (visual flakes are common in CI)

---

## 6. Database and Migrations (low priority)

### 6.1 Add a `link_stats_daily` pre-aggregated table

**Problem:** The 7-day sparkline queries run on every `getLinks`. For a busy tenant this is `O(page_size × 7)` GROUP BY over `analytics`.

**Proposed change:** Add a Cron Trigger that runs hourly and pre-aggregates per-day, per-link counts into `link_stats_daily (link_id, day, count)`. `getLinks` reads from this table. Cut the analytics scan from every request to once an hour.

**Effort:** M  ·  **Risk:** Low (additive)

### 6.2 Add composite index on `analytics (link_id, country)`

**Problem:** `getStats` has a `GROUP BY country` over `analytics WHERE link_id = ?`. Without `(link_id, country)`, D1 falls back to a `link_id` index scan and an in-memory GROUP BY.

**Proposed change:** Add `CREATE INDEX idx_analytics_link_country ON analytics (link_id, country)` in a new migration.

**Effort:** S  ·  **Risk:** Low

### 6.3 Add `link_settings` for future per-link toggles

**Problem:** `links` already has 17 columns. Adding more (e.g., `password_attempts_limit`, `redirect_method` 301 vs 302) will push D1 to its 2 000-column-per-table wall.

**Proposed change:** Move optional toggles to a `link_settings (link_id PK, key TEXT, value TEXT)`. Document the convention in `docs/DATABASE.md`.

**Effort:** M  ·  **Risk:** Med (touches the most-modified file)

---

## 7. Operations and Tooling (medium priority)

### 7.1 Add a staging environment

**Problem:** `develop` is deployed manually. PRs cannot be reviewed against a live Worker.

**Proposed change:** Add a `[env.staging]` block in `wrangler.toml`. Add a `deploy-staging.yml` workflow that runs on PR open. Frontend uses the staging Worker URL via `VITE_API_URL`.

**Effort:** M  ·  **Risk:** Low

### 7.2 Add a backup runbook

**Problem:** `scripts/db-backup.sh`, `db-compare.sh`, `db-restore.sh` exist but there is no docs page describing when to run them.

**Proposed change:** Add `docs/OPERATIONS.md` listing: daily backup cadence, restore procedure, how to read the comparison report.

**Effort:** S  ·  **Risk:** Low

### 7.3 Dependabot / Renovate config

**Problem:** `wrangler ^4.83`, `hono ^4.0`, `nanoid ^5.0` are pinned to major.minor. Patch updates require manual bumps.

**Proposed change:** Add `.github/dependabot.yml` with weekly `npm` and `github-actions` ecosystems. Auto-merge patch-level PRs after CI passes.

**Effort:** S  ·  **Risk:** Low

### 7.4 Bundle-size tracking

**Problem:** No way to notice when a refactor doubles the SPA bundle.

**Proposed change:** Add `vite-plugin-bundlesize` or a `size-limit` config. Fail CI when the Admin chunk exceeds 250 KB or the Home chunk exceeds 80 KB.

**Effort:** S  ·  **Risk:** Low

### 7.5 Add CONTRIBUTING.md and PR template

**Problem:** `AGENTS.md` is detailed for in-code work, but external contributors have no entry point.

**Proposed change:** Add `.github/CONTRIBUTING.md` linking to the SDLC skill, the test commands, the commit message convention. Add a PR template that requires a test plan and a rollback plan.

**Effort:** S  ·  **Risk:** Low

---

## 8. Documentation (low priority)

### 8.1 Update `docs/spec/SYSTEM_DESIGN.md` post-3rd audit

**Problem:** The doc still describes the rate limit as `20 req/hr` (now split into `api=20` and `redirect=200`). The KV fallback is removed. The session model is now HMAC-signed.

**Proposed change:** Refresh the doc. Add a section listing the 64 audit items and the audit cadence.

**Effort:** S  ·  **Risk:** Low

### 8.2 Document the security model

**Problem:** `AGENTS.md` has a "Security Model" section but it pre-dates the HttpOnly cookie, the PBKDF2 migration, the security headers, and the bucket split.

**Proposed change:** Update the section. Cross-link to the new audit. Note the `wrangler secret put` workflow.

**Effort:** S  ·  **Risk:** Low

### 8.3 Generate an OpenAPI spec from handlers

**Problem:** The API reference is hand-written in `AGENTS.md`. Drift between doc and code is inevitable.

**Proposed change:** Use `hono-openapi` to derive the spec from the route definitions. Publish at `GET /openapi.json` and at `https://duckshort.cc/api-docs`.

**Effort:** M  ·  **Risk:** Low

---

## 9. Features (low priority — would be product work, not engineering debt)

These are roadmap items, not improvements. Listed for completeness against the open `BACKLOGS.md`:

- **Additional locales** (Thai `lang-th.md` exists but is not wired)
- **Searchable / sortable Admin table** (already partial via `searchQuery` / `statusFilter`; could extend to date range and tag)
- **Short-link QR code on the Home tab** (already in the result modal)
- **Webhook UI** (currently API-only)
- **Per-link custom expiry at creation** (UI uses a `CUSTOM` hours input — verified working)
- **Public-stats opt-in** (`share_token` per link — partial sketch in audit S-20)

---

## 10. Implementation Roadmap (suggested)

| Wave | Timeframe | Items |
|------|-----------|-------|
| Wave 1 (1-2 weeks) | Quick wins, low risk | 1.3 failed-auth logs, 1.5 session lifetime, 2.3 depcheck, 2.5 SQL date math, 3.4 /health, 4.1 type-safe env, 4.2 constants `as const`, 4.3 db types, 4.5 ESLint in CI, 5.3 schema helper, 5.4 coverage gate, 6.2 composite index, 7.3 dependabot, 7.4 bundle-size, 7.5 contributing guide, 8.1 refresh SYSTEM_DESIGN, 8.2 security model |
| Wave 2 (3-4 weeks) | Medium effort, measurable impact | 1.1 CSP, 1.2 separate SESSION_SECRET, 1.4 CSRF token, 2.1 KV cache, 2.2 admin first-paint, 2.4 code-split admin, 3.1 Sentry, 3.2 rate-limit metrics, 4.4 useShortenForm hook, 4.6 dispatchRedirect contract test, 5.2 property test for pickVariant, 6.1 link_stats_daily, 7.1 staging env, 7.2 backup runbook |
| Wave 3 (later) | Larger features | 3.3 webhook retries, 5.1 E2E, 5.5 visual regression, 6.3 link_settings, 8.3 OpenAPI |

### Wave 1 — Status (as of 2026-06-18)

All 17 Wave 1 items shipped. Tests: 215/215 passing, typecheck clean, coverage 86%/89%/79%/88% (statements/functions/branches/lines) — well above the 60% gate.

| # | Item | Commit-shape summary | Where |
|---|------|----------------------|-------|
| 1.3 | Failed-auth log enrichment | `requireAuthFromContext(c)` logs `auth_failed` with `reason`, `path`, `method`, `ip` | `src/lib/auth.ts` |
| 1.5 | Session lifetime 1h | `SESSION_MAX_AGE_SECONDS = 3600`; `Max-Age=3600` on cookie | `src/lib/constants.ts`, `src/handlers/auth.ts` |
| 2.3 | Drop unused packages | Verified: `recharts`, `react-i18next`, `i18next`, `react-markdown`, `react-quill` already absent (R-09 from prior audit) | `frontend/package.json` |
| 2.5 | Server-side date math | `strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')` and `…'-1 hour'` in `getStats` / `getGlobalStats` (ISO-8601 form to match stored format) | `src/handlers/stats.ts` |
| 3.4 | `/health` endpoint | `GET /health` → 200 / 503 with `{ status, components: { db, rate_limiter } }`; `Cache-Control: no-store` | `src/handlers/health.ts`, `src/index.tsx` |
| 4.1 | Type-safe env helper | `pagesOrigin(env)`, `baseUrl(env)`, `stripTrailingSlash(url)` | `src/lib/env.ts` |
| 4.2 | Literal-typed constants | `RATE_LIMIT_MAX_REQUESTS: 20 = 20`, `…REDIRECT…: 200 = 200`, `…WINDOW_MS: 3_600_000 = 60*60*1000`, `MAX_URL_LENGTH: 8_192 = 8*1024`, `MAX_PASSWORD_LENGTH: 256 = 256`, `SESSION_MAX_AGE_SECONDS: 3_600 = 60*60`, `WEBHOOK_TIMEOUT_MS: 5_000 = 5_000`, `CUSTOM_ID_REGEX: RegExp = /^[a-zA-Z0-9_-]{3,20}$/` | `src/lib/constants.ts` |
| 4.3 | Shared DB row interfaces | `LinkRow`, `LinkRowWithSparkline`, `RedirectLinkRow`, `AnalyticsRow`, `VariantRow`, `GeoRedirectRow`, `CounterRow` | `src/lib/dbTypes.ts` |
| 4.5 | ESLint in CI | `npm run lint` step in `deploy-worker.yml` + `deploy-all.yml`; dedicated `lint.yml` workflow on PRs | `.github/workflows/*` |
| 5.3 | Schema test helper | 9 inline `applySchema` / `clearAll` replaced with `import { applySchema, clearAll } from '../helpers/schema'` | `test/handlers/*.test.ts`, `test/helpers/schema.ts` |
| 5.4 | Coverage gate | `@vitest/coverage-istanbul` (Workers pool doesn't support V8); 60% lines/funcs/stmts, 50% branches; `npm run test:coverage` script; `Coverage gate` step in `deploy-worker.yml` | `vitest.config.ts`, `package.json`, `deploy-worker.yml` |
| 6.2 | Composite analytics index | `idx_analytics_link_country` + `idx_analytics_link_referer` | `migrations/0010_analytics_link_country_index.sql` |
| 7.3 | Dependabot | Weekly `npm` (root + frontend) + `github-actions` scans; grouped minor+patch with auto-merge labels | `.github/dependabot.yml` |
| 7.4 | Bundle-size tracking | `frontend/scripts/check-bundle-size.mjs` checks entry ≤ 250 KB, chunks ≤ 150 KB, total ≤ 1.5 MB | `frontend/scripts/check-bundle-size.mjs`, `frontend/package.json` |
| 7.5 | CONTRIBUTING + PR template | Test plan + rollback plan required fields; commit-message convention table; Conventional Commits | `.github/CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md` |
| 8.1 | Refresh SYSTEM_DESIGN | Bucket split (`api=20` / `redirect=200`), no KV fallback, HMAC session, S-19 headers, P-17 PK, P-18 timeout, S-20 hostname-only referer, B-12 BASE_URL cache key, B-13 PAGES_URL, audit cadence | `docs/spec/SYSTEM_DESIGN.md` |
| 8.2 | Refresh security model | HMAC cookie, 1h lifetime, PBKDF2 (100k iter), S-18–S-20 hardening, P-17/P-18, S-19 headers, bucket split, secrets workflow | `AGENTS.MD` |

Each item can ship independently. Recommend one item per PR with a test plan and a rollback plan.

### Wave 1 — ✅ CLOSED (2026-06-18)

All 17 Wave 1 items shipped. Tests: 215/215 passing, typecheck clean, coverage 86%/89%/79%/88% (statements/functions/branches/lines) — well above the 60% gate. Production deployment: `main` HEAD `9ed224d`, Worker version `54212963-1492-4e1e-97a5-b3b8c2b5f6de`, Pages alias `duckshort.pages.dev`. CSP follow-up shipped same day after a `'self'` mismatch was caught in production.

### Wave 2 — ✅ CLOSED (2026-06-18)

All 14 Wave 2 items shipped. Tests: 255/255 passing, typecheck clean, coverage 87.6%/91.3%/81.0%/89.8% (statements/functions/branches/lines) — well above the 60% gate. Production deployment pending: `develop` HEAD ready to merge to `main`, Worker version TBD, Pages alias `duckshort.pages.dev`.

| # | Item | Summary | Where |
|---|------|---------|-------|
| 1.1 | Content-Security-Policy middleware | `default-src 'self'` + per-surface overrides; skips-if-already-set lets Pages `_headers` win on the SPA proxy | `src/index.tsx` S-19 middleware; `test/middleware/securityHeaders.test.ts` |
| 1.2 | Separate `SESSION_SECRET` | HMAC key split from `ADMIN_SECRET`; legacy fallback with `session_legacy_key` warn log | `src/lib/auth.ts` `sessionSecret()`; `src/types.ts` `SESSION_SECRET?` |
| 1.4 | CSRF token (double-submit) | 32-byte random token, `XSRF-TOKEN` non-HttpOnly cookie, `X-XSRF-TOKEN` header echo, constant-time compare. Only enforced for cookie-based auth (Bearer has no attack surface) | `src/lib/auth.ts` `generateCsrfToken/readCsrfCookie/csrfTokensMatch`; `src/index.tsx` `/api/*` middleware; `test/handlers/csrf.test.ts` |
| 2.1 | Activate Cache API | 24h cache on hot redirects, key matches `purgeRedirectCache` (`${BASE_URL}/__redirect_cache__/${id}`); encoded via Response headers; **critical fix**: skips caching `burn_on_read` links (otherwise second access returned 302 from cache instead of 404) | `src/lib/redirectUtils.ts`; `src/handlers/redirect.tsx`; `test/handlers/redirect-cache.test.ts` |
| 2.2 | Admin first-paint | 30s `Cache-Control: public, max-age=30` on `/api/stats/global`; substantial `LinkTableSkeleton` lazy chunk (1.78 KB) | `src/handlers/stats.ts`; `frontend/src/components/admin/LinkTableSkeleton.tsx` |
| 2.4 | Code-split Admin | `React.lazy` on each tab; bundle dropped from 41 KB single Admin chunk to 24 KB initial (Admin.js 9.9 KB + LinkTable.js 14.4 KB) | `frontend/src/pages/Admin.tsx` |
| 3.1 | Sentry for frontend | `@sentry/react` 8.55, opt-in via `VITE_SENTRY_DSN`, release wired to `__APP_VERSION__`; ErrorBoundary `componentDidCatch` captures and reports | `frontend/src/lib/sentry.ts`; `frontend/src/components/ErrorBoundary.tsx`; `frontend/src/main.tsx` |
| 3.2 | Rate-limit metrics | 100% sample for blocked (warn), 5% sample for allowed (info), SHA-256 IP hash (16 hex chars) for privacy; tunable via `RATE_LIMIT_METRIC_SAMPLE` | `src/middleware/rateLimit.ts` |
| 4.4 | `useShortenForm` hook refactor | 13 useState → 4 hooks: `useShortenForm` (url/customId/burn/expiry/error/shortUrl/copy), `useStatsView` (id/limit/submitted), `useGlobalStats` (30s poll), `useLinkStats` (per-link query) | `frontend/src/hooks/*.ts`; `frontend/src/pages/Home.tsx` |
| 4.6 | `dispatchRedirect` contract | JSDoc CONTRACT table (5 kinds: not_found/expired/password/burned_out/redirect) + 9 contract tests | `src/lib/redirectUtils.ts`; `test/handlers/dispatch-contract.test.ts` |
| 5.2 | Property-based tests for `pickVariant` | `fast-check@^3`; 6 properties (always valid URL, single variant deterministic, distribution ±5% over 5k trials, weight preservation, empty → '', all-zero → first) | `test/lib/variants.property.test.ts`; `src/lib/variants.ts` |
| 6.1 | `link_stats_daily` pre-agg | New table + hourly cron `aggregateLinkStatsDaily`; `getStats` + `getLinks` read cache first, fall back to analytics on miss; idempotent re-runs converge via `ON CONFLICT … DO UPDATE` | `migrations/0011_link_stats_daily.sql`; `src/handlers/aggregate.ts`; `test/handlers/aggregate.test.ts` |
| 7.1 | Staging environment | `[env.staging]` block in `wrangler.toml` (separate D1 + Pages project); `.github/workflows/deploy-staging.yml` triggered on PR open against `develop` | `wrangler.toml`; `.github/workflows/deploy-staging.yml`; `docs/OPERATIONS.md` |
| 7.2 | Backup runbook | `docs/OPERATIONS.md` — backup cadence, restore procedure (test env only), prod → local copy with sanitization SQL for `password_hash`/`webhook_url`/`custom_domain`, schema drift workflow, migration rules ("never edit applied migrations"), secrets rotation, incident response | `docs/OPERATIONS.md` |

**Bugs discovered + fixed during Wave 2:**
- `burn_on_read` links were being cached → second access returned 302 from cache instead of 404. Fixed with `&& !link.burn_on_read` guard in `dispatchRedirect` → `writeCache`. Locked by `redirect-cache.test.ts` "burn-on-read links are NOT cached".
- Initial CSRF implementation required CSRF for all state-changing requests including Bearer auth. Refined: only enforced when `admin_token` cookie is present (Bearer clients have no CSRF attack surface).

---

## 11. Non-Goals (do **not** do)

- **Replace Cloudflare D1 with a hosted Postgres.** The edge-native design is the value proposition. Stay on D1.
- **Rewrite the Worker in a different framework.** Hono is doing the job. Migration cost is enormous for no functional gain.
- **Add a graph database or Redis.** The current scale (counters + 1-hour analytics window) does not need it.
- **Internationalize the Admin UI.** Single-user tool; English is fine.
- **Add a 3rd-party auth provider (Auth0, Clerk).** Adds a dependency, a cost, and a privacy surface for no UX benefit.

---

## 12. Summary

The codebase is in a strong, shippable state. The recent audit cycle closed 64 items across three passes; performance, security, and code quality are all within best-practice envelopes. The plan above is the next wave of investment to take the project from "production-ready" to "long-lived" — better observability, tighter test coverage, slightly better security posture, and lower operational risk.

The single highest-leverage item is **Wave 2.1 — activate the redirect cache** (drop D1 read traffic by an order of magnitude on hot links) and **Wave 2.1 — add CSP** (closes the last big XSS gap).

Everything else is incremental polish.

---

*Plan generated 2026-06-18 from a review of `develop` @ `214be8b`.*
*Wave 1 closed 2026-06-18 — 17/17 items shipped.*
*Wave 2 closed 2026-06-18 — 14/14 items shipped.*
