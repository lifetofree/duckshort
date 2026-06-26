import { env, runInDurableObject } from 'cloudflare:test'

export async function applySchema() {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, original_url TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, disabled INTEGER DEFAULT 0, password_hash TEXT, tag TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, webhook_url TEXT, burn_on_read INTEGER DEFAULT 0, og_title TEXT, og_description TEXT, og_image TEXT, custom_domain TEXT, visits INTEGER NOT NULL DEFAULT 0)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS analytics (id TEXT, link_id TEXT NOT NULL, country TEXT, referer TEXT, user_agent TEXT, timestamp TEXT DEFAULT (datetime('now')))`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS link_variants (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, destination_url TEXT NOT NULL, weight INTEGER DEFAULT 1)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS geo_redirects (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, country_code TEXT NOT NULL, destination_url TEXT NOT NULL)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0)`)
  // 6.1: pre-aggregated daily counts per link. Matches migration 0011.
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS link_stats_daily (link_id TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (link_id, day))`)
}

// 2026-06-26 (vitest 4 upgrade): vitest-pool-workers 0.16 persists Durable
// Object state across `it` blocks within the same test file. The previous
// 0.5.x reset DO storage per test via the storage stack, but that no longer
// happens. Without an explicit reset the rate limiter counter leaks across
// tests in the same file, so a test that expects `X-RateLimit-Remaining:
// 199` after one redirect sees `198` (or worse, 429) once a sibling test has
// already incremented the same bucket. clearAll() now also wipes the rate
// limiter's per-(bucket,ip) storage so every test starts from zero.
export async function clearAll() {
  await env.DB.prepare('DELETE FROM geo_redirects').run()
  await env.DB.prepare('DELETE FROM link_variants').run()
  await env.DB.prepare('DELETE FROM analytics').run()
  await env.DB.prepare('DELETE FROM link_stats_daily').run()
  await env.DB.prepare('DELETE FROM links').run()
  await env.DB.prepare('DELETE FROM counters').run()
  await resetRateLimiter()
}

export async function resetRateLimiter() {
  // Tests don't set CF-Connecting-IP / X-Forwarded-For, so the middleware
  // always falls through to the `'unknown'` key (see src/middleware/rateLimit.ts).
  // Reset both buckets under that key. If a test ever sets CF-Connecting-IP
  // to something else, extend this list rather than parsing the request.
  const ips = ['unknown'] as const
  const buckets = ['api', 'redirect'] as const
  for (const bucket of buckets) {
    for (const ip of ips) {
      const id = env.RATE_LIMITER.idFromName(`${bucket}:${ip}`)
      const stub = env.RATE_LIMITER.get(id)
      await runInDurableObject(stub, async (_instance, state) => {
        await state.storage.deleteAll()
      })
    }
  }
}

export async function seedLink(
  id: string,
  overrides: Partial<{
    original_url: string
    expires_at: string | null
    disabled: number
    password_hash: string | null
    burn_on_read: number
    tag: string | null
    utm_source: string | null
    utm_medium: string | null
    utm_campaign: string | null
    webhook_url: string | null
    og_title: string | null
    og_description: string | null
    og_image: string | null
    custom_domain: string | null
  }> = {}
) {
  const now = new Date().toISOString()
  const row = {
    original_url: 'https://example.com',
    expires_at: null,
    disabled: 0,
    password_hash: null,
    burn_on_read: 0,
    tag: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    webhook_url: null,
    og_title: null,
    og_description: null,
    og_image: null,
    custom_domain: null,
    ...overrides,
  }

  await env.DB.prepare(
    `INSERT INTO links
      (id, original_url, created_at, expires_at, disabled, password_hash, burn_on_read, tag,
       utm_source, utm_medium, utm_campaign, webhook_url, og_title, og_description, og_image, custom_domain)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, row.original_url, now, row.expires_at, row.disabled, row.password_hash,
      row.burn_on_read, row.tag, row.utm_source, row.utm_medium, row.utm_campaign,
      row.webhook_url, row.og_title, row.og_description, row.og_image, row.custom_domain
    )
    .run()

  return id
}
