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
     * Get a single module by ID
     */
    getModule(moduleId) {
        const modules = this.getModules();
        return modules.find(m => m.id === parseInt(moduleId));
    }

    /**
     * Create a new module
     */
    createModule(moduleData) {
        const modules = this.getModules();
        const newModule = {
            id: modules.length > 0 ? Math.max(...modules.map(m => m.id)) + 1 : 1,
            ...moduleData,
            status: moduleData.status || 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        modules.push(newModule);
        this.set('modules', modules);

        // Initialize module-specific storage
        this.set(`module:${newModule.id}:weeks`, []);

        return newModule;
    }

    /**
     * Update an existing module
     */
    updateModule(moduleId, updates) {
        const modules = this.getModules();
        const index = modules.findIndex(m => m.id === parseInt(moduleId));

        if (index === -1) {
            throw new Error(`Module ${moduleId} not found`);
        }

        modules[index] = {
            ...modules[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.set('modules', modules);
        return modules[index];
    }

    /**
     * Delete a module and all its data
     */
    deleteModule(moduleId) {
        const modules = this.getModules();
        const filtered = modules.filter(m => m.id !== parseInt(moduleId));

        this.set('modules', filtered);

        // Clean up module-specific data
        this.remove(`module:${moduleId}:weeks`);
        this.remove(`module:${moduleId}:zoom`);
        this.remove(`module:${moduleId}:info`);

        return true;
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
     * Create a new week
     */
    createWeek(moduleId, weekData) {
        const weeks = this.getWeeks(moduleId);
        const newWeek = {
            id: weeks.length > 0 ? Math.max(...weeks.map(w => w.id)) + 1 : 1,
            moduleId: parseInt(moduleId),
            ...weekData,
            status: weekData.status || 'locked',
            order: weekData.order || weeks.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        weeks.push(newWeek);
        this.set(`module:${moduleId}:weeks`, weeks);

        return newWeek;
    }

    /**
     * Update an existing week
     */
    updateWeek(moduleId, weekId, updates) {
        const weeks = this.getWeeks(moduleId);
        const index = weeks.findIndex(w => w.id === parseInt(weekId));

        if (index === -1) {
            throw new Error(`Week ${weekId} not found in module ${moduleId}`);
        }

        weeks[index] = {
            ...weeks[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.set(`module:${moduleId}:weeks`, weeks);
        return weeks[index];
    }

    /**
     * Delete a week
     */
    deleteWeek(moduleId, weekId) {
        const weeks = this.getWeeks(moduleId);
        const filtered = weeks.filter(w => w.id !== parseInt(weekId));

        this.set(`module:${moduleId}:weeks`, filtered);

        // Clean up week-specific data
        this.remove(`week:${weekId}:progress`);
        this.remove(`week:${weekId}:completed`);

        return true;
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
     * Mark a week as completed
     */
    completeWeek(weekId) {
        this.set(`week:${weekId}:completed`, true);
        this.updateProgress(weekId, {
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        return true;
    }

    /**
     * Check if a week is completed
     */
    isWeekCompleted(weekId) {
        return this.get(`week:${weekId}:completed`, false);
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
     * Save a response to a question
     */
    saveResponse(weekId, questionId, content) {
        const key = `response:week:${weekId}:question:${questionId}`;
        const response = {
            weekId: parseInt(weekId),
            questionId: parseInt(questionId),
            content: content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.set(key, response);
        return response;
    }

    /**
     * Get a response
     */
    getResponse(weekId, questionId) {
        const key = `response:week:${weekId}:question:${questionId}`;
        return this.get(key, null);
    }

    // ==================== Discussion Operations ====================

    /**
     * Get discussion posts for a question
     */
    getDiscussionPosts(weekId, questionId) {
        const key = `discussion:week:${weekId}:question:${questionId}`;
        return this.get(key, []);
    }

    /**
     * Add a discussion post
     */
    addDiscussionPost(weekId, questionId, post) {
        const posts = this.getDiscussionPosts(weekId, questionId);
        const newPost = {
            id: Date.now(),
            ...post,
            createdAt: new Date().toISOString()
        };

        posts.unshift(newPost);
        this.set(`discussion:week:${weekId}:question:${questionId}`, posts);

        return newPost;
    }

    /**
     * Add a reply to a discussion post
     */
    addReply(weekId, questionId, postId, reply) {
        const posts = this.getDiscussionPosts(weekId, questionId);
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
        this.set(`discussion:week:${weekId}:question:${questionId}`, posts);

        return newReply;
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
