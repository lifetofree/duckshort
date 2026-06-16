import type { Context } from 'hono'
import type { Env, RedirectLinkRow } from '../types'
import NotFound from '../ui/pages/NotFound'
import { resolveDestination, recordAnalytics, handleBurnOnRead } from '../lib/redirectUtils'

export async function redirectLink(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()

  const link = await c.env.DB.prepare(
    `SELECT id, original_url, disabled, expires_at, password_hash,
            utm_source, utm_medium, utm_campaign, webhook_url, burn_on_read,
            (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')) as is_expired
     FROM links WHERE id = ?`
  ).bind(id).first<RedirectLinkRow>()

  if (!link || link.disabled) {
    return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.is_expired) {
    await c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ?').bind(id).run()
    return c.html(<NotFound message="LINK EXPIRED" />, 410)
  }

  if (link.burn_on_read) {
    const burned = await handleBurnOnRead(c.env.DB, id)
    if (!burned) return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.password_hash) {
    return c.redirect(`/password/${id}`, 302)
  }

  const country = (c.req.header('cf-ipcountry') || 'unknown').toUpperCase()
  const referer = (c.req.header('referer') || 'unknown').slice(0, 255)
  const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)

  const destination = await resolveDestination(
    c.env.DB, id, link.original_url,
    link.utm_source, link.utm_medium, link.utm_campaign,
    country
  )

  recordAnalytics(c.executionCtx, c.env.DB, id, country, referer, ua, link.webhook_url)

  return c.redirect(destination, 302)
}
