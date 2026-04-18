import type { Context } from 'hono'
import type { Env } from '../types'
import { requireAuth, hashPassword } from '../lib/auth'
import { generateId } from '../lib/nanoid'

export async function getLinks(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const links = await c.env.DB.prepare(
    'SELECT id, original_url, created_at, expires_at, disabled, tag FROM links ORDER BY created_at DESC'
  ).all()

  // Fetch 7-day sparkline counts for each link
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sparklineRows = await c.env.DB.prepare(
    `SELECT link_id, date(timestamp) as day, COUNT(*) as count
     FROM analytics
     WHERE timestamp >= ?
     GROUP BY link_id, day
     ORDER BY link_id, day`
  ).bind(sevenDaysAgo).all<{ link_id: string; day: string; count: number }>()

  const sparklineByLink: Record<string, Record<string, number>> = {}
  for (const row of sparklineRows.results) {
    if (!sparklineByLink[row.link_id]) sparklineByLink[row.link_id] = {}
    sparklineByLink[row.link_id][row.day] = row.count
  }

  // Build 7-day arrays
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push(d.toISOString().slice(0, 10))
  }

  const result = links.results.map((link: any) => ({
    ...link,
    sparkline: days.map((day) => sparklineByLink[link.id]?.[day] ?? 0),
  }))

  return c.json(result)
}

export async function createLink(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const body = await c.req.json<{
    url: string
    customId?: string
    burn_on_read?: boolean
    expiresIn?: number
    password?: string
    tag?: string
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    webhook_url?: string
    og_title?: string
    og_description?: string
    og_image?: string
    variants?: Array<{ destination_url: string; weight?: number }>
  }>()

  if (!body.url) return c.json({ error: 'URL required' }, 400)

  let id = body.customId?.trim() || generateId()
  
  // If custom ID, validate format and check if it already exists
  if (body.customId) {
    const trimmed = body.customId.trim()
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(trimmed)) {
      return c.json({ error: 'Custom ID must be 3-50 characters (alphanumeric, underscore, hyphen)' }, 400)
    }
    
    const existing = await c.env.DB.prepare(
      'SELECT id FROM links WHERE id = ?'
    ).bind(id).first()
    if (existing) return c.json({ error: 'Custom alias already taken' }, 409)
  }

  const createdAt = new Date().toISOString()
  const expiresAt = body.expiresIn
    ? new Date(Date.now() + body.expiresIn * 1000).toISOString()
    : null
  const passwordHash = body.password ? await hashPassword(body.password) : null

  await c.env.DB.prepare(
    `INSERT INTO links
      (id, original_url, created_at, expires_at, password_hash, tag, utm_source, utm_medium, utm_campaign, webhook_url, burn_on_read, og_title, og_description, og_image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.url,
      createdAt,
      expiresAt,
      passwordHash,
      body.tag ?? null,
      body.utm_source ?? null,
      body.utm_medium ?? null,
      body.utm_campaign ?? null,
      body.webhook_url ?? null,
      body.burn_on_read ? 1 : 0,
      body.og_title ?? null,
      body.og_description ?? null,
      body.og_image ?? null,
    )
    .run()

  // Insert A/B variants if provided
  if (body.variants && body.variants.length > 0) {
    const stmts = body.variants.map((v) =>
      c.env.DB.prepare(
        'INSERT INTO link_variants (id, link_id, destination_url, weight) VALUES (?, ?, ?, ?)'
      ).bind(generateId(), id, v.destination_url, v.weight ?? 1)
    )
    await c.env.DB.batch(stmts)
  }

  return c.json({ id, shortUrl: `${c.env.BASE_URL}/${id}` })
}

export async function updateLink(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { id } = c.req.param()
  const body = await c.req.json<{
    action?: 'toggle' | 'extend'
    extendHours?: number
    disabled?: boolean
  }>()

  if (body.action === 'toggle') {
    const link = await c.env.DB.prepare(
      'SELECT disabled FROM links WHERE id = ?'
    ).bind(id).first<{ disabled: number }>()
    if (!link) return c.json({ error: 'Not found' }, 404)

    await c.env.DB.prepare(
      'UPDATE links SET disabled = ? WHERE id = ?'
    ).bind(link.disabled ? 0 : 1, id).run()
    return c.json({ success: true, disabled: !link.disabled })
  }

  if (body.action === 'extend') {
    const hours = body.extendHours ?? 24
    const link = await c.env.DB.prepare(
      'SELECT expires_at FROM links WHERE id = ?'
    ).bind(id).first<{ expires_at: string | null }>()
    if (!link) return c.json({ error: 'Not found' }, 404)

    const base = link.expires_at && new Date(link.expires_at) > new Date()
      ? new Date(link.expires_at)
      : new Date()
    const newExpiry = new Date(base.getTime() + hours * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(
      'UPDATE links SET expires_at = ?, disabled = 0 WHERE id = ?'
    ).bind(newExpiry, id).run()
    return c.json({ success: true, expires_at: newExpiry })
  }

  return c.json({ error: 'Unknown action' }, 400)
}

export async function deleteLink(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { id } = c.req.param()
  await c.env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
  return c.json({ success: true })
}

export async function bulkDeleteLinks(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { ids } = await c.req.json<{ ids: string[] }>()
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'ids array required' }, 400)
  }

  const stmts = ids.map((id) =>
    c.env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id)
  )
  await c.env.DB.batch(stmts)
  return c.json({ success: true, deleted: ids.length })
}

export async function getVariants(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { id } = c.req.param()
  const variants = await c.env.DB.prepare(
    'SELECT id, destination_url, weight FROM link_variants WHERE link_id = ?'
  ).bind(id).all()
  return c.json(variants.results)
}

export async function createVariant(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { id } = c.req.param()
  const { destination_url, weight } = await c.req.json<{
    destination_url: string
    weight?: number
  }>()
  if (!destination_url) return c.json({ error: 'destination_url required' }, 400)

  const variantId = generateId()
  await c.env.DB.prepare(
    'INSERT INTO link_variants (id, link_id, destination_url, weight) VALUES (?, ?, ?, ?)'
  ).bind(variantId, id, destination_url, weight ?? 1).run()
  return c.json({ id: variantId, link_id: id, destination_url, weight: weight ?? 1 })
}

export async function deleteVariant(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuth(c.env, c.req.header('Authorization'))
  if (auth) return auth

  const { variantId } = c.req.param()
  await c.env.DB.prepare('DELETE FROM link_variants WHERE id = ?').bind(variantId).run()
  return c.json({ success: true })
}
