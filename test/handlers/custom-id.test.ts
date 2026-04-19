import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

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

async function req(url: string, init: RequestInit = {}) {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

describe('Custom ID (Vanity URL) Functionality', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('creates link with valid custom ID', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'my-custom-link'
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('my-custom-link')
    expect(body.shortUrl).toContain('my-custom-link')
  })

  it('returns 409 when custom ID already exists', async () => {
    // Create first link with custom ID
    await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'taken-id'
      }),
    })

    // Try to create second link with same ID
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://another.com',
        customId: 'taken-id'
      }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('already taken')
  })

  it('accepts custom ID with underscores and hyphens', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'my_custom-link-123'
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('my_custom-link-123')
  })

  it('accepts custom ID with mixed case', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'MyCustomID'
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('MyCustomID')
  })

  it('trims whitespace from custom ID', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: '  my-id  '
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('my-id')
  })

  it('redirects correctly using custom ID', async () => {
    // Create link with custom ID
    await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'test-redirect'
      }),
    })

    // Test redirect
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/test-redirect`), env, ctx)
    await waitOnExecutionContext(ctx)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com')
  })

  it('generates random ID when customId is not provided', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com'
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toHaveLength(8)
    expect(body.id).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('handles empty customId by generating random ID', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: ''
      }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toHaveLength(8)
  })

  it('rejects custom ID that is too short (less than 3 characters)', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'ab'
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('3-20 characters')
  })

  it('rejects custom ID that is too long (more than 20 characters)', async () => {
    const longId = 'a'.repeat(21)
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: longId
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('3-20 characters')
  })

  it('rejects custom ID with invalid characters', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'my@custom#id'
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('alphanumeric, underscore, hyphen')
  })

  it('rejects custom ID with spaces', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify({
        url: 'https://example.com',
        customId: 'my custom id'
      }),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('alphanumeric, underscore, hyphen')
  })
})
