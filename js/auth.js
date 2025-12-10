/**
 * LecternAI Authentication Utilities
 *
 * Provides auth guards and user management functions for the app.
 * All pages should use these to ensure proper access control.
 */

import { supabase } from './supabase-client.js'

/**
 * Get the currently logged-in user with their profile data
 * @returns {Object|null} User profile or null if not logged in
 */
export async function getCurrentUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;

    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

    return profile;
}

/**
 * Require an active (approved) user to access the page
 * Redirects to login if not authenticated, pending page if not approved
 * @returns {Object|null} User profile or null (with redirect)
 */
export async function requireActiveUser() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    if (user.status === 'pending') {
        window.location.href = 'pending.html';
        return null;
    }
    return user;
}

/**
 * Require admin role to access the page
 * Redirects to login if not authenticated, index if not admin
 * @returns {Object|null} Admin user profile or null (with redirect)
 */
export async function requireAdmin() {
    const user = await requireActiveUser();
    if (user && user.role !== 'admin') {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

/**
 * Check if a user is enrolled in a specific module
 * @param {string} userId - User ID
 * @param {number} moduleId - Module ID
 * @returns {boolean} True if enrolled
 */
export async function isEnrolled(userId, moduleId) {
    const { data } = await supabase
        .from('enrollments')
        .select('id')
        .eq('user_id', userId)
        .eq('module_id', moduleId)
        .single();
    return !!data;
}

/**
 * Check if user can access a module (admin or enrolled)
 * @param {Object} user - User profile
 * @param {number} moduleId - Module ID
 * @returns {boolean} True if user can access
 */
export async function canAccessModule(user, moduleId) {
    if (user.role === 'admin') return true;
    return await isEnrolled(user.id, moduleId);
}

/**
 * Log out the current user
 */
export async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

/**
 * Sign up a new user
 * Creates auth user and matching profile in users table
 * @param {string} email
 * @param {string} password
 * @param {string} name
 * @returns {Object} Result with success/error
 */
export async function signUp(email, password, name) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
    });

    if (authError) {
        return { success: false, error: authError.message };
    }

    // Create user profile with pending status
    const { error: profileError } = await supabase
        .from('users')
        .insert({
            id: authData.user.id,
            email: email,
            name: name,
            role: 'student',
            status: 'pending'
        });

    if (profileError) {
        return { success: false, error: profileError.message };
    }

    return { success: true, user: authData.user };
}

/**
 * Sign in an existing user
 * @param {string} email
 * @param {string} password
 * @returns {Object} Result with success/error and user status
 */
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return { success: false, error: error.message };
    }

    // Get user profile to check status
    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

    return {
        success: true,
        user: data.user,
        profile,
        isPending: profile?.status === 'pending'
    };
}

/**
 * Get all users (admin function)
 * @returns {Array} List of all users
 */
export async function getAllUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }
    return data;
}

/**
 * Approve a pending user (admin function)
 * @param {string} userId
 * @returns {Object} Result
 */
export async function approveUser(userId) {
    const { error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', userId);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * Reject/delete a pending user (admin function)
 * @param {string} userId
 * @returns {Object} Result
 */
export async function rejectUser(userId) {
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * Update user role (admin function)
 * @param {string} userId
 * @param {string} role - 'admin' or 'student'
 * @returns {Object} Result
 */
export async function updateUserRole(userId, role) {
    const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

/**
 * Get enrollments for a user
 * @param {string} userId
 * @returns {Array} List of module IDs
 */
export async function getUserEnrollments(userId) {
    const { data, error } = await supabase
        .from('enrollments')
        .select('module_id')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching enrollments:', error);
        return [];
    }
    return data.map(e => e.module_id);
}

/**
 * Set enrollments for a user (replaces existing)
 * @param {string} userId
 * @param {Array} moduleIds - Array of module IDs to enroll in
 * @returns {Object} Result
 */
export async function setUserEnrollments(userId, moduleIds) {
    // Delete existing enrollments
    const { error: deleteError } = await supabase
        .from('enrollments')
        .delete()
        .eq('user_id', userId);

    if (deleteError) {
        return { success: false, error: deleteError.message };
    }

    // Insert new enrollments
    if (moduleIds.length > 0) {
        const enrollments = moduleIds.map(moduleId => ({
            user_id: userId,
            module_id: moduleId
        }));

        const { error: insertError } = await supabase
            .from('enrollments')
            .insert(enrollments);

        if (insertError) {
            return { success: false, error: insertError.message };
        }
    }

    return { success: true };
}

/**
 * Render user header component
 * Shows logged-in user name, admin link if applicable, and logout button
 * @param {Object} user - User profile
 * @param {HTMLElement} container - Container to render into
 */
export function renderUserHeader(user, container) {
    const isAdmin = user.role === 'admin';

    container.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem 1rem; background: var(--light-bg); border-bottom: 1px solid #e9ecef;">
            <span style="flex: 1;">
                <strong>${user.name || user.email}</strong>
                ${isAdmin ? '<span style="background: var(--primary-color); color: white; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem;">Admin</span>' : ''}
            </span>
            ${isAdmin ? '<a href="admin-users.html" class="btn btn-secondary" style="padding: 0.3rem 0.75rem; font-size: 0.85rem;">Manage Users</a>' : ''}
            <button onclick="window.logoutUser()" class="btn btn-secondary" style="padding: 0.3rem 0.75rem; font-size: 0.85rem;">Logout</button>
        </div>
    `;

    // Export logout function to window
    window.logoutUser = logout;
}
