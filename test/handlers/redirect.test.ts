import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'

const BASE = 'http://localhost'

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

describe('GET /:id (redirect)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 404 for unknown link', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/notexist`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })

  it('redirects to original URL for valid link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    ).bind('abc12345', 'https://example.com', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/abc12345`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com')
  })

  it('returns 404 for disabled link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, disabled) VALUES (?, ?, ?, 1)'
    ).bind('dis12345', 'https://example.com', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/dis12345`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 410 for expired link', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind('exp12345', 'https://example.com', new Date().toISOString(), pastDate).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/exp12345`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(410)
  })

  it('injects UTM params into destination URL', async () => {
    await env.DB.prepare(
      `INSERT INTO links (id, original_url, created_at, utm_source, utm_medium, utm_campaign)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind('utm12345', 'https://example.com', new Date().toISOString(), 'duck', 'short', 'test').run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/utm12345`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    const loc = res.headers.get('location')!
    expect(loc).toContain('utm_source=duck')
    expect(loc).toContain('utm_medium=short')
    expect(loc).toContain('utm_campaign=test')
  })

  it('redirects to password entry when link is password-protected', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, password_hash) VALUES (?, ?, ?, ?)'
    ).bind('pw123456', 'https://secret.com', new Date().toISOString(), 'fakehash').run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/pw123456`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/password/pw123456')
  })

  it('records analytics visit', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    ).bind('ana12345', 'https://example.com', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/ana12345`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)

    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM analytics WHERE link_id = ?'
    ).bind('ana12345').first<{ count: number }>()
    expect(row?.count).toBe(1)
  })
})
