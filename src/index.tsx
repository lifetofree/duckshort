import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './types'

import { getLinks, createLink, updateLink, deleteLink, bulkDeleteLinks, getVariants, createVariant, deleteVariant } from './handlers/admin'
import { redirectLink } from './handlers/redirect'
import { getStats, getGlobalStats } from './handlers/stats'
import { previewLink } from './handlers/preview'
import { showPasswordEntry, verifyPasswordEntry } from './handlers/password'
import { cleanupExpiredLinks } from './handlers/cleanup'
import { rateLimit } from './middleware/rateLimit'
const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors({
  origin: (origin) => origin ?? '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

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

// Frontend routes - proxy to Cloudflare Pages
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

// Short link redirects
app.get('/preview/:id', previewLink)
app.get('/password/:id', showPasswordEntry)
app.post('/password/:id', verifyPasswordEntry)
app.get('/:id', redirectLink)

// Catch-all for other frontend routes
app.all('*', async (c) => {
  const url = new URL(c.req.url)
  const pagesUrl = `https://duckshort.pages.dev${url.pathname}${url.search}`
  
  try {
    const response = await fetch(pagesUrl, {
      method: c.req.method,
      headers: c.req.header(),
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.text() : undefined,
    })
    
    const body = await response.text()
    
    return new Response(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/html',
        'Cache-Control': 'public, max-age=3600',
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
