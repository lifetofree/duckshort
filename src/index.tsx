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
import { timingSafeEqual } from './lib/auth'

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

// Admin login form HTML
function adminLoginHtml(error = '') {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Login — DuckShort</title><style>*{box-sizing:border-box;margin:0;padding:0}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0E14;font-family:'JetBrains Mono',monospace}.card{border:1px solid rgba(0,242,255,0.2);border-radius:12px;padding:2.5rem;width:100%;max-width:360px;display:flex;flex-direction:column;gap:1.25rem}h1{font-family:Orbitron,sans-serif;color:#00F2FF;font-size:1.4rem;letter-spacing:2px;text-shadow:0 0 10px #00F2FF}label{font-size:0.65rem;letter-spacing:2px;color:#8892a4;text-transform:uppercase}input[type=password]{width:100%;padding:.75rem;background:#13171f;border:1px solid rgba(0,242,255,0.2);border-radius:8px;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:.85rem;outline:none}input[type=password]:focus{border-color:#00F2FF}button{padding:.85rem;background:#00F2FF;border:none;border-radius:8px;color:#0B0E14;font-family:Orbitron,sans-serif;font-weight:700;font-size:.85rem;letter-spacing:2px;cursor:pointer}.error{color:#FF0055;font-size:.7rem;letter-spacing:1px}</style></head><body><div class="card"><h1>ADMIN ACCESS</h1>${error ? `<p class="error">${error}</p>` : ''}<form method="POST" action="/admin"><label for="p">Secret</label><input id="p" type="password" name="password" autofocus autocomplete="current-password"><button type="submit">ENTER</button></form></div></body></html>`
}

// Admin route — cookie-gated, proxies to Pages SPA when authenticated
app.get('/admin', async (c) => {
  const cookie = c.req.header('cookie') ?? ''
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('admin_token='))?.slice('admin_token='.length)
  const valid = token && c.env.ADMIN_SECRET ? await timingSafeEqual(token, c.env.ADMIN_SECRET) : false
  if (!valid) return c.html(adminLoginHtml(), 401)
  try {
    const res = await fetch('https://duckshort.pages.dev/')
    return new Response(res.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
  } catch {
    return c.json({ error: 'Failed to proxy to frontend' }, 502)
  }
})

app.post('/admin', async (c) => {
  const body = await c.req.parseBody()
  const password = (body['password'] as string) ?? ''
  const valid = c.env.ADMIN_SECRET ? await timingSafeEqual(password, c.env.ADMIN_SECRET) : false
  if (!valid) return c.html(adminLoginHtml('Invalid secret. Try again.'), 401)
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin',
      'Set-Cookie': `admin_token=${c.env.ADMIN_SECRET}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
    },
  })
})

// Short link redirects
app.get('/preview/:id', previewLink)
app.get('/password/:id', showPasswordEntry)
app.post('/password/:id', verifyPasswordEntry)
app.get('/:id', redirectLink)

// Root route - proxy to Pages
app.get('/', async (c) => {
  try {
    const res = await fetch('https://duckshort.pages.dev/')
    return new Response(res.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
  } catch {
    return c.json({ error: 'Failed to proxy to frontend' }, 502)
  }
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

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
