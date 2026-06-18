// Tests for the counter self-heal (added after the prod counter drift
// incident on 2026-06-18 where the counter showed 1 while analytics had
// 1203 rows).
import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { selfHealTotalVisitsCounter } from '../../src/handlers/aggregate'
import { applySchema, clearAll } from '../helpers/schema'

async function seedAnalytics(count: number) {
  for (let i = 0; i < count; i++) {
    await env.DB.prepare(
      'INSERT INTO analytics (id, link_id, country, referer, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(`id-${i}`, 'link-x', 'US', null, 'jest', new Date().toISOString()).run()
  }
}

async function setCounter(value: number) {
  await env.DB.prepare(
    'INSERT INTO counters (key, value) VALUES (\'total_visits\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(value).run()
}

async function getCounter(): Promise<number> {
  const row = await env.DB.prepare('SELECT value FROM counters WHERE key = ?').bind('total_visits').first<{ value: number }>()
  return row?.value ?? 0
}

describe('selfHealTotalVisitsCounter', () => {
  beforeEach(async () => { await applySchema(); await clearAll() })

  it('heals when counter is far below analytics', async () => {
    await seedAnalytics(100)
    await setCounter(1)
    const result = await selfHealTotalVisitsCounter(env)
    expect(result.healed).toBe(true)
    expect(result.counter).toBe(100)
    expect(await getCounter()).toBe(100)
  })

  it('does not heal when counter is in sync (within 5%)', async () => {
    await seedAnalytics(100)
    await setCounter(98) // 2% drift, under threshold
    const result = await selfHealTotalVisitsCounter(env)
    expect(result.healed).toBe(false)
    expect(await getCounter()).toBe(98) // unchanged
  })

  it('heals when counter is zero and analytics is non-zero', async () => {
    await seedAnalytics(50)
    // No counter row exists
    const result = await selfHealTotalVisitsCounter(env)
    expect(result.healed).toBe(true)
    expect(result.counter).toBe(50)
    expect(await getCounter()).toBe(50)
  })

  it('is a no-op when both are zero', async () => {
    // No analytics, no counter
    const result = await selfHealTotalVisitsCounter(env)
    expect(result.healed).toBe(false)
    expect(result.counter).toBe(0)
    expect(result.analytics).toBe(0)
  })

  it('heals even when analytics is small (absolute drift above 5%)', async () => {
    await seedAnalytics(2)
    await setCounter(0)
    const result = await selfHealTotalVisitsCounter(env)
    // |2-0|/2 = 100% drift
    expect(result.healed).toBe(true)
    expect(result.counter).toBe(2)
  })
})
