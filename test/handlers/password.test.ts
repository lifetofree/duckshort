import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { hashPassword } from '../../src/lib/auth'

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

const TEST_PASSWORD = 'secret123'
let PASSWORD_HASH: string

describe('Password Handler', () => {
  beforeEach(async () => {
    await applySchema()
    await clearAll()
    PASSWORD_HASH = await hashPassword(TEST_PASSWORD)
  })

  it('GET /password/:id returns 404 for missing link', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/password/missing`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })

  it('GET /password/:id returns 404 for disabled link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, disabled, password_hash) VALUES (?, ?, ?, 1, ?)'
    ).bind('pw-dis', 'https://example.com', new Date().toISOString(), PASSWORD_HASH).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/password/pw-dis`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })

  it('GET /password/:id returns 410 for expired link', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, expires_at, password_hash) VALUES (?, ?, ?, ?, ?)'
    ).bind('pw-exp', 'https://example.com', new Date().toISOString(), pastDate, PASSWORD_HASH).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/password/pw-exp`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(410)
  })

  it('GET /password/:id returns HTML form for valid password-protected link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, password_hash) VALUES (?, ?, ?, ?)'
    ).bind('pw-ok', 'https://example.com', new Date().toISOString(), PASSWORD_HASH).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/password/pw-ok`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('POST /password/:id with wrong password returns 401', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, password_hash) VALUES (?, ?, ?, ?)'
    ).bind('pw-wrong', 'https://example.com', new Date().toISOString(), PASSWORD_HASH).run()

    const body = new FormData()
    body.append('password', 'wrongpassword')

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/password/pw-wrong`, { method: 'POST', body }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(401)
  })

  it('POST /password/:id with correct password redirects to destination', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, password_hash) VALUES (?, ?, ?, ?)'
    ).bind('pw-correct', 'https://example.com/dest', new Date().toISOString(), PASSWORD_HASH).run()

    const body = new FormData()
    body.append('password', TEST_PASSWORD)

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/password/pw-correct`, { method: 'POST', body }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com/dest')
  })
})
