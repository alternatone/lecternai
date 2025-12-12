/**
 * Lectern Data Validation
 *
 * Centralized validation for all data entities.
 * Ensures data integrity before saving to storage or sending to API.
 */

class Validator {
    /**
     * Validate module data
     */
    static validateModule(data) {
        const errors = [];

        if (!data.title || typeof data.title !== 'string') {
            errors.push('Module title is required');
        } else if (data.title.length < 3) {
            errors.push('Module title must be at least 3 characters');
        } else if (data.title.length > 200) {
            errors.push('Module title must be less than 200 characters');
        }

        if (data.description && data.description.length > 2000) {
            errors.push('Module description must be less than 2000 characters');
        }

        if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
            errors.push('Invalid module status');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate week data
     */
    static validateWeek(data) {
        const errors = [];

        if (!data.title || typeof data.title !== 'string') {
            errors.push('Week title is required');
        } else if (data.title.length < 3) {
            errors.push('Week title must be at least 3 characters');
        } else if (data.title.length > 200) {
            errors.push('Week title must be less than 200 characters');
        }

        if (data.status && !['locked', 'current', 'complete'].includes(data.status)) {
            errors.push('Invalid week status');
        }

        if (data.pages && !Array.isArray(data.pages)) {
            errors.push('Week pages must be an array');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate resource data
     */
    static validateResource(data) {
        const errors = [];

        if (!data.title || typeof data.title !== 'string') {
            errors.push('Resource title is required');
        } else if (data.title.length < 1) {
            errors.push('Resource title cannot be empty');
        } else if (data.title.length > 300) {
            errors.push('Resource title must be less than 300 characters');
        }

        if (!data.url || typeof data.url !== 'string') {
            errors.push('Resource URL is required');
        } else if (!this.isValidUrl(data.url)) {
            errors.push('Resource URL must be a valid HTTP/HTTPS URL');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate question data
     */
    static validateQuestion(data) {
        const errors = [];

        if (!data.text || typeof data.text !== 'string') {
            errors.push('Question text is required');
        } else if (data.text.length < 10) {
            errors.push('Question text must be at least 10 characters');
        } else if (data.text.length > 2000) {
            errors.push('Question text must be less than 2000 characters');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate video data
     */
    static validateVideo(data) {
        const errors = [];

        if (!data.title || typeof data.title !== 'string') {
            errors.push('Video title is required');
        }

        if (!data.url || typeof data.url !== 'string') {
            errors.push('Video URL is required');
        } else if (!this.isValidVideoUrl(data.url)) {
            errors.push('Video URL must be a valid YouTube, Vimeo, or HTTP/HTTPS URL');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate zoom info data
     */
    static validateZoomInfo(data) {
        const errors = [];

        if (data.url && !this.isValidUrl(data.url)) {
            errors.push('Zoom URL must be a valid HTTP/HTTPS URL');
        }

        if (data.schedule) {
            const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            if (data.schedule.day && !validDays.includes(data.schedule.day)) {
                errors.push('Invalid day of week');
            }

            if (data.schedule.time && !this.isValidTime(data.schedule.time)) {
                errors.push('Invalid time format (must be HH:MM)');
            }

            const validTimezones = ['EST', 'CST', 'MST', 'PST', 'UTC'];
            if (data.schedule.timezone && !validTimezones.includes(data.schedule.timezone)) {
                errors.push('Invalid timezone');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if string is a valid URL
     */
    static isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    /**
     * Check if string is a valid video URL (YouTube, Vimeo, or general)
     */
    static isValidVideoUrl(string) {
        if (!this.isValidUrl(string)) {
            return false;
        }

        // YouTube patterns
        if (string.includes('youtube.com') || string.includes('youtu.be')) {
            return true;
        }

        // Vimeo patterns
        if (string.includes('vimeo.com')) {
            return true;
        }

        // General HTTP/HTTPS URL
        return true;
    }

    /**
     * Check if string is a valid time in HH:MM format
     */
    static isValidTime(string) {
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(string);
    }

    /**
     * Sanitize HTML to prevent XSS
     */
    static sanitizeHtml(html) {
        const temp = document.createElement('div');
        temp.textContent = html;
        return temp.innerHTML;
    }

    /**
     * Validate and sanitize user input
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Trim whitespace
        let sanitized = input.trim();

        // Escape HTML special characters
        sanitized = this.sanitizeHtml(sanitized);

        return sanitized;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator };
}
