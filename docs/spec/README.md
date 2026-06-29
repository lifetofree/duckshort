# DuckShort — Technical Spec

Technical reference documentation for the DuckShort URL shortener.
Mirrors the canonical summary in `AGENTS.md` (which is the source of truth —
this directory is the deep-dive).

| Document | Description |
|----------|-------------|
| [TECH_STACK.md](./TECH_STACK.md) | Stack choices, versions, runtime config, coding standards, rate limits |
| [DATABASE.md](./DATABASE.md) | D1 schema, all tables, columns, indexes, migration history |
| [API.md](./API.md) | Full API reference — all endpoints, request/response contracts, errors |
| [OPERATIONS.md](../OPERATIONS.md) | Backup cadence, restore procedure, prod→local copy, migration rules, secrets workflow, incident response, staging |
| [PLAN_IMPROVEMENT.md](../PLAN_IMPROVEMENT.md) | Wave-by-wave improvement plan (Wave 1 + Wave 2 shipped; Wave 3 open) |

**As of:** 2026-06-26 | **Stage:** Production (v1.9.3)

See also: `AGENTS.md` (canonical project summary), `BACKLOGS.md` (active gaps), `HISTORY.md` (archived resolved tasks).

## Note on `SYSTEM_DESIGN.md`

The `SYSTEM_DESIGN.md` historically in this folder was a low-level architecture doc. With the v1.9.3 Workers Static Assets migration, bucket split, HMAC session model, and Wave 2 changes, that doc became stale. It has been replaced by the canonical architecture overview in `AGENTS.md` (see "Core Architecture" and "Routing Architecture" sections). For ad-hoc feature-level design docs, see `docs/` (e.g., the SDLC framework artifacts `BUSINESS_GOALS.md`, `REQUIREMENTS.md`, `USER_JOURNEY.md`, `SYSTEM_DESIGN.md`, `REVIEWS.md` are produced per-feature under the multi-agent workflow).
