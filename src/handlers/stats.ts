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

  // 2.5: Use SQLite's `strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')`
  // server-side instead of computing a JS ISO timestamp and binding it.
  // Cuts a Date allocation per request and keeps the SQL self-describing.
  // `strftime` with the ISO-8601 template matches the format we store in the
  // `timestamp` column (also ISO-8601 UTC), so lexical comparison is correct.
  const SPARKLINE_WINDOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')"
  // 6.1: link_stats_daily.day is stored as YYYY-MM-DD, so we use date() here
  // to compare against the timestamp-anchored window. Two columns, two
  // formats — we coalesce inside JS below.
  const SPARKLINE_WINDOW_DAY = "strftime('%Y-%m-%d', 'now', '-6 days')"

  // All 5 queries run in parallel (P-09). The sparkline read uses the
  // pre-aggregated cache (link_stats_daily); on a cache miss we fall back
  // to scanning `analytics` (test fixtures, first deploy). Both queries
  // share the same result shape — `{ day, count }[]` — so the post-
  // processing code is identical.
  const [link, visits, countries, referrers, sparklineCache] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, original_url, created_at, expires_at, disabled, tag FROM links WHERE id = ?'
    ).bind(id).first(),
    c.env.DB.prepare('SELECT COUNT(*) as count FROM analytics WHERE link_id = ?').bind(id).first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT country, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY country ORDER BY count DESC LIMIT ?`
    ).bind(id, limit).all(),
    c.env.DB.prepare(
      `SELECT referer, COUNT(*) as count FROM analytics WHERE link_id = ? GROUP BY referer ORDER BY count DESC LIMIT ?`
    ).bind(id, limit).all(),
    c.env.DB.prepare(
      `SELECT day, count FROM link_stats_daily WHERE link_id = ? AND day >= ${SPARKLINE_WINDOW_DAY}`
    ).bind(id).all<{ day: string; count: number }>(),
  ])

  let sparklineRows = sparklineCache
  if (sparklineCache.results.length === 0) {
    sparklineRows = await c.env.DB.prepare(
      `SELECT date(timestamp) as day, COUNT(*) as count FROM analytics WHERE link_id = ? AND timestamp >= ${SPARKLINE_WINDOW} GROUP BY day`
    ).bind(id).all<{ day: string; count: number }>()
  }

  if (!link) return c.json({ error: 'Not found' }, 404)

  // Build the last 7 days server-side as well — still cheap in JS, but keeps
  // the SQL boundary clean.
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    days.push(d.toISOString().slice(0, 10))
  }
  const countByDay: Record<string, number> = {}
  for (const row of sparklineRows.results) countByDay[row.day] = row.count
  const sparklineData = days.map((day) => countByDay[day] ?? 0)

  return c.json({
    link,
    visits: visits?.count ?? 0,
    countries: countries.results,
    referrers: referrers.results,
    sparkline: sparklineData,
  })
}

export async function getGlobalStats(c: Context<{ Bindings: Env }>) {
  // 2.5: `strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')` server-side.
  // Uses ISO-8601 format to match the `timestamp` column's stored format so
  // lexical comparison is correct (datetime() returns space-separated).
  const HOURLY_WINDOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')"

  // P-01/P-11: totalVisits from counters table (O(1)) instead of COUNT(*) over analytics.
  // If counter row doesn't exist, fall back to COUNT(*) (first request after migration or test setup)
  const [counterResult, hourlyResult] = await Promise.all([
    c.env.DB.prepare('SELECT value as count FROM counters WHERE key = ?').bind('total_visits').first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM analytics WHERE timestamp >= ${HOURLY_WINDOW}`
    ).first<{ count: number }>(),
  ])

  let totalVisits: number
  if (counterResult) {
    totalVisits = counterResult.count
  } else {
    // Counter not initialized — fall back to full count and seed the counter
    const fallback = await c.env.DB.prepare('SELECT COUNT(*) as count FROM analytics').first<{ count: number }>()
    totalVisits = fallback?.count ?? 0
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        'INSERT INTO counters (key, value) VALUES (\'total_visits\', ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      ).bind(totalVisits, totalVisits).run()
    )
  }

  const hourlyVisits = hourlyResult?.count ?? 0
  const mood: Mood = getMood(hourlyVisits)

  // 2.2: 30s edge cache. The global stats page polls every 30s, so
  // max-age=30 collapses duplicate fetches across users onto a single
  // origin read. The values are aggregate (not per-user), so the cache
  // is safe to share.
  c.header('Cache-Control', 'public, max-age=30')
  return c.json({ totalVisits, hourlyVisits, mood })
}
