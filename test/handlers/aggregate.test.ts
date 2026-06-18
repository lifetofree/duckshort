// 6.1: Tests for the link_stats_daily pre-aggregated cache + cron handler.
import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { aggregateLinkStatsDaily } from '../../src/handlers/aggregate'
import { applySchema, clearAll } from '../helpers/schema'

async function seedLink(id: string) {
  await env.DB.prepare(
    'INSERT INTO links (id, original_url, created_at) VALUES (?, ?, ?)'
  ).bind(id, 'https://example.com', new Date().toISOString()).run()
}

async function seedAnalytics(linkId: string, day: string, count: number) {
  // day is YYYY-MM-DD. We craft timestamps at noon UTC so the day() rollup
  // is stable.
  for (let i = 0; i < count; i++) {
    await env.DB.prepare(
      'INSERT INTO analytics (link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).bind(linkId, 'US', null, 'jest', `${day}T12:00:00Z`).run()
  }
}

describe('aggregateLinkStatsDaily (6.1)', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('aggregates yesterday analytics into link_stats_daily', async () => {
    await seedLink('agg-1')
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await seedAnalytics('agg-1', yesterday, 3)

    await aggregateLinkStatsDaily(env)

    const rows = await env.DB.prepare(
      'SELECT day, count FROM link_stats_daily WHERE link_id = ?'
    ).bind('agg-1').all<{ day: string; count: number }>()
    const found = rows.results.find((r) => r.day === yesterday)
    expect(found?.count).toBe(3)
  })

  it('is idempotent — re-running overwrites the same day', async () => {
    await seedLink('agg-2')
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await seedAnalytics('agg-2', yesterday, 2)
    await aggregateLinkStatsDaily(env)
    // Add one more analytics row for the same day
    await seedAnalytics('agg-2', yesterday, 1)
    await aggregateLinkStatsDaily(env)

    const row = await env.DB.prepare(
      'SELECT count FROM link_stats_daily WHERE link_id = ? AND day = ?'
    ).bind('agg-2', yesterday).first<{ count: number }>()
    expect(row?.count).toBe(3)
  })

  it('ignores analytics older than the 7-day window', async () => {
    await seedLink('agg-3')
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await seedAnalytics('agg-3', tenDaysAgo, 5)
    await aggregateLinkStatsDaily(env)

    const rows = await env.DB.prepare(
      'SELECT day, count FROM link_stats_daily WHERE link_id = ?'
    ).bind('agg-3').all<{ day: string; count: number }>()
    expect(rows.results).toHaveLength(0)
  })

  it('aggregates multiple links in a single pass', async () => {
    await seedLink('agg-4a')
    await seedLink('agg-4b')
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await seedAnalytics('agg-4a', yesterday, 2)
    await seedAnalytics('agg-4b', yesterday, 4)

    await aggregateLinkStatsDaily(env)

    const a = await env.DB.prepare(
      'SELECT count FROM link_stats_daily WHERE link_id = ? AND day = ?'
    ).bind('agg-4a', yesterday).first<{ count: number }>()
    const b = await env.DB.prepare(
      'SELECT count FROM link_stats_daily WHERE link_id = ? AND day = ?'
    ).bind('agg-4b', yesterday).first<{ count: number }>()
    expect(a?.count).toBe(2)
    expect(b?.count).toBe(4)
  })

  it('returns the number of rows touched', async () => {
    await seedLink('agg-5')
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await seedAnalytics('agg-5', yesterday, 1)
    const { rows } = await aggregateLinkStatsDaily(env)
    expect(rows).toBeGreaterThanOrEqual(1)
  })
})
