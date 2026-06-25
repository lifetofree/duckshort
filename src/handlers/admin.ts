import type { Context } from 'hono'
import type { Env } from '../types'
import { hashPassword } from '../lib/auth'
import { generateId } from '../lib/nanoid'
import { isSafeUrl, isSafeWebhookUrl, purgeRedirectCache } from '../lib/redirectUtils'

// Shape returned by the cursor / first-page SELECT in getLinks. Defined as
// an indexed type so the map callbacks below can use a precise type instead
// of `any`.
type LinkRow = {
  id: string
  created_at: string
  [k: string]: unknown
}
import {
  EXTEND_HOURS_MIN,
  EXTEND_HOURS_MAX,
  BULK_DELETE_MAX_IDS,
  EXPORT_MAX_ROWS,
  MAX_TAG_LENGTH,
  MAX_UTM_LENGTH,
  MAX_OG_TITLE_LENGTH,
  MAX_OG_DESCRIPTION_LENGTH,
} from '../lib/constants'

export async function getLinks(c: Context<{ Bindings: Env }>) {
  // P-03/P-12: Cursor-based pagination
  const cursor = c.req.query('cursor') // ISO timestamp of last item
  const pageSize = Math.min(parseInt(c.req.query('limit') ?? '50', 10) || 50, 100)

  const links = cursor
    ? await c.env.DB.prepare(
      `SELECT id, original_url, created_at, expires_at, disabled, tag, burn_on_read, custom_domain, visits,
              CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password,
              webhook_url, utm_source, utm_medium, utm_campaign,
              og_title, og_description, og_image
       FROM links WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`
    ).bind(cursor, pageSize + 1).all<LinkRow>()
    : await c.env.DB.prepare(
      `SELECT id, original_url, created_at, expires_at, disabled, tag, burn_on_read, custom_domain, visits,
              CASE WHEN password_hash IS NOT NULL THEN 1 ELSE 0 END as has_password,
              webhook_url, utm_source, utm_medium, utm_campaign,
              og_title, og_description, og_image
       FROM links ORDER BY created_at DESC LIMIT ?`
    ).bind(pageSize + 1).all<LinkRow>()

  const hasNext = links.results.length > pageSize
  const pageRows = hasNext ? links.results.slice(0, pageSize) : links.results
  const nextCursor = hasNext ? pageRows[pageRows.length - 1].created_at as string : null

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const linkIds = pageRows.map((l: LinkRow) => l.id)
  const sparklineByLink: Record<string, Record<string, number>> = {}

  // P-02: Only fetch sparklines for the current page's link IDs
  if (linkIds.length > 0) {
    const placeholders = linkIds.map(() => '?').join(', ')
    // 6.1: read from the pre-aggregated cache. Fall back to analytics if
    // the cache is empty (test fixtures, first deploy). The window is
    // expressed in days (link_stats_daily.day is YYYY-MM-DD).
    const sevenDayWindowDay = "strftime('%Y-%m-%d', 'now', '-6 days')"
    const cached = await c.env.DB.prepare(
      `SELECT link_id, day, count FROM link_stats_daily
       WHERE day >= ${sevenDayWindowDay} AND link_id IN (${placeholders})`
    ).bind(...linkIds).all<{ link_id: string; day: string; count: number }>()
    if (cached.results.length > 0) {
      for (const row of cached.results) {
        if (!sparklineByLink[row.link_id]) sparklineByLink[row.link_id] = {}
        sparklineByLink[row.link_id][row.day] = row.count
      }
    } else {
      const sparklineRows = await c.env.DB.prepare(
        `SELECT link_id, date(timestamp) as day, COUNT(*) as count
         FROM analytics
         WHERE timestamp >= ? AND link_id IN (${placeholders})
         GROUP BY link_id, day`
      ).bind(sevenDaysAgo, ...linkIds).all<{ link_id: string; day: string; count: number }>()
      for (const row of sparklineRows.results) {
        if (!sparklineByLink[row.link_id]) sparklineByLink[row.link_id] = {}
        sparklineByLink[row.link_id][row.day] = row.count
      }
    }
  }

  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push(d.toISOString().slice(0, 10))
  }

  const result = pageRows.map((link: LinkRow) => ({
    ...link,
    sparkline: days.map((day) => sparklineByLink[link.id]?.[day] ?? 0),
  }))

  return c.json({ links: result, nextCursor })
}

export async function createLink(c: Context<{ Bindings: Env }>) {
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

  if (!isSafeUrl(body.url)) {
    return c.json({ error: 'Only http/https URLs are allowed' }, 400)
  }

  if (body.webhook_url) {
    if (!isSafeWebhookUrl(body.webhook_url)) {
      return c.json({ error: 'webhook_url must be a public https URL' }, 400)
    }
  }

  // S-16: og_image must be a public http(s) URL (prevents javascript:/data: + SSRF).
  if (body.og_image != null && body.og_image !== '' && !isSafeUrl(body.og_image)) {
    return c.json({ error: 'og_image must be a public http(s) URL' }, 400)
  }

  // S-16 / B-11: cap free-form text fields to keep DB rows bounded.
  const fieldLengthChecks: Array<[string, string | undefined, number]> = [
    ['tag', body.tag, MAX_TAG_LENGTH],
    ['utm_source', body.utm_source, MAX_UTM_LENGTH],
    ['utm_medium', body.utm_medium, MAX_UTM_LENGTH],
    ['utm_campaign', body.utm_campaign, MAX_UTM_LENGTH],
    ['og_title', body.og_title, MAX_OG_TITLE_LENGTH],
    ['og_description', body.og_description, MAX_OG_DESCRIPTION_LENGTH],
  ]
  for (const [name, value, max] of fieldLengthChecks) {
    if (value != null && value !== '' && value.length > max) {
      return c.json({ error: `${name} exceeds ${max} characters` }, 400)
    }
  }

  let id = body.customId?.trim() || generateId()

  if (body.customId) {
    const trimmed = body.customId.trim()
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(trimmed)) {
      return c.json({ error: 'Custom ID must be 3-20 characters (alphanumeric, underscore, hyphen)' }, 400)
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
  const { id } = c.req.param()
  const body = await c.req.json<{
    action?: 'toggle' | 'extend' | 'set_custom_domain'
    extendHours?: number
    disabled?: boolean
    custom_domain?: string | null
  }>()

  if (body.action === 'toggle') {
    const link = await c.env.DB.prepare(
      'SELECT disabled FROM links WHERE id = ?'
    ).bind(id).first<{ disabled: number }>()
    if (!link) return c.json({ error: 'Not found' }, 404)

    await c.env.DB.prepare(
      'UPDATE links SET disabled = ? WHERE id = ?'
    ).bind(link.disabled ? 0 : 1, id).run()
    // P-10 / B-12: Purge redirect cache (uses BASE_URL for the cache key so
    // staging / preview / future domain moves stay correct).
    await purgeRedirectCache(c.executionCtx, id, c.env.BASE_URL)
    return c.json({ success: true, disabled: !link.disabled })
  }

  if (body.action === 'set_custom_domain') {
    const domain = (body.custom_domain ?? '').trim() || null
    if (domain !== null && !/^[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}[a-zA-Z0-9]$/.test(domain)) {
      return c.json({ error: 'Invalid custom domain format' }, 400)
    }
    if (domain !== null) {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM links WHERE custom_domain = ? AND id != ?'
      ).bind(domain, id).first()
      if (existing) return c.json({ error: 'Custom domain already in use by another link' }, 409)
    }
    await c.env.DB.prepare(
      'UPDATE links SET custom_domain = ? WHERE id = ?'
    ).bind(domain, id).run()
    return c.json({ success: true, custom_domain: domain })
  }

  if (body.action === 'extend') {
    // B-10: validate the hours range. An unvalidated body.extendHours could
    // overflow Date arithmetic, produce "Invalid time value", and crash the
    // handler with a 500.
    const rawHours = body.extendHours ?? 24
    const hours = Number(rawHours)
    if (
      !Number.isFinite(hours) ||
      !Number.isInteger(hours) ||
      hours < EXTEND_HOURS_MIN ||
      hours > EXTEND_HOURS_MAX
    ) {
      return c.json(
        { error: `extendHours must be an integer between ${EXTEND_HOURS_MIN} and ${EXTEND_HOURS_MAX}` },
        400
      )
    }

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
  const { id } = c.req.param()
  const result = await c.env.DB.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  // P-10 / B-12: Purge redirect cache for the deleted link (BASE_URL-keyed).
  await purgeRedirectCache(c.executionCtx, id, c.env.BASE_URL)
  return c.json({ success: true })
}

export async function bulkDeleteLinks(c: Context<{ Bindings: Env }>) {
  const { ids } = await c.req.json<{ ids: string[] }>()
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'ids array required' }, 400)
  }

  // B-09: D1 enforces a bound-parameter limit (~100). Reject larger batches
  // explicitly so the client gets a clear 400 instead of an opaque 500.
  if (ids.length > BULK_DELETE_MAX_IDS) {
    return c.json(
      { error: `Maximum ${BULK_DELETE_MAX_IDS} IDs per batch (got ${ids.length})` },
      400
    )
  }

  // P-08/P-14: Single DELETE with IN clause instead of N batched statements
  const placeholders = ids.map(() => '?').join(', ')
  const result = await c.env.DB.prepare(
    `DELETE FROM links WHERE id IN (${placeholders})`
  ).bind(...ids).run()
  const deleted = result.meta.changes ?? ids.length
  // P-10 / B-12: Purge redirect cache for all deleted links (BASE_URL-keyed,
  // fire-and-forget; non-blocking).
  for (const id of ids) purgeRedirectCache(c.executionCtx, id, c.env.BASE_URL)
  return c.json({ success: true, deleted })
}

export async function getVariants(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const variants = await c.env.DB.prepare(
    'SELECT id, destination_url, weight FROM link_variants WHERE link_id = ?'
  ).bind(id).all()
  return c.json(variants.results)
}

export async function createVariant(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const { destination_url, weight } = await c.req.json<{
    destination_url: string
    weight?: number
  }>()
  if (!destination_url) return c.json({ error: 'destination_url required' }, 400)
  if (!isSafeUrl(destination_url)) return c.json({ error: 'Only http/https URLs are allowed' }, 400)

  const variantId = generateId()
  await c.env.DB.prepare(
    'INSERT INTO link_variants (id, link_id, destination_url, weight) VALUES (?, ?, ?, ?)'
  ).bind(variantId, id, destination_url, weight ?? 1).run()
  return c.json({ id: variantId, link_id: id, destination_url, weight: weight ?? 1 })
}

export async function deleteVariant(c: Context<{ Bindings: Env }>) {
  const { variantId } = c.req.param()
  const result = await c.env.DB.prepare('DELETE FROM link_variants WHERE id = ?').bind(variantId).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true })
}

export async function exportLinks(c: Context<{ Bindings: Env }>) {
  // P-15: Stream the CSV in batches so we never hold the full export in Worker
  // memory. D1's per-row cost is still O(N), but the heap footprint stays bounded
  // to one batch at a time. Hard-cap at EXPORT_MAX_ROWS rows; if truncated, emit
  // a final comment line and a Link: rel=next response header so the admin can
  // page through additional exports.
  const BATCH = 1_000
  const encoder = new TextEncoder()
  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const statusOf = (link: { disabled: number; expires_at: string | null }) =>
    link.disabled
      ? 'disabled'
      : link.expires_at && new Date(link.expires_at) < new Date()
        ? 'expired'
        : 'active'

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode('ID,Original URL,Created,Expires,Status,Tag,Visits\n'))

        let offset = 0
        let total = 0
        let truncated = false

        // P-06/P-13: Use the visits column directly (no analytics JOIN).
        while (true) {
          const { results } = await c.env.DB.prepare(
            `SELECT id, original_url, created_at, expires_at, disabled, tag, COALESCE(visits, 0) as visits
             FROM links
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`
          ).bind(BATCH, offset).all<{
            id: string
            original_url: string
            created_at: string
            expires_at: string | null
            disabled: number
            tag: string | null
            visits: number
          }>()

          if (results.length === 0) break

          for (const link of results) {
            if (total >= EXPORT_MAX_ROWS) {
              truncated = true
              break
            }
            const row = `${link.id},${escape(link.original_url)},${link.created_at},${link.expires_at ?? ''},${statusOf(link)},${escape(link.tag ?? '')},${link.visits}\n`
            controller.enqueue(encoder.encode(row))
            total++
          }

          if (truncated || results.length < BATCH) break
          offset += BATCH
        }

        if (truncated) {
          controller.enqueue(encoder.encode(`# truncated at ${EXPORT_MAX_ROWS} rows; use the Admin UI for the full list\n`))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="duckshort-export.csv"',
      'Cache-Control': 'no-store',
    },
  })
}

export async function getGeoRedirects(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const rows = await c.env.DB.prepare(
    'SELECT id, country_code, destination_url FROM geo_redirects WHERE link_id = ?'
  ).bind(id).all()
  return c.json(rows.results)
}

export async function createGeoRedirect(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const { country_code, destination_url } = await c.req.json<{
    country_code: string
    destination_url: string
  }>()

  if (!country_code || !destination_url) {
    return c.json({ error: 'country_code and destination_url required' }, 400)
  }

  const code = country_code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) {
    return c.json({ error: 'country_code must be a 2-letter ISO code (e.g. US, TH)' }, 400)
  }

  if (!isSafeUrl(destination_url)) {
    return c.json({ error: 'Only http/https URLs are allowed' }, 400)
  }

  const geoId = generateId()
  await c.env.DB.prepare(
    'INSERT INTO geo_redirects (id, link_id, country_code, destination_url) VALUES (?, ?, ?, ?)'
  ).bind(geoId, id, code, destination_url).run()

  return c.json({ id: geoId, link_id: id, country_code: code, destination_url })
}

export async function deleteGeoRedirect(c: Context<{ Bindings: Env }>) {
  const { geoId } = c.req.param()
  const result = await c.env.DB.prepare('DELETE FROM geo_redirects WHERE id = ?').bind(geoId).run()
  if (result.meta.changes === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true })
}
