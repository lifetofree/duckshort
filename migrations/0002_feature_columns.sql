-- Migration: Feature columns for password protection, tags, UTM params, webhooks, A/B variants
ALTER TABLE links ADD COLUMN password_hash TEXT;
ALTER TABLE links ADD COLUMN tag TEXT;
ALTER TABLE links ADD COLUMN utm_source TEXT;
ALTER TABLE links ADD COLUMN utm_medium TEXT;
ALTER TABLE links ADD COLUMN utm_campaign TEXT;
ALTER TABLE links ADD COLUMN webhook_url TEXT;

ALTER TABLE analytics ADD COLUMN timestamp TEXT DEFAULT (datetime('now'));

CREATE TABLE IF NOT EXISTS link_variants (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  weight INTEGER DEFAULT 1,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_link_variants_link_id ON link_variants(link_id);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp);
