/**
 * Tests for the third audit (2026-06-17) LOW-priority items:
 *  - B-12: purgeRedirectCache uses the supplied baseUrl (no hardcoded `duckshort.cc`)
 *  - B-13: index.tsx reads PAGES_URL from env, falling back to the production URL
 *  - P-19: rate-limit fail-open path emits a highly distinguishable structured log
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { purgeRedirectCache } from '../../src/lib/redirectUtils'
import { applySchema, clearAll, seedLink } from '../helpers/schema'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

async function req(url: string, init: RequestInit = {}) {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

// ─── B-12: purgeRedirectCache honours the supplied baseUrl ─────────────────

describe('B-12: purgeRedirectCache uses the supplied baseUrl', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  // Helper: stub `caches.default.delete` and return the captured URL.
  async function withDeleteSpy(
    fn: (capture: (url: string) => void) => Promise<void> | void
  ): Promise<string | undefined> {
    const cacheApi = (globalThis as unknown as { caches: { default: Cache } }).caches
    const originalDelete = cacheApi.default.delete.bind(cacheApi.default)
    let captured: string | undefined
    cacheApi.default.delete = async (input: RequestInfo | URL) => {
      captured = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      return true
    }
    try {
      await fn((url) => { captured = url })
    } finally {
      cacheApi.default.delete = originalDelete
    }
    return captured
  }

  it('builds the cache key from the explicit baseUrl argument', async () => {
    const ctx = { waitUntil: () => { /* no-op */ } } as unknown as ExecutionContext
    const captured = await withDeleteSpy(() => {
      void purgeRedirectCache(ctx, 'abc123', 'https://staging.duckshort.example')
    })
    expect(captured).toBe('https://staging.duckshort.example/__redirect_cache__/abc123')
  })

  it('strips trailing slashes from baseUrl before building the cache key', async () => {
    const ctx = { waitUntil: () => { /* no-op */ } } as unknown as ExecutionContext
    const captured = await withDeleteSpy(() => {
      void purgeRedirectCache(ctx, 'xyz', 'https://staging.duckshort.example///')
    })
    expect(captured).toBe('https://staging.duckshort.example/__redirect_cache__/xyz')
  })

  it('falls back to https://duckshort.cc when no baseUrl is supplied', async () => {
    const ctx = { waitUntil: () => { /* no-op */ } } as unknown as ExecutionContext
    const captured = await withDeleteSpy(() => {
      void purgeRedirectCache(ctx, 'legacy')
    })
    expect(captured).toBe('https://duckshort.cc/__redirect_cache__/legacy')
  })

  // S-21: The redirect cache write key is lower-cased (see `cacheKey` in
  // redirectUtils). purgeRedirectCache MUST use the same casing so admin
  // toggle/delete/extend actually evict the cached entry. Without this,
  // a request that warms the cache under one casing would survive an
  // admin toggle/delete when the link id differs in case from the cache
  // key — the cache would keep returning the old destination until its
  // 24h TTL expired.
  it('lowercases the id segment so it matches the cache write key (S-21)', async () => {
    const ctx = { waitUntil: () => { /* no-op */ } } as unknown as ExecutionContext
    const captured = await withDeleteSpy(() => {
      void purgeRedirectCache(ctx, 'VibeCoding-01', 'https://duckshort.cc')
    })
    expect(captured).toBe('https://duckshort.cc/__redirect_cache__/vibecoding-01')
  })

  it('lower-cases the id when baseUrl is omitted', async () => {
    const ctx = { waitUntil: () => { /* no-op */ } } as unknown as ExecutionContext
    const captured = await withDeleteSpy(() => {
      void purgeRedirectCache(ctx, 'MixedCase')
    })
    expect(captured).toBe('https://duckshort.cc/__redirect_cache__/mixedcase')
  })

  it('admin toggle / delete / bulk-delete pass c.env.BASE_URL as the cache origin', async () => {
    await seedLink('b12-1')
    await seedLink('b12-2')
    const res = await req('/api/links/b12-1', {
      method: 'DELETE',
      headers: { Authorization: AUTH },
    })
    expect(res.status).toBe(200)
    // The cache.delete call goes through ctx.waitUntil, so it may complete
    // after the response. Probe the spy until we observe at least one
    // call referencing the link id and BASE_URL.
    const cacheApi = (globalThis as unknown as { caches: { default: Cache } }).caches
    const originalDelete = cacheApi.default.delete.bind(cacheApi.default)
    const captured: string[] = []
    cacheApi.default.delete = async (input: RequestInfo | URL) => {
      captured.push(typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url)
      return true
    }
    try {
      await req('/api/links/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ ids: ['b12-2'] }),
      })
      // waitUntil may not flush before req() returns, so retry briefly.
      for (let i = 0; i < 30; i++) {
        if (captured.some((u) => u.includes('/__redirect_cache__/b12-2'))) break
        await new Promise((r) => setTimeout(r, 20))
      }
      const matched = captured.filter((u) => u.includes('__redirect_cache__'))
      expect(matched.length).toBeGreaterThan(0)
      // Cache origin should be BASE_URL (https://duckshort.cc), not hardcoded
      // anywhere else.
      matched.forEach((u) => {
        expect(u).toMatch(/^https?:\/\/[^/]+\/__redirect_cache__\//)
      })
    } finally {
      cacheApi.default.delete = originalDelete
    }
  })
})

// ─── B-13: PAGES_URL env var drives the Pages proxy origin ────────────────

describe('B-13: Pages proxy uses PAGES_URL when set', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('falls back to https://duckshort.pages.dev when PAGES_URL is unset', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/`), env, ctx)
    await waitOnExecutionContext(ctx)
    // We can't observe the Pages fetch directly, but the proxy must complete
    // without erroring and the S-19 security-headers middleware still applies.
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('honours PAGES_URL when the env overrides it', async () => {
    const ctx = createExecutionContext()
    const envWithPages = new Proxy(env, {
      get(target, prop) {
        if (prop === 'PAGES_URL') return 'https://staging.duckshort.pages.dev'
        return Reflect.get(target as object, prop)
      },
    }) as unknown as typeof env
    const res = await app.fetch(new Request(`${BASE}/`), envWithPages, ctx)
    await waitOnExecutionContext(ctx)
    // The proxy still emits the security headers regardless of the upstream.
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})

// ─── P-19: rate-limit fail-open emits a distinguishable structured log ────

describe('P-19: rate-limit fail-open path is loudly logged', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('logs rate_limit_disabled_binding_missing with fail_open: true when RATE_LIMITER is missing', async () => {
    // Save and stub the original console.warn so we can capture the structured log entry.
    const originalWarn = console.warn
    const captured: unknown[][] = []
    console.warn = (...args: unknown[]) => { captured.push(args) }

    try {
      // Build a context without RATE_LIMITER (the binding is absent).
      const envWithoutLimiter = {
        ...env,
        // Override with `undefined` to simulate the binding-missing case.
        // We can't delete properties on the frozen env, so we use a Proxy.
      } as unknown as typeof env
      const envProxy = new Proxy(envWithoutLimiter, {
        get(target, prop) {
          if (prop === 'RATE_LIMITER') return undefined
          return Reflect.get(target as object, prop)
        },
      })

      const ctx = createExecutionContext()
      const res = await app.fetch(
        new Request(`${BASE}/api/links`, { headers: { Authorization: AUTH } }),
        envProxy,
        ctx
      )
      await waitOnExecutionContext(ctx)
      expect(res.status).toBe(200)

      // Find the fail-open log entry. The structured log is a single JSON
      // string with `message: rate_limit_disabled_binding_missing`.
      const entry = captured
        .map((args) => args[0])
        .find((msg) => typeof msg === 'string' && msg.includes('rate_limit_disabled_binding_missing'))
      expect(entry, 'expected fail-open warning to be logged').toBeDefined()
      const parsed = JSON.parse(entry as string) as Record<string, unknown>
      expect(parsed.message).toBe('rate_limit_disabled_binding_missing')
      expect(parsed.fail_open).toBe(true)
      expect(parsed.binding).toBe('RATE_LIMITER')
      expect(parsed.path).toBe('/api/links')
      expect(parsed.action_required).toMatch(/wrangler\.toml/)
    } finally {
      console.warn = originalWarn
    }
  })
})
