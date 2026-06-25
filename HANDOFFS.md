# Handoffs

Live handoff notes for the next reviewer / session. Captures state that's not
self-evident from the commit log: open PR review status, in-flight blockers,
local-environment quirks, and where to resume.

Last updated: 2026-06-26 by an automated review session.

---

## Current release state

- **Latest release on `main`**: `a81c68a` — **v1.9.1** (`chore(release): bump version to 1.9.1 and update CHANGELOG`).
- **Deployed to production**: yes — `duckshort.cc` Worker version `ce9e1e9c`, Pages deployment `9c147b73.duckshort.pages.dev` (the Worker proxies the production domain through to it).
- **Branches in sync**: `main` and `develop` are at the same commit as of this handoff.

### What 1.9.1 contains (in merge order)

1. `524da02 fix(shorten)` — moved `POST /api/links` above the auth middleware with a `linksAuthGuard` that peeks at body to require auth only on admin-only fields (`tag`, `webhook_url`, `utm_*`, `og_*`, `variants`).
2. `6d59185 fix(shorten)` — added `frontend/src/lib/cookies.ts` + `X-XSRF-TOKEN` echo in `useShortenForm` so logged-in admins don't get 403 when submitting the public form.
3. `eda9b0b fix(csrf)` — added `X-XSRF-TOKEN` to CORS `allowHeaders`, extracted `frontend/src/lib/api-fetch.ts` utility, migrated `Admin.tsx`/`LinkCreateForm`/`GeoRedirectManager`/`VariantManager` to use it, **deleted all GitHub Actions workflows** (deploys are now manual `wrangler deploy`).
4. `31e508c fix(lint)` — downgraded `@eslint/js` to `^9.39.4` (proper peer resolution instead of `--legacy-peer-deps`), added `.wrangler/**` to eslint ignores, converted `constants.ts` literal types to `as const`.
5. `0676c86 ci` — installed eslint at the root, added `eslint.config.js` (105 lines, workerd/vitest globals, `test/**` override for `any`/`no-redeclare`/`no-unused-vars`), fixed four pre-existing `any` errors in `admin.ts`/`auth.ts`/`Layout.tsx`, dropped `--max-warnings=0` from the lint script.
6. `c7c9a70 fix(security)` — variant URL validation, `expiresIn` bounds check, password length cap, `generateId` collision retry, cron self-heal guard, name-based cookie parsing (replaced `cookieHeader.includes('admin_token=')` with proper name parsing).
7. `563f7b0 chore(release)` — bumped version to 1.9.1 + CHANGELOG.

---

## Open dependabot PRs — review status (2026-06-26)

Nine dependabot PRs are open against `develop`. Status of each:

| PR | Package(s) | Verdict | Action |
|----|------------|---------|--------|
| [#11](https://github.com/lifetofree/duckshort/pull/11) | frontend patch+minor (tailwindcss/vite, react-query, motion, eslint-plugin) | **APPROVE & MERGE** | Typecheck + build pass, no source changes, no regressions vs develop baseline. |
| [#2](https://github.com/lifetofree/duckshort/pull/2) | backend patch+minor — `hono`/`nanoid`/`typescript` patches **and** `@cloudflare/vitest-pool-workers ^0.5.0 → ^0.16.20` | **DO NOT MERGE** | The `vitest-pool-workers` 0.5 → 0.16 jump pulls in newer `@cloudflare/workers-types` that requires `ExecutionContext<unknown>` with a `tracing` field. Breaks typecheck in `admin.ts:224`, `redirect.tsx:20`, `password.tsx:61`, `redirectUtils.ts:167`. Comment posted recommending split. |
| [#3](https://github.com/lifetofree/duckshort/pull/3) | `vitest` 2.1 → 4.1 | **DO NOT MERGE** | Even with `vitest-pool-workers ^0.16.20` layered on top, `vitest.config.ts` line 1 imports `@cloudflare/vitest-pool-workers/config` — that subpath export was removed. Config load fails. |
| [#4](https://github.com/lifetofree/duckshort/pull/4) | `@vitest/coverage-istanbul` 2.1 → 4.1 | **DO NOT MERGE** | Companion to #3. Unmet peer dep with vitest 2. |
| [#6](https://github.com/lifetofree/duckshort/pull/6) | `@vitest/coverage-v8` 2.1 → 4.1 | **DO NOT MERGE** | Same as #4. |
| [#7](https://github.com/lifetofree/duckshort/pull/7) | `@vitejs/plugin-react` 4.7 → 6.0 | **UNVETTED** | Major bump. Likely drop-in for this codebase (no custom Babel config), but needs verification with Vite 5 / React 18 / React 19 compatibility. |
| [#8](https://github.com/lifetofree/duckshort/pull/8) | `react-dom` + `@types/react-dom` 18.3 → 19.2 | **UNVETTED** | React 19 typed ref-as-prop, dropped legacy context, changed `defaultProps` semantics. Needs source audit. |
| [#9](https://github.com/lifetofree/duckshort/pull/9) | `react-router-dom` 6.30 → 7.18 | **STALE — REBASE NEEDED** | Build + typecheck pass; missing all `src/__tests__/` files (stale branch off old develop). v7 supports `BrowserRouter`/`Routes`/`Route`/`MemoryRouter` unchanged (the only APIs this codebase uses). Peer is `react@^18 || ^19` — does not force React 19. |
| [#10](https://github.com/lifetofree/duckshort/pull/10) | `react` + `@types/react` 18.3 → 19.2 | **UNVETTED** | Big-bang React 19 upgrade. |

---

## Recommended release plan

| Version | Scope | Action |
|---------|-------|--------|
| **1.9.2** (patch) | Merge #11 | **DO NEXT.** Low risk. `gh pr review --approve 11` → squash → merge into develop → fast-forward main → `wrangler deploy` + `wrangler pages deploy`. |
| **1.9.3** (patch, optional) | Manual bump of the safe subset of #2: `hono ^4.0.0 → ^4.12.27`, `nanoid ^5.0.0 → ^5.1.16`, `typescript ^6.0.2 → ^6.0.3`. | Edit `package.json` by hand, run `npm install`, run `npm test` (must stay 264/264), commit + deploy. Skip the `vitest-pool-workers` bump — that's part of the 2.0.0 sprint. |
| **1.9.4** (patch, optional) | Rebase PR #9 onto current develop, re-run typecheck/test, merge. | Standalone react-router 7 works on React 18. Closes one major-version PR. |
| **2.0.0** (major) | React 19 (#10 + #8), @vitejs/plugin-react 6 (#7), vitest 4 stack (#3 + #4 + #6), `vitest.config.ts` rewrite, `ExecutionContext<unknown>` typing fixes across 4 files, possibly Vite 6 upgrade. | **Do not attempt as a dependabot merge.** Requires coordinated PR with code edits + test sweep. Track in a separate issue (recommended title: `v2.0.0 — React 19 + vitest 4 stack upgrade`). |

---

## CI / deploy state

- **GitHub Actions workflows deleted** in commit `eda9b0b` — `deploy-all.yml`, `deploy-frontend.yml`, `deploy-staging.yml`, `deploy-worker.yml`, `lint.yml` are gone.
- **Deploys are manual** via the local `~/.wrangler/config/default.toml` OAuth token (expires ~3h after issue, refresh by re-running `wrangler login`). Required scopes: `workers:write`, `d1:write`, `pages:write`, `workers_scripts:write`, `workers_routes:write`.
- **Backend deploy**: `npx wrangler deploy` from repo root. Wrangler auto-detects `wrangler.toml`.
- **Frontend deploy**: `cd frontend && npm run build && npx wrangler pages deploy frontend/dist --project-name duckshort`. Build output goes to `frontend/dist/`.
- **No automated gate**: dependabot PRs don't run CI now. Manual local verification is the only gate, hence the per-PR vetting in the table above.

---

## Known pre-existing debt (NOT blockers for 1.9.x)

These exist on `develop` independently of any open PR and should be tracked separately:

1. **Frontend lint baseline**: 1 error + 11 warnings on develop (`any` in `LinkCreateForm.tsx:56`; ~10 `err is defined but never used` warnings in admin components; 1 `useEffect` exhaustive-deps warning in `Admin.tsx`). The lint script has `--max-warnings=0` removed (commit `0676c86`) so it exits 0 with these in place.
2. **Frontend test baseline**: 23 of 138 tests fail on develop — all in `src/__tests__/Home.test.tsx` and `src/__tests__/Home-extended.test.tsx`. Root cause: `HomePage` uses `@tanstack/react-query` (`useGlobalStats`) but the test setup doesn't wrap `<HomePage />` in `QueryClientProvider`. Error: `No QueryClient set, use QueryClientProvider to set one`. Fix: wrap render with `QueryClientProvider` in `src/test/renderWithProviders.tsx`.
3. **Backend `vitest-pool-workers`**: pinned to `^0.5.0` for compatibility with the `ExecutionContext` (non-generic) signature used throughout `admin.ts`, `redirect.tsx`, `password.tsx`, `redirectUtils.ts`. Bumping requires either the typing fixes or staying on 0.5.x.
4. **No automated staging environment**: every manual `wrangler deploy` goes to production. No `wrangler deploy --env staging` workflow.

---

## Local environment quirks

- `npm install` in the root requires `--legacy-peer-deps` because `@typescript-eslint/parser` 8.61 and `@eslint/js` 9.39 don't formally peer-match (the project doesn't use npm workspaces, so the conflict surfaces).
- Frontend `npm install` similarly requires `--legacy-peer-deps` — same reason.
- `wrangler types` regenerates `worker-configuration.d.ts` — do not commit it unless intentionally updating types.
- `package-lock.json` is regenerated by `npm install` with no actual content changes — always check `git diff package-lock.json` before committing to confirm only the dependabot PR's intended delta.

---

## Where to resume

If you're picking this up cold:

1. **First decision**: do you want to ship 1.9.2 (PR #11) right now? If yes: `gh pr review --approve 11` → merge via GitHub UI → checkout main locally → `git pull` → `wrangler deploy` + build/deploy frontend.
2. **Second decision**: are you doing the 2.0.0 sprint now or deferring? If now, start by drafting the `vitest.config.ts` rewrite + `ExecutionContext<unknown>` fixes in a single PR against `develop`.
3. **Third decision**: should the `.github/dependabot.yml` be updated to scope the auto-groups? Current config groups patches+minors together, which is what bundled `@cloudflare/vitest-pool-workers` into PR #2 and broke it. Recommended split:
   - group "safe-patches" → patches only on `eslint`, `tailwindcss/vite`, `motion`, `react-query`, `nanoid`, `typescript`
   - group "vitest-stack" → all `vitest` ecosystem packages together
   - ignore majors by default → require `versioning-strategy: increase` override per-PR for major bumps

---

## Useful commands cheat sheet

```bash
# List dependabot PRs with key metadata
gh pr list --author app/dependabot --state open --json number,title,headRefName,additions,deletions,changedFiles

# Check out a PR locally
gh pr checkout <num>

# Run the full backend verification
npm run lint && npm run typecheck && npm test

# Run the full frontend verification
cd frontend && npm run lint && npx tsc --noEmit && npm test

# Build and deploy frontend
cd frontend && npm run build && npx wrangler pages deploy frontend/dist --project-name duckshort

# Deploy backend
cd .. && npx wrangler deploy
```
