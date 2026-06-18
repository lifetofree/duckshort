import type { Context } from 'hono'
import type { Env } from '../types'
import NotFound from '../ui/pages/NotFound'
import {
  loadLinkRow,
  dispatchRedirect,
  tryReadRedirectCache,
  recordAnalyticsFromCacheHit,
} from '../lib/redirectUtils'

export async function redirectLink(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()

  // 2.1: Cache hit path. Skip the D1 SELECT entirely; only the analytics
  // INSERT runs (in waitUntil) and the cached 302 returns. On a hot link
  // this cuts redirect latency to ~5-10ms.
  const cached = await tryReadRedirectCache(c.env, id)
  if (cached) {
    recordAnalyticsFromCacheHit(
      c.executionCtx, c.env.DB,
      cached.linkId, c.req.header('cf-ipcountry'),
      c.req.header('referer'), c.req.header('user-agent'),
      cached.webhookUrl
    )
    return c.redirect(cached.destination, 302)
  }

  const link = await loadLinkRow(c.env.DB, id)

  if (!link) {
    return c.html(<NotFound message="LINK NOT FOUND" />, 404)
  }

  return dispatchRedirect(c, link)
}
