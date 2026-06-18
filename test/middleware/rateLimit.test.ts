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

describe('Rate limiting', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('skips rate limiting when RATE_LIMITER is not bound', async () => {
    const origLimiter = env.RATE_LIMITER
    try {
      env.RATE_LIMITER = undefined as any
      const res = await req('/api/stats/global')
      expect(res.status).toBe(200)
    } finally {
      env.RATE_LIMITER = origLimiter
    }
  })

  it('does not crash when RATE_LIMITER is bound', async () => {
    if (!env.RATE_LIMITER) {
      console.warn('Skipping test: RATE_LIMITER not bound in test environment')
      return
    }
    // Stats routes are not rate-limited, but custom domain middleware runs
    const res = await req('/api/stats/global')
    expect(res.status).toBe(200)
  })
})
