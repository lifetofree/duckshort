/** @jsxImportSource hono/jsx */
import type { Context } from 'hono'
import type { Env } from '../types'
import { verifyPassword } from '../lib/auth'
import PasswordEntry from '../ui/pages/PasswordEntry'
import NotFound from '../ui/pages/NotFound'

interface LinkRow {
  original_url: string
  disabled: number
  expires_at: string | null
  password_hash: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

function injectUtm(
  url: string,
  source: string | null,
  medium: string | null,
  campaign: string | null
): string {
  if (!source && !medium && !campaign) return url
  try {
    const u = new URL(url)
    if (source) u.searchParams.set('utm_source', source)
    if (medium) u.searchParams.set('utm_medium', medium)
    if (campaign) u.searchParams.set('utm_campaign', campaign)
    return u.toString()
  } catch {
    return url
  }
}

export async function showPasswordEntry(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const link = await c.env.DB.prepare(
    `SELECT original_url, disabled, password_hash,
            (expires_at IS NOT NULL AND expires_at < datetime('now')) as is_expired
     FROM links WHERE id = ?`
  ).bind(id).first<LinkRow & { is_expired: number }>()

  if (!link || link.disabled || !link.password_hash) {
    return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.is_expired) {
    return c.html(<NotFound message="LINK EXPIRED" />, 410)
  }

  return c.html(<PasswordEntry id={id} error={null} />)
}

export async function verifyPasswordEntry(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const link = await c.env.DB.prepare(
    `SELECT original_url, disabled, password_hash,
            utm_source, utm_medium, utm_campaign, burn_on_read,
            (expires_at IS NOT NULL AND expires_at < datetime('now')) as is_expired
     FROM links WHERE id = ?`
  ).bind(id).first<LinkRow & { is_expired: number; burn_on_read: number }>()

  if (!link || link.disabled || !link.password_hash) {
    return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.is_expired) {
    return c.html(<NotFound message="LINK EXPIRED" />, 410)
  }

  const body = await c.req.parseBody()
  const password = String(body.password ?? '')

  const valid = await verifyPassword(password, link.password_hash)
  if (!valid) {
    return c.html(<PasswordEntry id={id} error="Incorrect password" />, 401)
  }

  // Handle burn_on_read
  if (link.burn_on_read) {
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ?').bind(id).run()
    )
  }

  let destination = link.original_url
  destination = injectUtm(destination, link.utm_source, link.utm_medium, link.utm_campaign)

  const country = c.req.header('cf-ipcountry') || 'unknown'
  const referer = (c.req.header('referer') || 'unknown').slice(0, 255)
  const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)
  const timestamp = new Date().toISOString()

  // Fetch webhook_url for analytics (not in first query)
  const meta = await c.env.DB.prepare(
    'SELECT webhook_url FROM links WHERE id = ?'
  ).bind(id).first<{ webhook_url: string | null }>()

  c.executionCtx.waitUntil(
    (async () => {
      await c.env.DB.prepare(
        'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, country, referer, ua, timestamp).run()

      if (meta?.webhook_url) {
        try {
          await fetch(meta.webhook_url, {
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
