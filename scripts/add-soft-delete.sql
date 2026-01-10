-- Add soft delete column to discussion_posts
-- Run this in Supabase SQL Editor

-- Add is_deleted column if it doesn't exist
ALTER TABLE discussion_posts
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Update the parent_id foreign key to SET NULL on delete instead of CASCADE
-- This prevents child posts from being deleted when parent is hard-deleted
-- (Though with soft delete, we won't hard-delete posts with children)

-- Note: The soft delete logic is handled in the application layer:
-- - When deleting a post with replies, set is_deleted = true instead of deleting
-- - When deleting a post without replies, actually delete it
-- - Display deleted posts as "[deleted]" placeholder
