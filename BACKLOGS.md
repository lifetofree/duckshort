# Backlogs

Active feature gaps, improvements, and missing roadmap items.
Resolved items are archived in `HISTORY.md`.

---

## Roadmap Gaps

### Custom Domains
- **Status**: Not yet implemented.
- **Approach**: Route matching logic to resolve incoming requests by custom domain, and a `custom_domain` column on the `links` table.

---

## Missing Features

### Additional Locales
- **Status**: Only English (`lang-en.json`) is currently wired; locale-switching UI not built.
- **Approach**: Extend `I18nProvider` to accept a `locale` prop, create `lang-th.json` (Thai translation template already exists in `lang-th.md`), add a language switcher component.

### Admin: search and filter
- All links shown in creation order with no search or sort.
- **Approach**: Add a search input and column sort on the links table.

---

## Improvements

### Neon Heatmap Visualization
- Transform the existing country stats into a visual geographic heatmap.
- **Approach**: Integrate a lightweight SVG map library in the `Home.tsx` stats tab to visualize `cf-ipcountry` data with neon glows.

### Geo-Fencing Redirects
- Redirect users to different URLs based on their country.
- **Approach**: Leverage the `cf-ipcountry` header in the redirect handler to match against a new `geo_redirects` table or column.

### Pagination for stats queries (frontend)
- The backend now accepts `?limit=N` (1–100, default 10) for top countries/referrers.
- **Status**: Done. `StatsView.tsx` now exposes a limit selector (Top 5/10/25/50/100).
- **Approach**: Expose a limit selector in `StatsView.tsx` so users can choose how many rows to show.

---

## Code Quality

### [LOW] CORS is fully open
- `origin: (origin) => origin ?? '*'` in `src/index.tsx` allows any origin.
- Not a bug for a public tool, but should be documented as intentional.

## Dependencies

### vitest 3 -> 4 / vitest-pool-workers upgrade (security)
- **Discovered**: 2026-06-26 npm audit.
- **Status**: DONE on branch `deps/vitest-4-upgrade` (PR pending).
- **Why**: Eliminates the remaining 12 audit vulnerabilities (4 critical, 4 high, 4 moderate) all transitive through `@cloudflare/vitest-pool-workers@^0.5.0` and `wrangler@^4.83.0` (devalue prototype pollution, undici smuggling/Set-Cookie injection, ws memory disclosure, esbuild dev-server leak, vite-node).
- **Required package.json bumps** (all applied):
  - `@cloudflare/vitest-pool-workers` `^0.5.0` -> `^0.16.20` (major)
  - `@vitest/coverage-istanbul` `^2.1.9` -> `^4.1.9` (major)
  - `@vitest/coverage-v8` `^2.1.9` -> `^4.1.9` (major)
  - `vitest` `^2.0.0` -> `^4.1.9` (major, transitive but pinned range)
- **Changes made**:
  - `vitest.config.ts` -> `vitest.config.mts` and rewritten to use `defineConfig` from `vitest/config` + the `cloudflareTest()` Vite plugin (the old `defineWorkersConfig` / `poolOptions.workers` shape is gone in 0.16). Renaming to `.mts` avoids the rolldown bundler trying to `require()` the now-ESM-only `@cloudflare/vitest-pool-workers` package.
  - `test/helpers/schema.ts`: extended `clearAll()` to also wipe the rate limiter Durable Object storage for the well-known test IP (`'unknown'`) under both buckets. This is required because vitest-pool-workers 0.16 + miniflare 4 deliberately **persist** DO state across `it` blocks within a test file (the old 0.5.x storage-stack reset no longer applies to DOs). Without this, sibling tests leak rate-limit counters into each other and 429 mid-suite.
  - `worker-configuration.d.ts`: regenerated via `wrangler types`.
- **Verification on the upgrade branch**:
  - `npm audit` -> 0 vulnerabilities (was 12).
  - `npm test` -> 264/264 green (was 258/264 green before the schema.ts fix).
  - `npm run typecheck` -> 0 errors.
  - `npm run lint` -> 0 errors, 4 warnings (same baseline as develop).
  - `npm run test:coverage` -> 89.17% stmts / 80.23% branches / 95.87% funcs / 91.33% lines, thresholds (60/60/50/60) all passed.
- **Follow-up**: `.github/dependabot.yml` `vitest-stack` group override can stay; it will continue to batch weekly PRs for vitest / @vitest / @cloudflare/vitest-pool-workers. No config change needed.
