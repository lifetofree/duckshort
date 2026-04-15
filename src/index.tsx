import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import type { Env } from './types'

import { getLinks, createLink, deleteLink } from './handlers/admin'
import { redirectLink } from './handlers/redirect'
import { getStats } from './handlers/stats'
import Home from './ui/pages/Home'
import Admin from './ui/pages/Admin'
import NotFound from './ui/pages/NotFound'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors())

// Serve static assets from the frontend build
app.get('/assets/*', serveStatic({ root: './frontend/dist' }))
app.get('/favicon.svg', serveStatic({ root: './frontend/dist' }))
app.get('/icons.svg', serveStatic({ root: './frontend/dist' }))

app.get('/', (c) => c.html(<Home />))
app.get('/admin', (c) => c.html(<Admin />))
app.get('/:id', redirectLink)
app.get('/api/stats/:id', getStats)
app.get('/api/links', getLinks)
app.post('/api/links', createLink)
app.delete('/api/links/:id', deleteLink)

app.notFound((c) => c.html(<NotFound />, 404))

export default app
