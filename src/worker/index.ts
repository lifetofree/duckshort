import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/cloudflare-workers'
import { showRoutes } from 'hono/dev'
import type { Env } from './types'

import admin from './handlers/admin'
import redirect from './handlers/redirect'
import stats from './handlers/stats'
import home from './ui/pages/Home'
import adminPage from './ui/pages/Admin'
import notFound from './ui/pages/NotFound'

const app = new Hono<{ Bindings: Env }>()

app.use('*', logger())
app.use('*', cors())

app.get('/', home)
app.get('/admin', adminPage)
app.get('/redirect/:id', redirect)
app.get('/api/stats/:id', stats)
app.get('/api/links', admin)
app.post('/api/links', admin)
app.delete('/api/links/:id', admin)

app.notFound(notFound)

export default app