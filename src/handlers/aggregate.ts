import type { Env } from '../types'
import { logger } from '../lib/logger'

/**
 * 6.1: Pre-aggregate the last 7 days of `analytics` into `link_stats_daily`.
 *
 * Runs hourly via the Cron Trigger. Idempotent: re-aggregation overwrites
 * existing rows in the cache via `ON CONFLICT … DO UPDATE`, so a missed or
 * doubled cron run converges to the same answer.
 *
 * The window is 7 days (matching the sparkline window used by getStats /
 * getLinks). Anything older is dropped from the cache but stays in
 * `analytics` for ad-hoc queries.
 */
export async function aggregateLinkStatsDaily(env: Env): Promise<{ rows: number }> {
  const windowStart = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days')"
  const result = await env.DB.prepare(
    `INSERT INTO link_stats_daily (link_id, day, count)
     SELECT link_id, date(timestamp) AS day, COUNT(*) AS count
     FROM analytics
     WHERE timestamp >= ${windowStart}
     GROUP BY link_id, day
     ON CONFLICT(link_id, day) DO UPDATE SET count = excluded.count`
  ).run()
  // D1's `run()` returns `meta.changes` (rows touched). Some runtimes return
  // `meta.rows_written` instead; fall back gracefully.
  const meta = (result as { meta?: { changes?: number; rows_written?: number } }).meta ?? {}
  const rows = meta.changes ?? meta.rows_written ?? 0
  logger.info('link_stats_daily_aggregated', { rows })
  return { rows }
}
