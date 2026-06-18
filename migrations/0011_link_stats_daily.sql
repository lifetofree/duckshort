-- 6.1: Pre-aggregated daily counts per link.
-- The cron-triggered `aggregateLinkStatsDaily` (src/handlers/aggregate.ts) runs
-- hourly and re-aggregates the last 7 days into this table. getStats and
-- getLinks read from here for the 7-day sparkline; they fall back to
-- aggregating `analytics` on-demand if the cron hasn't caught up yet (e.g.
-- first deploy, test fixtures).
ALTER TABLE links ADD COLUMN daily_sparkline_cache_at TEXT;

CREATE TABLE IF NOT EXISTS link_stats_daily (
  link_id TEXT NOT NULL,
  day     TEXT NOT NULL, -- YYYY-MM-DD
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, day),
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_link_stats_daily_day
  ON link_stats_daily(day);

CREATE INDEX IF NOT EXISTS idx_link_stats_daily_link_day
  ON link_stats_daily(link_id, day);
