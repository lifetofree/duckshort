/** @jsxImportSource hono/jsx */
import type { Context } from 'hono'
import type { Env } from '../types'
import Preview from '../ui/pages/Preview'

export async function previewLink(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()

  const link = await c.env.DB.prepare(
    'SELECT original_url, disabled, expires_at FROM links WHERE id = ?'
  ).bind(id).first<{ original_url: string; disabled: number; expires_at: string | null }>()

  if (!link || link.disabled) {
    return c.html('<h1>Link not found or disabled</h1>', 404)
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return c.html('<h1>Link expired</h1>', 410)
  }

  return c.html(<Preview id={id} destination={link.original_url} />)
}
