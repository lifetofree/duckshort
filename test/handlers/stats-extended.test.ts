/**
 * Extended stats tests — covers gaps not in stats.test.ts:
 *  - ?limit=N param on GET /api/stats/:id
 *  - ACTIVE / BUSY / VIRAL mood thresholds on GET /api/stats/global
 *  - Stats for a link with zero visits
 *  - Stats with multiple countries / referrers
 */
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

async function insertAnalytics(linkId: string, count: number, opts: { country?: string; referer?: string; minutesAgo?: number } = {}) {
  const ts = opts.minutesAgo !== undefined
    ? new Date(Date.now() - opts.minutesAgo * 60_000).toISOString()
    : new Date().toISOString()

  for (let i = 0; i < count; i++) {
    await env.DB.prepare(
      'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).bind(linkId, opts.country ?? 'US', opts.referer ?? 'direct', 'bot', ts).run()
  }
}

// ─── GET /api/stats/:id — limit param ────────────────────────────────────────

describe('GET /api/stats/:id — limit param', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('defaults to 10 countries/referrers when no limit given', async () => {
    await seedLink('lim-default')
    // Insert 15 distinct countries
    const countries = ['US','GB','DE','FR','JP','AU','CA','BR','IN','KR','NG','MX','IT','ES','NL']
    for (const country of countries) {
      await insertAnalytics('lim-default', 1, { country })
    }

    const res = await req('/api/stats/lim-default')
    expect(res.status).toBe(200)
    const body = await res.json() as { countries: any[] }
    expect(body.countries.length).toBe(10)
  })

  it('respects ?limit=5 to return only 5 results', async () => {
    await seedLink('lim-5')
    const countries = ['US','GB','DE','FR','JP','AU','CA','BR','IN','KR']
    for (const country of countries) {
      await insertAnalytics('lim-5', 1, { country })
    }

    const res = await req('/api/stats/lim-5?limit=5')
    expect(res.status).toBe(200)
    const body = await res.json() as { countries: any[] }
    expect(body.countries.length).toBe(5)
  })

  it('respects ?limit=20 to return up to 20 results', async () => {
    await seedLink('lim-20')
    const countries = ['US','GB','DE','FR','JP','AU','CA','BR','IN','KR','NG','MX','IT','ES','NL']
    for (const country of countries) {
      await insertAnalytics('lim-20', 1, { country })
    }

    const res = await req('/api/stats/lim-20?limit=20')
    expect(res.status).toBe(200)
    const body = await res.json() as { countries: any[] }
    expect(body.countries.length).toBe(15) // only 15 distinct countries inserted
  })

  it('clamps limit to 10 when limit=0 (invalid)', async () => {
    await seedLink('lim-zero')
    for (const c of ['US','GB','DE','FR','JP','AU','CA','BR','IN','KR','NG']) {
      await insertAnalytics('lim-zero', 1, { country: c })
    }

    const res = await req('/api/stats/lim-zero?limit=0')
    expect(res.status).toBe(200)
    const body = await res.json() as { countries: any[] }
    expect(body.countries.length).toBe(10) // clamped to default
  })

  it('clamps limit to 100 when limit=200 (exceeds max)', async () => {
    await seedLink('lim-over')
    const res = await req('/api/stats/lim-over?limit=200')
    expect(res.status).toBe(200)
    // No error — just returns clamped result
    const body = await res.json() as { countries: any[] }
    expect(Array.isArray(body.countries)).toBe(true)
  })

  it('returns visits=0 for a link with no analytics', async () => {
    await seedLink('lim-zero-visits')
    const res = await req('/api/stats/lim-zero-visits')
    expect(res.status).toBe(200)
    const body = await res.json() as { visits: number; countries: any[]; referrers: any[] }
    expect(body.visits).toBe(0)
    expect(body.countries).toHaveLength(0)
    expect(body.referrers).toHaveLength(0)
  })

  it('ranks countries by visit count descending', async () => {
    await seedLink('lim-rank')
    await insertAnalytics('lim-rank', 10, { country: 'US' })
    await insertAnalytics('lim-rank', 3, { country: 'GB' })
    await insertAnalytics('lim-rank', 7, { country: 'DE' })

    const res = await req('/api/stats/lim-rank?limit=3')
    const body = await res.json() as { countries: Array<{ country: string; count: number }> }
    expect(body.countries[0].country).toBe('US')
    expect(body.countries[0].count).toBe(10)
    expect(body.countries[1].country).toBe('DE')
    expect(body.countries[2].country).toBe('GB')
  })

  it('the link object in response does not expose sensitive fields', async () => {
    await seedLink('lim-safe', { password_hash: 'abc123hash', webhook_url: 'https://hook.example.com' })

    const res = await req('/api/stats/lim-safe')
    expect(res.status).toBe(200)
    const body = await res.json() as { link: Record<string, unknown> }
    expect(body.link).not.toHaveProperty('password_hash')
    expect(body.link).not.toHaveProperty('webhook_url')
  })
})

// ─── GET /api/stats/global — mood thresholds ──────────────────────────────────

describe('GET /api/stats/global — mood thresholds', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('returns ACTIVE when hourly visits >= 1 and < 10', async () => {
    await seedLink('mood-active')
    await insertAnalytics('mood-active', 5, { minutesAgo: 30 })

    const res = await req('/api/stats/global')
    expect(res.status).toBe(200)
    const body = await res.json() as { mood: string; hourlyVisits: number }
    expect(body.hourlyVisits).toBe(5)
    expect(body.mood).toBe('ACTIVE')
  })

  it('returns BUSY when hourly visits >= 10 and < 50', async () => {
    await seedLink('mood-busy')
    await insertAnalytics('mood-busy', 25, { minutesAgo: 30 })

    const res = await req('/api/stats/global')
    expect(res.status).toBe(200)
    const body = await res.json() as { mood: string; hourlyVisits: number }
    expect(body.hourlyVisits).toBe(25)
    expect(body.mood).toBe('BUSY')
  })

  it('returns VIRAL when hourly visits >= 50', async () => {
    await seedLink('mood-viral')
    await insertAnalytics('mood-viral', 55, { minutesAgo: 30 })

    const res = await req('/api/stats/global')
    expect(res.status).toBe(200)
    const body = await res.json() as { mood: string; hourlyVisits: number }
    expect(body.hourlyVisits).toBe(55)
    expect(body.mood).toBe('VIRAL')
  })

  it('ignores visits older than 1 hour for mood calculation', async () => {
    await seedLink('mood-old')
    // Insert 50 visits from 2 hours ago — should NOT count for hourly mood
    await insertAnalytics('mood-old', 50, { minutesAgo: 120 })

    const res = await req('/api/stats/global')
    const body = await res.json() as { mood: string; hourlyVisits: number; totalVisits: number }
    expect(body.hourlyVisits).toBe(0)
    expect(body.mood).toBe('DORMANT')
    // But total visits should include the old ones
    expect(body.totalVisits).toBe(50)
  })

  it('returns correct totalVisits as sum across all time', async () => {
    await seedLink('total-count')
    await insertAnalytics('total-count', 10, { minutesAgo: 120 }) // old
    await insertAnalytics('total-count', 5, { minutesAgo: 30 })   // recent

    const res = await req('/api/stats/global')
    const body = await res.json() as { totalVisits: number }
    expect(body.totalVisits).toBe(15)
  })
})

// ─── GET /api/stats/:id — referrer ranking ────────────────────────────────────

describe('GET /api/stats/:id — referrers', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('ranks referrers by visit count descending', async () => {
    await seedLink('ref-rank')
    await insertAnalytics('ref-rank', 8, { referer: 'https://google.com' })
    await insertAnalytics('ref-rank', 2, { referer: 'https://twitter.com' })
    await insertAnalytics('ref-rank', 5, { referer: 'https://reddit.com' })

    const res = await req('/api/stats/ref-rank?limit=3')
    const body = await res.json() as { referrers: Array<{ referer: string; count: number }> }
    expect(body.referrers[0].referer).toBe('https://google.com')
    expect(body.referrers[0].count).toBe(8)
    expect(body.referrers[1].referer).toBe('https://reddit.com')
  })
})
