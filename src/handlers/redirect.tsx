import type { Context } from 'hono'
import type { Env } from '../types'
import NotFound from '../ui/pages/NotFound'
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

export async function redirectLink(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()

  const link = await c.env.DB.prepare(
    `SELECT original_url, disabled, expires_at, password_hash,
            utm_source, utm_medium, utm_campaign, webhook_url, burn_on_read,
            (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')) as is_expired
     FROM links WHERE id = ?`
  ).bind(id).first<LinkRow & { is_expired: number; burn_on_read: number }>()

  if (!link || link.disabled) {
    return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.is_expired) {
    await c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ?').bind(id).run()
    return c.html(<NotFound message="LINK EXPIRED" />, 410)
  }

  // Handle burn_on_read: disable link atomically for future use
  if (link.burn_on_read) {
    const result = await c.env.DB.prepare(
      'UPDATE links SET disabled = 1 WHERE id = ? AND disabled = 0'
    ).bind(id).run()
    
    // If no rows were updated, another request already disabled this link
    if (result.meta.changes === 0) {
      return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
    }
  }

  // Password-protected: redirect to entry page
  if (link.password_hash) {
    return c.redirect(`/password/${id}`, 302)
  }

  // Determine destination URL (A/B variants take priority)
  const variantsResult = await c.env.DB.prepare(
    'SELECT destination_url, weight FROM link_variants WHERE link_id = ?'
  ).bind(id).all<VariantRow>()

  let destination = link.original_url
  if (variantsResult.results.length > 0) {
    destination = pickVariant(variantsResult.results)
  }

  destination = injectUtm(destination, link.utm_source, link.utm_medium, link.utm_campaign)

  const country = c.req.header('cf-ipcountry') || 'unknown'
  const referer = (c.req.header('referer') || 'unknown').slice(0, 255)
  const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)
  const timestamp = new Date().toISOString()

  c.executionCtx.waitUntil(
    (async () => {
      await c.env.DB.prepare(
        'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, country, referer, ua, timestamp).run()

      if (link.webhook_url) {
        try {
          await fetch(link.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link_id: id, country, referer, timestamp }),
          })
        } catch {
          // Ignore webhook failures
        }
      }
    })()
  )

  return c.redirect(destination, 302)
}
