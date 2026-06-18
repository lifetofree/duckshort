import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { applySchema, clearAll } from '../helpers/schema'

const BASE = 'http://localhost'

async function req(url: string, init: RequestInit = {}) {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

describe('POST /api/auth', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 400 when password is missing', async () => {
    const res = await req('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Password required')
  })

  it('returns 500 when ADMIN_SECRET is not set', async () => {
    const origSecret = env.ADMIN_SECRET
    try {
      env.ADMIN_SECRET = ''
      const res = await req('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'test' }),
      })
      expect(res.status).toBe(500)
      const body = await res.json() as { error: string }
      expect(body.error).toBe('Server misconfigured')
    } finally {
      env.ADMIN_SECRET = origSecret
    }
  })

  it('returns 401 for invalid password', async () => {
    const res = await req('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('Invalid credentials')
  })

  it('returns 200 with Set-Cookie for valid password', async () => {
    const res = await req('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-secret' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean }
    expect(body.success).toBe(true)

    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain('admin_token=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=Strict')
    // 1.5: session lifetime reduced to 1h.
    expect(setCookie).toContain('Max-Age=3600')
  })
})

describe('POST /api/logout', () => {
  it('clears the session cookie', async () => {
    const res = await req('/api/logout', { method: 'POST' })
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toContain('admin_token=')
    expect(setCookie).toContain('Max-Age=0')
  })
})

describe('GET /api/auth/check', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns 401 without auth', async () => {
    const res = await req('/api/auth/check')
    expect(res.status).toBe(401)
  })

  it('returns 200 with Bearer auth', async () => {
    const res = await req('/api/auth/check', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { authenticated: boolean }
    expect(body.authenticated).toBe(true)
  })
})
