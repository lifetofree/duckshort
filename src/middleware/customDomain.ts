import type { MiddlewareHandler } from 'hono'
import type { Env, RedirectLinkRow } from '../types'
import { resolveDestination, recordAnalytics, handleBurnOnRead } from '../lib/redirectUtils'

export function resolveCustomDomain(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const hostname = c.req.header('host') || ''
    const baseUrl = c.env.BASE_URL || 'https://duckshort.cc'
    const primaryHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

    if (
      hostname === primaryHost ||
      hostname.endsWith(`.${primaryHost}`) ||
      hostname.includes('localhost') ||
      hostname.startsWith('127.') ||
      hostname === 'localhost:8787'
    ) {
      return next()
    }

    // Skip custom domain lookup for API routes
    if (c.req.path.startsWith('/api/')) {
      return next()
    }

    const link = await c.env.DB.prepare(
      `SELECT id, original_url, disabled, expires_at, password_hash,
              utm_source, utm_medium, utm_campaign, webhook_url, burn_on_read,
              (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')) as is_expired
       FROM links WHERE custom_domain = ?`
    ).bind(hostname).first<RedirectLinkRow>()

    if (!link) return next()

    if (link.disabled) {
      return c.json({ error: 'Link disabled' }, 404)
    }

    if (link.is_expired) {
      await c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ?').bind(link.id).run()
      return c.json({ error: 'Link expired' }, 410)
    }

    if (link.password_hash) {
      return c.redirect(`/password/${link.id}`, 302)
    }

    if (link.burn_on_read) {
      const burned = await handleBurnOnRead(c.env.DB, link.id)
      if (!burned) return c.json({ error: 'Link disabled' }, 404)
    }

    const country = (c.req.header('cf-ipcountry') || 'unknown').toUpperCase()
    const referer = (c.req.header('referer') || 'unknown').slice(0, 255)
    const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)

    const destination = await resolveDestination(
      c.env.DB, link.id, link.original_url,
      link.utm_source, link.utm_medium, link.utm_campaign,
      country
    )

    recordAnalytics(c.executionCtx, c.env.DB, link.id, country, referer, ua, link.webhook_url)

    return c.redirect(destination, 302)
  }
}
