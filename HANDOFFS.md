# Handoffs

Live handoff notes for the next reviewer / session. Captures state that's not
self-evident from the commit log: open PR review status, in-flight blockers,
local-environment quirks, and where to resume.

Last updated: 2026-06-26 (v1.9.3 — vitest 4 + Thai locale + Workers Static Assets, awaiting production deploy)

---

## Current release state

- **Latest release on `main`**: **v1.9.3** (CHANGELOG entry dated 2026-06-26; covers safe `npm audit fix`, vitest 4 / vitest-pool-workers 0.16 upgrade on `develop`, CI restore, Workers Static Assets frontend serving, and the Thai locale feature on the SDLC path).
- **Deployed to production**: still running **v1.9.2** (`duckshort.cc` Worker `085f8931-2b9f-4eb7-a0f5-e5140d4317e7`, Pages alias `eb82fb82.duckshort.pages.dev`). The v1.9.3 changes (vitest 4, Workers Static Assets, Thai locale) are merged on `develop` and ready to ship via a manual `wrangler deploy` + `wrangler pages deploy frontend/dist --project-name duckshort`.
- **Branches in sync**: `develop` ahead of `main` — squash `976b914` (PR #18 vitest 4 upgrade) plus the v1.9.3 SDLC handoff artifacts (Thai locale feature) and commit `2c8bde7` (Static Assets switch).

---

## Open PRs & in-flight blockers

- **None open**. PR #18 (vitest 4 / vitest-pool-workers 0.16) merged via squash `976b914` on 2026-06-26.
- **Production deploy pending** for v1.9.3 (vitest 4 upgrade + Workers Static Assets + Thai locale). Manual deploy needed; `deploy-all.yml` workflow was recreated but currently uses `workflow_dispatch` only (auto-deploy on push to `main` is intentionally disabled).

---

## Local environment status

- **Lint baseline**: 0 errors, 4 warnings on `develop` (non-blocking unused vars and hook dependency warnings).
- **Test baseline**: 100% green — 138/138 frontend tests, 264/264 backend tests after the vitest 4 merge.
- **Typecheck baseline**: 100% green (0 errors).
- **Coverage** (post vitest 4 upgrade): 89.17% stmts / 80.23% branches / 95.87% funcs / 91.33% lines — well above the 60/60/50/60 gate.

---

## Security: npm audit (2026-06-26)

Final state: **0 vulnerabilities** after both rounds.

**Round 1 — safe `npm audit fix`** (shipped v1.9.2 → production):
- `hono` resolved to `4.12.27` (within `^4.0.0`), patches 7 Hono advisories.
- `postcss` resolved to `8.5.15` (transitive via vite), patches the `<style>` XSS advisory.

**Round 2 — vitest 3 → 4 / vitest-pool-workers 0.5 → 0.16 breaking upgrade** (PR #18, merged `976b914`):
- Brings the audit count from 12 remaining → **0**.
- Backend package bumps: `@cloudflare/vitest-pool-workers` `^0.5.0` → `^0.16.20`, `vitest` `^2.0.0` → `^4.1.9`, `@vitest/coverage-istanbul` / `@vitest/coverage-v8` `^2.1.9` → `^4.1.9`.
- Frontend `package.json` was NOT bumped in PR #18 — frontend tests still run on `vitest@^2.0.0`. This works today because each workspace has its own lockfile, but tracked under BACKLOGS.md → "vitest major mismatch between workspaces".

### Test infra changes shipped in PR #18
- `vitest.config.ts` → `vitest.config.mts`. Rewritten to use `defineConfig` from `vitest/config` + the `cloudflareTest()` Vite plugin (the old `defineWorkersConfig` / `poolOptions.workers` helper is gone in 0.16). The `.mts` rename avoids the rolldown config bundler trying to `require()` the now-ESM-only `@cloudflare/vitest-pool-workers` package.
- `test/helpers/schema.ts` `clearAll()` now also resets the rate limiter Durable Object storage for the `'unknown'` IP under both `api` and `redirect` buckets. vitest-pool-workers 0.16 deliberately persists DO state across `it` blocks within a file (the old per-test storage-stack reset no longer applies to DOs), so tests that share an IP key now leak rate-limit counters into each other unless explicitly cleared.

---

## v1.9.3 — other shipped work

- **Workers Static Assets**: frontend is now served from the Worker via `assets.binding = "ASSETS"` (`wrangler.toml`), with `not_found_handling = "single-page-application"`. The `GET /`, `GET /admin`, and catch-all routes delegate to `c.env.ASSETS.fetch(c.req.raw)`. `_redirects` + `_headers` in `frontend/public/` are no longer required for the Worker-served path.
- **Thai locale + Language Switcher**: shipped via the SDLC framework (PO → PM → Tech Lead → Architect → TDD Coder → Reviewer → DevOps). Artifacts: `docs/BUSINESS_GOALS.md`, `docs/REQUIREMENTS.md`, `docs/USER_JOURNEY.md`, `docs/SYSTEM_DESIGN.md`, `docs/TECH_STACK.md`, `docs/REVIEWS.md`, `STATUS.md`. New files: `frontend/src/locales/lang-th.json`, `frontend/src/components/LanguageSwitcher.tsx`. Persists in `localStorage` under `duckshort_locale`.
- **CI restore**: `.github/workflows/deploy-all.yml` recreated as `workflow_dispatch` only (no auto-deploy on push to `main` — that's intentional per commit `2c8bde7` "Switch to dev-only environment, disable auto-deploy CI").
