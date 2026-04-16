-- Add burn_on_read column to links table
ALTER TABLE links ADD COLUMN burn_on_read INTEGER DEFAULT 0;
