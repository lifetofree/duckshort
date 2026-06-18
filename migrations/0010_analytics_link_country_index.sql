-- 6.2: Composite index on (link_id, country) so the
-- `GROUP BY country ORDER BY count DESC` query in getStats can use a covering
-- index scan instead of an in-memory GROUP BY. Same pattern for referer.
CREATE INDEX IF NOT EXISTS idx_analytics_link_country ON analytics (link_id, country);
CREATE INDEX IF NOT EXISTS idx_analytics_link_referer ON analytics (link_id, referer);
