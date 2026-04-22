import type { Context } from 'hono'
import type { Env } from '../types'

type Mood = 'DORMANT' | 'ACTIVE' | 'BUSY' | 'VIRAL'

function getMood(hourlyVisits: number): Mood {
  if (hourlyVisits >= 50) return 'VIRAL'
  if (hourlyVisits >= 10) return 'BUSY'
  if (hourlyVisits >= 1) return 'ACTIVE'
  return 'DORMANT'
}

export async function getStats(c: Context<{ Bindings: Env }>) {
  const { id } = c.req.param()
  const limitParam = parseInt(c.req.query('limit') ?? '10', 10)
  const limit = Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 100 ? limitParam : 10

  const [link, visits, countries, referrers] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, original_url, created_at, expires_at, disabled, tag FROM links WHERE id = ?'
    ).bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM analytics WHERE link_id = ?').bind(id).first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT country, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY country ORDER BY count DESC LIMIT ${limit}`
    ).bind(id).all(),
    c.env.DB.prepare(
      `SELECT referer, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY referer ORDER BY count DESC LIMIT ${limit}`
    ).bind(id).all(),
  ])

  if (!link) return c.json({ error: 'Not found' }, 404)

  // Build 7-day sparkline
  const days: string[] = []
  const sparklineData: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const iso = d.toISOString()
    days.push(iso.slice(0, 10))
  }
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const sparklineRows = await c.env.DB.prepare(
    `SELECT date(timestamp) as day, COUNT(*) as count FROM analytics WHERE link_id = ? AND timestamp >= ? GROUP BY day`
  ).bind(id, sevenDaysAgo).all<{ day: string; count: number }>()
  const countByDay: Record<string, number> = {}
  for (const row of sparklineRows.results) countByDay[row.day] = row.count
  for (const day of days) sparklineData.push(countByDay[day] ?? 0)

  return c.json({
    link,
    visits: visits?.count ?? 0,
    countries: countries.results,
    referrers: referrers.results,
    sparkline: sparklineData,
  })
}

export async function getGlobalStats(c: Context<{ Bindings: Env }>) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const [totalResult, hourlyResult] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) as count FROM analytics').first<{ count: number }>(),
    c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM analytics WHERE timestamp >= ?'
    ).bind(oneHourAgo).first<{ count: number }>(),
  ])

  const totalVisits = totalResult?.count ?? 0
  const hourlyVisits = hourlyResult?.count ?? 0
  const mood: Mood = getMood(hourlyVisits)

  return c.json({ totalVisits, hourlyVisits, mood })
}
