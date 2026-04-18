/**
 * Extended admin handler tests — covers gaps not in admin.test.ts:
 *  - createLink with OG tags, password, UTM, tag fields
 *  - PATCH extend action (and 400 for unknown action)
 *  - bulk-delete input validation (empty ids array)
 *  - createVariant validation (missing destination_url)
 *  - getLinks sparkline structure
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

// ─── createLink — field coverage ──────────────────────────────────────────────

describe('POST /api/links — OG tag fields', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('stores og_title, og_description, og_image when provided', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        og_title: 'My OG Title',
        og_description: 'OG description text',
        og_image: 'https://img.example.com/og.png',
      }),
    })

    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string }

    const row = await env.DB.prepare(
      'SELECT og_title, og_description, og_image FROM links WHERE id = ?'
    ).bind(id).first<{ og_title: string; og_description: string; og_image: string }>()

    expect(row?.og_title).toBe('My OG Title')
    expect(row?.og_description).toBe('OG description text')
    expect(row?.og_image).toBe('https://img.example.com/og.png')
  })

  it('stores null OG fields when not provided', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string }

    const row = await env.DB.prepare(
      'SELECT og_title, og_description, og_image FROM links WHERE id = ?'
    ).bind(id).first<{ og_title: string | null; og_description: string | null; og_image: string | null }>()

    expect(row?.og_title).toBeNull()
    expect(row?.og_description).toBeNull()
    expect(row?.og_image).toBeNull()
  })
})

describe('POST /api/links — password field', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('hashes and stores password when provided', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', password: 'hunter2' }),
    })

    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string }

    const row = await env.DB.prepare(
      'SELECT password_hash FROM links WHERE id = ?'
    ).bind(id).first<{ password_hash: string | null }>()

    // Should be a 64-char SHA-256 hex, not the plaintext
    expect(row?.password_hash).toHaveLength(64)
    expect(row?.password_hash).not.toBe('hunter2')
  })

  it('stores null password_hash when no password given', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string }

    const row = await env.DB.prepare(
      'SELECT password_hash FROM links WHERE id = ?'
    ).bind(id).first<{ password_hash: string | null }>()
    expect(row?.password_hash).toBeNull()
  })
})

describe('POST /api/links — UTM + tag fields', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('stores utm_source, utm_medium, utm_campaign, and tag', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'summer-promo',
        tag: 'campaign-q2',
      }),
    })

    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string }

    const row = await env.DB.prepare(
      'SELECT utm_source, utm_medium, utm_campaign, tag FROM links WHERE id = ?'
    ).bind(id).first<{ utm_source: string; utm_medium: string; utm_campaign: string; tag: string }>()

    expect(row?.utm_source).toBe('newsletter')
    expect(row?.utm_medium).toBe('email')
    expect(row?.utm_campaign).toBe('summer-promo')
    expect(row?.tag).toBe('campaign-q2')
  })
})

describe('POST /api/links — expiry', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('sets expires_at when expiresIn is provided', async () => {
    const beforeCreate = Date.now()
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com', expiresIn: 3600 }),
    })

    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string }

    const row = await env.DB.prepare(
      'SELECT expires_at FROM links WHERE id = ?'
    ).bind(id).first<{ expires_at: string }>()

    expect(row?.expires_at).not.toBeNull()
    const expiresAt = new Date(row!.expires_at).getTime()
    expect(expiresAt).toBeGreaterThan(beforeCreate + 3590_000) // ~1 hour
    expect(expiresAt).toBeLessThan(beforeCreate + 3610_000)
  })

  it('stores null expires_at when no expiresIn', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(200)
    const { id } = await res.json() as { id: string }

    const row = await env.DB.prepare(
      'SELECT expires_at FROM links WHERE id = ?'
    ).bind(id).first<{ expires_at: string | null }>()
    expect(row?.expires_at).toBeNull()
  })
})

// ─── PATCH /api/links/:id — extend action ─────────────────────────────────────

describe('PATCH /api/links/:id (extend)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('extends expiry on an already-expiring link', async () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString()
    await seedLink('ext-link', { expires_at: futureDate })

    const res = await req('/api/links/ext-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 24 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; expires_at: string }
    expect(body.success).toBe(true)
    expect(body.expires_at).toBeDefined()

    const newExpiry = new Date(body.expires_at).getTime()
    const originalExpiry = new Date(futureDate).getTime()
    // New expiry should be ~24 hours beyond the original
    expect(newExpiry).toBeGreaterThan(originalExpiry + 23 * 3600_000)
    expect(newExpiry).toBeLessThan(originalExpiry + 25 * 3600_000)
  })

  it('extends from now when link has no expiry', async () => {
    await seedLink('ext-no-expiry', { expires_at: null })

    const res = await req('/api/links/ext-no-expiry', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 48 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; expires_at: string }
    expect(body.success).toBe(true)
    const newExpiry = new Date(body.expires_at).getTime()
    expect(newExpiry).toBeGreaterThan(Date.now() + 47 * 3600_000)
  })

  it('extends from now when link has already expired', async () => {
    const pastDate = new Date(Date.now() - 3600_000).toISOString()
    await seedLink('ext-expired', { expires_at: pastDate, disabled: 1 })

    const res = await req('/api/links/ext-expired', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 12 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; expires_at: string }
    expect(body.success).toBe(true)
    // Re-enables the link
    const row = await env.DB.prepare('SELECT disabled FROM links WHERE id = ?').bind('ext-expired').first<{ disabled: number }>()
    expect(row?.disabled).toBe(0)
  })

  it('defaults to 24 hours when extendHours is not provided', async () => {
    await seedLink('ext-default')

    const res = await req('/api/links/ext-default', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; expires_at: string }
    expect(body.success).toBe(true)
    const newExpiry = new Date(body.expires_at).getTime()
    expect(newExpiry).toBeGreaterThan(Date.now() + 23 * 3600_000)
  })

  it('returns 404 when extending a non-existent link', async () => {
    const res = await req('/api/links/ghost-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'extend', extendHours: 24 }),
    })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/links/:id (unknown action)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 400 for unrecognised action', async () => {
    await seedLink('action-link')
    const res = await req('/api/links/action-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'delete-all-data' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/unknown action/i)
  })

  it('returns 404 when toggling a non-existent link', async () => {
    const res = await req('/api/links/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ action: 'toggle' }),
    })
    expect(res.status).toBe(404)
  })
})

// ─── POST /api/links/bulk-delete — input validation ───────────────────────────

describe('POST /api/links/bulk-delete — validation', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 400 when ids array is empty', async () => {
    const res = await req('/api/links/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ ids: [] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBeDefined()
  })

  it('returns 400 when ids is not an array', async () => {
    const res = await req('/api/links/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ ids: 'link1' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await req('/api/links/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ['link1'] }),
    })
    expect(res.status).toBe(401)
  })

  it('silently succeeds when deleting non-existent ids', async () => {
    const res = await req('/api/links/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ ids: ['ghost1', 'ghost2'] }),
    })
    // D1 batch DELETE on missing rows is not an error
    expect(res.status).toBe(200)
    const body = await res.json() as { deleted: number }
    expect(body.deleted).toBe(2) // reports the number of ids sent
  })
})

// ─── Variant API — validation ─────────────────────────────────────────────────

describe('POST /api/links/:id/variants — validation', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 400 when destination_url is missing', async () => {
    await seedLink('var-link')
    const res = await req('/api/links/var-link/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ weight: 5 }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toMatch(/destination_url/i)
  })

  it('defaults weight to 1 when not specified', async () => {
    await seedLink('var-weight')
    const res = await req('/api/links/var-weight/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ destination_url: 'https://variant.com' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { weight: number }
    expect(body.weight).toBe(1)
  })

  it('returns 401 without auth', async () => {
    await seedLink('var-auth')
    const res = await req('/api/links/var-auth/variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination_url: 'https://variant.com' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/links/:id/variants — empty result', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns empty array for link with no variants', async () => {
    await seedLink('no-variants')
    const res = await req('/api/links/no-variants/variants', {
      headers: { Authorization: AUTH },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(0)
  })
})

// ─── getLinks — sparkline structure ──────────────────────────────────────────

describe('GET /api/links — sparkline', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns sparkline array of length 7 for each link', async () => {
    await seedLink('sparklink')
    const res = await req('/api/links', { headers: { Authorization: AUTH } })
    expect(res.status).toBe(200)
    const body = await res.json() as any[]
    expect(body[0].sparkline).toBeDefined()
    expect(Array.isArray(body[0].sparkline)).toBe(true)
    expect(body[0].sparkline).toHaveLength(7)
    expect(body[0].sparkline.every((v: unknown) => typeof v === 'number')).toBe(true)
  })

  it('sparkline counts visits for the last 7 days', async () => {
    await seedLink('spark-count')
    const now = new Date().toISOString()
    // Insert 3 analytics rows for today
    for (let i = 0; i < 3; i++) {
      await env.DB.prepare(
        'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind('spark-count', 'US', 'direct', 'bot', now).run()
    }

    const res = await req('/api/links', { headers: { Authorization: AUTH } })
    const body = await res.json() as any[]
    const link = body.find((l: any) => l.id === 'spark-count')
    expect(link).toBeDefined()
    // Last element of sparkline is today
    expect(link.sparkline[6]).toBe(3)
  })
})
