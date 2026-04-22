import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

async function applySchema() {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, original_url TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT, disabled INTEGER DEFAULT 0, password_hash TEXT, tag TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, webhook_url TEXT, burn_on_read INTEGER DEFAULT 0, og_title TEXT, og_description TEXT, og_image TEXT, custom_domain TEXT)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS analytics (link_id TEXT NOT NULL, country TEXT, referer TEXT, user_agent TEXT, timestamp TEXT DEFAULT (datetime('now')))`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS link_variants (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, destination_url TEXT NOT NULL, weight INTEGER DEFAULT 1)`)
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS geo_redirects (id TEXT PRIMARY KEY, link_id TEXT NOT NULL, country_code TEXT NOT NULL, destination_url TEXT NOT NULL)`)}

async function clearAll() {
  await env.DB.prepare('DELETE FROM links').run()
  await env.DB.prepare('DELETE FROM analytics').run()
  await env.DB.prepare('DELETE FROM link_variants').run()
}

async function req(url: string, init: RequestInit = {}) {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

describe('A/B Link Variants', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('creates link with variants', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        variants: [
          { destination_url: 'https://variant-a.com', weight: 1 },
          { destination_url: 'https://variant-b.com', weight: 1 }
        ]
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; shortUrl: string }
    expect(body.id).toHaveLength(8)

    // Check variants were created
    const variants = await env.DB.prepare(
      'SELECT * FROM link_variants WHERE link_id = ?'
    ).bind(body.id).all()
    expect(variants.results.length).toBe(2)
  })

  it('redirects to variant destination when variants exist', async () => {
    // Create link with variants
    const createRes = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        variants: [
          { destination_url: 'https://variant-a.com', weight: 1 },
          { destination_url: 'https://variant-b.com', weight: 1 }
        ]
      }),
    })

    const createBody = await createRes.json() as { id: string }
    const linkId = createBody.id

    // Test redirect
    const ctx = createExecutionContext()
    const redirectRes = await app.fetch(new Request(`${BASE}/${linkId}`), env, ctx)
    await waitOnExecutionContext(ctx)

    expect(redirectRes.status).toBe(302)
    const location = redirectRes.headers.get('location')
    expect(location).toMatch(/https:\/\/variant-[ab]\.com/)
  })

  it('respects variant weights in selection', async () => {
    // Create link with weighted variants
    const createRes = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        variants: [
          { destination_url: 'https://heavy.com', weight: 9 },
          { destination_url: 'https://light.com', weight: 1 }
        ]
      }),
    })

    const createBody = await createRes.json() as { id: string }
    const linkId = createBody.id

    // Make multiple requests and check distribution
    const results = { heavy: 0, light: 0 }
    const iterations = 20

    for (let i = 0; i < iterations; i++) {
      const ctx = createExecutionContext()
      const res = await app.fetch(new Request(`${BASE}/${linkId}`), env, ctx)
      await waitOnExecutionContext(ctx)

      const location = res.headers.get('location')
      if (location === 'https://heavy.com') {
        results.heavy++
      } else if (location === 'https://light.com') {
        results.light++
      }
    }

    // Heavy variant should be selected more often (approximately 90%)
    expect(results.heavy).toBeGreaterThan(results.light)
  })

  it('lists variants for a link', async () => {
    // Create link with variants
    const createRes = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        variants: [
          { destination_url: 'https://variant-a.com', weight: 2 },
          { destination_url: 'https://variant-b.com', weight: 3 }
        ]
      }),
    })

    const createBody = await createRes.json() as { id: string }
    const linkId = createBody.id

    // Get variants
    const variantsRes = await req(`/api/links/${linkId}/variants`, {
      headers: { Authorization: AUTH }
    })

    expect(variantsRes.status).toBe(200)
    const variants = await variantsRes.json() as any[]
    expect(variants.length).toBe(2)
    expect(variants[0].weight).toBe(2)
    expect(variants[1].weight).toBe(3)
  })

  it('adds variant to existing link', async () => {
    // Create link
    const createRes = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ url: 'https://example.com' }),
    })

    const createBody = await createRes.json() as { id: string }
    const linkId = createBody.id

    // Add variant
    const addRes = await req(`/api/links/${linkId}/variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({ destination_url: 'https://new-variant.com', weight: 5 })
    })

    expect(addRes.status).toBe(200)
    const addBody = await addRes.json() as { id: string; destination_url: string; weight: number }
    expect(addBody.destination_url).toBe('https://new-variant.com')
    expect(addBody.weight).toBe(5)
  })

  it('deletes variant from link', async () => {
    // Create link with variant
    const createRes = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        variants: [{ destination_url: 'https://variant.com', weight: 1 }]
      }),
    })

    const createBody = await createRes.json() as { id: string }
    const linkId = createBody.id

    // Get variant ID
    const variantsRes = await req(`/api/links/${linkId}/variants`, {
      headers: { Authorization: AUTH }
    })
    const variants = await variantsRes.json() as any[]
    const variantId = variants[0].id

    // Delete variant
    const deleteRes = await req(`/api/links/variants/${variantId}`, {
      method: 'DELETE',
      headers: { Authorization: AUTH }
    })

    expect(deleteRes.status).toBe(200)

    // Verify variant is deleted
    const variantsAfterRes = await req(`/api/links/${linkId}/variants`, {
      headers: { Authorization: AUTH }
    })
    const variantsAfter = await variantsAfterRes.json() as any[]
    expect(variantsAfter.length).toBe(0)
  })
})
