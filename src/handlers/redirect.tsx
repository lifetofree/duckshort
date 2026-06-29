import type { Context } from 'hono'
import type { Env } from '../types'
import NotFound from '../ui/pages/NotFound'
import {
  loadLinkRow,
  dispatchRedirect,
  tryReadRedirectCache,
  recordAnalyticsFromCacheHit,
  normalizeLinkId,
} from '../lib/redirectUtils'

export async function redirectLink(c: Context<{ Bindings: Env }>) {
  // S-21: normalise the id — strip a trailing slash so `VibeCoding-01/`
  // resolves instead of falling through to the SPA shell. Case is preserved
  // here; loadLinkRow + the cache key handle case-insensitivity.
  const id = normalizeLinkId(c.req.param('id') ?? '')

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
