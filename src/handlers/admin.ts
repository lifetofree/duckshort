import type { Context } from 'hono'
import type { Env } from '../types'
import { requireAuth } from '../lib/auth'
import { generateId } from '../lib/nanoid'

export async function getLinks(c: Context<{ Bindings: Env }>) {
  const auth = requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const result = await c.env.DB.prepare(
    'SELECT id, original_url, created_at, expires_at, disabled FROM links ORDER BY created_at DESC'
  ).all()
  return c.json(result)
}

export async function createLink(c: Context<{ Bindings: Env }>) {
  const auth = requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { url, expiresIn } = await c.req.json<{ url: string; expiresIn?: number }>()
  if (!url) return c.json({ error: 'URL required' }, 400)

  const id = generateId()
  const createdAt = new Date().toISOString()
  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

  await c.env.DB.prepare(
    'INSERT INTO links (id, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(id, url, createdAt, expiresAt).run()

  return c.json({ id, shortUrl: `${c.env.BASE_URL}/${id}` })
}

export async function deleteLink(c: Context<{ Bindings: Env }>) {
  const auth = requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
  return c.json({ success: true })
}