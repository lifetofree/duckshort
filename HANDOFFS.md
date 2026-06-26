# Handoffs

Live handoff notes for the next reviewer / session. Captures state that's not
self-evident from the commit log: open PR review status, in-flight blockers,
local-environment quirks, and where to resume.

Last updated: 2026-06-26 (npm audit fix applied; breaking-change upgrade tracked in BACKLOGS)

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

`npm audit fix` (non-breaking) applied and verified:

- `hono` resolved to `4.12.27` (within `^4.0.0`), patches 7 Hono advisories (JSX HTML injection, CORS credentials reflection, bodyLimit bypass, IPv6 deny bypass, etc.).
- `postcss` resolved to `8.5.15` (transitive via vite), patches the `<style>` XSS advisory.
- Post-fix verification: `npm test` 264/264 green, `npm run typecheck` clean, `npm run lint` 0 errors / 4 warnings.

Remaining **12 vulnerabilities (4 moderate, 4 high, 4 critical)** are all transitive through `@cloudflare/vitest-pool-workers@^0.5.0` and `wrangler@^4.83.0`. The only clean resolution is `npm audit fix --force`, which would bump:

- `@cloudflare/vitest-pool-workers` 0.5.x -> 0.16.20 (semver-major, pulls in vitest 4 + miniflare that patches undici/ws/devalue/esbuild)
- `@vitest/coverage-istanbul` 2.1.9 -> 4.1.9 (semver-major)
- `@vitest/coverage-v8` 2.1.9 -> 4.1.9 (semver-major)

Tracked in `BACKLOGS.md` → "Dependencies: vitest 3 -> 4 / vitest-pool-workers upgrade". Dependabot is currently configured to ignore semver-major bumps and to group the vitest stack, so this needs a manual PR.
