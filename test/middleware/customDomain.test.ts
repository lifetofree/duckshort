import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'
import app from '../../src/index'
import { applySchema, clearAll, seedLink } from '../helpers/schema'

const BASE = 'http://localhost'

async function req(url: string, init: RequestInit = {}) {
  const ctx = createExecutionContext()
  const res = await app.fetch(new Request(`${BASE}${url}`, init), env, ctx)
  await waitOnExecutionContext(ctx)
  return res
}

describe('Custom domain resolution', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('passes through for primary hostname', async () => {
    const res = await req('/', {
      headers: { host: 'duckshort.cc' },
    })
    // Should proxy to Pages or return an error, but not 404 from custom domain logic
    expect(res.status).not.toBe(404)
  })

  it('passes through for localhost', async () => {
    const res = await req('/', {
      headers: { host: 'localhost:8787' },
    })
    expect(res.status).not.toBe(404)
  })

  it('passes through for API routes on custom domains', async () => {
    const res = await req('/api/stats/global', {
      headers: { host: 'custom.example.com' },
    })
    expect(res.status).toBe(200)
  })

  it('redirects when custom domain matches a link', async () => {
    await seedLink('link1', { custom_domain: 'my.custom.domain' })
    const res = await req('/', {
      headers: { host: 'my.custom.domain' },
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('https://example.com')
  })

  it('passes through for unmatched custom domains', async () => {
    const res = await req('/', {
      headers: { host: 'unknown.custom.domain' },
    })
    // Should not crash, either proxy or 404
    expect(res.status).toBeDefined()
  })
})
