# Handoffs

Live handoff notes for the next reviewer / session. Captures state that's not
self-evident from the commit log: open PR review status, in-flight blockers,
local-environment quirks, and where to resume.

Last updated: 2026-06-26 (npm audit fix applied; vitest 4 upgrade on `deps/vitest-4-upgrade`, PR pending)

---

## Current release state

- **Latest release on `main`**: **v1.9.2** (merged PR #11, resolved backend typecheck and frontend test/lint errors).
- **Deployed to production**: yes — `duckshort.cc` Worker version `0835b92a-c869-4e65-ad6c-1ae81176278c`, Pages deployment `5fcaedf5.duckshort.pages.dev` (the Worker proxies the production domain through to it).
- **Branches in sync**: `main` and `develop` are at the same commit (`6a7d480` / `5092026` + version bumps).

---

## Open PRs & in-flight blockers

- **None**: All previous typecheck mismatches, frontend test setup errors, and ESLint warnings have been resolved. PR #11 has been successfully merged and tested.

---

## Local environment status

- **Lint baseline**: 0 errors, 4 warnings on `develop` (non-blocking unused vars and hook dependency warnings).
- **Test baseline**: 100% green (138/138 frontend tests pass, 264/264 backend tests pass — verified after the 2026-06-26 safe `npm audit fix`).
- **Typecheck baseline**: 100% green (0 errors).

## Security: npm audit (2026-06-26)

Ran `npm audit` against the current dependency tree. Initial state: **15 vulnerabilities (4 moderate, 7 high, 4 critical)**.

`npm audit fix` (non-breaking) applied on develop and verified:

- `hono` resolved to `4.12.27` (within `^4.0.0`), patches 7 Hono advisories (JSX HTML injection, CORS credentials reflection, bodyLimit bypass, IPv6 deny bypass, etc.).
- `postcss` resolved to `8.5.15` (transitive via vite), patches the `<style>` XSS advisory.
- Post-fix verification: `npm test` 264/264 green, `npm run typecheck` clean, `npm run lint` 0 errors / 4 warnings.

The remaining **12 vulnerabilities** (transitive through `@cloudflare/vitest-pool-workers@^0.5.0` and `wrangler@^4.83.0`) were resolved on branch **`deps/vitest-4-upgrade`** via the vitest 3 -> 4 + vitest-pool-workers 0.5 -> 0.16 breaking-change upgrade (see BACKLOGS → Dependencies). After the upgrade:

- `npm audit` -> **0 vulnerabilities**.
- 264/264 backend tests green.
- 89.17% statements / 80.23% branches / 95.87% funcs / 91.33% lines (coverage thresholds 60/60/50/60 all pass).

### Test infra changes on `deps/vitest-4-upgrade`

- `vitest.config.ts` was renamed to `vitest.config.mts` and rewritten to use `defineConfig` from `vitest/config` + the `cloudflareTest()` Vite plugin. The old `defineWorkersConfig` / `poolOptions.workers` helper is gone in 0.16. The `.mts` rename avoids the rolldown config bundler trying to `require()` the now-ESM-only package.
- `test/helpers/schema.ts` `clearAll()` now also resets the rate limiter Durable Object storage for the `'unknown'` IP under both `api` and `redirect` buckets. vitest-pool-workers 0.16 deliberately persists DO state across `it` blocks within a file (the old per-test storage-stack reset no longer applies to DOs), so tests that share an IP key now leak rate-limit counters into each other unless explicitly cleared. PR #TBD will include this fix.
