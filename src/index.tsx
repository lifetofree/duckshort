import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Context, Next } from 'hono'
import type { Env } from './types'
import { logger as appLogger } from './lib/logger'

import { getLinks, createLink, updateLink, deleteLink, bulkDeleteLinks, getVariants, createVariant, deleteVariant, exportLinks, getGeoRedirects, createGeoRedirect, deleteGeoRedirect } from './handlers/admin'
import { login, logout, checkAuth } from './handlers/auth'
import { redirectLink } from './handlers/redirect'
import { getStats, getGlobalStats } from './handlers/stats'
import { previewLink } from './handlers/preview'
import { showPasswordEntry, verifyPasswordEntry } from './handlers/password'
import { cleanupExpiredLinks } from './handlers/cleanup'
import { aggregateLinkStatsDaily } from './handlers/aggregate'
import { health } from './handlers/health'
import { rateLimit, type RateLimitBucket } from './middleware/rateLimit'
import { resolveCustomDomain } from './middleware/customDomain'
import { requireAuth, requireAuthFromContext, csrfTokensMatch } from './lib/auth'
import { pagesOrigin } from './lib/env'

const app = new Hono<{ Bindings: Env }>()

// S-19: Defence-in-depth security headers on every Worker response. The Pages
// site already sets these via `frontend/public/_headers`, but the Worker also
// serves SSR pages (preview, password, 404) and API JSON. We set the headers
// here so both surfaces are covered.
app.use('*', async (c: Context<{ Bindings: Env }>, next: Next) => {
  await next()
  // Skip if a handler already set the header to something specific
  if (!c.res.headers.get('X-Content-Type-Options')) {
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
  }
  if (!c.res.headers.get('X-Frame-Options')) {
    c.res.headers.set('X-Frame-Options', 'DENY')
  }
  if (!c.res.headers.get('Referrer-Policy')) {
    c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  }
  // 1.1: Content-Security-Policy. The default covers both the SSR pages and
  // the API JSON. For SSR pages (`/preview/:id`, `/password/:id`, 404) we
  // need:
  //   - 'unsafe-inline' for style-src — Layout.tsx ships a neon-themed
  //     <style> block
  //   - https://fonts.googleapis.com / https://fonts.gstatic.com — Orbitron
  //     + JetBrains Mono via the Google Fonts stylesheet
  //   - form-action 'self' — the password form POSTs back to the same origin
  // For API JSON, the CSP is technically not used (the response is not a
  // browsing context) but it is harmless and provides defence-in-depth if a
  // future bug ever returns HTML in a JSON endpoint.
  // Skip when a handler has already set the header — the Pages `app.get('/')`
  // proxy forwards the Pages `_headers` CSP, which is permissive enough for
  // the SPA bundle + Cloudflare Web Analytics beacon.
  if (!c.res.headers.get('Content-Security-Policy')) {
    c.res.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; ')
    )
  }
})

app.use('*', logger())
app.use('*', cors({
  origin: ['https://duckshort.cc', 'https://duckshort.pages.dev', 'http://localhost:3030', 'http://localhost:8787'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// Custom domain resolution — must run before route matching
app.use('*', resolveCustomDomain())

// P-16: Two separate rate-limit buckets. `api` (default) covers /api/* and the
// password verify endpoint at 20/hr. `redirect` covers /:id and /password/:id
// GET at 200/hr so shared IPs are not locked out by normal click traffic.
const apiRateLimit = (c: Context<{ Bindings: Env }>, next: Next) =>
  rateLimit(c, next, 'api' satisfies RateLimitBucket)
const redirectRateLimit = (c: Context<{ Bindings: Env }>, next: Next) =>
  rateLimit(c, next, 'redirect' satisfies RateLimitBucket)

// Public auth routes (rate-limited to prevent brute-force)
app.post('/api/auth', apiRateLimit, login)
app.post('/api/logout', logout)

// S-20: Public stats endpoints. The /api/stats/:id response intentionally
// omits the raw `referer` URL — we keep only the hostname to avoid leaking
// search queries / private paths. The endpoint remains unauthenticated by
// design (link owner can share the stats URL).
app.get('/api/stats/global', getGlobalStats)
app.get('/api/stats/:id', getStats)

// Auth middleware for all remaining /api/* routes (S-10: rate-limited + authed).
// Uses `requireAuthFromContext` so the auth_failed log line includes path / ip
// (1.3) — useful for spotting brute-force patterns in Cloudflare's dashboard.
//
// 1.4: double-submit CSRF check for state-changing requests. Runs after the
// auth check so unauthenticated callers see a 401, not a 403 — and so the
// login route (registered before this middleware) is exempt. The XSRF-TOKEN
// cookie is non-HttpOnly, so the SPA can read it and echo it back as the
// X-XSRF-TOKEN header. Constant-time match via timingSafeEqual.
//
// CSRF only applies to cookie-based auth — a Bearer header is never
// auto-attached by the browser, so the CSRF attack model does not apply.
// We detect cookie auth by the presence of the `admin_token` cookie.
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
app.use('/api/*', apiRateLimit, async (c, next) => {
  const auth = await requireAuthFromContext(c)
  if (auth) return auth
  if (STATE_CHANGING_METHODS.has(c.req.method)) {
    const cookieHeader = c.req.header('cookie') ?? ''
    if (cookieHeader.includes('admin_token=')) {
      const headerValue = c.req.header('X-XSRF-TOKEN')
      const match = await csrfTokensMatch(cookieHeader, headerValue)
      if (!match) {
        appLogger.warn('csrf_failed', {
          method: c.req.method,
          path: c.req.path,
          ip: c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For')?.split(',')[0]?.trim(),
        })
        return c.json({ error: 'CSRF token mismatch' }, 403)
      }
    }
  }
  return next()
})

// Protected API routes — registered AFTER the auth middleware so they inherit auth + rate-limit
// /api/auth/check is here (not before the middleware) to prevent the auth-bypass S-13
app.get('/api/auth/check', checkAuth)
app.get('/api/links', getLinks)
app.post('/api/links', createLink)
app.post('/api/links/bulk-delete', bulkDeleteLinks)
app.patch('/api/links/:id', updateLink)
app.delete('/api/links/:id', deleteLink)
app.get('/api/links/:id/variants', getVariants)
app.post('/api/links/:id/variants', createVariant)
app.delete('/api/links/variants/:variantId', deleteVariant)
app.get('/api/links/export', exportLinks)
app.get('/api/links/:id/geo-redirects', getGeoRedirects)
app.post('/api/links/:id/geo-redirects', createGeoRedirect)
app.delete('/api/links/geo-redirects/:geoId', deleteGeoRedirect)

// B-13: Pages proxy origin (4.1: env helper). Reads PAGES_URL with a fallback
// to the production Pages URL.
const pageOrigin = (c: Context<{ Bindings: Env }>) => pagesOrigin(c.env)

// Frontend routes - proxy to Cloudflare Pages (must come BEFORE /:id)
app.get('/', async (c) => {
  try {
    const res = await fetch(`${pageOrigin(c)}/`)
    return new Response(res.body, res)
  } catch {
    return c.json({ error: 'Failed to proxy to frontend' }, 502)
  }
})

app.get('/admin', async (c) => {
  try {
    const res = await fetch(`${pageOrigin(c)}/admin/`)
    return new Response(res.body, res)
  } catch {
    return c.json({ error: 'Failed to proxy to frontend' }, 502)
  }
})

// Preview and password entry pages
app.get('/preview/:id', previewLink)
// S-15: rate-limit password verification to deter brute-force attempts on link passwords
app.get('/password/:id', showPasswordEntry)
app.post('/password/:id', redirectRateLimit, verifyPasswordEntry)

// 3.4: Health check (unauthenticated, no rate limit). Returns 200 with
// { status: 'ok', components: { db, rate_limiter } } or 503 when D1 is down.
app.get('/health', health)

// Short link redirects (catch-all, must be LAST among GET routes)
// P-16: redirects use the higher "redirect" bucket (200/hr) so shared IPs are
// not locked out by normal click traffic.
app.get('/:id', redirectRateLimit, redirectLink)

// Catch-all for other frontend routes — stream body to avoid corrupting binary assets
app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const pagesUrl = `${pageOrigin(c)}${url.pathname}${url.search}`

  try {
    const response = await fetch(pagesUrl, {
      method: c.req.method,
      headers: c.req.header(),
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
    })

    const isHtml = response.headers.get('Content-Type')?.includes('text/html')

    return new Response(response.body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/html',
        // Short TTL for HTML; assets have content-addressed filenames so longer cache is fine
        'Cache-Control': isHtml
          ? 'public, max-age=0, must-revalidate'
          : (response.headers.get('Cache-Control') || 'public, max-age=3600'),
      },
    })
  } catch (err) {
    return c.json({ error: 'Failed to proxy to frontend' }, 502)
  }
})

export { RateLimiter } from './durableObjects/RateLimiter'

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 6.1: Pre-aggregate analytics → link_stats_daily hourly so the 7-day
    // sparkline queries can read from a tiny index rather than scan
    // analytics. Idempotent, so multiple invocations converge.
    ctx.waitUntil(
      aggregateLinkStatsDaily(env).catch((err) => {
        appLogger.error('cron_aggregate_failed', { error: String(err) })
      })
    )
    ctx.waitUntil(
      cleanupExpiredLinks(env).then(({ deleted }) => {
        appLogger.info('cron_cleanup', { deleted })
      })
    )
  },
}
