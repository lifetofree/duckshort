# Contributing to DuckShort

Thanks for your interest in contributing! This project follows a strict multi-agent SDLC (see `skills/SKILL.md` in the repo) to keep code, tests, and docs in lockstep.

## Quick Start

```bash
# 1. Install
npm install
cd frontend && npm install && cd ..

# 2. Set local secrets
echo "ADMIN_SECRET=dev-secret" > .dev.vars
echo "BASE_URL=http://localhost:8787" >> .dev.vars

# 3. Run the dev stack
npm run dev               # worker on :8787
cd frontend && npm run dev  # SPA on :3030
```

## Development Workflow

Every change goes through the following stages. The full rationale lives in `skills/SKILL.md`; this is the cheat-sheet.

| Stage | Command | Purpose |
|-------|---------|---------|
| Lint | `npm run lint` | ESLint with zero warnings tolerated |
| Typecheck | `npm run typecheck` | `wrangler types && tsc --noEmit` |
| Test | `npm test` | Vitest on Workers pool (215+ tests) |
| Coverage | `npm run test:coverage` | Istanbul, 60% line/function/statement, 50% branch |
| Build (worker) | `npm run deploy` | `wrangler deploy` (requires `CLOUDFLARE_API_TOKEN`) |
| Build (frontend) | `cd frontend && npm run build:check-size` | Vite + bundle-size gate (entry ≤ 250 KB, total ≤ 1.5 MB) |

All five checks must pass locally before opening a PR. CI re-runs them on every push; PRs that break any check are auto-closed.

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) so Dependabot, release tooling, and code review can all pattern-match on the prefix.

```
<type>(<scope>): <short summary>
```

Common types:

| Type | When | Example |
|------|------|---------|
| `feat` | New user-facing feature | `feat(redirects): add weighted A/B variant selection` |
| `fix` | Bug fix | `fix(rate-limit): use per-bucket limit passed by middleware` |
| `refactor` | Code change with no behaviour delta | `refactor(lib): consolidate inline test schema into helpers/schema.ts` |
| `test` | Tests only | `test(security): add S-19 header regression` |
| `docs` | Docs only | `docs(security): document 1h session lifetime` |
| `chore` | Tooling / deps | `chore(deps): bump hono to 4.7` |
| `ci` | CI / CD | `ci(coverage): add Istanbul coverage gate` |

The subject line is capped at 72 characters; the body wraps at 80. Always include a `Co-authored-by:` trailer for AI assistance.

## Pull Requests

PRs are merged via squash. Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`) — it asks for a test plan and a rollback plan, which are mandatory.

Reviewers expect:

1. A short summary of the *why* (not the *what* — the diff shows that).
2. Linked issues (e.g. `Closes #123`, `Refs #456`).
3. A test plan that lists the test names you ran locally.
4. A rollback plan (which file to revert, or which flag to flip).
5. Screenshots for any UI change (the SPA is dark-themed, so use a dark-mode screenshot).

## Style Guide

- **TypeScript** strict, no `any`, no `as` casts outside the test suite.
- **Constants** go in `src/lib/constants.ts` with explicit literal type annotations.
- **DB row shapes** go in `src/lib/dbTypes.ts` — never inline them in handlers.
- **Env access** goes through `src/lib/env.ts` (`pagesOrigin`, `baseUrl`, `stripTrailingSlash`).
- **Tests** import `applySchema` / `clearAll` / `seedLink` from `test/helpers/schema.ts` — no inline schema.

## Filing Bugs

Open an issue on GitHub with a clear summary, reproduction steps, expected vs. actual behaviour, and severity (HIGH / MEDIUM / LOW). Reference the relevant code path in the title.
