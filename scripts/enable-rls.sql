-- Enable Row Level Security on all tables
-- Run this in Supabase SQL Editor to fix security lints

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_zoom_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "users_select_basic" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can update any user" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;

DROP POLICY IF EXISTS "Admins full access to modules" ON modules;
DROP POLICY IF EXISTS "Students view enrolled launched modules" ON modules;
DROP POLICY IF EXISTS "Students view enrolled archived modules" ON modules;

DROP POLICY IF EXISTS "Admins full access to zoom info" ON module_zoom_info;
DROP POLICY IF EXISTS "Students view zoom info for enrolled modules" ON module_zoom_info;

DROP POLICY IF EXISTS "Admins full access to weeks" ON weeks;
DROP POLICY IF EXISTS "Students view weeks in enrolled modules" ON weeks;

DROP POLICY IF EXISTS "Admins full access to pages" ON pages;
DROP POLICY IF EXISTS "Students view pages in enrolled modules" ON pages;

DROP POLICY IF EXISTS "Admins full access to questions" ON questions;
DROP POLICY IF EXISTS "Students view questions in enrolled modules" ON questions;

DROP POLICY IF EXISTS "Admins full access to resources" ON resources;
DROP POLICY IF EXISTS "Students view resources in enrolled modules" ON resources;

DROP POLICY IF EXISTS "Admins full access to videos" ON videos;
DROP POLICY IF EXISTS "Students view videos in enrolled modules" ON videos;

DROP POLICY IF EXISTS "Admins full access to enrollments" ON enrollments;
DROP POLICY IF EXISTS "Students view own enrollments" ON enrollments;

DROP POLICY IF EXISTS "Admins full access to progress" ON progress;
DROP POLICY IF EXISTS "Students manage own progress" ON progress;

DROP POLICY IF EXISTS "Admins full access to discussion posts" ON discussion_posts;
DROP POLICY IF EXISTS "Students view posts in enrolled modules" ON discussion_posts;
DROP POLICY IF EXISTS "Students create posts in enrolled modules" ON discussion_posts;
DROP POLICY IF EXISTS "Students update own posts" ON discussion_posts;
DROP POLICY IF EXISTS "Students delete own posts" ON discussion_posts;


-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id::text = auth.uid()::text
        AND role = 'admin'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is enrolled in a module
CREATE OR REPLACE FUNCTION is_enrolled(module_id_param BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM enrollments
        WHERE user_id::text = auth.uid()::text
        AND module_id = module_id_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== USERS POLICIES =====
-- Allow authenticated users to see basic info of all users (needed for discussion author names)
CREATE POLICY "users_select_basic" ON users
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can update their own profile (but not role/status)
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (id::text = auth.uid()::text)
    WITH CHECK (id::text = auth.uid()::text);

-- Admins can update any user
CREATE POLICY "Admins can update any user" ON users
    FOR UPDATE USING (is_admin());

-- Allow authenticated users to insert their own row on signup
CREATE POLICY "users_insert_own" ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = id::text);

-- ===== MODULES POLICIES =====
-- Admins can do everything with modules
CREATE POLICY "Admins full access to modules" ON modules
    FOR ALL USING (is_admin());

-- Students can view launched modules they're enrolled in
CREATE POLICY "Students view enrolled launched modules" ON modules
    FOR SELECT USING (
        status = 'launched' AND is_enrolled(id)
    );

-- Students can view archived modules they're enrolled in
CREATE POLICY "Students view enrolled archived modules" ON modules
    FOR SELECT USING (
        status = 'archived' AND is_enrolled(id)
    );

-- ===== MODULE_ZOOM_INFO POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to zoom info" ON module_zoom_info
    FOR ALL USING (is_admin());

-- Students can view zoom info for enrolled modules
CREATE POLICY "Students view zoom info for enrolled modules" ON module_zoom_info
    FOR SELECT USING (is_enrolled(module_id));

-- ===== WEEKS POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to weeks" ON weeks
    FOR ALL USING (is_admin());

-- Students can view weeks in enrolled modules
CREATE POLICY "Students view weeks in enrolled modules" ON weeks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM modules m
            WHERE m.id = weeks.module_id
            AND m.status IN ('launched', 'archived')
            AND is_enrolled(m.id)
        )
    );

-- ===== PAGES POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to pages" ON pages
    FOR ALL USING (is_admin());

-- Students can view pages in enrolled modules
CREATE POLICY "Students view pages in enrolled modules" ON pages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM weeks w
            JOIN modules m ON m.id = w.module_id
            WHERE w.id = pages.week_id
            AND m.status IN ('launched', 'archived')
            AND is_enrolled(m.id)
        )
    );

-- ===== QUESTIONS POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to questions" ON questions
    FOR ALL USING (is_admin());

-- Students can view questions in enrolled modules
CREATE POLICY "Students view questions in enrolled modules" ON questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pages p
            JOIN weeks w ON w.id = p.week_id
            JOIN modules m ON m.id = w.module_id
            WHERE p.id = questions.page_id
            AND m.status IN ('launched', 'archived')
            AND is_enrolled(m.id)
        )
    );

-- ===== RESOURCES POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to resources" ON resources
    FOR ALL USING (is_admin());

-- Students can view resources in enrolled modules
CREATE POLICY "Students view resources in enrolled modules" ON resources
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pages p
            JOIN weeks w ON w.id = p.week_id
            JOIN modules m ON m.id = w.module_id
            WHERE p.id = resources.page_id
            AND m.status IN ('launched', 'archived')
            AND is_enrolled(m.id)
        )
    );

-- ===== VIDEOS POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to videos" ON videos
    FOR ALL USING (is_admin());

-- Students can view videos in enrolled modules
CREATE POLICY "Students view videos in enrolled modules" ON videos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pages p
            JOIN weeks w ON w.id = p.week_id
            JOIN modules m ON m.id = w.module_id
            WHERE p.id = videos.page_id
            AND m.status IN ('launched', 'archived')
            AND is_enrolled(m.id)
        )
    );

-- ===== ENROLLMENTS POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to enrollments" ON enrollments
    FOR ALL USING (is_admin());

-- Students can view their own enrollments
CREATE POLICY "Students view own enrollments" ON enrollments
    FOR SELECT USING (user_id::text = auth.uid()::text);

-- ===== PROGRESS POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to progress" ON progress
    FOR ALL USING (is_admin());

-- Students can manage their own progress
CREATE POLICY "Students manage own progress" ON progress
    FOR ALL USING (user_id::text = auth.uid()::text)
    WITH CHECK (user_id::text = auth.uid()::text);

-- ===== DISCUSSION_POSTS POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to discussion posts" ON discussion_posts
    FOR ALL USING (is_admin());

-- Students can view posts in enrolled modules
CREATE POLICY "Students view posts in enrolled modules" ON discussion_posts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM questions q
            JOIN pages p ON p.id = q.page_id
            JOIN weeks w ON w.id = p.week_id
            JOIN modules m ON m.id = w.module_id
            WHERE q.id = discussion_posts.question_id
            AND m.status IN ('launched', 'archived')
            AND is_enrolled(m.id)
        )
    );

-- Students can create posts in enrolled modules
CREATE POLICY "Students create posts in enrolled modules" ON discussion_posts
    FOR INSERT
    WITH CHECK (
        user_id::text = auth.uid()::text AND
        EXISTS (
            SELECT 1 FROM questions q
            JOIN pages p ON p.id = q.page_id
            JOIN weeks w ON w.id = p.week_id
            JOIN modules m ON m.id = w.module_id
            WHERE q.id = discussion_posts.question_id
            AND m.status IN ('launched', 'archived')
            AND is_enrolled(m.id)
        )
    );

-- Students can update their own posts
CREATE POLICY "Students update own posts" ON discussion_posts
    FOR UPDATE USING (user_id::text = auth.uid()::text)
    WITH CHECK (user_id::text = auth.uid()::text);

-- Students can delete their own posts
CREATE POLICY "Students delete own posts" ON discussion_posts
    FOR DELETE USING (user_id::text = auth.uid()::text);
