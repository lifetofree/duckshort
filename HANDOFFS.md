# Handoffs

Live handoff notes for the next reviewer / session. Captures state that's not
self-evident from the commit log: open PR review status, in-flight blockers,
local-environment quirks, and where to resume.

Last updated: 2026-06-26 (safe `npm audit fix` shipped; vitest 4 upgrade merged to develop via PR #18, awaiting production deploy)

---

## Current release state

- **Latest release on `main`**: **v1.9.2** (merged PR #11, resolved backend typecheck and frontend test/lint errors).
- **Deployed to production**: yes — `duckshort.cc` Worker version `085f8931-2b9f-4eb7-a0f5-e5140d4317e7`, Pages deployment `eb82fb82.duckshort.pages.dev` (the Worker proxies the production domain through to the latest Pages deployment). Manual deploy performed today because the `deploy-all.yml` workflow was removed in commit `2c8bde7`.
- **Branches in sync**: `main` and `develop` both at `e72ac7a` (ahead of `main` is `976b914` on `develop` — the vitest 4 upgrade merge).

---

## Open PRs & in-flight blockers

- **None open**. **PR #18** (vitest 4 + vitest-pool-workers 0.16 upgrade, `deps/vitest-4-upgrade` -> `develop`) was merged via squash on 2026-06-26 as commit `976b914`. It is **not yet deployed to production** — production is still running the previous safe-audit-fix build. A manual `wrangler deploy` + `wrangler pages deploy` is needed to ship the test-pool upgrade.

---

## Local environment status

- **Lint baseline**: 0 errors, 4 warnings on `develop` (non-blocking unused vars and hook dependency warnings).
- **Test baseline**: 100% green (138/138 frontend tests pass, 264/264 backend tests pass — verified after the 2026-06-26 safe `npm audit fix`).
- **Typecheck baseline**: 100% green (0 errors).

## Security: npm audit (2026-06-26)

Ran `npm audit` against the current dependency tree. Initial state: **15 vulnerabilities (4 moderate, 7 high, 4 critical)**.

**Round 1 — safe `npm audit fix`** applied on develop and shipped to production:

- `hono` resolved to `4.12.27` (within `^4.0.0`), patches 7 Hono advisories (JSX HTML injection, CORS credentials reflection, bodyLimit bypass, IPv6 deny bypass, etc.).
- `postcss` resolved to `8.5.15` (transitive via vite), patches the `<style>` XSS advisory.
- Verification: `npm test` 264/264 green, `npm run typecheck` clean, `npm run lint` 0 errors / 4 warnings.

**Round 2 — vitest 3 -> 4 / vitest-pool-workers 0.5 -> 0.16 breaking-change upgrade** merged on develop via PR #18 (squash commit `976b914`) on 2026-06-26. Brings `npm audit` from 12 remaining vulnerabilities to **0**.

- 264/264 backend tests green on the merged commit.
- 89.17% statements / 80.23% branches / 95.87% funcs / 91.33% lines (coverage thresholds 60/60/50/60 all pass).

### Test infra changes shipped in PR #18

- `vitest.config.ts` was renamed to `vitest.config.mts` and rewritten to use `defineConfig` from `vitest/config` + the `cloudflareTest()` Vite plugin. The old `defineWorkersConfig` / `poolOptions.workers` helper is gone in 0.16. The `.mts` rename avoids the rolldown config bundler trying to `require()` the now-ESM-only `@cloudflare/vitest-pool-workers` package.
- `test/helpers/schema.ts` `clearAll()` now also resets the rate limiter Durable Object storage for the `'unknown'` IP under both `api` and `redirect` buckets. vitest-pool-workers 0.16 deliberately persists DO state across `it` blocks within a file (the old per-test storage-stack reset no longer applies to DOs), so tests that share an IP key now leak rate-limit counters into each other unless explicitly cleared. PR #18 includes this fix.
