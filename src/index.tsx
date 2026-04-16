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
app.post('/api/links/bulk-delete', bulkDeleteLinks)
app.patch('/api/links/:id', updateLink)
app.delete('/api/links/:id', deleteLink)
app.get('/api/links/:id/variants', getVariants)
app.post('/api/links/:id/variants', createVariant)
app.delete('/api/links/variants/:variantId', deleteVariant)

// Short link redirects
app.get('/preview/:id', previewLink)
app.get('/password/:id', showPasswordEntry)
app.post('/password/:id', verifyPasswordEntry)
app.get('/:id', redirectLink)

// Root route - proxy index.html from Pages so asset hashes are always current
app.get('/', async (c) => {
  try {
    const res = await fetch('https://duckshort.pages.dev/', {
      headers: { 'User-Agent': 'DuckShort-Worker/1.0' },
    })
    const html = await res.text()
    return c.html(html, 200, {
      'Cache-Control': 'no-store',
    })
  } catch {
    // Minimal fallback if Pages is unreachable
    return c.html(`<!doctype html><html><head><meta charset="UTF-8"/><title>DuckShort</title></head><body><div id="root"></div></body></html>`, 503)
  }
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

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
