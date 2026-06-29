# Backlogs

Active feature gaps, improvements, and missing roadmap items.
Resolved items are archived in `HISTORY.md`.

---

## Roadmap Gaps

_(None — all roadmap items have shipped.)_

- ~~Custom Domains~~ — shipped v1.9.0
- ~~Additional Locales~~ — shipped v1.9.3 (Thai translation + language switcher)

---

## Missing Features

### Admin: search and filter
- All links shown in creation order with no search or sort.
- **Approach**: Add a search input and column sort on the links table.

---

## Improvements

### PLAN_IMPROVEMENT Wave 3
The remaining unimplemented items from `docs/PLAN_IMPROVEMENT.md`:
- **3.3** Webhook delivery retries (exponential back-off, `webhook_attempts` table)
- **5.1** End-to-end Playwright tests for the SPA
- **5.5** Visual regression testing for Admin dashboard
- **6.3** `link_settings` table for future per-link toggles
- **8.3** Generate OpenAPI spec from Hono handlers (`hono-openapi`)

---

## Code Quality

### [LOW] CORS allowlist is explicit
- `src/index.tsx` CORS `origin` is a hardcoded allowlist of `duckshort.cc`, `duckshort.pages.dev`, and the two localhost ports.
- Documented as intentional; not a bug for a public tool.

### [LOW] `vitest` major mismatch between workspaces
- Root `package.json` is on `vitest@^4.1.9` (Workers pool runs the backend tests).
- `frontend/package.json` is still on `vitest@^2.0.0` (frontend component tests).
- Works today because each workspace runs `vitest` against its own config, but `depcheck` will flag it as a "two installs" risk.
- **Approach**: Bump frontend to `vitest@^4` and verify `frontend/vitest.config.ts` + `frontend/src/__tests__/` are compatible. Captured under Wave 3 follow-ups.

---

## Dependencies

### `npm audit` is currently clean
- Last audit (2026-06-26, after PR #18 vitest 4 upgrade): **0 vulnerabilities**.
- Dependabot is configured (`vitest-stack` group override batches weekly updates for vitest / @vitest / @cloudflare/vitest-pool-workers).
- Action required: none, but re-run weekly.
