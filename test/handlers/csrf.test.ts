// 1.4: CSRF protection for state-changing /api/* requests.
import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { applySchema, clearAll } from '../helpers/schema'

const BASE = 'http://localhost'
const AUTH = 'Bearer test-secret'

async function seedLink(id: string) {
  await env.DB.prepare(
    'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
  ).bind(id, 'https://example.com', new Date().toISOString()).run()
}

async function req(url: string, init: RequestInit = {}): Promise<Response> {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

interface LoginResult { adminToken: string; csrfToken: string }

async function login(): Promise<LoginResult> {
  // 1.4: login sets both the admin_token (HttpOnly) and XSRF-TOKEN cookies.
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'test-secret' }),
  }), env, ctx)
  await waitOnExecutionContext(ctx)
  const setCookieHeaders = res.headers.getSetCookie?.() ?? []
  const adminCookie = setCookieHeaders.find((c) => c.startsWith('admin_token='))
  const csrfCookie = setCookieHeaders.find((c) => c.startsWith('XSRF-TOKEN='))
  if (!adminCookie || !csrfCookie) throw new Error('Missing cookies in login response')
  return {
    adminToken: adminCookie.split(';')[0].split('=')[1],
    csrfToken: csrfCookie.split(';')[0].split('=')[1],
  }
}

describe('CSRF protection (1.4)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('login sets an XSRF-TOKEN cookie alongside admin_token', async () => {
    const { csrfToken } = await login()
    expect(csrfToken).toBeTruthy()
    expect(csrfToken.length).toBe(64) // 32 bytes hex
  })

  it('POST /api/links via cookie auth without X-XSRF-TOKEN header → 403', async () => {
    const { adminToken, csrfToken } = await login()
    const res = await req('/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': `admin_token=${adminToken}; XSRF-TOKEN=${csrfToken}`,
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('CSRF token mismatch')
  })

  it('POST /api/links via cookie auth with matching X-XSRF-TOKEN header → 200/201', async () => {
    const { adminToken, csrfToken } = await login()
    const res = await req('/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': `admin_token=${adminToken}; XSRF-TOKEN=${csrfToken}`,
        'X-XSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect([200, 201]).toContain(res.status)
  })

  it('POST /api/links via cookie auth with mismatched X-XSRF-TOKEN header → 403', async () => {
    const { adminToken, csrfToken } = await login()
    const res = await req('/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': `admin_token=${adminToken}; XSRF-TOKEN=${csrfToken}`,
        'X-XSRF-TOKEN': 'a'.repeat(64),
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(403)
  })

  it('PATCH /api/links/:id via cookie auth without CSRF token → 403', async () => {
    const { adminToken, csrfToken } = await login()
    await seedLink('csrf-patch-1')
    const res = await req('/api/links/csrf-patch-1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'cookie': `admin_token=${adminToken}; XSRF-TOKEN=${csrfToken}`,
      },
      body: JSON.stringify({ action: 'toggle' }),
    })
    expect(res.status).toBe(403)
  })

  it('DELETE /api/links/:id via cookie auth without CSRF token → 403', async () => {
    const { adminToken, csrfToken } = await login()
    await seedLink('csrf-del-1')
    const res = await req('/api/links/csrf-del-1', {
      method: 'DELETE',
      headers: { 'cookie': `admin_token=${adminToken}; XSRF-TOKEN=${csrfToken}` },
    })
    expect(res.status).toBe(403)
  })

  it('GET /api/links is exempt from CSRF (safe method)', async () => {
    const { adminToken } = await login()
    const res = await req('/api/links', {
      headers: { 'cookie': `admin_token=${adminToken}` },
    })
    expect(res.status).toBe(200)
  })

  it('Bearer auth does NOT need a CSRF token (no auto-attached cookie)', async () => {
    // CLI scripts use Bearer; no cookie means no CSRF attack surface.
    const res = await req('/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': AUTH,
        // No X-XSRF-TOKEN, no cookie — should succeed because Bearer auth
        // bypasses the CSRF check.
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect([200, 201]).toContain(res.status)
  })

  it('anonymous POST /api/links with only public fields succeeds (no auth required)', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(200)
  })

  it('anonymous POST /api/links with admin-only fields returns 401', async () => {
    const res = await req('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', webhook_url: 'https://hooks.example.com/hook' }),
    })
    expect(res.status).toBe(401)
  })

  it('admin-cookie POST /api/links with matching X-XSRF-TOKEN header succeeds (home form path)', async () => {
    // Regression: when an admin is logged in and visits the home page, the
    // browser auto-attaches the admin_token cookie to the public shorten
    // request via credentials: 'include'. The SPA reads the XSRF-TOKEN
    // cookie and echoes it back as X-XSRF-TOKEN so the CSRF check passes.
    const { adminToken, csrfToken } = await login()
    const res = await req('/api/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cookie': `admin_token=${adminToken}; XSRF-TOKEN=${csrfToken}`,
        'X-XSRF-TOKEN': csrfToken,
      },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(200)
  })

  it('POST /api/auth (login) is exempt from CSRF (no session yet)', async () => {
    const res = await req('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-secret' }),
    })
    expect(res.status).toBe(200)
  })
})

