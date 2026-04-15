import type { Context } from 'hono'
import type { Env } from '../types'

export async function redirectLink(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()

  const link = await c.env.DB.prepare(
    'SELECT original_url, disabled, expires_at FROM links WHERE id = ?'
  ).bind(id).first()

  if (!link || link.disabled) {
    return c.html('<h1>Link not found or expired</h1>', 404)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    await c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ?').bind(id).run()
    return c.html('<h1>Link expired</h1>', 410)
  }

  const country = c.req.header('cf-ipcountry') || 'unknown'
  const referer = (c.req.header('referer') || 'unknown').slice(0, 255)
  const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)

  c.executionCtx.waitUntil(
    c.env.DB.prepare(
      'INSERT INTO analytics (link_id, country, referer, user_agent) VALUES (?, ?, ?, ?)'
    ).bind(id, country, referer, ua).run()
  )

  return c.redirect(link.original_url, 302)
}