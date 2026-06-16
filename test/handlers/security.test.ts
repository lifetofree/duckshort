import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { applySchema, clearAll, seedLink } from '../helpers/schema'

const BASE = 'http://localhost'
const AUTH = { Authorization: `Bearer ${env.ADMIN_SECRET}` }

describe('Security: URL validation (S-06)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('rejects javascript: URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toMatch(/http/)
  })

  it('rejects data: URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'data:text/html,<script>alert(1)</script>' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
  })

  it('rejects ftp: URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'ftp://files.example.com/file.txt' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
  })

  it('accepts http: URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'http://example.com' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
  })

  it('accepts https: URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
  })
})

describe('Security: Webhook URL validation (S-07)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('rejects http: webhook URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', webhook_url: 'http://example.com/hook' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toMatch(/webhook/)
  })

  it('rejects localhost webhook URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', webhook_url: 'https://localhost/hook' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
  })

  it('rejects private IP webhook URLs (127.x.x.x)', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', webhook_url: 'https://127.0.0.1/hook' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
  })

  it('rejects private IP webhook URLs (192.168.x.x)', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', webhook_url: 'https://192.168.1.1/hook' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
  })

  it('accepts public https: webhook URLs', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', webhook_url: 'https://hooks.example.com/webhook' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
  })
})

describe('Security: Custom ID validation (B-01)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('rejects custom ID longer than 20 chars', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', customId: 'a'.repeat(21) }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toMatch(/3-20/)
  })

  it('rejects custom ID shorter than 3 chars', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', customId: 'ab' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
  })

  it('rejects custom ID with special characters', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', customId: 'my link!' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(400)
  })

  it('accepts valid custom ID', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ url: 'https://example.com', customId: 'my-link_123' }),
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(data.id).toBe('my-link_123')
  })
})

describe('Security: Auth (S-01, S-02)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 401 for missing auth', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(401)
  })

  it('returns 401 for wrong bearer token', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      headers: { Authorization: 'Bearer wrong-secret' },
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(401)
  })

  it('accepts correct bearer token', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, {
      headers: AUTH,
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
  })
})

describe('Security: deleteLink 404 check (BUG-5)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 404 when deleting a non-existent link', async () => {
    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links/doesnotexist`, {
      method: 'DELETE',
      headers: AUTH,
    }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(404)
  })
})

describe('Performance: parallel stats query (P-09)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns sparkline data along with stats', async () => {
    await seedLink('sparktest', { original_url: 'https://example.com' })
    await env.DB.prepare(
      `INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)`
    ).bind('sparktest', 'TH', 'unknown', 'test', new Date().toISOString()).run()

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/stats/sparktest`), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const data = await res.json() as any
    expect(Array.isArray(data.sparkline)).toBe(true)
    expect(data.sparkline).toHaveLength(7)
    expect(data.sparkline[6]).toBe(1)
  })
})

describe('Admin: getLinks returns extended columns (B-05)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns burn_on_read and has_password fields', async () => {
    await seedLink('exttest', { original_url: 'https://example.com', burn_on_read: 1, password_hash: 'fakehash' })

    const ctx = createExecutionContext()
    const res = await app.fetch(new Request(`${BASE}/api/links`, { headers: AUTH }), env, ctx)
    await waitOnExecutionContext(ctx)
    expect(res.status).toBe(200)
    const links = await res.json() as any[]
    const link = links.find(l => l.id === 'exttest')
    expect(link).toBeDefined()
    expect(link.burn_on_read).toBe(1)
    expect(link.has_password).toBe(1)
  })
})
