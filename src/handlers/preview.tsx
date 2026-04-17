/** @jsxImportSource hono/jsx */
import type { Context } from 'hono'
import type { Env } from '../types'
import Preview from '../ui/pages/Preview'
import NotFound from '../ui/pages/NotFound'

export async function previewLink(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()

  const link = await c.env.DB.prepare(
    `SELECT original_url, disabled, og_title, og_description, og_image,
     (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')) as is_expired
     FROM links WHERE id = ?`
  ).bind(id).first<{ original_url: string; disabled: number; is_expired: number; og_title: string | null; og_description: string | null; og_image: string | null }>()

  if (!link || link.disabled) {
    return c.html(<NotFound message="LINK NOT FOUND OR DISABLED" />, 404)
  }

  if (link.is_expired) {
    return c.html(<NotFound message="LINK EXPIRED" />, 410)
  }

  return c.html(
    <Preview
      id={id}
      destination={link.original_url}
      ogTitle={link.og_title ?? undefined}
      ogDescription={link.og_description ?? undefined}
      ogImage={link.og_image ?? undefined}
    />
  )
}
