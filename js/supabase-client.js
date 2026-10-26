/**
 * Supabase Client for Lectern
 *
 * This module initializes the Supabase client for database operations.
 * Import this in any file that needs to interact with Supabase.
 */

import { createDemoClient } from './demo-client.js'

const supabaseUrl = 'https://bnuovhturagqbmunxgql.supabase.co'
const supabaseKey = 'sb_publishable_OjwtqfL9HleTzienBAHAZw_KkfXuwA6'

/**
 * Demo mode runs against sample data in localStorage instead of Supabase.
 * Always on for the lectern-demo Cloudflare Pages project (incl. preview URLs);
 * toggle locally with ?demo=1 / ?demo=0.
 */
function isDemoMode() {
    const param = new URLSearchParams(location.search).get('demo')
    if (param === '1') localStorage.setItem('lectern-demo', '1')
    if (param === '0') localStorage.removeItem('lectern-demo')
    return /(^|\.)lectern-demo(-[a-z0-9]+)?\.pages\.dev$/.test(location.hostname) ||
        localStorage.getItem('lectern-demo') === '1'
}

// supabase-js is only fetched outside demo mode, so the demo has no backend or CDN dependency
export const supabase = isDemoMode()
    ? createDemoClient()
    : (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(supabaseUrl, supabaseKey)

/**
 * Get the current authenticated user's ID
 * @returns {Promise<string|null>} User ID or null if not logged in
 */
export async function getCurrentUserId() {
    const { data: { user } } = await supabase.auth.getUser()
    return user ? user.id : null
}

/**
 * Check if user is viewing as admin (for participant mode)
 *
 * This returns true when the admin is viewing content as admin (not as student).
 * It is intentionally based on localStorage for the "participant mode" feature
 * where admins can preview content as a student would see it.
 *
 * Note: For actual permission checks (can user access admin pages?),
 * use requireAdmin() from auth.js which checks the database role.
 */
export function isAdmin() {
    const view = localStorage.getItem('currentView')
    return view === 'admin'
}
