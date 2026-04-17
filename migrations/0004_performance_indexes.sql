CREATE INDEX IF NOT EXISTS idx_links_created_disabled ON links(created_at DESC, disabled);
CREATE INDEX IF NOT EXISTS idx_links_tag ON links(tag);
CREATE INDEX IF NOT EXISTS idx_analytics_link_timestamp ON analytics(link_id, timestamp);
