import type { Context, MiddlewareHandler } from 'hono'
import type { Env } from '../types'
import { injectUtm } from '../lib/utm'

interface LinkRow {
  original_url: string
  disabled: number
  expires_at: string | null
  password_hash: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  webhook_url: string | null
  burn_on_read: number
  id: string
}

interface VariantRow {
  destination_url: string
  weight: number
}

function pickVariant(variants: VariantRow[]): string {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
  let random = Math.random() * totalWeight
  for (const v of variants) {
    random -= v.weight
    if (random <= 0) return v.destination_url
  }
  return variants[variants.length - 1].destination_url
}

export function resolveCustomDomain(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const hostname = c.req.header('host') || ''
    const baseUrl = c.env.BASE_URL || 'https://duckshort.cc'
    const primaryHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

    // Only intercept non-primary hostnames
    if (
      hostname === primaryHost ||
      hostname.endsWith(`.${primaryHost}`) ||
      hostname.includes('localhost') ||
      hostname.startsWith('127.') ||
      hostname === 'localhost:8787'
    ) {
      return next()
    }

    // Look up link by custom_domain
    const link = await c.env.DB.prepare(
      `SELECT id, original_url, disabled, expires_at, password_hash,
              utm_source, utm_medium, utm_campaign, webhook_url, burn_on_read,
              (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')) as is_expired
       FROM links WHERE custom_domain = ?`
    ).bind(hostname).first<LinkRow & { is_expired: number }>()

    if (!link) return next()

    if (link.disabled) {
      return c.json({ error: 'Link disabled' }, 404)
    }

    if (link.is_expired) {
      await c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ?').bind(link.id).run()
      return c.json({ error: 'Link expired' }, 410)
    }

    // Password-protected: redirect to entry page
    if (link.password_hash) {
      return c.redirect(`/password/${link.id}`, 302)
    }

    // Determine destination (A/B variants take priority)
    const variantsResult = await c.env.DB.prepare(
      'SELECT destination_url, weight FROM link_variants WHERE link_id = ?'
    ).bind(link.id).all<VariantRow>()

    let destination = link.original_url
    if (variantsResult.results.length > 0) {
      destination = pickVariant(variantsResult.results)
    }

    // Apply geo-redirect if country match exists
    const country = c.req.header('cf-ipcountry') || 'unknown'
    if (country && country !== 'unknown') {
      const geoRedirect = await c.env.DB.prepare(
        'SELECT destination_url FROM geo_redirects WHERE link_id = ? AND country_code = ?'
      ).bind(link.id, country.toUpperCase()).first<{ destination_url: string }>()
      if (geoRedirect) {
        destination = geoRedirect.destination_url
      }
    }

    destination = injectUtm(destination, link.utm_source, link.utm_medium, link.utm_campaign)

    // Handle burn_on_read: disable link atomically
    if (link.burn_on_read) {
      const result = await c.env.DB.prepare(
        'UPDATE links SET disabled = 1 WHERE id = ? AND disabled = 0'
      ).bind(link.id).run()
      if (result.meta.changes === 0) {
        return c.json({ error: 'Link disabled' }, 404)
      }
    }

    const referer = (c.req.header('referer') || 'unknown').slice(0, 255)
    const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)
    const timestamp = new Date().toISOString()

    c.executionCtx.waitUntil(
      (async () => {
        await c.env.DB.prepare(
          'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).bind(link.id, country, referer, ua, timestamp).run()

        if (link.webhook_url) {
          try {
            await fetch(link.webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ link_id: link.id, country, referer, timestamp }),
            })
          } catch {
            // Ignore webhook failures
          }
        }
      })()
    )

    return c.redirect(destination, 302)
  }
}
