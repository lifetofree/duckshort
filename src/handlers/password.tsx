/** @jsxImportSource hono/jsx */
import type { Context } from 'hono'
import type { Env } from '../types'
import { verifyPassword } from '../lib/auth'
import PasswordEntry from '../ui/pages/PasswordEntry'

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
    'SELECT original_url, disabled, expires_at, password_hash FROM links WHERE id = ?'
  ).bind(id).first<LinkRow>()

  if (!link || link.disabled || !link.password_hash) {
    return c.html('<h1>Link not found</h1>', 404)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.html('<h1>Link expired</h1>', 410)
  }

  return c.html(<PasswordEntry id={id} error={null} />)
}

export async function verifyPasswordEntry(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const link = await c.env.DB.prepare(
    `SELECT original_url, disabled, expires_at, password_hash,
            utm_source, utm_medium, utm_campaign
     FROM links WHERE id = ?`
  ).bind(id).first<LinkRow>()

  if (!link || link.disabled || !link.password_hash) {
    return c.html('<h1>Link not found</h1>', 404)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.html('<h1>Link expired</h1>', 410)
  }

  const body = await c.req.parseBody()
  const password = String(body.password ?? '')

  const valid = await verifyPassword(password, link.password_hash)
  if (!valid) {
    return c.html(<PasswordEntry id={id} error="Incorrect password" />, 401)
  }

  let destination = link.original_url
  destination = injectUtm(destination, link.utm_source, link.utm_medium, link.utm_campaign)

  const country = c.req.header('cf-ipcountry') || 'unknown'
  const referer = (c.req.header('referer') || 'unknown').slice(0, 255)
  const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)
  const timestamp = new Date().toISOString()

  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, country, referer, ua, timestamp).run()
  )

  return c.redirect(destination, 302)
}
