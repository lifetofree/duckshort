-- Geo-fencing: per-link country-based redirect rules
CREATE TABLE IF NOT EXISTS geo_redirects (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL,
  country_code TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_geo_redirects_link_id ON geo_redirects(link_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_geo_redirects_link_country ON geo_redirects(link_id, country_code);
