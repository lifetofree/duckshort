import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './types'

import { getLinks, createLink, updateLink, deleteLink, bulkDeleteLinks, getVariants, createVariant, deleteVariant, exportLinks, getGeoRedirects, createGeoRedirect, deleteGeoRedirect } from './handlers/admin'
import { redirectLink } from './handlers/redirect'
import { getStats, getGlobalStats } from './handlers/stats'
import { previewLink } from './handlers/preview'
import { showPasswordEntry, verifyPasswordEntry } from './handlers/password'
import { cleanupExpiredLinks } from './handlers/cleanup'
import { rateLimit } from './middleware/rateLimit'
import { resolveCustomDomain } from './middleware/customDomain'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors({
  origin: ['https://duckshort.cc', 'https://duckshort.pages.dev', 'http://localhost:3030', 'http://localhost:8787'],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// Custom domain resolution — must run before route matching
app.use('*', resolveCustomDomain())

// API routes
app.get('/api/stats/global', getGlobalStats)
app.get('/api/stats/:id', getStats)
app.get('/api/links', getLinks)
app.post('/api/links', rateLimit, createLink)
app.post('/api/links/bulk-delete', rateLimit, bulkDeleteLinks)
app.patch('/api/links/:id', updateLink)
app.delete('/api/links/:id', deleteLink)
app.get('/api/links/:id/variants', getVariants)
app.post('/api/links/:id/variants', createVariant)
app.delete('/api/links/variants/:variantId', deleteVariant)
app.get('/api/links/export', exportLinks)
app.get('/api/links/:id/geo-redirects', getGeoRedirects)
app.post('/api/links/:id/geo-redirects', createGeoRedirect)
app.delete('/api/links/geo-redirects/:geoId', deleteGeoRedirect)

// Frontend routes - proxy to Cloudflare Pages (must come BEFORE /:id)
app.get('/', async (c) => {
  try {
    const res = await fetch('https://duckshort.pages.dev/')
    return new Response(res.body, res)
  } catch {
    return c.json({ error: 'Failed to proxy to frontend' }, 502)
  }
})

app.get('/admin', async (c) => {
  try {
    const res = await fetch('https://duckshort.pages.dev/admin/')
    return new Response(res.body, res)
  } catch {
    return c.json({ error: 'Failed to proxy to frontend' }, 502)
  }
})

// Preview and password entry pages
app.get('/preview/:id', previewLink)
app.get('/password/:id', showPasswordEntry)
app.post('/password/:id', verifyPasswordEntry)

// Short link redirects (catch-all, must be LAST among GET routes)
app.get('/:id', redirectLink)

// Catch-all for other frontend routes — stream body to avoid corrupting binary assets
app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const pagesUrl = `https://duckshort.pages.dev${url.pathname}${url.search}`

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
    ctx.waitUntil(
      cleanupExpiredLinks(env).then(({ deleted }) => {
        console.log(`[cron] Cleaned up ${deleted} expired link(s)`)
      })
    )
  },
}
