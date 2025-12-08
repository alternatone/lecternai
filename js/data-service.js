/**
 * LecternAI Data Service
 *
 * Centralized data access layer that abstracts storage operations.
 * Provides a consistent API that can easily switch between localStorage and backend.
 *
 * Benefits:
 * - Single source of truth for data operations
 * - Easy to swap storage backend (localStorage → API)
 * - Consistent error handling and validation
 * - Automatic data migration and versioning
 */

class DataService {
    constructor() {
        this.storageType = 'localStorage'; // Future: 'api'
        this.apiBaseUrl = '/api/v1'; // Future API endpoint
        this.currentUser = null;
        this.initializeStorage();
    }

    // ==================== ID Generation ====================

    /**
     * Generate a unique ID using timestamp and random suffix
     * This prevents ID collisions after deletions
     */
    generateId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Generate numeric ID safely by finding max ID in collection
     * Falls back to timestamp-based if collection is empty
     */
    generateNumericId(collection) {
        if (!collection || collection.length === 0) {
            return 1;
        }
        const maxId = Math.max(...collection.map(item => parseInt(item.id) || 0));
        return maxId + 1;
    }

    // ==================== Operation Result Helpers ====================

    /**
     * Create a success result object
     */
    success(data, message = 'Operation successful') {
        return { success: true, data, message, error: null };
    }

    /**
     * Create an error result object
     */
    error(message, code = 'UNKNOWN_ERROR') {
        console.error(`[DataService] Error: ${message}`);
        return { success: false, data: null, message, error: { code, message } };
    }

    /**
     * Initialize storage and run migrations if needed
     */
    initializeStorage() {
        const version = this.get('db:version');
        if (!version) {
            this.set('db:version', '1.0.0');
            this.migrateFromLegacyStorage();
        }
    }

    /**
     * Migrate from old localStorage keys to new structure
     */
    migrateFromLegacyStorage() {
        // Migrate old keys to new structure
        const legacyModules = this.get('modules');
        if (legacyModules) {
            // Already in new format, no migration needed
            console.log('[DataService] Storage structure up to date');
        }
    }

    // ==================== Core Storage Operations ====================

    /**
     * Get data from storage
     */
    get(key, defaultValue = null) {
        if (this.storageType === 'localStorage') {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error(`[DataService] Error reading key "${key}":`, error);
                return defaultValue;
            }
        }
        // Future: API call
    }

    /**
     * Set data in storage
     */
    set(key, value) {
        if (this.storageType === 'localStorage') {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error(`[DataService] Error writing key "${key}":`, error);
                return false;
            }
        }
        // Future: API call
    }

    /**
     * Remove data from storage
     */
    remove(key) {
        if (this.storageType === 'localStorage') {
            localStorage.removeItem(key);
            return true;
        }
        // Future: API call
    }

    /**
     * Clear all data (use with caution)
     */
    clear() {
        if (this.storageType === 'localStorage') {
            localStorage.clear();
            this.initializeStorage();
            return true;
        }
        // Future: API call
    }

    // ==================== Module Operations ====================

    /**
     * Get all modules
     */
    getModules() {
        return this.get('modules', []);
    }

    /**
     * Get modules filtered by status
     * @param {string} status - 'draft', 'launched', or 'archived'
     */
    getModulesByStatus(status) {
        const modules = this.getModules();
        return modules.filter(m => m.status === status);
    }

    /**
     * Get template modules (draft status)
     */
    getTemplateModules() {
        return this.getModulesByStatus('draft');
    }

    /**
     * Get active (launched) modules
     */
    getActiveModules() {
        return this.getModulesByStatus('launched');
    }

    /**
     * Get archived modules
     */
    getArchivedModules() {
        return this.getModulesByStatus('archived');
    }

    /**
     * Get launched modules visible to students (with unlocked weeks)
     */
    getStudentModules() {
        const launchedModules = this.getActiveModules();
        const today = new Date().toISOString().split('T')[0];

        // Filter to only modules that have at least one unlocked week
        return launchedModules.filter(module => {
            const weeks = this.getWeeks(module.id);
            return weeks.some(week => {
                if (!week.unlockDate) return true; // No unlock date means always visible
                return week.unlockDate <= today;
            });
        });
    }

    /**
     * Get a single module by ID
     */
    getModule(moduleId) {
        const modules = this.getModules();
        return modules.find(m => m.id === parseInt(moduleId));
    }

    /**
     * Create a new module with validation
     */
    createModule(moduleData) {
        // Validate module data if Validator is available
        if (typeof Validator !== 'undefined') {
            const validation = Validator.validateModule(moduleData);
            if (!validation.valid) {
                return this.error('Validation failed: ' + validation.errors.join(', '), 'VALIDATION_ERROR');
            }
        }

        try {
            const modules = this.getModules();
            const newModule = {
                id: this.generateNumericId(modules),
                ...moduleData,
                status: moduleData.status || 'draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            modules.push(newModule);
            const saved = this.set('modules', modules);

            if (!saved) {
                return this.error('Failed to save module to storage', 'STORAGE_ERROR');
            }

            // Initialize module-specific storage
            this.set(`module:${newModule.id}:weeks`, []);

            return this.success(newModule, 'Module created successfully');
        } catch (err) {
            return this.error('Failed to create module: ' + err.message, 'CREATE_ERROR');
        }
    }

    /**
     * Update an existing module with validation
     */
    updateModule(moduleId, updates) {
        try {
            const modules = this.getModules();
            const index = modules.findIndex(m => m.id === parseInt(moduleId));

            if (index === -1) {
                return this.error(`Module ${moduleId} not found`, 'NOT_FOUND');
            }

            // Validate updates if title is being changed
            if (updates.title && typeof Validator !== 'undefined') {
                const validation = Validator.validateModule({ ...modules[index], ...updates });
                if (!validation.valid) {
                    return this.error('Validation failed: ' + validation.errors.join(', '), 'VALIDATION_ERROR');
                }
            }

            modules[index] = {
                ...modules[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            const saved = this.set('modules', modules);
            if (!saved) {
                return this.error('Failed to save module updates', 'STORAGE_ERROR');
            }

            return this.success(modules[index], 'Module updated successfully');
        } catch (err) {
            return this.error('Failed to update module: ' + err.message, 'UPDATE_ERROR');
        }
    }

    /**
     * Delete a module and all its data
     */
    deleteModule(moduleId) {
        try {
            const modules = this.getModules();
            const moduleExists = modules.some(m => m.id === parseInt(moduleId));

            if (!moduleExists) {
                return this.error(`Module ${moduleId} not found`, 'NOT_FOUND');
            }

            const filtered = modules.filter(m => m.id !== parseInt(moduleId));
            const saved = this.set('modules', filtered);

            if (!saved) {
                return this.error('Failed to delete module from storage', 'STORAGE_ERROR');
            }

            // Clean up module-specific data
            this.remove(`module:${moduleId}:weeks`);
            this.remove(`module:${moduleId}:zoom`);
            this.remove(`module:${moduleId}:info`);

            return this.success(null, 'Module deleted successfully');
        } catch (err) {
            return this.error('Failed to delete module: ' + err.message, 'DELETE_ERROR');
        }
    }

    /**
     * Launch a module - creates a copy with 'launched' status
     * The original template remains as a draft for future use
     */
    launchModule(templateId) {
        try {
            const modules = this.getModules();
            const templateIndex = modules.findIndex(m => m.id === parseInt(templateId));

            if (templateIndex === -1) {
                return this.error(`Template module ${templateId} not found`, 'NOT_FOUND');
            }

            const template = modules[templateIndex];

            // Get template weeks
            const templateWeeks = this.getWeeks(templateId);

            // Check all weeks have unlock dates
            const missingUnlockDates = templateWeeks.filter(w => !w.unlockDate);
            if (missingUnlockDates.length > 0) {
                return this.error('All weeks must have unlock dates before launching', 'VALIDATION_ERROR');
            }

            // Ensure the template keeps its draft status
            modules[templateIndex] = {
                ...template,
                status: 'draft'
            };

            // Create a new module with launched status
            const newModuleId = this.generateNumericId(modules);

            const launchedModule = {
                ...template,
                id: newModuleId,
                status: 'launched',
                templateId: parseInt(templateId), // Reference to original template
                launchedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            modules.push(launchedModule);
            this.set('modules', modules);

            // Copy weeks to new module
            const copiedWeeks = templateWeeks.map((week, index) => ({
                ...week,
                id: index + 1,
                moduleId: newModuleId,
                discussions: [] // Initialize empty discussions for the launched module
            }));
            this.set(`module:${newModuleId}:weeks`, copiedWeeks);

            // Copy zoom info
            const zoomInfo = this.getZoomInfo(templateId);
            if (zoomInfo && Object.keys(zoomInfo).length > 0) {
                this.set(`module:${newModuleId}:zoom`, zoomInfo);
            }

            return this.success(launchedModule, 'Module launched successfully');
        } catch (err) {
            return this.error('Failed to launch module: ' + err.message, 'LAUNCH_ERROR');
        }
    }

    /**
     * Archive a launched module - preserves all content and discussions
     */
    archiveModule(moduleId) {
        try {
            const module = this.getModule(moduleId);
            if (!module) {
                return this.error(`Module ${moduleId} not found`, 'NOT_FOUND');
            }

            if (module.status !== 'launched') {
                return this.error('Only launched modules can be archived', 'INVALID_STATUS');
            }

            // Update module status to archived
            const result = this.updateModule(moduleId, {
                status: 'archived',
                archivedAt: new Date().toISOString()
            });

            return result;
        } catch (err) {
            return this.error('Failed to archive module: ' + err.message, 'ARCHIVE_ERROR');
        }
    }

    /**
     * Get visible weeks for a student (based on unlock dates)
     */
    getVisibleWeeks(moduleId) {
        const weeks = this.getWeeks(moduleId);
        const today = new Date().toISOString().split('T')[0];

        return weeks.filter(week => {
            if (!week.unlockDate) return true; // No unlock date means always visible
            return week.unlockDate <= today;
        });
    }

    // ==================== Week Operations ====================

    /**
     * Get all weeks for a module
     */
    getWeeks(moduleId) {
        return this.get(`module:${moduleId}:weeks`, []);
    }

    /**
     * Get a single week by ID
     */
    getWeek(moduleId, weekId) {
        const weeks = this.getWeeks(moduleId);
        return weeks.find(w => w.id === parseInt(weekId));
    }

    /**
     * Create a new week with validation
     */
    createWeek(moduleId, weekData) {
        // Validate week data if Validator is available
        if (typeof Validator !== 'undefined') {
            const validation = Validator.validateWeek(weekData);
            if (!validation.valid) {
                return this.error('Validation failed: ' + validation.errors.join(', '), 'VALIDATION_ERROR');
            }
        }

        try {
            const weeks = this.getWeeks(moduleId);
            const newWeek = {
                id: this.generateNumericId(weeks),
                moduleId: parseInt(moduleId),
                ...weekData,
                status: weekData.status || 'locked',
                order: weekData.order || weeks.length + 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            weeks.push(newWeek);
            const saved = this.set(`module:${moduleId}:weeks`, weeks);

            if (!saved) {
                return this.error('Failed to save week to storage', 'STORAGE_ERROR');
            }

            return this.success(newWeek, 'Week created successfully');
        } catch (err) {
            return this.error('Failed to create week: ' + err.message, 'CREATE_ERROR');
        }
    }

    /**
     * Update an existing week with validation
     */
    updateWeek(moduleId, weekId, updates) {
        try {
            const weeks = this.getWeeks(moduleId);
            const index = weeks.findIndex(w => w.id === parseInt(weekId));

            if (index === -1) {
                return this.error(`Week ${weekId} not found in module ${moduleId}`, 'NOT_FOUND');
            }

            // Validate updates if title is being changed
            if (updates.title && typeof Validator !== 'undefined') {
                const validation = Validator.validateWeek({ ...weeks[index], ...updates });
                if (!validation.valid) {
                    return this.error('Validation failed: ' + validation.errors.join(', '), 'VALIDATION_ERROR');
                }
            }

            weeks[index] = {
                ...weeks[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            const saved = this.set(`module:${moduleId}:weeks`, weeks);
            if (!saved) {
                return this.error('Failed to save week updates', 'STORAGE_ERROR');
            }

            return this.success(weeks[index], 'Week updated successfully');
        } catch (err) {
            return this.error('Failed to update week: ' + err.message, 'UPDATE_ERROR');
        }
    }

    /**
     * Delete a week
     */
    deleteWeek(moduleId, weekId) {
        try {
            const weeks = this.getWeeks(moduleId);
            const weekExists = weeks.some(w => w.id === parseInt(weekId));

            if (!weekExists) {
                return this.error(`Week ${weekId} not found`, 'NOT_FOUND');
            }

            const filtered = weeks.filter(w => w.id !== parseInt(weekId));
            const saved = this.set(`module:${moduleId}:weeks`, filtered);

            if (!saved) {
                return this.error('Failed to delete week from storage', 'STORAGE_ERROR');
            }

            // Clean up week-specific data
            this.remove(`week:${weekId}:progress`);
            this.remove(`week:${weekId}:completed`);

            return this.success(null, 'Week deleted successfully');
        } catch (err) {
            return this.error('Failed to delete week: ' + err.message, 'DELETE_ERROR');
        }
    }

    // ==================== Progress Operations ====================

    /**
     * Get progress for a week
     */
    getProgress(weekId) {
        return this.get(`week:${weekId}:progress`, {});
    }

    /**
     * Update progress for a week
     */
    updateProgress(weekId, progressData) {
        const progress = {
            ...progressData,
            weekId: parseInt(weekId),
            timestamp: new Date().toISOString()
        };

        this.set(`week:${weekId}:progress`, progress);
        return progress;
    }

    /**
     * Save student's current page position for a week
     */
    savePagePosition(moduleId, weekId, pageNumber) {
        const key = `module:${moduleId}:week:${weekId}:pagePosition`;
        const position = {
            page: pageNumber,
            savedAt: new Date().toISOString()
        };
        this.set(key, position);
        return position;
    }

    /**
     * Get student's saved page position for a week
     */
    getPagePosition(moduleId, weekId) {
        const key = `module:${moduleId}:week:${weekId}:pagePosition`;
        return this.get(key, null);
    }

    /**
     * Clear page position (when week is completed)
     */
    clearPagePosition(moduleId, weekId) {
        const key = `module:${moduleId}:week:${weekId}:pagePosition`;
        this.delete(key);
    }

    /**
     * Mark a week as completed
     */
    completeWeek(moduleId, weekId) {
        const key = `module:${moduleId}:week:${weekId}:completed`;
        this.set(key, true);
        // Clear the page position when week is completed
        this.clearPagePosition(moduleId, weekId);
        return true;
    }

    /**
     * Check if a week is completed
     */
    isWeekCompleted(moduleId, weekId) {
        const key = `module:${moduleId}:week:${weekId}:completed`;
        return this.get(key, false);
    }

    // ==================== Zoom Operations ====================

    /**
     * Get zoom info for a module
     */
    getZoomInfo(moduleId) {
        return this.get(`module:${moduleId}:zoom`, {});
    }

    /**
     * Update zoom info for a module
     */
    updateZoomInfo(moduleId, zoomData) {
        this.set(`module:${moduleId}:zoom`, zoomData);
        return zoomData;
    }

    // ==================== Draft Operations ====================

    /**
     * Save a draft
     */
    saveDraft(type, data) {
        const key = `draft:${type}`;
        const draft = {
            ...data,
            savedAt: new Date().toISOString()
        };

        this.set(key, draft);
        return draft;
    }

    /**
     * Get a draft
     */
    getDraft(type) {
        return this.get(`draft:${type}`, null);
    }

    /**
     * Delete a draft
     */
    deleteDraft(type) {
        this.remove(`draft:${type}`);
        return true;
    }

    // ==================== User Preferences ====================

    /**
     * Get user preferences
     */
    getPreferences() {
        return this.get('user:preferences', {
            currentView: 'student',
            theme: 'light'
        });
    }

    /**
     * Update user preferences
     */
    updatePreferences(updates) {
        const prefs = this.getPreferences();
        const updated = { ...prefs, ...updates };
        this.set('user:preferences', updated);
        return updated;
    }

    /**
     * Get current view (student/teacher)
     */
    getCurrentView() {
        return this.get('currentView', 'student');
    }

    /**
     * Set current view
     */
    setCurrentView(view) {
        this.set('currentView', view);
        return view;
    }

    /**
     * Get current module ID
     */
    getCurrentModuleId() {
        return this.get('currentModuleId', null);
    }

    /**
     * Set current module ID
     */
    setCurrentModuleId(moduleId) {
        this.set('currentModuleId', moduleId);
        return moduleId;
    }

    // ==================== Response Operations ====================

    /**
     * Save a response to a question (isolated per module)
     * @param {number} moduleId - Module ID
     * @param {number} weekId - Week ID
     * @param {number} pageIndex - Page index (0-based)
     * @param {number} questionId - Question index within the page
     * @param {string} content - Response content
     */
    saveResponse(moduleId, weekId, pageIndex, questionId, content) {
        const key = `response:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`;
        const response = {
            moduleId: parseInt(moduleId),
            weekId: parseInt(weekId),
            pageIndex: parseInt(pageIndex),
            questionId: parseInt(questionId),
            content: content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.set(key, response);
        return response;
    }

    /**
     * Get a response (isolated per module)
     */
    getResponse(moduleId, weekId, pageIndex, questionId) {
        const key = `response:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`;
        return this.get(key, null);
    }

    // ==================== Discussion Operations ====================

    /**
     * Get discussion posts for a question (isolated per module)
     */
    getDiscussionPosts(moduleId, weekId, pageIndex, questionId) {
        const key = `discussion:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`;
        return this.get(key, []);
    }

    /**
     * Add a discussion post (isolated per module)
     */
    addDiscussionPost(moduleId, weekId, pageIndex, questionId, post) {
        const posts = this.getDiscussionPosts(moduleId, weekId, pageIndex, questionId);
        const newPost = {
            id: Date.now(),
            ...post,
            createdAt: new Date().toISOString()
        };

        posts.unshift(newPost);
        this.set(`discussion:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`, posts);

        return newPost;
    }

    /**
     * Add a reply to a discussion post (isolated per module)
     */
    addReply(moduleId, weekId, pageIndex, questionId, postId, reply) {
        const posts = this.getDiscussionPosts(moduleId, weekId, pageIndex, questionId);
        const post = posts.find(p => p.id === postId);

        if (!post) {
            throw new Error(`Post ${postId} not found`);
        }

        if (!post.replies) {
            post.replies = [];
        }

        const newReply = {
            id: Date.now(),
            ...reply,
            createdAt: new Date().toISOString()
        };

        post.replies.push(newReply);
        this.set(`discussion:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`, posts);

        return newReply;
    }

    /**
     * Edit a discussion post
     */
    editDiscussionPost(moduleId, weekId, pageIndex, questionId, postId, newContent) {
        const posts = this.getDiscussionPosts(moduleId, weekId, pageIndex, questionId);
        const post = posts.find(p => p.id === postId);

        if (!post) {
            throw new Error(`Post ${postId} not found`);
        }

        post.content = newContent;
        post.editedAt = new Date().toISOString();

        this.set(`discussion:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`, posts);
        return post;
    }

    /**
     * Edit a reply
     */
    editReply(moduleId, weekId, pageIndex, questionId, postId, replyId, newContent) {
        const posts = this.getDiscussionPosts(moduleId, weekId, pageIndex, questionId);
        const post = posts.find(p => p.id === postId);

        if (!post) {
            throw new Error(`Post ${postId} not found`);
        }

        const reply = post.replies ? post.replies.find(r => r.id === replyId) : null;
        if (!reply) {
            throw new Error(`Reply ${replyId} not found`);
        }

        reply.content = newContent;
        reply.editedAt = new Date().toISOString();

        this.set(`discussion:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`, posts);
        return reply;
    }

    // ==================== Utility Methods ====================

    /**
     * Export all data for backup
     */
    exportData() {
        const data = {
            version: this.get('db:version'),
            exportedAt: new Date().toISOString(),
            modules: this.getModules(),
            preferences: this.getPreferences()
        };

        // Add all module-specific data
        data.modules.forEach(module => {
            data[`module_${module.id}_weeks`] = this.getWeeks(module.id);
            data[`module_${module.id}_zoom`] = this.getZoomInfo(module.id);
        });

        return data;
    }

    /**
     * Import data from backup
     */
    importData(data) {
        if (!data.version) {
            throw new Error('Invalid data format');
        }

        // Import modules
        this.set('modules', data.modules);

        // Import module-specific data
        data.modules.forEach(module => {
            if (data[`module_${module.id}_weeks`]) {
                this.set(`module:${module.id}:weeks`, data[`module_${module.id}_weeks`]);
            }
            if (data[`module_${module.id}_zoom`]) {
                this.set(`module:${module.id}:zoom`, data[`module_${module.id}_zoom`]);
            }
        });

        // Import preferences
        if (data.preferences) {
            this.set('user:preferences', data.preferences);
        }

        return true;
    }
}

// Create global instance
const dataService = new DataService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataService, dataService };
}
