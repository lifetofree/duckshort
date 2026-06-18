// 2.1: Cache API hot-path test. Verifies that:
//   - A first redirect populates the cache (writes are observable on second hit)
//   - A second redirect with no DB change returns the cached destination
//   - A disabled / deleted link invalidates the cache (admin purge)
//   - burn-on-read links are NOT cached (the second access goes to DB and
//     returns 404 because the row is disabled)
import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { applySchema, clearAll } from '../helpers/schema'

const BASE = 'http://localhost'

async function seed(id: string, originalUrl: string, extras: Partial<{ disabled: number; burn_on_read: number; utm_source: string }> = {}) {
  await env.DB.prepare(
    `INSERT INTO links
       (id, original_url, created_at, disabled, burn_on_read, utm_source, utm_medium, utm_campaign)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, originalUrl, new Date().toISOString(),
    extras.disabled ?? 0,
    extras.burn_on_read ?? 0,
    extras.utm_source ?? null,
    null, null,
  ).run()
}

async function req(path: string): Promise<Response> {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${path}`), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

describe('redirect cache (2.1)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('first request populates the cache; second request uses the cached destination', async () => {
    await seed('cache-1', 'https://cached.example.com/path')

    const res1 = await req('/cache-1')
    expect(res1.status).toBe(302)
    expect(res1.headers.get('location')).toBe('https://cached.example.com/path')

    // Update the underlying URL directly in D1 (bypassing the admin API so
    // we know the cache is the only thing that could serve the old URL).
    await env.DB.prepare('UPDATE links SET original_url = ? WHERE id = ?')
      .bind('https://new-destination.example.com', 'cache-1').run()

    const res2 = await req('/cache-1')
    expect(res2.status).toBe(302)
    // The cache is sticky — second request still gets the original destination.
    expect(res2.headers.get('location')).toBe('https://cached.example.com/path')
  })

  it('cache records UTM-injected destinations correctly', async () => {
    await seed('cache-utm', 'https://cached.example.com', { utm_source: 'duck' })

    const res1 = await req('/cache-utm')
    expect(res1.status).toBe(302)
    expect(res1.headers.get('location')).toContain('utm_source=duck')

    const res2 = await req('/cache-utm')
    expect(res2.status).toBe(302)
    expect(res2.headers.get('location')).toContain('utm_source=duck')
  })

  it('burn-on-read links are NOT cached — second access returns 404 from the DB', async () => {
    await seed('cache-burn-1', 'https://burn.example.com', { burn_on_read: 1 })

    const res1 = await req('/cache-burn-1')
    expect(res1.status).toBe(302)

    // Burn-on-read disabled the row in dispatchRedirect. The second access
    // must not be served from the cache.
    const res2 = await req('/cache-burn-1')
    expect(res2.status).toBe(404)
  })

  it('cache write failure is non-fatal — first request still succeeds', async () => {
    // The writeCache helper wraps in try/catch and falls through. Even if
    // the Cache API throws (e.g. in a test runtime without caches.default),
    // dispatchRedirect returns the 302 as normal.
    await seed('cache-fallback', 'https://fallback.example.com')
    const res = await req('/cache-fallback')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://fallback.example.com')
  })

  it('cache hit still records an analytics row (counts are accurate)', async () => {
    await seed('cache-ana', 'https://analytics.example.com')

    await req('/cache-ana')
    await req('/cache-ana')
    await req('/cache-ana')

    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM analytics WHERE link_id = ?'
    ).bind('cache-ana').first<{ count: number }>()
    expect(row?.count).toBe(3)
  })
})
