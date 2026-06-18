-- P-01/P-06/P-11/P-13: Add visits column on links + counters table
-- The visits column is incremented in recordAnalytics (best-effort) so getLinks/exportLinks
-- avoid a full-table LEFT JOIN subquery over analytics.
-- The counters table caches aggregate totals for getGlobalStats, replacing COUNT(*) over analytics.
ALTER TABLE links ADD COLUMN visits INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_links_visits ON links(visits DESC);

CREATE TABLE IF NOT EXISTS counters (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO counters (key, value) VALUES ('total_visits', 0);

-- Backfill visits from existing analytics rows
UPDATE links SET visits = (SELECT COUNT(*) FROM analytics WHERE analytics.link_id = links.id);
