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

describe('Preview Handler', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 404 for missing link', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/preview/missing`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 404 for disabled link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, disabled) VALUES (?, ?, ?, 1)'
    ).bind('prev-dis', 'https://example.com', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/preview/prev-dis`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })

  it('returns 410 for expired link', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).bind('prev-exp', 'https://example.com', new Date().toISOString(), pastDate).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/preview/prev-exp`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(410)
  })

  it('returns HTML preview page with destination URL', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    ).bind('prev-ok', 'https://example.com/destination', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/preview/prev-ok`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('https://example.com/destination')
  })

  it('renders og:title and og:description when set', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, og_title, og_description, og_image) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind('prev-og', 'https://example.com', new Date().toISOString(), 'My Title', 'My Description', 'https://img.example.com/img.png').run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/preview/prev-og`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('My Title')
    expect(html).toContain('My Description')
    expect(html).toContain('https://img.example.com/img.png')
  })
})
