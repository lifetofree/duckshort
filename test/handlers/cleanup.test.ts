import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { cleanupExpiredLinks } from '../../src/handlers/cleanup'

async function applySchema() {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, original_url TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, disabled INTEGER DEFAULT 0, password_hash TEXT, tag TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, webhook_url TEXT, burn_on_read INTEGER DEFAULT 0, og_title TEXT, og_description TEXT, og_image TEXT)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS analytics (link_id TEXT NOT NULL, country TEXT, referer TEXT, user_agent TEXT, timestamp TEXT DEFAULT (datetime('now')))`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS link_variants (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, destination_url TEXT NOT NULL, weight INTEGER DEFAULT 1)`)
}

async function clearAll() {
  await env.DB.prepare('DELETE FROM links').run()
  await env.DB.prepare('DELETE FROM analytics').run()
  await env.DB.prepare('DELETE FROM link_variants').run()
}

describe('cleanupExpiredLinks', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('deletes links that have expired', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind('expired1', 'https://example.com', new Date().toISOString(), pastDate).run()

    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind('expired2', 'https://example.com', new Date().toISOString(), pastDate).run()

    const result = await cleanupExpiredLinks(env)
    expect(result.deleted).toBe(2)

    const remaining = await env.DB.prepare('SELECT COUNT(*) as count FROM links').first<{ count: number }>()
    expect(remaining?.count).toBe(0)
  })

  it('does not delete active links', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind('active1', 'https://example.com', new Date().toISOString(), futureDate).run()

    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    ).bind('active2', 'https://example.com', new Date().toISOString()).run()

    const result = await cleanupExpiredLinks(env)
    expect(result.deleted).toBe(0)

    const remaining = await env.DB.prepare('SELECT COUNT(*) as count FROM links').first<{ count: number }>()
    expect(remaining?.count).toBe(2)
  })

  it('handles empty database gracefully', async () => {
    const result = await cleanupExpiredLinks(env)
    expect(result.deleted).toBe(0)
  })

  it('deletes only expired links, not disabled ones', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at, disabled) VALUES (?, ?, ?, ?, 1)'
    ).bind('disabled', 'https://example.com', new Date().toISOString(), pastDate).run()

    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind('expired', 'https://example.com', new Date().toISOString(), pastDate).run()

    const result = await cleanupExpiredLinks(env)
    expect(result.deleted).toBe(1)

    const remaining = await env.DB.prepare('SELECT COUNT(*) as count FROM links').first<{ count: number }>()
    expect(remaining?.count).toBe(1)
  })
})
