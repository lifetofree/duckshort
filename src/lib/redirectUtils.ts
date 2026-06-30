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

// 2.1: Cache API helpers for the redirect hot path. The cache key uses the
// same `${BASE_URL}/__redirect_cache__/${id}` format that `purgeRedirectCache`
// already deletes, so an admin write (updateLink / deleteLink / burn) wipes
// the cache entry as before. The cached value is a 302 Response with the
// destination, the link id, and the webhook URL encoded in headers — we use
// headers (not the body) because the Cache API stores the body too, and
// storing a JSON blob would cost an extra parse on every read.
//
// Skip the cache for: password links (handled by /password/:id), burn-on-read
// links (single-use), expired/disabled links (already short-circuited by
// dispatchRedirect). Only the `redirect` kind is cached.
function cacheKey(env: { BASE_URL?: string }, id: string): string {
  const baseUrl = (env.BASE_URL || 'https://duckshort.cc').replace(/\/+$/, '')
  // S-21: lower-case the id segment so `VibeCoding-01` and `vibecoding-01`
  // share one cache entry. Without this, a scanner that lowercased the URL
  // would miss the cache populated by an exact-case request (or vice-versa),
  // and `purgeRedirectCache` keyed on the stored id would fail to evict an
  // entry written under a different case.
  return `${baseUrl}/__redirect_cache__/${id.toLowerCase()}`
}

interface CachedRedirect {
  destination: string
  linkId: string
  webhookUrl: string | null
}

async function tryReadCache(env: { BASE_URL?: string; caches?: CacheStorage }, id: string): Promise<CachedRedirect | null> {
  try {
    const cache = (caches as unknown as { default: Cache }).default
    const cached = await cache.match(new Request(cacheKey(env, id)))
    if (!cached) return null
    const destination = cached.headers.get('Location')
    if (!destination) return null
    return {
      destination,
      linkId: cached.headers.get('X-Link-Id') || id,
      webhookUrl: cached.headers.get('X-Webhook-Url') || null,
    }
  } catch {
    return null
  }
}

// Public alias for the cache hit path used by the /:id handler.
export async function tryReadRedirectCache(env: { BASE_URL?: string }, id: string): Promise<CachedRedirect | null> {
  return tryReadCache(env, id)
}

// 2.1: Analytics + webhook fire on a cache hit. Same shape as the cache-miss
// path in dispatchRedirect, just without the DB link-row lookup. We extract
// the request metadata (country/referer/UA) at the call site so this helper
// can be reused by /password/:id verify and the custom-domain middleware.
interface MiniExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

export function recordAnalyticsFromCacheHit(
  ctx: MiniExecutionContext,
  db: D1Database,
  linkId: string,
  cfIpcountry: string | undefined,
  referer: string | undefined,
  ua: string | undefined,
  webhookUrl: string | null,
): void {
  const country = (cfIpcountry || 'unknown').toUpperCase()
  const ref = refererHostname(referer ?? '').slice(0, 255)
  const userAgent = (ua || 'unknown').slice(0, 255)
  recordAnalytics(ctx, db, linkId, country, ref, userAgent, webhookUrl)
}

function writeCache(
  ctx: MiniExecutionContext,
  env: { BASE_URL?: string },
  id: string,
  destination: string,
  linkId: string,
  webhookUrl: string | null,
): void {
  try {
    const cache = (caches as unknown as { default: Cache }).default
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: destination,
        'X-Link-Id': linkId,
        'X-Webhook-Url': webhookUrl ?? '',
        // 24h TTL. The cache is invalidated explicitly by `purgeRedirectCache`
        // on every update/delete/burn, so a 24h ceiling is just a safety net
        // for an operator who forgets to call purge.
        'Cache-Control': 'public, max-age=86400',
      },
    })
    ctx.waitUntil(cache.put(new Request(cacheKey(env, id)), response))
  } catch {
    // Cache write failure is non-fatal — the next request will just miss.
  }
}

// S-21: Case-insensitive short-link lookups. QR scanners (Android camera,
// WeChat, Google Lens, many iOS preview flows) routinely lowercase the URL
// before opening it, and D1/SQLite compares TEXT case-sensitively by default
// — so `VibeCoding-01` stored in D1 would 404 when a scanner opened
// `vibecoding-01`. Two normalisations happen here:
//
//   1. `normalizeLinkId()` strips a single trailing slash (`VibeCoding-01/`
//      → `VibeCoding-01`) so trailing-slash requests don't fall through to
//      the SPA shell. Case is preserved (the stored row keeps its original
//      casing); the DB match uses COLLATE NOCASE.
//   2. The redirect cache key is lower-cased so `VibeCoding-01` and
//      `vibecoding-01` share one cache entry. `purgeRedirectCache` must use
//      the same lower-casing to invalidate correctly (it does, via
//      `cacheKey`).
export function normalizeLinkId(raw: string): string {
  return raw.replace(/\/+$/, '')
}

// F-03: Shared link-row SELECT + gate logic for all redirect handlers.
// Uses COLLATE NOCASE so lookups are case-insensitive (see S-21 above).
const LINK_ROW_SELECT = `SELECT id, original_url, disabled, expires_at, password_hash,
       utm_source, utm_medium, utm_campaign, webhook_url, burn_on_read,
       (expires_at IS NOT NULL AND datetime(expires_at) < datetime('now')) as is_expired`

export async function loadLinkRow(db: D1Database, id: string, byColumn: 'id' | 'custom_domain' = 'id'): Promise<RedirectLinkRow | null> {
  const column = byColumn === 'custom_domain' ? 'custom_domain' : 'id'
  return db.prepare(`${LINK_ROW_SELECT} FROM links WHERE ${column} = ? COLLATE NOCASE`)
    .bind(id).first<RedirectLinkRow>()
}

export type RedirectResult =
  | { kind: 'not_found' }
  | { kind: 'expired' }
  | { kind: 'password'; id: string }
  | { kind: 'burned_out' }
  | { kind: 'redirect'; destination: string; linkId: string; country: string; referer: string; ua: string; webhookUrl: string | null }

// F-03: Unified redirect gate — checks disabled/expired/burn/password then resolves destination.
//
// CONTRACT (locked by `test/handlers/dispatch-contract.test.ts`):
//
//  | `kind`        | Status | Body / Location                          | Side effects                              |
//  | ------------- | ------ | ---------------------------------------- | ----------------------------------------- |
//  | `not_found`   | 404    | `{ error: 'Link disabled' }`             | none                                      |
//  | `expired`     | 410    | `{ error: 'Link expired' }`              | UPDATE links SET disabled=1; purge cache  |
//  | `password`    | 302    | Location: `/password/:id`                | none                                      |
//  | `burned_out`  | 404    | `{ error: 'Link disabled' }`             | (burn UPDATE lost the race)               |
//  | `redirect`    | 302    | Location: <resolved destination>         | INSERT analytics; UPDATE visits; counter; webhook POST |
//
// Check order matters: disabled > expired > password > burn > redirect. A link
// that is BOTH expired AND password-protected returns 410 (the more accurate
// "no longer available" signal), not 302. A link that is BOTH burn AND
// password-protected returns 302 to the password page (the user might still
// have a valid password even though the link would self-destruct on first
// visit).
export async function dispatchRedirect(
  c: Context<{ Bindings: Env }>,
  link: RedirectLinkRow
): Promise<Response> {
  if (link.disabled) {
    return noStore(c.json({ error: 'Link disabled' }, 404))
  }

  if (link.is_expired) {
    await c.env.DB.prepare('UPDATE links SET disabled = 1 WHERE id = ? COLLATE NOCASE').bind(link.id).run()
    await purgeRedirectCache(c.executionCtx, link.id, c.env.BASE_URL)
    return noStore(c.json({ error: 'Link expired' }, 410))
  }

  if (link.password_hash) {
    // Password interstitial is per-link state; keep it private and short-lived.
    return privateShort(c.redirect(`/password/${link.id}`, 302))
  }

  if (link.burn_on_read) {
    const burned = await handleBurnOnRead(c.env.DB, link.id)
    if (!burned) return noStore(c.json({ error: 'Link disabled' }, 404))
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

  // 2.1: cache the final destination so the next request skips the DB SELECTs
  // for this link. Skip if no ExecutionContext is available (e.g. unit tests
  // without a real Worker runtime). Also skip for burn_on_read links — the
  // link is disabled at the same time, so caching the destination would let
  // the second access bypass the disabled check via the cache hit.
  if (c.executionCtx && !link.burn_on_read) {
    writeCache(c.executionCtx, c.env, link.id, destination, link.id, link.webhook_url)
  }

  recordAnalytics(c.executionCtx, c.env.DB, link.id, country, referer, ua, link.webhook_url)

  // S-22: short private browser cache on the 302. `private` keeps it out of
  // shared proxies/CDNs (the destination can be admin-changed at any time via
  // variants/geo/extend, and burn-on-read/disable must take effect promptly);
  // max-age=300 is short enough that an admin change propagates within 5 min
  // but long enough to speed up repeat clicks from the same browser (e.g. a
  // user re-opening a bookmarked short URL).
  return privateShort(c.redirect(destination, 302))
}

// S-22: Cache header helpers for redirect responses.
//
// iOS Safari and the iOS Camera QR scanner cache HTTP responses aggressively
// and, unlike Chrome, they do NOT treat a missing Cache-Control as "do not
// cache" — they cache 404/410 responses by default. Before these helpers
// existed, a link that 404'd once (e.g. before a case-insensitivity fix, or
// in the brief window before a newly-created link propagated) would keep
// showing the cached neon 404 on iOS even after the server started returning
// 302. `noStore` forces every error response to be re-fetched.
//
// Accepts Hono's `Response | Promise<Response>` return union so it can wrap
// `c.html()` / `c.json()` / `c.redirect()` directly.
export function noStore(res: Response | Promise<Response>): Response | Promise<Response> {
  // `then` works for both sync (Response has no .then) and async (Promise);
  // for a plain Response we mutate in place. We branch to keep the sync fast
  // path zero-allocation.
  if (res instanceof Promise) {
    return res.then((r: Response) => {
      r.headers.set('Cache-Control', 'no-store')
      return r
    })
  }
  res.headers.set('Cache-Control', 'no-store')
  return res
}

// Short-lived, browser-only cache for successful redirects. See S-22 above.
export function privateShort(res: Response | Promise<Response>): Response | Promise<Response> {
  if (res instanceof Promise) {
    return res.then((r: Response) => {
      r.headers.set('Cache-Control', 'private, max-age=300')
      return r
    })
  }
  res.headers.set('Cache-Control', 'private, max-age=300')
  return res
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
  ctx: MiniExecutionContext,
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
  ctx: MiniExecutionContext,
  id: string,
  baseUrl: string = 'https://duckshort.cc'
): Promise<void> {
  const cacheUrl = `${baseUrl.replace(/\/+$/, '')}/__redirect_cache__/${id}`
  ctx.waitUntil(
    (caches as unknown as { default: Cache }).default.delete(new Request(cacheUrl, { method: 'GET' }))
  )
}
