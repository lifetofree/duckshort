-- Migration: Initial schema
DROP TABLE IF EXISTS analytics;
DROP TABLE IF EXISTS links;

CREATE TABLE links (
    id TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT,
    disabled INTEGER DEFAULT 0
);

CREATE TABLE analytics (
    link_id TEXT NOT NULL,
    country TEXT,
    referer TEXT,
    user_agent TEXT,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE INDEX idx_links_expires_at ON links(expires_at);
CREATE INDEX idx_analytics_link_id_country ON analytics(link_id, country);
CREATE INDEX idx_analytics_link_id_referer ON analytics(link_id, referer);
