import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

async function applySchema() {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, original_url TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, disabled INTEGER DEFAULT 0, password_hash TEXT, tag TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, webhook_url TEXT, burn_on_read INTEGER DEFAULT 0, og_title TEXT, og_description TEXT, og_image TEXT)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS analytics (link_id TEXT NOT NULL, country TEXT, referer TEXT, user_agent TEXT, timestamp TEXT DEFAULT (datetime('now')))`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS link_variants (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, destination_url TEXT NOT NULL, weight INTEGER DEFAULT 1)`)
}

async function clearAll() {
  await env.DB.prepare('DELETE FROM links').run()
  await env.DB.prepare('DELETE FROM analytics').run()
}

describe('GET /api/stats/:id', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 404 for unknown link', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/stats/notexist`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })

  it('returns stats for a known link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    ).bind('stat1234', 'https://example.com', new Date().toISOString()).run()
    await env.DB.prepare(
      'INSERT INTO analytics (link_id, country, referer, user_agent) VALUES (?, ?, ?, ?)'
    ).bind('stat1234', 'US', 'https://google.com', 'Mozilla').run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/stats/stat1234`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const body = await res.json() as { link: Record<string, unknown>; visits: number; countries: any[]; referrers: any[] }
    expect(body.visits).toBe(1)
    expect(body.countries[0].country).toBe('US')
    expect(body.link).not.toHaveProperty('password_hash')
    expect(body.link).not.toHaveProperty('webhook_url')
  })

  it('does not expose sensitive fields for password-protected links', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, password_hash) VALUES (?, ?, ?, ?)'
    ).bind('secret99', 'https://secret.com', new Date().toISOString(), '$2b$10$hashedvalue').run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/stats/secret99`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const body = await res.json() as { link: Record<string, unknown> }
    expect(body.link).not.toHaveProperty('password_hash')
    expect(body.link).not.toHaveProperty('webhook_url')
    expect(body.link).toHaveProperty('id', 'secret99')
  })
})

describe('GET /api/stats/global', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns total visits and mood', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    ).bind('glb12345', 'https://example.com', new Date().toISOString()).run()
    await env.DB.prepare(
      'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).bind('glb12345', 'US', 'direct', 'bot', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/stats/global`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const body = await res.json() as { totalVisits: number; hourlyVisits: number; mood: string }
    expect(body.totalVisits).toBe(1)
    expect(body.hourlyVisits).toBe(1)
    expect(['DORMANT', 'ACTIVE', 'BUSY', 'VIRAL']).toContain(body.mood)
  })

  it('returns DORMANT mood when there are no recent visits', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/stats/global`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const body = await res.json() as { mood: string }
    expect(body.mood).toBe('DORMANT')
  })
})
