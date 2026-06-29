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

// S-21: regression tests for case-insensitive short-link lookups.
//
// QR scanners (Android camera, WeChat, Google Lens, many iOS preview flows)
// routinely lower-case the URL before opening it, and D1/SQLite compares TEXT
// case-sensitively by default — so a link stored as `VibeCoding-01` would 404
// when a scanner opened `vibecoding-01`. These tests lock the case-insensitive
// behaviour in place across every lookup path.
describe('S-21: case-insensitive link lookups', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  describe('GET /:id (redirect)', () => {
    it('resolves a lowercase request against a mixed-case stored id', async () => {
      await seedLink('VibeCoding-01', { original_url: 'https://forms.gle/abc' })

      const res = await req('/vibecoding-01')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://forms.gle/abc')
    })

    it('resolves an uppercase request against a mixed-case stored id', async () => {
      await seedLink('VibeCoding-01', { original_url: 'https://forms.gle/abc' })

      const res = await req('/VIBECODING-01')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://forms.gle/abc')
    })

    it('still resolves the exact-case request (no regression)', async () => {
      await seedLink('VibeCoding-01', { original_url: 'https://forms.gle/abc' })

      const res = await req('/VibeCoding-01')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://forms.gle/abc')
    })

    it('returns 404 when no case variant exists', async () => {
      await seedLink('VibeCoding-01')
      const res = await req('/totally-different-id')
      expect(res.status).toBe(404)
    })
  })

  describe('trailing slash', () => {
    it('GET /:id/ redirects instead of falling through to the SPA shell', async () => {
      await seedLink('VibeCoding-01', { original_url: 'https://forms.gle/abc' })

      const res = await req('/VibeCoding-01/')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://forms.gle/abc')
    })

    it('GET /:id/ with a case-mismatched id still redirects', async () => {
      // Combines both fixes: trailing slash + case insensitivity.
      await seedLink('VibeCoding-01', { original_url: 'https://forms.gle/abc' })

      const res = await req('/vibecoding-01/')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('https://forms.gle/abc')
    })
  })

  describe('GET /preview/:id', () => {
    it('resolves a lowercase request against a mixed-case stored id', async () => {
      await seedLink('VibeCoding-01', { original_url: 'https://forms.gle/abc' })

      const res = await req('/preview/vibecoding-01')
      expect(res.status).toBe(200)
      const body = await res.text()
      expect(body).toContain('https://forms.gle/abc')
    })

    it('returns 404 when no case variant exists', async () => {
      const res = await req('/preview/no-such-link')
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/stats/:id', () => {
    it('resolves a lowercase request and joins analytics on the stored id', async () => {
      await seedLink('VibeCoding-01')
      // Analytics are written with the STORED id — a case-mismatched request
      // must still see these rows (this is the regression that motivated
      // resolving the stored id before the analytics queries).
      await env.DB.prepare(
        'INSERT INTO analytics (id, link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind('an1', 'VibeCoding-01', 'US', 'unknown', 'test', new Date().toISOString()).run()
      await env.DB.prepare(
        'INSERT INTO analytics (id, link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind('an2', 'VibeCoding-01', 'TH', 'unknown', 'test', new Date().toISOString()).run()

      const res = await req('/api/stats/vibecoding-01')
      expect(res.status).toBe(200)
      const body = await res.json<{ visits: number; countries: { country: string; count: number }[] }>()
      expect(body.visits).toBe(2)
      expect(body.countries).toHaveLength(2)
    })

    it('returns 404 for an unknown case variant', async () => {
      const res = await req('/api/stats/no-such-link')
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/links (case-insensitive collision check)', () => {
    it('rejects a custom alias that differs only by case from an existing one', async () => {
      await seedLink('MyAlias')

      const res = await req('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ url: 'https://example.com', customId: 'myalias' }),
      })

      expect(res.status).toBe(409)
      const body = await res.json<{ error: string }>()
      expect(body.error).toContain('already taken')
    })

    it('still stores the custom alias AS-TYPED (original casing preserved)', async () => {
      const res = await req('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ url: 'https://example.com', customId: 'MyCustomID' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json<{ id: string }>()
      expect(body.id).toBe('MyCustomID')
    })
  })

  describe('PATCH /api/links/:id (admin mutations)', () => {
    it('toggle resolves case-insensitively', async () => {
      await seedLink('MixedCase', { disabled: 0 })

      const res = await req('/api/links/mixedcase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ action: 'toggle' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json<{ disabled: boolean }>()
      expect(body.disabled).toBe(true)
    })

    it('extend resolves case-insensitively', async () => {
      await seedLink('MixedCase')

      const res = await req('/api/links/MIXEDCASE', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ action: 'extend', extendHours: 24 }),
      })
      expect(res.status).toBe(200)
    })
  })

  describe('DELETE /api/links/:id', () => {
    it('deletes case-insensitively', async () => {
      await seedLink('MixedCase')

      const res = await req('/api/links/mixedcase', {
        method: 'DELETE',
        headers: { Authorization: AUTH },
      })
      expect(res.status).toBe(200)

      // Confirm gone
      const follow = await req('/MixedCase')
      expect(follow.status).toBe(404)
    })
  })

  describe('child resources (variants / geo-redirects)', () => {
    it('GET /api/links/:id/variants resolves the stored id for the join', async () => {
      await seedLink('MixedCase')
      await env.DB.prepare(
        'INSERT INTO link_variants (id, link_id, destination_url, weight) VALUES (?, ?, ?, ?)'
      ).bind('v1', 'MixedCase', 'https://variant.com', 1).run()

      const res = await req('/api/links/mixedcase/variants', { headers: { Authorization: AUTH } })
      expect(res.status).toBe(200)
      const body = await res.json<{ link_id?: string; destination_url: string }[]>()
      expect(body).toHaveLength(1)
      expect(body[0].destination_url).toBe('https://variant.com')
    })

    it('POST /api/links/:id/geo-redirects writes against the stored id', async () => {
      await seedLink('MixedCase')

      const res = await req('/api/links/mixedcase/geo-redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify({ country_code: 'US', destination_url: 'https://us.example.com' }),
      })
      expect(res.status).toBe(200)
      const body = await res.json<{ link_id: string }>()
      expect(body.link_id).toBe('MixedCase')

      // The rule should join correctly when the link is hit.
      const rows = await env.DB.prepare(
        'SELECT link_id FROM geo_redirects WHERE link_id = ?'
      ).bind('MixedCase').all<{ link_id: string }>()
      expect(rows.results).toHaveLength(1)
    })
  })
})
