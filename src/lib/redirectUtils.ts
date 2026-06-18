import type { Context } from 'hono'
import type { Env, RedirectLinkRow } from '../types'
import { injectUtm } from './utm'
import { pickVariant, type VariantRow } from './variants'
import { logger } from './logger'
import { WEBHOOK_TIMEOUT_MS } from './constants'

// S-20: Reduce the privacy surface of stored referer headers. We keep only
// the hostname (no path, query string, or fragment) so the analytics response
// cannot leak search queries / user-specific URLs. Unknown referers are
// recorded as the literal string "unknown".
export function refererHostname(referer: string): string {
  try {
    return new URL(referer).hostname.toLowerCase()
  } catch {
    return 'unknown'
  }
}

// P-17: 16-char hex token used as the `analytics.id` value for new rows. Cheap
// to generate, easy to grep in logs, and 64 bits of entropy is more than
// enough for "delete one row by id" semantics.
function newAnalyticsId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

// F-03: Shared link-row SELECT + gate logic for all redirect handlers
const LINK_ROW_SELECT = `SELECT id, original_url, disabled, expires_at, password_hash,
       utm_source, utm_medium, utm_campaign, webhook_url, burn_on_read,
       (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')) as is_expired`

export async function loadLinkRow(db: D1Database, id: string, byColumn: 'id' | 'custom_domain' = 'id'): Promise<RedirectLinkRow | null> {
  const column = byColumn === 'custom_domain' ? 'custom_domain' : 'id'
  return db.prepare(`${LINK_ROW_SELECT} FROM links WHERE ${column} = ?`)
    .bind(id).first<RedirectLinkRow>()
}

export type RedirectResult =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'password'; id: string }
  | { kind: 'burned_out' }
  | { kind: 'redirect'; destination: string; linkId: string; country: string; referer: string; ua: string; webhookUrl: string | null }

// F-03: Unified redirect gate — checks disabled/expired/burn/password then resolves destination
export async function dispatchRedirect(
  c: Context<{ Bindings: Env }>,
  link: RedirectLinkRow
): Promise<Response> {
  if (link.disabled) {
    return c.json({ error: 'Link disabled' }, 404)
  }

  if (link.is_expired) {
    await c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ?').bind(link.id).run()
    await purgeRedirectCache(c.executionCtx, link.id, c.env.BASE_URL)
    return c.json({ error: 'Link expired' }, 410)
  }

  if (link.password_hash) {
    return c.redirect(`/password/${link.id}`, 302)
  }

  if (link.burn_on_read) {
    const burned = await handleBurnOnRead(c.env.DB, link.id)
    if (!burned) return c.json({ error: 'Link disabled' }, 404)
    await purgeRedirectCache(c.executionCtx, link.id, c.env.BASE_URL)
  }

  const country = (c.req.header('cf-ipcountry') || 'unknown').toUpperCase()
  // S-20: store only the referer hostname (no path/query) — see refererHostname.
  const referer = refererHostname(c.req.header('referer') ?? '').slice(0, 255)
  const ua = (c.req.header('user-agent') || 'unknown').slice(0, 255)

  const destination = await resolveDestination(
    c.env.DB, link.id, link.original_url,
    link.utm_source, link.utm_medium, link.utm_campaign,
    country
  )

  recordAnalytics(c.executionCtx, c.env.DB, link.id, country, referer, ua, link.webhook_url)

  return c.redirect(destination, 302)
}

export async function resolveDestination(
  db: D1Database,
  linkId: string,
  originalUrl: string,
  utmSource: string | null,
  utmMedium: string | null,
  utmCampaign: string | null,
  country: string
): Promise<string> {
  const [variantsResult, geoResult] = await Promise.all([
    db.prepare('SELECT destination_url, weight FROM link_variants WHERE link_id = ?')
      .bind(linkId).all<VariantRow>(),
    country !== 'unknown'
      ? db.prepare('SELECT destination_url FROM geo_redirects WHERE link_id = ? AND country_code = ?')
          .bind(linkId, country.toUpperCase()).first<{ destination_url: string }>()
      : Promise.resolve(null),
  ])

  let destination = originalUrl
  if (variantsResult.results.length > 0) {
    destination = pickVariant(variantsResult.results)
  }
  if (geoResult) {
    destination = geoResult.destination_url
  }
  return injectUtm(destination, utmSource, utmMedium, utmCampaign)
}

export function recordAnalytics(
  ctx: ExecutionContext,
  db: D1Database,
  linkId: string,
  country: string,
  referer: string,
  ua: string,
  webhookUrl: string | null
): void {
  const timestamp = new Date().toISOString()
  ctx.waitUntil(
    (async () => {
      // Insert analytics row + increment visits column + global counter atomically
      // P-17: include the new analytics.id PK column (migration 0009).
      await db.batch([
        db.prepare(
          'INSERT INTO analytics (id, link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(newAnalyticsId(), linkId, country, referer, ua, timestamp),
        db.prepare('UPDATE links SET visits = visits + 1 WHERE id = ?').bind(linkId),
        db.prepare(
          'INSERT INTO counters (key, value) VALUES (\'total_visits\', 1) ON CONFLICT(key) DO UPDATE SET value = value + 1'
        ),
      ])

      if (webhookUrl) {
        // P-18: cap webhook latency with AbortController so a slow consumer
        // does not hold the Worker CPU for the full 30s waitUntil budget.
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link_id: linkId, country, referer, timestamp }),
            signal: controller.signal,
          })
        } catch (e) {
          logger.error('webhook_failed', {
            linkId,
            webhookUrl,
            error: e instanceof Error ? e.message : String(e),
            timedOut: e instanceof Error && e.name === 'AbortError',
          })
        } finally {
          clearTimeout(timeout)
        }
      }
    })()
  )
}

export async function handleBurnOnRead(db: D1Database, linkId: string): Promise<boolean> {
  const result = await db.prepare(
    'UPDATE links SET disabled = 1 WHERE id = ? AND disabled = 0'
  ).bind(linkId).run()
  return result.meta.changes > 0
}

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function isSafeWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false

    // URL.hostname can return "[::1]" for IPv6 literals; strip the brackets.
    // Some runtimes normalise IPv4-mapped IPv6 to plain IPv4 in `hostname`,
    // while others keep the literal. We need to cover both cases.
    const raw = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')

    // Reject any IPv4-mapped IPv6 form (::ffff:0:0/96) explicitly, before
    // any other checks. This covers cloud metadata (::ffff:169.254.169.254)
    // and loopback (::ffff:127.0.0.1) regardless of URL-parser normalisation.
    if (raw.includes('::ffff:')) return false

    // Loopback addresses (any flavour).
    if (raw === 'localhost' || raw === '::1' || raw === '127.0.0.1' || raw === '0.0.0.0') return false

    // Re-evaluate IPv4 portion against the private-range rules (handles
    // ::ffff: stripped form and plain IPv4 inputs uniformly).
    const ipv4 = raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw

    // Private/reserved IPv4 ranges.
    if (ipv4.startsWith('127.') || ipv4.startsWith('192.168.') || ipv4.startsWith('10.')) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ipv4)) return false
    if (ipv4.startsWith('169.254.')) return false // AWS / GCP / Azure metadata
    // 100.64.0.0/10 — Cloudflare / ISP CGNAT internal range.
    if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./.test(ipv4)) return false
    // 0.0.0.0/8 — "this network".
    if (/^0\./.test(ipv4)) return false

    // IPv6 ULA (fc00::/7 — covers fc and fd prefixes).
    if (raw.startsWith('fc') || raw.startsWith('fd')) return false
    // IPv6 link-local (fe80::/10).
    if (/^fe[89ab][0-9a-f]?(:|$)/i.test(raw)) return false

    return true
  } catch {
    return false
  }
}

// P-10: Purge a link's redirect cache entry (call on update/delete/burn).
// B-12: accept the cache origin as a parameter so staging / preview / future
// domain moves use the right cache key. Defaults to BASE_URL (or
// `https://duckshort.cc`) so callers in tests don't need to thread it.
export async function purgeRedirectCache(
  ctx: ExecutionContext,
  id: string,
  baseUrl: string = 'https://duckshort.cc'
): Promise<void> {
  const cacheUrl = `${baseUrl.replace(/\/+$/, '')}/__redirect_cache__/${id}`
  ctx.waitUntil(
    (caches as unknown as { default: Cache }).default.delete(new Request(cacheUrl, { method: 'GET' }))
  )
}
