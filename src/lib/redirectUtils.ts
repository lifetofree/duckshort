import { injectUtm } from './utm'
import { pickVariant, type VariantRow } from './variants'

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
      await db.prepare(
        'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind(linkId, country, referer, ua, timestamp).run()

      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link_id: linkId, country, referer, timestamp }),
          })
        } catch {
          // webhook failures are non-fatal
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
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h === '::1') return false
    if (h.startsWith('127.') || h.startsWith('192.168.') || h.startsWith('10.')) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
    return true
  } catch {
    return false
  }
}
