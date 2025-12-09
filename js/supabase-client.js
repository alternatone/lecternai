/**
 * Supabase Client for LecternAI
 *
 * This module initializes the Supabase client for database operations.
 * Import this in any file that needs to interact with Supabase.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://kfsmfllzcumvzsbufwgt.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtmc21mbGx6Y3VtdnpzYnVmd2d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMDkyMjUsImV4cCI6MjA4MDg4NTIyNX0.X_o03nwo4aXBuj9zeUxCz4k60roq_xlACwkLwKIS4qE'

export const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * Temporary user ID function - will be replaced with real auth
 * Returns a hardcoded test user ID for development
 */
export function getCurrentUserId() {
    // TODO: Replace with real auth in next phase
    // For now, return a test user ID that should exist in the users table
    return 'test-user-001'
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
