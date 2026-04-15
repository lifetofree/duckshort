import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './types'

import { getLinks, createLink, updateLink, deleteLink, bulkDeleteLinks, getVariants, createVariant, deleteVariant } from './handlers/admin'
import { redirectLink } from './handlers/redirect'
import { getStats, getGlobalStats } from './handlers/stats'
import { previewLink } from './handlers/preview'
import { showPasswordEntry, verifyPasswordEntry } from './handlers/password'

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
app.post('/api/links', createLink)
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

// Root route - API info (redirect to frontend UI)
app.get('/', (c) => {
  return c.redirect('https://40aca286.duckshort.pages.dev/')
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

export default app
