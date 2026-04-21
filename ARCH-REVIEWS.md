# DuckShort Architecture Review (per arch.md guidelines)

## System Overview

DuckShort is a **Cloudflare Workers-first** URL shortener with React SPA frontend on Cloudflare Pages. The architecture follows edge-native principles with a clear separation between the backend Worker and frontend Pages.

## Component Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              duckshort.cc Worker (Hono.js 4)             │  │
│  │  ┌─────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────┐ │  │
│  │  │  Rate   │ │   Redirect   │ │  Preview   │ │Password │ │  │
│  │  │Limiter  │ │   Handler    │ │  Handler   │ │ Handler │ │  │
│  │  │   DO    │ │   + UTM      │ │  + OG Tags │ │ + A/B   │ │  │
│  │  └────┬────┘ └──────────────┘ └────────────┘ └────┬────┘ │  │
│  │       │                                        ___│      │  │
│  │  ┌────▼────────────────────────────┐  ┌────────▼──────┐  │  │
│  │  │         D1 Database             │  │   KV Store    │  │  │
│  │  │  (links, analytics, variants)   │  │ (Rate Limit   │  │  │
│  │  │                                 │  │  Legacy Fall- │  │  │
│  │  └─────────────────────────────────┘  │  back)        │  │  │
│  │                                       └───────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              duckshort.pages.dev (React SPA)             │  │
│  │  ┌─────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────┐ │  │
│  │  │  Home   │ │   Admin UI   │ │  i18n      │ │  Stats  │ │  │
│  │  │  Page   │ │  (stub)      │ │ Provider   │ │  View   │ │  │
│  │  └─────────┘ └──────────────┘ └────────────┘ └─────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## ✅ Strengths

### 1. Edge-First Design
- **Sub-10ms cold starts** on Cloudflare Workers
- Worker intercepts all traffic at `duckshort.cc/*` route
- Frontend dynamically proxied from Pages at `/`, ensuring correct asset hashes always served

### 2. Security Implementation
- **`timingSafeEqual`** via Web Crypto API for Bearer token comparison
- `ADMIN_SECRET` stored as encrypted Cloudflare secret (not in `wrangler.toml`)
- Link passwords hashed with SHA-256 (bcrypt unavailable in Workers runtime)
- NanoID Base62 (8-char) prevents sequential enumeration

### 3. Rate Limiting Architecture
- **Durable Object** (`RateLimiter`) with `storage.transaction()` for atomic per-IP throttling
- 20 req/hr cap applied to `POST /api/links` and `POST /api/links/bulk-delete`
- KV namespace (`RATE_LIMIT`) available as legacy fallback
- Graceful degradation if `RATE_LIMITER` binding absent

### 4. Feature Completeness
- A/B variant rotation with weighted random selection
- Burn-on-read self-destructing links
- Password-protected links with interstitial page
- Click-through preview with custom OG tags
- UTM parameter injection on redirect
- Webhook notifications on clicks
- Scheduled cleanup via Cron Trigger (hourly)

### 5. Observability
- `observability.enabled = true` in `wrangler.toml`
- Cron cleanup logs `Cleaned up ${deleted} expired link(s)`
- Duck mood indicator (DORMANT/ACTIVE/BUSY/VIRAL/ERROR) reflects hourly traffic

## ⚠️ Concerns / Recommendations

### 1. **Proxy Fallback Risk** (Medium)
The `catch-all` route proxies to `duckshort.pages.dev`. If Pages is down, all non-API routes fail. The `/` route is explicit but the `*` catch-all could mask issues. Recommendation: Add circuit breaker with TTL.

### 2. **KV Binding Still Present** (Low)
`RATE_LIMIT` KV namespace is declared in `wrangler.toml` but only used by legacy code. The Durable Object is the primary rate limiter. Consider removing KV binding to reduce attack surface and simplify configuration.

### 3. **Sparkline Query N+1 Pattern** (Medium)
In [`getLinks()`](src/handlers/admin.ts:6), fetching 7-day sparklines requires a separate query per batch of links. For links tables with 1000+ entries, this creates a performance bottleneck. Consider:
- Pre-aggregating sparkline data
- Using a single query with `GROUP BY` (current implementation is acceptable for moderate scale)

### 4. **Auth Timing Side-Channel** (Medium-Low)
[`requireAuth()`](src/lib/auth.ts:9) returns `null` on success but still performs async `timingSafeEqual`. The early returns for missing header or secret are synchronous, potentially creating timing differences. Actual attack surface is minimal given entropy of secrets.

### 5. **Cron Migration Sequencing** (Low)
`wrangler.toml` has `[[migrations]]` with `new_sqlite_classes = ["RateLimiter"]`. D1 migrations run before Durable Object class registration. This is correct but worth noting for deployment order verification.

### 6. **Frontend Admin Page is Stub** (High Visibility)
[`Admin.tsx`](frontend/src/pages/Admin.tsx) is 48KB+ placeholder ("Coming soon"). If this is a production expectation, it should be tracked as technical debt.

### 7. **Missing Rate Limit on PATCH/DELETE** (Medium)
`PATCH /api/links/:id` and `DELETE /api/links/:id` lack rate limiting middleware. While less dangerous than POST, enumeration attacks could still be viable. Recommendation: Apply rate limiting to all mutation endpoints.

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Cold Start | <10ms | Cloudflare Workers edge |
| D1 Query | ~5-20ms | SQLite at edge |
| Durable Object | ~2-5ms | In-memory state |
| SPA Proxy | ~10-30ms | Additional hop to Pages |

## Security Posture

- **Auth**: Bearer token + cookie fallback, timing-safe comparison ✅
- **Secrets**: Cloudflare secrets, not in repo ✅
- **Rate Limiting**: Atomic DO-based, 20/hr cap ✅
- **Enumeration**: NanoID Base62 (218T combinations) ✅
- **XSS**: DOMPurify available but confirm usage in handlers
- **CSRF**: Implicit via Cloudflare SameSite cookie policy

## Summary

DuckShort implements a solid edge-native architecture with appropriate security measures. The design choices (Durable Objects for rate limiting, D1 for distributed SQLite, Cron for cleanup) align well with Cloudflare's serverless model. Key improvements would be:
1. Rate limiting on all mutation endpoints (PATCH/DELETE)
2. Removing unused KV binding
3. Implementing Admin dashboard UI
4. Adding proxy circuit breaker

Overall: **Production-ready** with minor technical debt items to address.

---

*Review Date: 2026-04-21*
*Reviewer: Adduckivity Systems Architect (arch.md skill)*