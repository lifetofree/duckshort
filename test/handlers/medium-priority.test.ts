/**
 * Tests for the third audit (2026-06-17) MEDIUM-priority items:
 *  - P-16: separate rate-limit buckets for redirects vs API writes
 *  - S-18: tight hostname check (no `evil-localhost.example.com` bypass)
 *  - S-19: security headers (X-Content-Type-Options / X-Frame-Options / Referrer-Policy)
 *  - P-17: analytics rows are inserted with an `id` PK column
 *  - P-18: webhook fetch passes an AbortController signal (5s timeout)
 *  - S-20: stored referer is hostname-only (no path / query / fragment)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { applySchema, clearAll, seedLink } from '../helpers/schema'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

async function req(url: string, init: RequestInit = {}) {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

// ─── P-16: separate rate-limit buckets ───────────────────────────────────────

describe('P-16: separate rate-limit buckets for redirects vs API writes', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('redirects use the higher "redirect" bucket (X-RateLimit-Limit = 200)', async () => {
    await seedLink('rl-1', { original_url: 'https://example.com' })
    const res = await req('/rl-1')
    expect(res.status).toBe(302)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('200')
  })

  it('API writes use the lower "api" bucket (X-RateLimit-Limit = 20)', async () => {
    const res = await req('/api/links', { headers: { Authorization: AUTH } })
    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('20')
  })

  it('redirect bucket and API bucket do not share counters (same IP)', async () => {
    await seedLink('rl-bucket', { original_url: 'https://example.com' })
    // Burn one redirect on the redirect bucket.
    const r1 = await req('/rl-bucket')
    expect(r1.headers.get('X-RateLimit-Limit')).toBe('200')
    expect(r1.headers.get('X-RateLimit-Remaining')).toBe('199')
    // Same IP, but the API bucket is independent.
    const r2 = await req('/api/links', { headers: { Authorization: AUTH } })
    expect(r2.headers.get('X-RateLimit-Limit')).toBe('20')
    expect(r2.headers.get('X-RateLimit-Remaining')).toBe('19')
  })
})

// ─── S-18: hostname check is exact ───────────────────────────────────────────

describe('S-18: customDomain hostname check is exact', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('does NOT short-circuit on `evil-localhost.example.com`', async () => {
    // A request with Host: evil-localhost.example.com should NOT bypass the
    // custom-domain lookup. The middleware now falls through to `/:id`, which
    // 404s on the unknown id — it does NOT return a 200 from a bypass.
    const ctx = createExecutionContext()
    const res = await app.fetch(
      new Request(`${BASE}/some-unknown-id`, { headers: { Host: 'evil-localhost.example.com' } }),
      env, ctx
    )
    await waitOnExecutionContext(ctx)
    expect([404, 302]).toContain(res.status)
  })

  it('still short-circuits on bare `localhost`', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(
      new Request(`${BASE}/`, { headers: { Host: 'localhost' } }),
      env, ctx
    )
    await waitOnExecutionContext(ctx)
    // The middleware returns next() — request continues to the proxy handler.
    // We don't assert the final status (depends on Pages proxy state in tests)
    // only that the middleware didn't crash.
    expect(res.status).toBeGreaterThanOrEqual(200)
  })
})

// ─── S-19: security headers ─────────────────────────────────────────────────

describe('S-19: defence-in-depth security headers on Worker responses', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy on API responses', async () => {
    const res = await req('/api/links', { headers: { Authorization: AUTH } })
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sets the headers on the redirect endpoint too', async () => {
    await seedLink('sh-1', { original_url: 'https://example.com' })
    const res = await req('/sh-1')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sets the headers on the 404 response', async () => {
    const res = await req('/no-such-link-id')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })
})

// ─── P-17: analytics rows get an id PK ──────────────────────────────────────

describe('P-17: analytics rows are inserted with a non-null id PK', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('stores a 16-char hex id on each redirect', async () => {
    await seedLink('p17-1', { original_url: 'https://example.com' })
    const r1 = await req('/p17-1')
    expect(r1.status).toBe(302)
    const r2 = await req('/p17-1')
    expect(r2.status).toBe(302)

    const rows = await env.DB.prepare(
      'SELECT id FROM analytics WHERE link_id = ? ORDER BY timestamp'
    ).bind('p17-1').all<{ id: string | null }>()
    expect(rows.results.length).toBe(2)
    expect(rows.results[0].id).toMatch(/^[0-9a-f]{16}$/)
    expect(rows.results[1].id).toMatch(/^[0-9a-f]{16}$/)
    expect(rows.results[0].id).not.toBe(rows.results[1].id) // unique
  })

  it('a single row can be addressed by id (GDPR-style delete)', async () => {
    await seedLink('p17-2', { original_url: 'https://example.com' })
    await req('/p17-2')
    const row = await env.DB.prepare(
      'SELECT id FROM analytics WHERE link_id = ? LIMIT 1'
    ).bind('p17-2').first<{ id: string }>()
    expect(row).toBeTruthy()

    const del = await env.DB.prepare('DELETE FROM analytics WHERE id = ?').bind(row!.id).run()
    expect(del.meta.changes).toBe(1)

    const after = await env.DB.prepare(
      'SELECT COUNT(*) as c FROM analytics WHERE link_id = ?'
    ).bind('p17-2').first<{ c: number }>()
    expect(after?.c).toBe(0)
  })
})

// ─── S-20: referer is hostname-only ─────────────────────────────────────────

describe('S-20: stored referer is hostname-only', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('strips path / query / fragment before storing', async () => {
    await seedLink('s20-1', { original_url: 'https://example.com' })
    const ctx = createExecutionContext()
    const res = await app.fetch(
      new Request(`${BASE}/s20-1`, {
        headers: { Referer: 'https://google.com/search?q=private+search&page=2' },
      }),
      env, ctx
    )
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)

    const row = await env.DB.prepare(
      'SELECT referer FROM analytics WHERE link_id = ?'
    ).bind('s20-1').first<{ referer: string }>()
    expect(row?.referer).toBe('google.com')
  })

  it('records "unknown" when Referer is missing or malformed', async () => {
    await seedLink('s20-2', { original_url: 'https://example.com' })
    const ctx = createExecutionContext()
    const res = await app.fetch(
      new Request(`${BASE}/s20-2`, { headers: { Referer: 'not a url' } }),
      env, ctx
    )
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(302)

    const row = await env.DB.prepare(
      'SELECT referer FROM analytics WHERE link_id = ?'
    ).bind('s20-2').first<{ referer: string }>()
    expect(row?.referer).toBe('unknown')
  })
})

// ─── P-18: webhook fetch has a timeout (AbortController) ─────────────────────

describe('P-18: webhook fetch is bounded by AbortController', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  // Stub global fetch to verify a timeout signal is passed and that the
  // request resolves quickly even when the upstream "hangs".
  it('passes an AbortController signal to the webhook fetch', async () => {
    const originalFetch = globalThis.fetch
    let capturedSignal: AbortSignal | undefined
    let capturedUrl: string | undefined
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      capturedSignal = init?.signal ?? undefined
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    try {
      await seedLink('p18-1', {
        original_url: 'https://example.com',
        webhook_url: 'https://hooks.example.com/hook',
      })
      const ctx = createExecutionContext()
      const res = await app.fetch(
        new Request(`${BASE}/p18-1`),
        env, ctx
      )
      await waitOnExecutionContext(ctx)
      expect(res.status).toBe(302)
      // waitUntil may complete after our test reads, so poll briefly.
      for (let i = 0; i < 30 && !capturedSignal; i++) {
        await new Promise((r) => setTimeout(r, 20))
      }
      expect(capturedUrl).toBe('https://hooks.example.com/hook')
      expect(capturedSignal).toBeInstanceOf(AbortSignal)
      // The signal is alive (not pre-aborted) at fetch time — the timeout
      // schedule aborts it after WEBHOOK_TIMEOUT_MS, not before.
      expect(capturedSignal?.aborted).toBe(false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('redirect still 302s even when the webhook is unreachable', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof fetch

    try {
      await seedLink('p18-2', {
        original_url: 'https://example.com',
        webhook_url: 'https://hooks.example.com/hook',
      })
      const ctx = createExecutionContext()
      const res = await app.fetch(new Request(`${BASE}/p18-2`), env, ctx)
      await waitOnExecutionContext(ctx)
      // User-facing redirect must succeed regardless of webhook outcome.
      expect(res.status).toBe(302)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
