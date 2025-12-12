/**
 * Supabase Client for Lectern
 *
 * This module initializes the Supabase client for database operations.
 * Import this in any file that needs to interact with Supabase.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://kfsmfllzcumvzsbufwgt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmc21mbGx6Y3VtdnpzYnVmd2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDkyMjUsImV4cCI6MjA4MDg4NTIyNX0.X_o03nwo4aXBuj9zeUxCz4k60roq_xlACwkLwKIS4qE'

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
