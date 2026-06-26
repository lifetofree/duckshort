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
- **Status**: Not started. Tracked here because it requires coordinated manual changes (semver-major, Dependabot ignores majors).
- **Why**: Eliminates the remaining 12 audit vulnerabilities (4 critical, 4 high, 4 moderate) all transitive through `@cloudflare/vitest-pool-workers@^0.5.0` and `wrangler@^4.83.0` (devalue prototype pollution, undici smuggling/Set-Cookie injection, ws memory disclosure, esbuild dev-server leak, vite-node).
- **Required package.json bumps**:
  - `@cloudflare/vitest-pool-workers` `^0.5.0` -> `^0.16.20` (major)
  - `@vitest/coverage-istanbul` `^2.1.9` -> `^4.1.9` (major)
  - `@vitest/coverage-v8` `^2.1.9` -> `^4.1.9` (major)
  - `vitest` `^2.0.0` -> `^4.0.0` (major, transitive but pinned range)
- **Known touch points**:
  - `vitest.config.ts`: `defineWorkersConfig` API may have changed; `poolOptions.workers.miniflare.bindings` shape likely updated (vitest-pool-workers 0.16 uses miniflare 4, binding names vs IDs).
  - `wrangler.toml` / `.dev.vars`: confirm compat with the bundled wrangler version (test pool reuses project wrangler).
  - `worker-configuration.d.ts`: regenerate via `wrangler types` after bump.
  - `test/**`: 264 backend tests should still pass, but coverage provider API (`@vitest/coverage-istanbul`) had breaking changes between v2 and v4 — re-run `npm run test:coverage` and verify the `thresholds` block is still honoured.
  - `.github/dependabot.yml`: remove `vitest-stack` group override once we're on the new major, or split it into `vitest-3-stack` / `vitest-4-stack` during the transition.
- **Approach**: Create a feature branch `deps/vitest-4-upgrade`, run `npm install @cloudflare/vitest-pool-workers@^0.16.20 @vitest/coverage-istanbul@^4.1.9 @vitest/coverage-v8@^4.1.9 vitest@^4.0.0`, fix any breakage in `vitest.config.ts` and tests, run `npm run typecheck && npm run lint && npm test && npm run test:coverage`, then open a PR with the audit output before/after attached.
- **Acceptance**: `npm audit` reports 0 vulnerabilities; full test/lint/typecheck green; coverage thresholds still enforced.
