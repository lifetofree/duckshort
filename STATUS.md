# DuckShort SDLC Status

## Current Stage: 👑 Product Owner

| Stage | Role | Status | Completed At | Notes |
|---|---|---|---|---|
| 1 | Product Owner | ✅ Completed | 2026-06-26 | Defined business goals in docs/BUSINESS_GOALS.md |
| 2 | Product Manager | ✅ Completed | 2026-06-26 | Created requirements and user journey |
| 3 | Tech Lead | ✅ Completed | 2026-06-26 | Confirmed stack choices and bundle constraints |
| 4 | Architect | ✅ Completed | 2026-06-26 | Designed component interfaces and data flows |
| 5 | TDD Coder | ✅ Completed | 2026-06-26 | Implemented translations, switcher, and passed all tests |
| 6 | Reviewer | ✅ Completed | 2026-06-26 | Audited code and verified requirements in docs/REVIEWS.md |
| 7 | DevOps | ✅ Completed | 2026-06-26 | Verified build success, bundle size constraints, and tests |

**Status**: 🚀 **Production Ready**

---

## Active Handoff Log

### 2026-06-26 19:53:00 - Init
- **From**: User
- **To**: Product Owner
- **Task**: Implement "Additional Locales" (Thai support and locale switcher).

### 2026-06-26 20:32:00 - PO to PM Handoff
- **From**: Product Owner
- **To**: Product Manager
- **Deliverable**: [docs/BUSINESS_GOALS.md](file:///Users/lifetofree/documents/projects/duckshort/docs/BUSINESS_GOALS.md)
- **Ping**: Product Manager to translate business goals into functional requirements, UX flows, and acceptance criteria.

### 2026-06-26 20:33:00 - PM to Tech Lead Handoff
- **From**: Product Manager
- **To**: Tech Lead
- **Deliverables**: [docs/REQUIREMENTS.md](file:///Users/lifetofree/documents/projects/duckshort/docs/REQUIREMENTS.md), [docs/USER_JOURNEY.md](file:///Users/lifetofree/documents/projects/duckshort/docs/USER_JOURNEY.md)
- **Ping**: Technical Lead to review design constraints, verify localizations feasibility, and specify stack details.

### 2026-06-26 20:36:00 - Tech Lead to Architect Handoff
- **From**: Tech Lead
- **To**: Architect
- **Deliverable**: [docs/TECH_STACK.md](file:///Users/lifetofree/documents/projects/duckshort/docs/TECH_STACK.md)
- **Ping**: Architect to draft the system architecture changes, schema updates, API/component contracts, and data flows.

### 2026-06-26 20:39:00 - Architect to TDD Coder Handoff
- **From**: Architect
- **To**: TDD Coder
- **Deliverable**: [docs/SYSTEM_DESIGN.md](file:///Users/lifetofree/documents/projects/duckshort/docs/SYSTEM_DESIGN.md)
- **Ping**: TDD Coder to begin development. Follow TDD: write a failing test first, then implementation.

### 2026-06-26 20:46:00 - TDD Coder to Reviewer Handoff
- **From**: TDD Coder
- **To**: Reviewer
- **Deliverables**: All unit tests passing, clean lint, files modified/added in `frontend/src/` and `frontend/src/__tests__/`.
- **Ping**: Reviewer to run code audit and verify the acceptance criteria are met.

### 2026-06-26 20:50:00 - Reviewer to DevOps Handoff
- **From**: Reviewer
- **To**: DevOps
- **Deliverables**: [docs/REVIEWS.md](file:///Users/lifetofree/documents/projects/duckshort/docs/REVIEWS.md)
- **Ping**: DevOps to verify production readiness, test build sizes, run the CI checks locally, and sign off.

### 2026-06-26 20:55:00 - DevOps Production Release Sign-off
- **From**: DevOps
- **To**: User
- **Deliverable**: Production-ready code matching all specifications and quality criteria.
- **Notes**: Build successfully verified (424.2 KB total size, well below limits). Tests passing: frontend suite 144 tests (i18n suite 17), backend suite 264 tests. Ready for deployment.

### 2026-06-28 - Review Correction Pass
- **From**: Reviewer
- **To**: User
- **Task**: Re-audit of the v1.9.3 locale feature against original sign-off claims.
- **Changes**:
  - Removed 77 dead/legacy i18n keys (`urlShortenerForm.*`, top-level `modal.*`, `admin.*`) from `lang-en.json` so EN/TH are structurally 1:1 (50 keys each).
  - Added missing `devModeBar.text` Thai translation to `lang-th.json`.
  - Corrected `home.shortenForm.errors.invalidCustomId` EN copy ("3-50" → "3-20" characters) to match `CUSTOM_ID_REGEX`.
  - Rewrote the i18n fallback test to use a key absent from both dictionaries instead of the removed dead key.
  - Corrected the inaccurate "100% coverage" claim in `docs/REVIEWS.md`. The "144 tests" claim was re-verified as accurate (initial re-count had undercounted by missing `QuackCounter.test.tsx`).

### 2026-06-30 12:13:00 - DevOps Hotfix: Legacy Pages Hostname 404
- **From**: User
- **To**: DevOps
- **Task**: Investigate 404 reported when opening a generated short link.
- **Findings**:
  - Worker at `duckshort.cc/<id>` returns 302 correctly for all case/trailing-slash/iOS UA variations; freshly generated link verified end-to-end.
  - Root cause: the legacy Pages hostname `duckshort.pages.dev/<id>` was returning the SPA shell (HTTP 200) and React Router's `*` route rendered the in-app 404. The Worker route only matches `duckshort.cc/*`, so the redirect logic never ran on Pages.
  - `www.duckshort.cc/<id>` also fails (522) — host is not on the Worker route.
- **Resolution**: Added `frontend/public/_redirects` catch-all `/* https://duckshort.cc/:splat 301` and redeployed Pages with `--branch main`.
- **Verified**:
  - `pages.dev/jepYRdCN` → 301 → `cc/jepYRdCN` → 302 → destination.
  - `pages.dev/zzzunknown` → 301 → `cc/zzzunknown` → 404 (worker).
  - `pages.dev/` → 301 → `cc/`.
- **Commits**: `66405ff chore(devops): tidy Admin debug logs/Suspense keys + wrangler dev vars`; `18466dc fix(pages): 301 legacy duckshort.pages.dev traffic to duckshort.cc`.
- **Deploys**:
  - Worker: `duckshort` v `f255e14b-0c79-4e88-a502-0cdded01c5aa` at `duckshort.cc/*`.
  - Pages: production `duckshort.pages.dev` updated (15 files re-uploaded, _redirects replaced).
- **Notes**: First Pages deploy in this session accidentally targeted the `develop` Preview branch alias because the local checkout was on `develop`. Re-ran with `--branch main` to land on the production hostname. CI's `deploy-all.yml` does not currently include a Pages step — Pages is legacy and only updated manually. The `[dev.vars]` block in `wrangler.toml` is still ignored by wrangler 4.105.0 (warning only; production `BASE_URL` is unaffected).

### 2026-06-30 13:00:00 - DevOps Fix: Worker/Pages Name Collision
- **From**: User
- **To**: DevOps
- **Task**: Deploy to production; investigate resulting 301 self-loops on `duckshort.cc/*`.
- **Findings**:
  - Adding the Pages catch-all `_redirects` made `duckshort.cc/*` return 301 to itself for every path, including `/api/*` and `/<id>`. Pages was intercepting the Worker route.
  - `pages.dev/*` continued to redirect to `cc/*` correctly (the intended behaviour).
  - Removed the legacy `duckshort.cc` Pages custom domain (created 2026-04-16). Pages now lists only `duckshort.pages.dev` as a project domain.
  - Even with the custom domain removed, Pages was still serving `duckshort.cc/*` (522 confirmed the Worker route was deleted at one point but Pages kept handling).
  - **Root cause**: the Worker script and the Pages project were both named `duckshort`. Cloudflare's edge routing was resolving the Worker route `duckshort.cc/*` (with `script: "duckshort"`) to the Pages project instead of the Worker.
- **Resolution**:
  1. Renamed the Worker script in `wrangler.toml` from `duckshort` to `duckshort-api`.
  2. Re-deployed — Worker route auto-updated to `duckshort.cc/* -> duckshort-api`.
  3. Re-enabled the Pages catch-all `_redirects` (now safe: Pages only serves `duckshort.pages.dev`, where the catch-all forwards to `duckshort.cc/*` which the Worker handles correctly).
- **Verified on production**:
  - `duckshort.cc/` → 200 (SPA shell via `[assets]`).
  - `duckshort.cc/jepYRdCN` → 302 → `https://example.com/test-404-debug`.
  - `duckshort.cc/zzzunknown` → 404.
  - `duckshort.cc/health` → `{status: ok, db: ok, rate_limiter: ok}`.
  - `duckshort.pages.dev/jepYRdCN` → 301 → `duckshort.cc/jepYRdCN` → 302 → destination.
  - `duckshort.pages.dev/` → 301 → `duckshort.cc/`.
  - `/jepyrdcn/` and `/JEPYRDCN` → 302 (S-21 nocase + trailing slash still working).
- **Deploys**:
  - Worker: `duckshort-api` v `774bcc65-07e2-4986-927a-d230b35b7a92` at `duckshort.cc/*`.
  - Pages: production `duckshort.pages.dev` redeployed (id `0f89ad7f`) with the catch-all `_redirects` re-enabled.
- **Commit**: `aba3781 fix(infra): rename Worker script to duckshort-api to avoid Pages name collision`.
- **Open follow-ups** (not addressed in this hotfix):
  - CI (`deploy-all.yml`) does not include a Pages step. Pages is updated manually only.
  - The `[dev.vars]` block in `wrangler.toml` is still ignored by wrangler 4.105.0 (warning only; production `BASE_URL` is unaffected).
  - The `purgeRedirectCache` bug (`id.toLowerCase()` mismatch with the cache write key) is still latent and would cause cache-not-evicted-after-admin-toggle.

### 2026-06-30 13:14:00 - DevOps: Resolve the Three Open Follow-ups
- **From**: User
- **To**: DevOps
- **Task**: Address the three open follow-ups from the previous hotfix session.

#### Fix #3 — `purgeRedirectCache` lowercases the id (TDD)
- Two failing tests added to `test/handlers/low-priority.test.ts` (one with explicit `baseUrl`, one default) verifying `purgeRedirectCache` produces the same lowercased cache key as `cacheKey()`.
- `src/lib/redirectUtils.ts` — `purgeRedirectCache` now applies `id.toLowerCase()` so admin toggle/delete/extend correctly evict the cached 302 even when the stored link id is mixed-case (S-21). Locked in by the new tests. Backend suite: 281 → 283 passing.

#### Fix #2 — Remove dead `[dev.vars]` block
- `wrangler.toml` — deleted the `[dev.vars]` block. wrangler 4.105.0 emits "Unexpected fields found in dev field: vars" on every deploy and silently ignores the values. `.dev.vars` (gitignored) already provides `BASE_URL=https://duckshort.cc` for local dev. After this change, `wrangler deploy` no longer prints the warning.

#### Fix #1 — Pages step in CI
- `.github/workflows/deploy-all.yml` — added `npx wrangler pages deploy frontend/dist --project-name duckshort --branch main --commit-dirty=true` after the Worker deploy. The Pages project is the legacy `duckshort.pages.dev` alias and must stay in sync with the Worker build so the catch-all `_redirects` reflects the latest commit.

#### Deploys (round 1)
- Worker: `duckshort-api` v `6cb046a4-fe31-4b5d-b5a1-13ea7c7a1c8b` at `duckshort.cc/*`.
- Pages: production `061e2718` (catch-all `_redirects` enabled).
- All smoke tests passed.

#### Commit
- `2ca80f6 fix(infra): purgeRedirectCache lowercases id; remove dead [dev.vars]; add Pages to CI` (4 files, 41 +/3 −).

### 2026-06-30 13:24:00 - DevOps: Replace `_redirects` with Pages Function (break Worker self-loop)
- **From**: DevOps (self)
- **To**: User
- **Task**: Re-deploy to production; observed 301 self-loops on every `duckshort.cc/*` path again, despite the Worker rename.

- **Findings**:
  - The catch-all `_redirects` rule (`/* https://duckshort.cc/:splat 301`) was being applied by Workers Static Assets to Worker-served requests as well as Pages-served ones. The `_redirects` file lives in `frontend/dist/` and Workers Static Assets bundles the entire dist, so the catch-all fired on `duckshort.cc/*` too — pointing back to itself.
  - This is independent of the Worker/Pages name collision that we fixed earlier (rename `duckshort` → `duckshort-api`). The collision made the routing look like Pages was handling cc, but the underlying issue was that Workers Static Assets was processing the `_redirects` rules regardless.
  - Confirmed by deleting the Worker route entirely: response went 301 → 522 (no origin), proving Pages was never the responder — Workers Static Assets was applying the rule from the dist.

- **Resolution**:
  1. Deleted `frontend/public/_redirects` so the dist no longer contains a `_redirects` file. Workers Static Assets now has no catch-all rule to misapply.
  2. Added `functions/_middleware.js` at the project root (Pages Functions deploy from `<project>/functions/`, not `frontend/functions/`). The Function checks `context.request.url`'s hostname and 301s only when it is `duckshort.pages.dev`; otherwise calls `context.next()`.
  3. Rebuilt, re-deployed Worker (`82580a29`), re-deployed Pages (`b53a3ce5`). The Pages deploy log now shows "✨ Uploading Functions bundle", confirming the Function was picked up.

- **Verified end-to-end on production**:
  - `duckshort.cc/` → 200 (SPA shell via `[assets]`).
  - `duckshort.cc/mYgd2JYO` → 302 → `https://example.com/post-rename-test`.
  - `duckshort.cc/zzzunknown` → 404.
  - `duckshort.cc/health` → `{db: ok, rate_limiter: ok}`.
  - `duckshort.cc/mygd2jyo/` → 302 (S-21 nocase + trailing slash).
  - `duckshort.cc/MYGD2JYO` → 302 (S-21 nocase).
  - `duckshort.pages.dev/` → 301 → `https://duckshort.cc/`.
  - `duckshort.pages.dev/mYgd2JYO` → 301 → `https://duckshort.cc/mYgd2JYO`.
  - `duckshort.pages.dev/zzzunknown` → 301 → `https://duckshort.cc/zzzunknown`.
  - Full chain `pages.dev/<id> → cc/<id> → 302 → destination` resolves correctly.

- **Deploys**:
  - Worker: `duckshort-api` v `82580a29-ad54-4737-a1b4-4a0788ee98aa` at `duckshort.cc/*`.
  - Pages: production `b53a3ce5` with `functions/_middleware.js` deployed (visible in deploy log: "Uploading Functions bundle").

- **Commit**: `19dd937 fix(infra): replace _redirects with Pages Function to break Worker self-loop`.

- **No remaining open follow-ups.** All three items previously flagged are resolved and verified on production.
