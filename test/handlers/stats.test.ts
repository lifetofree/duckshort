import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import app from '../../src/index'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

async function applySchema() {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      original_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      disabled INTEGER DEFAULT 0,
      password_hash TEXT,
      tag TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      webhook_url TEXT
    );
    CREATE TABLE IF NOT EXISTS analytics (
      link_id TEXT NOT NULL,
      country TEXT,
      referer TEXT,
      user_agent TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS link_variants (
      id TEXT PRIMARY KEY,
      link_id TEXT NOT NULL,
      destination_url TEXT NOT NULL,
      weight INTEGER DEFAULT 1
    );
  `)
}

async function clearAll() {
  await env.DB.prepare('DELETE FROM links').run()
  await env.DB.prepare('DELETE FROM analytics').run()
}

describe('GET /api/stats/:id', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 404 for unknown link', async () => {
    const res = await app.request(`${BASE}/api/stats/notexist`)
    expect(res.status).toBe(404)
  })

  it('returns stats for a known link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    ).bind('stat1234', 'https://example.com', new Date().toISOString()).run()
    await env.DB.prepare(
      'INSERT INTO analytics (link_id, country, referer, user_agent) VALUES (?, ?, ?, ?)'
    ).bind('stat1234', 'US', 'https://google.com', 'Mozilla').run()

    const res = await app.request(`${BASE}/api/stats/stat1234`)
    expect(res.status).toBe(200)
    const body = await res.json<{ visits: number; countries: any[]; referrers: any[] }>()
    expect(body.visits).toBe(1)
    expect(body.countries[0].country).toBe('US')
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

    const res = await app.request(`${BASE}/api/stats/global`)
    expect(res.status).toBe(200)
    const body = await res.json<{ totalVisits: number; hourlyVisits: number; mood: string }>()
    expect(body.totalVisits).toBe(1)
    expect(body.hourlyVisits).toBe(1)
    expect(['DORMANT', 'ACTIVE', 'BUSY', 'VIRAL']).toContain(body.mood)
  })

  it('returns DORMANT mood when there are no recent visits', async () => {
    const res = await app.request(`${BASE}/api/stats/global`)
    expect(res.status).toBe(200)
    const body = await res.json<{ mood: string }>()
    expect(body.mood).toBe('DORMANT')
  })
})
