/**
 * Lectern Database Schema
 *
 * This file defines the normalized database schema for Lectern.
 * Designed to be compatible with both localStorage and future backend sync.
 *
 * Schema Version: 1.0.0
 */

const DB_SCHEMA = {
    version: '1.0.0',

    /**
     * User Entity
     * Stores user profile and preferences
     */
    user: {
        id: 'string',           // UUID
        email: 'string',
        name: 'string',
        role: 'string',         // 'student' | 'teacher' | 'admin'
        preferences: {
            currentView: 'string',  // 'student' | 'teacher'
            theme: 'string'         // Future: 'light' | 'dark'
        },
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
    },

    /**
     * Module Entity
     * Represents a course module
     */
    module: {
        id: 'number',           // Auto-increment
        title: 'string',
        description: 'string',
        instructor: 'string',
        duration: 'string',
        participation: 'string',
        timeExpectations: 'string',
        status: 'string',       // 'draft' | 'published' | 'archived'
        zoomInfo: {
            url: 'string',
            meetingId: 'string',
            passcode: 'string',
            schedule: {
                day: 'string',      // 'Monday' | 'Tuesday' | ...
                time: 'string',     // HH:MM format
                timezone: 'string'  // 'EST' | 'CST' | ...
            }
        },
        createdBy: 'string',    // User ID
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
    },

    /**
     * Week Entity
     * Represents a week within a module
     */
    week: {
        id: 'number',           // Auto-increment
        moduleId: 'number',     // Foreign key to module
        title: 'string',
        description: 'string',
        order: 'number',        // Display order within module
        status: 'string',       // 'locked' | 'current' | 'complete'
        unlockDate: 'string',   // ISO date string
        pages: [                // Array of page objects
            {
                id: 'number',
                title: 'string',
                type: 'string', // 'discussion' | 'intro' | 'reading' | 'video'
                order: 'number',
                content: {
                    // Type-specific content structure
                }
            }
        ],
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
    },

    /**
     * Resource Entity
     * Represents learning resources (readings, videos, etc.)
     */
    resource: {
        id: 'number',
        weekId: 'number',       // Foreign key to week
        pageId: 'number',       // Which page within the week
        type: 'string',         // 'reading' | 'video' | 'audio' | 'link'
        title: 'string',
        description: 'string',
        url: 'string',
        metadata: {
            duration: 'string',     // For videos/audio
            author: 'string',       // For readings
            fileSize: 'number'      // For downloads
        },
        order: 'number',
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
    },

    /**
     * Question Entity
     * Represents reflection/discussion questions
     */
    question: {
        id: 'number',
        weekId: 'number',       // Foreign key to week
        pageId: 'number',       // Which page within the week
        type: 'string',         // 'reflection' | 'discussion' | 'essay'
        text: 'string',
        order: 'number',
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
    },

    /**
     * UserProgress Entity
     * Tracks student progress through modules and weeks
     */
    userProgress: {
        id: 'number',
        userId: 'string',       // Foreign key to user
        moduleId: 'number',     // Foreign key to module
        weekId: 'number',       // Foreign key to week
        pageId: 'number',       // Current page within week
        status: 'string',       // 'not_started' | 'in_progress' | 'completed'
        completedAt: 'timestamp',
        lastAccessedAt: 'timestamp',
        updatedAt: 'timestamp'
    },

    /**
     * Response Entity
     * Stores student responses to questions and reflections
     */
    response: {
        id: 'number',
        userId: 'string',       // Foreign key to user
        questionId: 'number',   // Foreign key to question
        weekId: 'number',       // Foreign key to week
        content: 'string',
        isPublic: 'boolean',    // For discussion posts
        replies: [              // For threaded discussions
            {
                id: 'number',
                userId: 'string',
                content: 'string',
                createdAt: 'timestamp'
            }
        ],
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
    },

    /**
     * Draft Entity
     * Temporary storage for unsaved work
     */
    draft: {
        id: 'string',           // UUID
        userId: 'string',       // Foreign key to user
        type: 'string',         // 'module' | 'week' | 'response'
        entityId: 'number',     // ID of the entity being drafted
        data: 'object',         // JSON blob of draft data
        createdAt: 'timestamp',
        updatedAt: 'timestamp'
    }
};

/**
 * Storage Keys Convention
 * Consistent naming for localStorage keys (future: API endpoints)
 */
const STORAGE_KEYS = {
    // User data
    CURRENT_USER: 'user:current',
    USER_PREFERENCES: 'user:preferences',

    // Module data
    MODULES: 'modules',
    MODULE: (id) => `module:${id}`,
    MODULE_WEEKS: (moduleId) => `module:${moduleId}:weeks`,
    MODULE_ZOOM: (moduleId) => `module:${moduleId}:zoom`,
    MODULE_INFO: 'module:info', // Temporary, should be scoped

    // Week data
    WEEK: (moduleId, weekId) => `module:${moduleId}:week:${weekId}`,
    WEEK_PROGRESS: (weekId) => `week:${weekId}:progress`,
    WEEK_COMPLETED: (weekId) => `week:${weekId}:completed`,

    // Question responses
    RESPONSE: (weekId, questionId) => `response:week:${weekId}:question:${questionId}`,
    DISCUSSION_POSTS: (weekId, questionId) => `discussion:week:${weekId}:question:${questionId}`,

    // Drafts
    DRAFT_MODULE: 'draft:module',
    DRAFT_WEEK: 'draft:week',
    DRAFT_RESPONSE: (weekId) => `draft:response:week:${weekId}`,

    // View state
    CURRENT_VIEW: 'ui:currentView',
    CURRENT_MODULE_ID: 'ui:currentModuleId'
};

/**
 * Data Validation Rules
 */
const VALIDATION_RULES = {
    module: {
        title: { required: true, minLength: 3, maxLength: 200 },
        description: { maxLength: 2000 },
        status: { enum: ['draft', 'published', 'archived'] }
    },
    week: {
        title: { required: true, minLength: 3, maxLength: 200 },
        status: { enum: ['locked', 'current', 'complete'] }
    },
    resource: {
        title: { required: true, minLength: 1, maxLength: 300 },
        url: { required: true, pattern: /^https?:\/\/.+/ }
    },
    question: {
        text: { required: true, minLength: 10, maxLength: 2000 }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DB_SCHEMA, STORAGE_KEYS, VALIDATION_RULES };
}
