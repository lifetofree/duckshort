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

// Root route - Serve frontend HTML
app.get('/', (c) => {
  return c.html(`
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="https://duckshort.pages.dev/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="DuckShort — Lightning-fast URL shortening at the Neon Pond" />
    <title>DuckShort | The Neon Pond</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <script type="module" crossorigin src="https://duckshort.pages.dev/assets/index-BrN49-oh.js"></script>
    <link rel="stylesheet" crossorigin href="https://duckshort.pages.dev/assets/index-BjtX5gEt.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
  `)
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
