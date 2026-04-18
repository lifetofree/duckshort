# DuckShort — Project Review & Test Coverage

> Full review across architecture, features, security, code quality, refactoring opportunities, and new feature proposals. Test coverage section follows.

---

## 1. Project Overview

DuckShort is an edge-native URL shortener built on the Cloudflare developer platform with a "Synthwave Mallard / Neon Pond" aesthetic. Traffic to `duckshort.cc` is intercepted by a Cloudflare Worker (Hono.js), which handles all API calls, redirects, and SSR interstitials. A React SPA (Cloudflare Pages) provides the user-facing UI and is dynamically proxied at the root by the Worker.

| Layer | Technology |
|-------|-----------|
| Backend runtime | Cloudflare Workers (edge, sub-10ms cold starts) |
| API framework | Hono.js 4 |
| Database | Cloudflare D1 (distributed SQLite) |
| Rate limiting | Cloudflare Durable Objects (`RateLimiter`) |
| KV | Cloudflare Workers KV (legacy fallback path) |
| Frontend | React 18 + Vite 5 + React Router v6 |
| Styling | TailwindCSS v4 + CSS custom properties |
| Animations | Framer Motion v12 (`motion/react`) |
| i18n | Custom `I18nProvider` + `useTranslation` hook |
| Testing | Vitest — backend via `@cloudflare/vitest-pool-workers`, frontend via jsdom |
| Deployment | GitHub Actions → Cloudflare Workers + Pages |

---

## 2. Architecture Review

### Routing Architecture

The routing layering is clean and well-reasoned:

```
duckshort.cc/* → Worker Route
  ├── /api/*           → Hono API handlers
  ├── /preview/:id     → SSR click-through interstitial
  ├── /password/:id    → SSR password form (GET + POST)
  ├── /:id             → redirect handler (302)
  └── /                → dynamic proxy to Pages (fetches duckshort.pages.dev at runtime)
```

The dynamic root proxy (`GET /` fetches `duckshort.pages.dev` at request time) is an elegant solution that eliminates asset-hash coupling between the Worker and the frontend build. No hardcoded filenames means frontend redeploys never require a Worker redeploy.

### Database Schema

Five sequential migrations tell a clear story of iterative feature additions:

| Migration | What it added |
|-----------|--------------|
| `0001_initial.sql` | `links` + `analytics` tables |
| `0002_feature_columns.sql` | `password_hash`, `tag`, `utm_*`, `webhook_url`, `analytics.timestamp`, `link_variants` |
| `0003_vanity_and_burn.sql` | `burn_on_read` column |
| `0004_performance_indexes.sql` | Composite indexes on `links(created_at, disabled)`, `links(tag)`, `analytics(link_id, timestamp)` |
| `0005_og_tags.sql` | `og_title`, `og_description`, `og_image` columns |

The schema is lean and purposeful. Every column earns its place. The composite index on `analytics(link_id, timestamp)` is correctly placed to accelerate the hourly mood query and per-link stats aggregation.

### Backend Handler Organization

`src/index.tsx` is a clean router-only file — no logic bleeds into it. Each handler file owns one concern. The `src/lib/` directory holds pure utilities. This separation is correct and easy to navigate.

### Frontend Component Structure

After the v1.3.0 refactor, `Home.tsx` is a lean orchestrator (~170 lines) that delegates to:
- `DuckMoodLogo` — animated mood-aware logo
- `QuackCounter` — milestone-aware visit counter
- `ShortenForm` — all shortening inputs
- `StatsView` — stats lookup and display
- `ResultModal` — post-creation QR + copy dialog

This decomposition is well-executed. Props flow down clearly. State stays in `Home.tsx` and is passed down — no prop-drilling through more than one level for any concern.

---

## 3. Feature Completeness

### Implemented (as of v1.3.0)

| Feature | Status | Notes |
|---------|--------|-------|
| Link shortening (NanoID) | ✓ | 8-char Base62, ~218 trillion combinations |
| Custom vanity aliases | ✓ | 3–50 chars, alphanumeric + underscore + hyphen |
| Link expiration | ✓ | `expires_at` with `datetime()` normalization |
| Custom expiry input | ✓ | Hours field revealed when "CUSTOM" selected |
| Burn-on-read | ✓ | Atomic `UPDATE … WHERE disabled = 0` prevents double-consume |
| Toggle enable/disable | ✓ | `PATCH /api/links/:id` action: "toggle" |
| Expiry extension | ✓ | Extends from future/null/expired correctly |
| Bulk delete | ✓ | D1 batch + rate-limited |
| Link tags | ✓ | `tag` column for campaign grouping |
| UTM injection | ✓ | Shared `injectUtm()` utility |
| Webhook on click | ✓ | Async `waitUntil` POST, failures silently ignored |
| A/B variant routing | ✓ | Weighted random selection, applied on redirect + password |
| Password-protected links | ✓ | SHA-256 hash, SSR interstitial |
| Click-through preview | ✓ | Branded interstitial with OG tags |
| OG tag customization | ✓ | `og_title`, `og_description`, `og_image` |
| Per-link stats | ✓ | Visits + top N countries + referrers, `?limit=N` |
| Global quack counter | ✓ | Total visits + hourly count + duck mood |
| Duck mood indicator | ✓ | DORMANT/ACTIVE/BUSY/VIRAL/ERROR states |
| QR code modal | ✓ | `qrcode.react` SVG + copy to clipboard |
| Atomic rate limiting | ✓ | Durable Object `storage.transaction()` per IP |
| Scheduled cleanup | ✓ | Cron trigger `0 * * * *` |
| Timing-safe auth | ✓ | `crypto.subtle.timingSafeEqual` |
| Analytics truncation | ✓ | UA + referer capped at 255 chars |
| i18n system | ✓ | Dot-notation keys + `{{param}}` interpolation |
| Auto-version footer | ✓ | `__APP_VERSION__` from `package.json` via Vite define |
| 7-day sparkline | ✓ | Backend delivers data; no frontend visualization yet |
| Dev mode bar | ✓ | Returns `null` in production |
| CI/CD pipelines | ✓ | Three GitHub Actions workflows |

### Not Yet Implemented

| Feature | Priority | Notes |
|---------|----------|-------|
| Admin Dashboard UI | High | `Admin.tsx` is a "coming soon" placeholder |
| Stats limit selector (frontend) | Medium | Backend supports `?limit=N`; no UI control in `StatsView` |
| Sparkline visualization | Medium | Data exists; no chart rendered |
| Bulk CSV export | Low | No export functionality |
| Custom domains | Low | Requires per-link domain routing |
| Additional locales | Low | Only English wired; no language switcher |
| Neon heatmap | Low | Geographic visualization of country stats |
| Geo-fencing redirects | Low | Country-based redirect rules |
| Admin search & filter | Medium | Links shown in creation order only |

---

## 4. Security Review

### Strengths

**Timing-safe auth** (`src/lib/auth.ts`): `timingSafeEqual` correctly uses `crypto.subtle.timingSafeEqual` (Web Crypto API), not a naive string comparison. This prevents timing-based secret inference attacks.

**Atomic burn-on-read**: Both `redirect.tsx` and `password.tsx` use `UPDATE … WHERE id = ? AND disabled = 0` and check `result.meta.changes === 0`. A race condition where two requests hit a burn-on-read link simultaneously is correctly handled — only the first request succeeds.

**NanoID entropy**: 8-char Base62 = 62^8 ≈ 218 trillion combinations. Brute-force enumeration is infeasible.

**Durable Object rate limiting**: `storage.transaction()` in `RateLimiter.ts` makes the check-and-increment atomic. The previous KV read-check-write pattern had a TOCTOU race — this is correctly fixed.

**Analytics safety**: UA and referer headers are truncated to 255 chars before DB storage, preventing oversized inputs.

**Secrets management**: `ADMIN_SECRET` is stored as an encrypted Cloudflare secret, never in `wrangler.toml` or the repository.

### Weaknesses / Issues

#### 1. `verifyPassword` is not timing-safe

**File:** `src/lib/auth.ts:38`

```ts
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password)
  return computed === hash  // ← plain string comparison
}
```

`hashPassword` produces a 64-character hex string, and comparing two hashes with `===` will short-circuit on the first differing character. An attacker who can measure response times with microsecond precision could leak information about the stored hash. The fix is straightforward:

```ts
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password)
  return timingSafeEqual(computed, hash)
}
```

#### 2. CORS is fully open

**File:** `src/index.tsx:17`

```ts
app.use('*', cors({
  origin: (origin) => origin ?? '*',
  ...
}))
```

Any origin can make cross-site requests to the API. For a public URL shortener this may be intentional, but it means any website can POST to `/api/links` (subject only to rate limiting). This should be documented as intentional in `AGENTS.MD` — it already exists in `BACKLOGS.md` but the entry is marked LOW with no action plan.

#### 3. Password hashing uses SHA-256, not bcrypt/Argon2

SHA-256 is a fast hash — a GPU can compute billions per second. A leaked database would expose passwords to rapid brute-force. bcrypt and Argon2 are unavailable in the Workers runtime, so this is a platform constraint. Mitigation: document this limitation explicitly, and consider adding a rate limit to the `POST /password/:id` verification endpoint.

#### 4. No rate limit on `POST /password/:id`

Password verification at `POST /password/:id` has no rate limiting. Given that passwords use SHA-256 (fast hash), an attacker can brute-force password-protected links at the speed of the network round-trip. Applying the existing `rateLimit` middleware to this route is a low-effort improvement.

---

## 5. Code Quality & Refactoring Opportunities

### Backend

#### Issue 1: `pickVariant` is duplicated

**Files:** `src/handlers/redirect.tsx:22` and `src/handlers/password.tsx:25`

The `pickVariant` function (weighted random selection over variant rows) is copied verbatim in both files — same logic, same interface, same edge-case handling. This should be extracted to `src/lib/variants.ts` and imported in both places.

```ts
// src/lib/variants.ts
interface VariantRow { destination_url: string; weight: number }
export function pickVariant(variants: VariantRow[]): string { ... }
```

The `VariantRow` interface is also duplicated across both files and should live in `src/types.ts` alongside `Env`.

#### Issue 2: Analytics write logic is duplicated

**Files:** `src/handlers/redirect.tsx:85` and `src/handlers/password.tsx:108`

The `waitUntil` block that writes to `analytics` and fires the webhook is nearly identical across both files. Extract it to a `src/lib/analytics.ts` helper:

```ts
export function recordClick(ctx: ExecutionContext, env: Env, linkId: string, req: Request, webhookUrl: string | null): void {
  ctx.waitUntil(/* ... */)
}
```

#### Issue 3: `LinkRow` interface is duplicated

`src/handlers/redirect.tsx:6` and `src/handlers/password.tsx:9` each define their own `LinkRow` interface. These are near-identical. Both should import from `src/types.ts`.

#### Issue 4: `getLinks` uses `link: any` cast

**File:** `src/handlers/admin.ts:37`

```ts
const result = links.results.map((link: any) => ({
```

The D1 `all()` call already returns typed results when a generic is provided (as done elsewhere in the codebase, e.g., `sparklineRows`). This should be typed properly.

#### Issue 5: `deleteLink` returns 200 even if link doesn't exist

**File:** `src/handlers/admin.ts:168`

```ts
await c.env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
return c.json({ success: true })
```

Deleting a non-existent link silently returns 200. Consider checking `result.meta.changes` and returning 404 if nothing was deleted — consistent with how `updateLink` handles missing links.

#### Issue 6: `main.jsx` dead file

**File:** `frontend/src/main.jsx`

A stale `.jsx` entry point remains alongside the real `main.tsx`. It has no imports for `I18nProvider` or `BrowserRouter` and would render a broken app if loaded. It should be deleted.

### Frontend

#### Issue 7: `StatsView` hardcodes `slice(0, 5)`

**File:** `frontend/src/components/StatsView.tsx:70, 84`

```ts
{stats.countries.slice(0, 5).map(...)}
{stats.referrers.slice(0, 5).map(...)}
```

The backend supports `?limit=N` (1–100). The frontend ignores this and always fetches the default (10 from the server) then slices to 5 client-side. This means data is fetched but discarded. Either:
- Add a limit selector to `StatsView` and pass `?limit=N` to the API, or
- Remove the `slice` and display all returned rows

#### Issue 8: `useEffect([shortUrl])` polling pattern

**File:** `frontend/src/pages/Home.tsx:38`

```ts
useEffect(() => {
  const fetchGlobalStats = () => { ... }
  fetchGlobalStats()
  const interval = setInterval(fetchGlobalStats, 30_000)
  return () => clearInterval(interval)
}, [shortUrl])
```

The dependency on `shortUrl` means the effect re-mounts (and immediately re-fetches) every time a link is created or the modal is closed. Global stats polling should be independent of the shortening flow. Change the dependency to `[]` and trigger a manual one-shot refresh after a successful shorten instead.

#### Issue 9: Inline styles throughout components

All components use extensive inline `style={{}}` objects rather than Tailwind classes or CSS custom properties. This is a stylistic choice that works, but it makes theming and responsive adjustments harder. Given TailwindCSS v4 is already in the stack, progressively migrating to utility classes would reduce visual noise and improve maintainability.

---

## 6. New Feature Proposals

### High Value

#### Admin Dashboard (React SPA)
`Admin.tsx` is currently a placeholder. The API already supports everything needed:
- `GET /api/links` (with sparkline) → links table
- `GET /api/links/:id/variants` → variant management
- `PATCH /api/links/:id` → toggle / extend
- `DELETE /api/links/:id` + bulk delete

A minimal admin UI (links table + search/filter + per-link stats panel) would complete the product. The sparkline data is already being fetched from the backend.

#### Stats Limit Selector
A small dropdown on `StatsView` (5 / 10 / 25 / 50) passed as `?limit=N` to the stats endpoint. One-line frontend change; backend already supports it.

#### Rate Limit on Password Endpoint
Apply `rateLimit` middleware to `POST /password/:id` to mitigate brute-force against password-protected links.

#### Sparkline Chart in Admin
`GET /api/links` already returns a 7-element `sparkline` array per link. Rendering it as a tiny SVG bar chart (no library needed — ~15 lines of JSX) would make the admin table immediately readable.

### Medium Value

#### Geo-Fencing Redirects
The `cf-ipcountry` header is already read from every request (for analytics). Adding a `geo_rules` JSON column to `links` (e.g., `{ "GB": "https://uk.example.com", "default": "https://example.com" }`) and checking it in the redirect handler would enable country-based routing with zero new infrastructure.

#### Neon Heatmap
Country stats are already collected. An SVG world map with neon-glow fill intensity proportional to visit count would be a high-impact visual addition consistent with the aesthetic.

#### Custom Domains
Per-link `custom_domain` column + Worker route matching on `Host` header. Requires Cloudflare zone setup per domain, which limits self-serve viability, but is achievable for managed deployments.

#### Link QR Download
The QR code in `ResultModal` is already rendered as SVG. Adding a "Download PNG" button using `canvas.toBlob()` or `URL.createObjectURL` would be a useful one-click feature.

### Low Value / Long-term

- **Bulk CSV export** — `GET /api/links?format=csv` returning a streamed response
- **Additional locales** — the i18n system is ready; only English strings need to be translated
- **Link click heatmap over time** — hourly histogram using existing `analytics.timestamp` data
- **Webhook retry queue** — currently webhook failures are silently ignored; a KV-backed retry queue would improve reliability
- **Link preview card (Open Graph)** — currently `GET /preview/:id` is the interstitial; the OG tags it sets also make the short URL itself share-friendly on social platforms

---

## 7. Test Coverage Summary

### Overview

| Layer | Test Files | Tests | Status |
|-------|-----------|-------|--------|
| Backend | 13 | 113 | ✓ All passing |
| Frontend | 9 | 138 | ✓ All passing |
| **Total** | **22** | **251** | **✓ All passing** |

### Test Infrastructure Added

**`test/helpers/schema.ts`** — Shared D1 schema helpers.
- `applySchema()` — creates `links`, `analytics`, `link_variants` tables via 3 separate `exec()` calls (D1 requires single-statement execution per call)
- `clearAll()` — truncates all tables between tests
- `seedLink(id, overrides)` — inserts a link row with sensible defaults

**`frontend/src/test/renderWithProviders.tsx`** — Wraps any component in `I18nProvider` + `MemoryRouter`.
```tsx
renderWithProviders(<MyComponent />)
```

---

### Backend Test Files

#### Existing (89 tests)

| File | Tests | What it covers |
|------|-------|----------------|
| `test/handlers/admin.test.ts` | 18 | CRUD for links and variants, auth |
| `test/handlers/redirect.test.ts` | 12 | Redirect, UTM injection, A/B routing |
| `test/handlers/stats.test.ts` | 10 | Stats endpoint, sensitive field exclusion |
| `test/handlers/cleanup.test.ts` | 6 | Expired link deletion via cron |
| `test/handlers/burn-on-read.test.ts` | 8 | Self-destruct after first visit |
| `test/handlers/custom-id.test.ts` | 8 | Custom alias creation and collision |
| `test/handlers/variants.test.ts` | 10 | A/B variant routing and weights |
| `test/handlers/password.test.ts` | 8 | 404 / disabled / expired / form / wrong pw / correct pw |
| `test/handlers/preview.test.ts` | 6 | 404 / disabled / expired / destination / OG tags |
| `test/lib/auth.test.ts` | 6 | Timing-safe comparison, hash, verify |
| `test/lib/nanoid.test.ts` | 7 | ID generation, charset, length |

#### New: `test/handlers/admin-extended.test.ts` (24 tests)

| Group | Tests |
|-------|-------|
| OG tag storage | OG fields stored; default to null when omitted |
| Password hashing | Stored as 64-char SHA-256 hex, not plaintext |
| UTM & tag fields | Stored and returned correctly |
| Expiry calculation | `expiresAt = now + expiresIn`; null when omitted |
| PATCH extend | From future / null / expired expiry; default 24h; 404 on missing |
| PATCH unknown action | Returns 400 |
| PATCH toggle on missing | Returns 404 |
| Bulk delete | Empty array → 400; non-array → 400; 401 on no auth; silently ignores non-existent IDs |
| Variant creation | Missing `destination_url` → 400; default weight = 1 |
| Variant listing | Returns empty array when no variants exist |
| Sparkline | Always 7 entries; counts reflect correct days |

#### New: `test/handlers/stats-extended.test.ts` (14 tests)

| Group | Tests |
|-------|-------|
| Limit parameter | Default 10; `?limit=5`; `?limit=20`; `?limit=0` clamps to 10; `?limit=200` no error |
| Edge cases | Zero visits; country/referrer DESC ranking; sensitive fields excluded |
| Mood thresholds | ACTIVE ≥ 5/hr; BUSY ≥ 25/hr; VIRAL ≥ 50/hr |
| Temporal accuracy | Old visits excluded from hourly; `totalVisits` = all-time |

---

### Frontend Test Files

#### Existing (41 tests)

| File | Tests | What it covers |
|------|-------|----------------|
| `src/__tests__/App.test.tsx` | 4 | Route rendering, 404 fallback |
| `src/__tests__/Home.test.tsx` | 5 | URL input, error states, success modal |
| `src/__tests__/Home-extended.test.tsx` | 18 | Stats tab, QR modal, clipboard, burn-on-read, expiry, mood indicators |
| `src/__tests__/DuckMoodLogo.test.tsx` | 7 | All 5 mood states, badge emoji, logo image, border styling |

**Fixes applied to all existing test files:**
- Added `I18nProvider` wrapper — all components transitively call `useTranslation()`
- Fixed placeholder/text regexes to match actual translation strings (underscore casing)
- Added 3rd fetch mock for `useEffect([shortUrl])` re-run on successful link creation
- Added 4th fetch mock for close-modal path (`setShortUrl(null)` re-triggers the effect)
- Fixed API error responses to include `{ status: 400 }` — default `200` caused the success code path to run
- Wrapped post-tab-click assertions in `waitFor` to account for `AnimatePresence mode="wait"` exit animation delay
- Fixed i18n "throws outside provider" test to use `renderHook` + try/catch to prevent async window error from leaking into sibling test files in the same Vitest worker

#### New: `src/__tests__/ShortenForm.test.tsx` (24 tests)

| Group | Tests |
|-------|-------|
| Rendering | URL input, shorten button, custom alias, expiry dropdown, burn-on-read toggle, error display |
| Submit button state | Disabled when empty; enabled with URL; disabled + "PROCESSING..." while loading |
| URL input | `onUrlChange` called; `type="url"`; disabled while loading |
| Custom alias | `onCustomIdChange` called; invalid chars stripped (`my@alias#` → `myalias`); reflects prop value |
| Expiry dropdown | All 6 options (0/3600/86400/604800/2592000/-1); CUSTOM shows hours input; callbacks fired with correct types |
| Custom hours input | `type="number"`, `min="1"`; `onCustomExpiryChange` called |
| Burn-on-read | `onBurnOnReadChange(true)` on toggle-on; `onBurnOnReadChange(false)` on toggle-off |
| Form submission | `onSubmit` called on button click |

#### New: `src/__tests__/ResultModal.test.tsx` (13 tests)

| Group | Tests |
|-------|-------|
| Rendering | Title, readonly URL input, QR SVG, copy button, close button |
| Copy | Shows "COPIED!" text; reverts when `copySuccess` is false; `onCopy` called |
| Close | `onClose` on close button; `onClose` on overlay click; NOT called on content click |

#### New: `src/__tests__/StatsView.test.tsx` (19 tests)

| Group | Tests |
|-------|-------|
| Rendering | Input, button, button enabled/disabled states, loading state, error display |
| Stats display | Visits count, countries section, referrers section, country names, country counts |
| Empty states | Countries section hidden when empty; referrers hidden when empty; all hidden when `stats` is null |
| Slicing | Only first 5 countries shown when > 5 provided |
| Interactions | `onSubmit` called on form submit; `onInputChange` called on keystroke |

#### New: `src/__tests__/QuackCounter.test.tsx` (40 tests)

| Group | Tests |
|-------|-------|
| Basic display | Comma-formatted count, duck emoji, zero visits |
| Milestone detection | All 11 milestones (100 / 500 / 1k / 5k / 10k / 50k / 100k / 500k / 1M / 5M / 10M) — each tested at threshold and at threshold+50 |
| Non-milestone | Values outside a window do not trigger milestone styling |
| Color | Milestone → magenta; non-milestone → secondary text color |

#### New: `src/__tests__/i18n.test.tsx` (11 tests)

| Group | Tests |
|-------|-------|
| Key resolution | Top-level key resolves; nested dot-notation resolves; missing key returns key string; key resolving to object returns key string |
| Param substitution | `{{version}}` replaced; unmatched param preserved; numeric param; multiple params |
| Error handling | `useTranslation()` throws correct message outside provider |
| Provider | Renders children; nested components receive consistent translations |

---

## 8. Running Tests

```bash
# Backend (Cloudflare Workers pool via Miniflare)
npm run test
# or
npx vitest run --config vitest.config.ts

# Frontend (jsdom + @testing-library/react)
cd frontend && npm run test
# or
cd frontend && npx vitest run

# Both from root (runs frontend vitest config by default if no --config flag)
npx vitest run
```
