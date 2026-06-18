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

describe('Geo-redirects API', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  describe('GET /api/links/:id/geo-redirects', () => {
    it('returns 401 without auth', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects')
      expect(res.status).toBe(401)
    })

    it('returns empty array for link with no geo-redirects', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects', {
        headers: { Authorization: AUTH },
      })
      expect(res.status).toBe(200)
      const body = await res.json() as any[]
      expect(body).toEqual([])
    })
  })

  describe('POST /api/links/:id/geo-redirects', () => {
    it('returns 401 without auth', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country_code: 'US', destination_url: 'https://us.example.com' }),
      })
      expect(res.status).toBe(401)
    })

    it('creates a geo-redirect rule', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ country_code: 'US', destination_url: 'https://us.example.com' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { id: string; country_code: string; destination_url: string }
      expect(body.country_code).toBe('US')
      expect(body.destination_url).toBe('https://us.example.com')
      expect(body.id).toHaveLength(8)
    })

    it('returns 400 when country_code is missing', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ destination_url: 'https://us.example.com' }),
      })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid country_code format', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ country_code: 'USA', destination_url: 'https://us.example.com' }),
      })
      expect(res.status).toBe(400)
      const body = await res.json() as { error: string }
      expect(body.error).toContain('2-letter ISO code')
    })

    it('returns 400 for unsafe URLs', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ country_code: 'US', destination_url: 'javascript:alert(1)' }),
      })
      expect(res.status).toBe(400)
    })

    it('normalizes country code to uppercase', async () => {
      await seedLink('link1')
      const res = await req('/api/links/link1/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ country_code: 'th', destination_url: 'https://th.example.com' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { country_code: string }
      expect(body.country_code).toBe('TH')
    })
  })

  describe('DELETE /api/links/geo-redirects/:geoId', () => {
    it('returns 401 without auth', async () => {
      const res = await req('/api/links/geo-redirects/geo1', { method: 'DELETE' })
      expect(res.status).toBe(401)
    })

    it('returns 404 for non-existent geo-redirect', async () => {
      const res = await req('/api/links/geo-redirects/nonexistent', {
        method: 'DELETE',
        headers: { Authorization: AUTH },
      })
      expect(res.status).toBe(404)
    })

    it('deletes a geo-redirect rule', async () => {
      await seedLink('link1')
      const createRes = await req('/api/links/link1/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ country_code: 'US', destination_url: 'https://us.example.com' }),
      })
      const { id } = await createRes.json() as { id: string }

      const deleteRes = await req(`/api/links/geo-redirects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: AUTH },
      })
      expect(deleteRes.status).toBe(200)
      const body = await deleteRes.json() as { success: boolean }
      expect(body.success).toBe(true)
    })
  })
})
