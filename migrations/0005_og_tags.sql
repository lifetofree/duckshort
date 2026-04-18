-- Add OG tag customization columns to links table
ALTER TABLE links ADD COLUMN og_title TEXT;
ALTER TABLE links ADD COLUMN og_description TEXT;
ALTER TABLE links ADD COLUMN og_image TEXT;
