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

describe('Burn-on-Read Functionality', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('disables link after first redirect when burn_on_read is enabled', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, burn_on_read) VALUES (?, ?, ?, 1)'
    ).bind('burn123', 'https://example.com', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/burn123`), env, ctx)
    await waitOnExecutionContext(ctx)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com')

    // Check if link is disabled
    const link = await env.DB.prepare('SELECT disabled FROM links WHERE id = ?').bind('burn123').first<{ disabled: number }>()
    expect(link?.disabled).toBe(1)
  })

  it('does not disable link when burn_on_read is disabled', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, burn_on_read) VALUES (?, ?, ?, 0)'
    ).bind('normal123', 'https://example.com', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/normal123`), env, ctx)
    await waitOnExecutionContext(ctx)

    expect(res.status).toBe(302)

    // Check if link is still enabled
    const link = await env.DB.prepare('SELECT disabled FROM links WHERE id = ?').bind('normal123').first<{ disabled: number }>()
    expect(link?.disabled).toBe(0)
  })

  it('returns 404 for second access to burn-on-read link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, burn_on_read) VALUES (?, ?, ?, 1)'
    ).bind('burn456', 'https://example.com', new Date().toISOString()).run()

    // First access
    const ctx1 = createExecutionContext()
    const res1 = await app.fetch(new Request(`${BASE}/burn456`), env, ctx1)
    await waitOnExecutionContext(ctx1)
    expect(res1.status).toBe(302)

    // Second access should fail
    const ctx2 = createExecutionContext()
    const res2 = await app.fetch(new Request(`${BASE}/burn456`), env, ctx2)
    await waitOnExecutionContext(ctx2)
    expect(res2.status).toBe(404)
  })

  it('records analytics before disabling burn-on-read link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, burn_on_read) VALUES (?, ?, ?, 1)'
    ).bind('burn789', 'https://example.com', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(
      new Request(`${BASE}/burn789`, {
        headers: {
          'cf-ipcountry': 'US',
          'referer': 'https://google.com',
          'user-agent': 'Mozilla/5.0'
        }
      }),
      env,
      ctx
    )
    await waitOnExecutionContext(ctx)

    expect(res.status).toBe(302)

    // Check analytics were recorded
    const analytics = await env.DB.prepare(
      'SELECT * FROM analytics WHERE link_id = ?'
    ).bind('burn789').first()
    expect(analytics).toBeDefined()
    expect(analytics?.country).toBe('US')
  })

  it('prevents concurrent access to burn-on-read link', async () => {
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, burn_on_read) VALUES (?, ?, ?, 1)'
    ).bind('burn-concurrent', 'https://example.com', new Date().toISOString()).run()

    // Make multiple concurrent requests with their own execution contexts
    const contexts = Array.from({ length: 5 }, () => createExecutionContext())
    const requests = contexts.map((ctx, i) =>
      app.fetch(new Request(`${BASE}/burn-concurrent`), env, ctx)
    )

    const responses = await Promise.all(requests)

    // Wait for all actual execution contexts to complete
    for (const ctx of contexts) {
      await waitOnExecutionContext(ctx)
    }

    // Count successful redirects (302) vs 404s
    const successCount = responses.filter(r => r.status === 302).length
    const failCount = responses.filter(r => r.status === 404).length

    // Only the first request should succeed (302), all others should fail (404)
    expect(successCount).toBe(1)
    expect(failCount).toBe(4)

    // Verify link is disabled
    const link = await env.DB.prepare('SELECT disabled FROM links WHERE id = ?').bind('burn-concurrent').first<{ disabled: number }>()
    expect(link?.disabled).toBe(1)
  })

  it('returns 404 when accessing already disabled burn-on-read link', async () => {
    // Create and manually disable a burn-on-read link
    await env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at, burn_on_read, disabled) VALUES (?, ?, ?, 1, 1)'
    ).bind('already-disabled', 'https://example.com', new Date().toISOString()).run()

    // Attempt to access the already disabled link
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/already-disabled`), env, ctx)
    await waitOnExecutionContext(ctx)

    // Should return 404 with "LINK NOT FOUND OR DISABLED" message
    expect(res.status).toBe(404)
    const text = await res.text()
    expect(text).toContain('LINK NOT FOUND OR DISABLED')
  })
})
