/**
 * Supabase Client for Lectern
 *
 * This module initializes the Supabase client for database operations.
 * Import this in any file that needs to interact with Supabase.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://bnuovhturagqbmunxgql.supabase.co'
const supabaseKey = 'sb_publishable_OjwtqfL9HleTzienBAHAZw_KkfXuwA6'

export const supabase = createClient(supabaseUrl, supabaseKey)

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
