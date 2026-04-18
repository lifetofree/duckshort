import { env } from 'cloudflare:test'

export async function applySchema() {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, original_url TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, disabled INTEGER DEFAULT 0, password_hash TEXT, tag TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, webhook_url TEXT, burn_on_read INTEGER DEFAULT 0, og_title TEXT, og_description TEXT, og_image TEXT)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS analytics (link_id TEXT NOT NULL, country TEXT, referer TEXT, user_agent TEXT, timestamp TEXT DEFAULT (datetime('now')))`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS link_variants (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, destination_url TEXT NOT NULL, weight INTEGER DEFAULT 1)`)
}

export async function clearAll() {
  await env.DB.prepare('DELETE FROM link_variants').run()
  await env.DB.prepare('DELETE FROM analytics').run()
  await env.DB.prepare('DELETE FROM links').run()
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
    ...overrides,
  }

  await env.DB.prepare(
    `INSERT INTO links
      (id, original_url, created_at, expires_at, disabled, password_hash, burn_on_read, tag,
       utm_source, utm_medium, utm_campaign, webhook_url, og_title, og_description, og_image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, row.original_url, now, row.expires_at, row.disabled, row.password_hash,
      row.burn_on_read, row.tag, row.utm_source, row.utm_medium, row.utm_campaign,
      row.webhook_url, row.og_title, row.og_description, row.og_image
    )
    .run()

  return id
}
