-- Custom domains: per-link custom domain binding
ALTER TABLE links ADD COLUMN custom_domain TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_custom_domain ON links(custom_domain) WHERE custom_domain IS NOT NULL;
