import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'
const BAD_AUTH = 'Bearer wrong'

async function seedLink(id = 'testlink') {
  await env.DB.prepare(
    `INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)`
  ).bind(id, 'https://example.com', new Date().toISOString()).run()
  return id
}

async function clearLinks() {
  await env.DB.prepare('DELETE FROM links').run()
  await env.DB.prepare('DELETE FROM analytics').run()
}

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

describe('GET /api/links', () => {
  beforeEach(async () => { await applySchema(); await clearLinks() })

  it('returns 401 without auth', async () => {
    const res = await app.request(`${BASE}/api/links`)
    expect(res.status).toBe(401)
  })

  it('returns link list when authenticated', async () => {
    await seedLink()
    const res = await app.request(`${BASE}/api/links`, {
      headers: { Authorization: AUTH },
    })
    expect(res.status).toBe(200)
    const body = await res.json<any[]>()
    expect(body.length).toBe(1)
    expect(body[0].id).toBe('testlink')
  })
})

describe('POST /api/links', () => {
  beforeEach(async () => { await applySchema(); await clearLinks() })

  it('returns 401 without auth', async () => {
    const res = await app.request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(401)
  })

  it('creates a link and returns shortUrl', async () => {
    const res = await app.request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json<{ id: string; shortUrl: string }>()
    expect(body.id).toHaveLength(8)
    expect(body.shortUrl).toContain(body.id)
  })

  it('returns 400 when URL is missing', async () => {
    const res = await app.request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/links/:id', () => {
  beforeEach(async () => { await applySchema(); await clearLinks() })

  it('returns 401 without auth', async () => {
    await seedLink()
    const res = await app.request(`${BASE}/api/links/testlink`, { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  it('deletes the link when authenticated', async () => {
    await seedLink()
    const res = await app.request(`${BASE}/api/links/testlink`, {
      method: 'DELETE',
      headers: { Authorization: AUTH },
    })
    expect(res.status).toBe(200)
    const body = await res.json<{ success: boolean }>()
    expect(body.success).toBe(true)
  })
})

describe('PATCH /api/links/:id (toggle)', () => {
  beforeEach(async () => { await applySchema(); await clearLinks() })

  it('toggles the disabled state', async () => {
    await seedLink()
    const res = await app.request(`${BASE}/api/links/testlink`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'toggle' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json<{ disabled: boolean }>()
    expect(body.disabled).toBe(true)
  })
})

describe('POST /api/links/bulk-delete', () => {
  beforeEach(async () => { await applySchema(); await clearLinks() })

  it('deletes multiple links', async () => {
    await seedLink('link1')
    await seedLink('link2')
    const res = await app.request(`${BASE}/api/links/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ ids: ['link1', 'link2'] }),
    })
    expect(res.status).toBe(200)
    const body = await res.json<{ deleted: number }>()
    expect(body.deleted).toBe(2)
  })
})
