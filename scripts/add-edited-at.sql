-- Add edited_at column to discussion_posts table
-- This tracks when a post was last edited by the user (separate from updated_at which auto-updates)

ALTER TABLE discussion_posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
