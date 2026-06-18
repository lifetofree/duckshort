-- Migration: P-17 — Add a primary-key column to `analytics` so individual rows
-- can be addressed (GDPR deletion, debug queries). Existing rows get NULL id;
-- new rows are populated with a 16-char hex token in the application layer.
-- A secondary index on `id` supports single-row lookups.

ALTER TABLE analytics ADD COLUMN id TEXT;

CREATE INDEX idx_analytics_id ON analytics(id);
