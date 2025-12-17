/**
 * Supabase Client for Lectern
 *
 * This module initializes the Supabase client for database operations.
 * Import this in any file that needs to interact with Supabase.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://bnuovhturagqbmunxgql.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudW92aHR1cmFncWJtdW54Z3FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MTQ0MDQsImV4cCI6MjA4MTQ5MDQwNH0.LBk9ZNDyza5gGLo9kCNvOLyCzfJJLj9t3w4hklYDuhk'

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
 * Check if user is admin (temporary implementation)
 * Will be replaced with real role checking from auth
 */
export function isAdmin() {
    // TODO: Replace with real role check from Supabase auth
    const view = localStorage.getItem('currentView')
    return view === 'admin'
}
