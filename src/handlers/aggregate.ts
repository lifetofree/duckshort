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

/**
 * Self-heal: re-sync the `total_visits` counter with the actual count of
 * `analytics` rows. The counter is incremented best-effort in the same
 * batch as the analytics insert, so under normal operation it stays in
 * sync. But any of the following can leave it stale:
 *   - a deploy that landed between the analytics INSERT and the counter
 *     UPDATE inside the batch (no transaction in D1, so partial commits
 *     are possible under failure)
 *   - a hand-applied backfill that touched `analytics` directly
 *   - an old `INSERT OR IGNORE` migration that reset value=0 after a run
 *     had already passed it
 *
 * Runs once an hour from the cron. Cheap: single COUNT(*) + single UPDATE.
 * Only writes when drift is detected (>5% off), so the hot path stays
 * read-only.
 */
export async function selfHealTotalVisitsCounter(env: Env): Promise<{ healed: boolean; counter: number; analytics: number }> {
  const analyticsRow = await env.DB.prepare('SELECT COUNT(*) as count FROM analytics').first<{ count: number }>()
  const counterRow = await env.DB.prepare('SELECT value FROM counters WHERE key = ?').bind('total_visits').first<{ value: number }>()
  const analytics = analyticsRow?.count ?? 0
  const counter = counterRow?.value ?? 0
  // Allow 5% drift to avoid write-amplification on noisy counters; heal
  // when the gap is clearly wrong.
  const drift = Math.abs(analytics - counter) / Math.max(analytics, 1)
  if (drift < 0.05) {
    return { healed: false, counter, analytics }
  }
  await env.DB.prepare(
    'INSERT INTO counters (key, value) VALUES (\'total_visits\', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).bind(analytics).run()
  logger.warn('counter_self_healed', { key: 'total_visits', previous: counter, corrected: analytics })
  return { healed: true, counter: analytics, analytics }
}
