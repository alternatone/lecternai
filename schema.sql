-- Lectern LMS Database Schema
-- Version: 1.0.0 (Beta)
-- Run this in Supabase SQL Editor to set up the database

-- ==================== TABLES ====================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    instructor TEXT,
    duration TEXT,
    participation TEXT,
    time_expectations TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'launched', 'archived')),
    template_id BIGINT REFERENCES modules(id) ON DELETE SET NULL,
    launched_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Module Zoom Info table
CREATE TABLE IF NOT EXISTS module_zoom_info (
    id BIGSERIAL PRIMARY KEY,
    module_id BIGINT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    url TEXT,
    meeting_id TEXT,
    passcode TEXT,
    day TEXT,
    time TEXT,
    timezone TEXT DEFAULT 'EST',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_id)
);

-- Weeks table
CREATE TABLE IF NOT EXISTS weeks (
    id BIGSERIAL PRIMARY KEY,
    module_id BIGINT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    unlock_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(module_id, week_number)
);

-- Pages table
CREATE TABLE IF NOT EXISTS pages (
    id BIGSERIAL PRIMARY KEY,
    week_id BIGINT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('discussion', 'intro', 'reading')),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(week_id, page_number)
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    question_number INT NOT NULL DEFAULT 1,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id BIGSERIAL PRIMARY KEY,
    page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enrollments table
CREATE TABLE IF NOT EXISTS enrollments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id BIGINT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

-- Progress table
CREATE TABLE IF NOT EXISTS progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_id BIGINT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    current_page INT DEFAULT 1,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_id)
);

-- Discussion Posts table
CREATE TABLE IF NOT EXISTS discussion_posts (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES discussion_posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_modules_status ON modules(status);
CREATE INDEX IF NOT EXISTS idx_modules_template_id ON modules(template_id);
CREATE INDEX IF NOT EXISTS idx_weeks_module_id ON weeks(module_id);
CREATE INDEX IF NOT EXISTS idx_pages_week_id ON pages(week_id);
CREATE INDEX IF NOT EXISTS idx_questions_page_id ON questions(page_id);
CREATE INDEX IF NOT EXISTS idx_resources_page_id ON resources(page_id);
CREATE INDEX IF NOT EXISTS idx_videos_page_id ON videos(page_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_module_id ON enrollments(module_id);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_week_id ON progress(week_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_question_id ON discussion_posts(question_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_user_id ON discussion_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_parent_id ON discussion_posts(parent_id);

-- ==================== FUNCTIONS ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users', 'modules', 'module_zoom_info', 'weeks', 'pages', 'questions', 'resources', 'videos', 'progress', 'discussion_posts']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END;
$$;

-- ==================== ROW LEVEL SECURITY ====================

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

-- ==================== RLS POLICIES ====================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
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
        WHERE user_id = auth.uid()
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
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admins can update any user
CREATE POLICY "Admins can update any user" ON users
    FOR UPDATE USING (is_admin());

-- Allow authenticated users to insert their own row on signup
CREATE POLICY "users_insert_own" ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

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
    FOR SELECT USING (user_id = auth.uid());

-- ===== PROGRESS POLICIES =====
-- Admins can view all progress
CREATE POLICY "Admins view all progress" ON progress
    FOR SELECT USING (is_admin());

-- Students can view and update their own progress
CREATE POLICY "Students view own progress" ON progress
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Students insert own progress" ON progress
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students update own progress" ON progress
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ===== DISCUSSION_POSTS POLICIES =====
-- Admins can do everything
CREATE POLICY "Admins full access to discussion posts" ON discussion_posts
    FOR ALL USING (is_admin());

-- Users can view posts in modules they're enrolled in
CREATE POLICY "Users view posts in enrolled modules" ON discussion_posts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM questions q
            JOIN pages p ON p.id = q.page_id
            JOIN weeks w ON w.id = p.week_id
            JOIN modules m ON m.id = w.module_id
            WHERE q.id = discussion_posts.question_id
            AND is_enrolled(m.id)
        )
    );

-- Users can create posts in modules they're enrolled in
CREATE POLICY "Users create posts in enrolled modules" ON discussion_posts
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM questions q
            JOIN pages p ON p.id = q.page_id
            JOIN weeks w ON w.id = p.week_id
            JOIN modules m ON m.id = w.module_id
            WHERE q.id = discussion_posts.question_id
            AND is_enrolled(m.id)
        )
    );

-- Users can update their own posts
CREATE POLICY "Users update own posts" ON discussion_posts
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete their own posts
CREATE POLICY "Users delete own posts" ON discussion_posts
    FOR DELETE USING (user_id = auth.uid());

-- ==================== AUTH TRIGGER ====================

-- Create user profile when auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'student',
        'pending'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
