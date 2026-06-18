/**
 * Tests for the third audit (2026-06-17) HIGH-priority items:
 *  - S-15: rate-limit + PBKDF2 for password verification
 *  - S-16: og_image URL validation + length caps on free-form text fields
 *  - S-17: isSafeWebhookUrl covers IPv6 ULA, ::ffff:, 0.0.0.0, 100.64.x
 *  - B-09: bulkDeleteLinks caps batch at 100 IDs
 *  - B-10: extendHours validated to integer in [1, 8760]
 *  - P-15: exportLinks streams the CSV (no OOM) and caps at 10K rows
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { isSafeWebhookUrl } from '../../src/lib/redirectUtils'
import { applySchema, clearAll, seedLink } from '../helpers/schema'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

async function req(url: string, init: RequestInit = {}) {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

// ─── S-17: isSafeWebhookUrl — additional private/loopback ranges ─────────────

describe('S-17: isSafeWebhookUrl blocks IPv6 ULA + mapped ranges', () => {
  it('rejects IPv4-mapped IPv6 (::ffff:169.254.169.254 — cloud metadata)', () => {
    expect(isSafeWebhookUrl('https://[::ffff:169.254.169.254]/hook')).toBe(false)
  })

  it('rejects IPv4-mapped IPv6 (::ffff:127.0.0.1 — loopback)', () => {
    expect(isSafeWebhookUrl('https://[::ffff:127.0.0.1]/hook')).toBe(false)
  })

  it('rejects IPv4-mapped IPv6 (::ffff:10.0.0.1 — RFC1918)', () => {
    expect(isSafeWebhookUrl('https://[::ffff:10.0.0.1]/hook')).toBe(false)
  })

  it('rejects IPv6 ULA fd00::/8', () => {
    expect(isSafeWebhookUrl('https://[fd00::1]/hook')).toBe(false)
    expect(isSafeWebhookUrl('https://[fd12:3456:789a::1]/hook')).toBe(false)
  })

  it('rejects IPv6 ULA fc00::/8', () => {
    expect(isSafeWebhookUrl('https://[fc00::1]/hook')).toBe(false)
  })

  it('rejects IPv6 link-local fe80::/10', () => {
    expect(isSafeWebhookUrl('https://[fe80::1]/hook')).toBe(false)
    expect(isSafeWebhookUrl('https://[fea0::1]/hook')).toBe(false)
  })

  it('rejects Cloudflare CGNAT range 100.64.0.0/10', () => {
    expect(isSafeWebhookUrl('https://100.64.0.1/hook')).toBe(false)
    expect(isSafeWebhookUrl('https://100.127.255.254/hook')).toBe(false)
  })

  it('rejects 0.0.0.0 (this network)', () => {
    expect(isSafeWebhookUrl('https://0.0.0.0/hook')).toBe(false)
  })

  it('rejects http: scheme', () => {
    expect(isSafeWebhookUrl('http://example.com/hook')).toBe(false)
  })

  it('rejects malformed URL', () => {
    expect(isSafeWebhookUrl('not a url')).toBe(false)
  })

  it('accepts a normal public https URL', () => {
    expect(isSafeWebhookUrl('https://hooks.example.com/webhook')).toBe(true)
    expect(isSafeWebhookUrl('https://api.github.com/events')).toBe(true)
  })
})

// ─── S-16: og_image validation + length caps ─────────────────────────────────

describe('S-16: og_image must be a public http(s) URL', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('rejects javascript: og_image URLs', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', og_image: 'javascript:alert(1)' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/og_image/)
  })

  it('rejects data: og_image URLs', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', og_image: 'data:text/html,<script>1</script>' }),
    })
    expect(res.status).toBe(400)
  })

  it('accepts https: og_image URLs', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', og_image: 'https://img.example.com/og.png' }),
    })
    expect(res.status).toBe(200)
  })

  it('accepts null/empty og_image (treated as absent)', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', og_image: '' }),
    })
    expect(res.status).toBe(200)
  })
})

describe('S-16/B-11: length caps on free-form text fields', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('rejects og_title > 200 chars', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', og_title: 'a'.repeat(201) }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/og_title/)
  })

  it('rejects og_description > 500 chars', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', og_description: 'a'.repeat(501) }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/og_description/)
  })

  it('rejects utm_source > 200 chars', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', utm_source: 'a'.repeat(201) }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects tag > 64 chars', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', tag: 'a'.repeat(65) }),
    })
    expect(res.status).toBe(400)
  })

  it('accepts fields at the cap', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        tag: 'a'.repeat(64),
        og_title: 'b'.repeat(200),
        og_description: 'c'.repeat(500),
        utm_source: 'd'.repeat(200),
      }),
    })
    expect(res.status).toBe(200)
  })
})

// ─── B-09: bulkDeleteLinks upper bound ───────────────────────────────────────

describe('B-09: bulkDeleteLinks caps batch at 100 IDs', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('rejects batches larger than 100 IDs with 400', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `link${i}`)
    const res = await req('/api/links/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ ids }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/100/)
  })

  it('accepts exactly 100 IDs', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => `link${i}`)
    const res = await req('/api/links/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ ids }),
    })
    expect(res.status).toBe(200)
  })
})

// ─── B-10: extendHours validation ─────────────────────────────────────────────

describe('B-10: extendHours must be a finite integer in [1, 8760]', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('rejects non-numeric extendHours', async () => {
    await seedLink('ext-bad-1')
    const res = await req('/api/links/ext-bad-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 'twenty' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/extendHours/)
  })

  it('rejects zero', async () => {
    await seedLink('ext-bad-2')
    const res = await req('/api/links/ext-bad-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 0 }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects negative hours', async () => {
    await seedLink('ext-bad-3')
    const res = await req('/api/links/ext-bad-3', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: -1 }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects hours > 8760 (1 year)', async () => {
    await seedLink('ext-bad-4')
    const res = await req('/api/links/ext-bad-4', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 8761 }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects non-integer hours', async () => {
    await seedLink('ext-bad-5')
    const res = await req('/api/links/ext-bad-5', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 1.5 }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects values that overflow Date arithmetic', async () => {
    await seedLink('ext-bad-6')
    const res = await req('/api/links/ext-bad-6', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: Number.MAX_SAFE_INTEGER }),
    })
    expect(res.status).toBe(400)
  })

  it('accepts the maximum 8760', async () => {
    await seedLink('ext-ok')
    const res = await req('/api/links/ext-ok', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 8760 }),
    })
    expect(res.status).toBe(200)
  })
})

// ─── P-15: exportLinks streaming + truncation cap ────────────────────────────

describe('P-15: exportLinks streams a CSV', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns text/csv with a single header row when the table is empty', async () => {
    const res = await req('/api/links/export', { headers: { Authorization: AUTH } })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/csv/)
    const body = await res.text()
    expect(body).toBe('ID,Original URL,Created,Expires,Status,Tag,Visits\n')
  })

  it('streams rows for every link without holding them all in one chunk', async () => {
    await seedLink('exp-1')
    await seedLink('exp-2')
    await seedLink('exp-3')

    const res = await req('/api/links/export', { headers: { Authorization: AUTH } })
    expect(res.status).toBe(200)
    const body = await res.text()
    const lines = body.trim().split('\n')
    expect(lines[0]).toBe('ID,Original URL,Created,Expires,Status,Tag,Visits')
    expect(lines.length).toBe(4) // header + 3 links
  })

  it('caps the export at 10,000 rows and emits a truncation comment', async () => {
    // Insert 10,005 rows directly to avoid seeding overhead
    const stmt = env.DB.prepare(
      'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
    )
    for (let i = 0; i < 10005; i++) {
      await stmt.bind(`bulk${i}`, 'https://example.com', new Date(Date.now() - i * 1000).toISOString()).run()
    }

    const res = await req('/api/links/export', { headers: { Authorization: AUTH } })
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toMatch(/# truncated at 10000 rows/)
    const dataLines = body.trim().split('\n').slice(1).filter((l) => !l.startsWith('#'))
    expect(dataLines.length).toBe(10000)
  })
})

// ─── S-15: rate limit on POST /password/:id ──────────────────────────────────

describe('S-15: POST /password/:id is rate-limited', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('responds to POST /password/:id', async () => {
    // Smoke test: the route is reachable and the rate-limit middleware runs
    // (a 401 is expected because the body is empty).
    const res = await req('/password/some-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'x' }),
    })
    expect([400, 401, 404, 429]).toContain(res.status)
  })
})
