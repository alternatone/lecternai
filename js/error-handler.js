/**
 * Lectern Error Handler
 *
 * Global error handling and logging for production error tracking.
 * Logs errors to Supabase error_logs table and shows user-friendly messages.
 */

import { supabase, getCurrentUserId } from './supabase-client.js';

class ErrorHandler {
    constructor() {
        this.initialized = false;
        this.errorQueue = [];
        this.isProcessing = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    /**
     * Initialize global error handlers
     */
    init() {
        if (this.initialized) return;

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'unhandled_promise_rejection',
                message: event.reason?.message || String(event.reason),
                stack: event.reason?.stack,
                context: { reason: String(event.reason) }
            });
            event.preventDefault();
        });

        // Handle synchronous errors
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleError({
                type: 'uncaught_error',
                message: String(message),
                stack: error?.stack,
                context: { source, lineno, colno }
            });
            return true; // Prevents default browser error handling
        };

        this.initialized = true;
        console.log('[ErrorHandler] Initialized');
    }

    /**
     * Log an error to Supabase and show user notification
     */
    async handleError(errorInfo, showNotification = true) {
        const { type, message, stack, context } = errorInfo;

        // Don't log certain benign errors
        if (this.shouldIgnoreError(message)) {
            return;
        }

        console.error(`[ErrorHandler] ${type}:`, message, context || '');

        // Queue error for logging
        this.queueError({
            error_type: type,
            error_message: message,
            stack_trace: stack || null,
            page_url: window.location.href,
            user_agent: navigator.userAgent,
            additional_context: context ? JSON.stringify(context) : null
        });

        // Show user-friendly notification
        if (showNotification) {
            this.showErrorNotification(type, message);
        }
    }

    /**
     * Check if an error should be ignored (benign/expected errors)
     */
    shouldIgnoreError(message) {
        const ignorePatterns = [
            'ResizeObserver loop',
            'Script error.',
            'Loading chunk',
            'Failed to fetch dynamically imported module',
            'NetworkError when attempting to fetch',
            // Ignore 406 errors from Supabase (handled separately)
            '406'
        ];

        return ignorePatterns.some(pattern =>
            message.toLowerCase().includes(pattern.toLowerCase())
        );
    }

    /**
     * Queue an error for batch logging
     */
    queueError(errorData) {
        this.errorQueue.push({
            ...errorData,
            timestamp: new Date().toISOString()
        });

        // Process queue if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * Process queued errors and send to Supabase
     */
    async processQueue() {
        if (this.errorQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;

        while (this.errorQueue.length > 0) {
            const errorData = this.errorQueue.shift();
            await this.logToSupabase(errorData);
        }

        this.isProcessing = false;
    }

    /**
     * Log error to Supabase with retry logic
     */
    async logToSupabase(errorData, retryCount = 0) {
        try {
            // Try to get user ID, but don't fail if user is not authenticated
            let userId = null;
            try {
                userId = await getCurrentUserId();
            } catch (e) {
                // User not authenticated, that's fine
            }

            // Parse additional_context if it's a string
            let additionalContext = null;
            if (errorData.additional_context) {
                try {
                    additionalContext = typeof errorData.additional_context === 'string'
                        ? JSON.parse(errorData.additional_context)
                        : errorData.additional_context;
                } catch (e) {
                    additionalContext = { raw: errorData.additional_context };
                }
            }

            console.log('[ErrorHandler] Logging to Supabase:', errorData.error_type);

            const { error } = await supabase
                .from('error_logs')
                .insert({
                    error_type: errorData.error_type,
                    error_message: errorData.error_message,
                    stack_trace: errorData.stack_trace || null,
                    page_url: errorData.page_url || null,
                    user_agent: errorData.user_agent || null,
                    user_id: userId,
                    additional_context: additionalContext
                });

            if (error) {
                console.warn('[ErrorHandler] Supabase insert error:', error);
                throw error;
            }

            console.log('[ErrorHandler] Successfully logged error to Supabase');
        } catch (err) {
            console.warn('[ErrorHandler] Failed to log to Supabase:', err.message);

            // Retry with exponential backoff
            if (retryCount < this.maxRetries) {
                await this.delay(this.retryDelay * Math.pow(2, retryCount));
                return this.logToSupabase(errorData, retryCount + 1);
            }

            // If all retries fail, store in localStorage as fallback
            this.storeLocally(errorData);
        }
    }

    /**
     * Store error locally as fallback when Supabase is unavailable
     */
    storeLocally(errorData) {
        try {
            const storedErrors = JSON.parse(localStorage.getItem('lectern_error_queue') || '[]');
            storedErrors.push(errorData);
            // Keep only last 50 errors
            const trimmed = storedErrors.slice(-50);
            localStorage.setItem('lectern_error_queue', JSON.stringify(trimmed));
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    /**
     * Flush locally stored errors to Supabase (call on app init)
     */
    async flushLocalErrors() {
        try {
            const storedErrors = JSON.parse(localStorage.getItem('lectern_error_queue') || '[]');
            if (storedErrors.length === 0) return;

            for (const errorData of storedErrors) {
                await this.logToSupabase(errorData);
            }

            localStorage.removeItem('lectern_error_queue');
        } catch (e) {
            // Ignore flush errors
        }
    }

    /**
     * Show user-friendly error notification
     */
    showErrorNotification(type, message) {
        // Map error types to user-friendly messages
        const userMessages = {
            'unhandled_promise_rejection': 'Something went wrong. Please try again.',
            'uncaught_error': 'An unexpected error occurred. Please refresh the page.',
            'network_error': 'Network error. Please check your connection.',
            'auth_error': 'Authentication error. Please log in again.',
            'data_error': 'Failed to load data. Please try again.',
            'save_error': 'Failed to save. Please try again.',
            'default': 'Something went wrong. Please try again.'
        };

        const userMessage = userMessages[type] || userMessages.default;

        // Use existing notification system if available
        if (typeof window.showNotification === 'function') {
            window.showNotification(userMessage, 'error');
        } else {
            // Fallback: create simple toast notification
            this.createToast(userMessage, 'error');
        }
    }

    /**
     * Create a simple toast notification (fallback)
     */
    createToast(message, type = 'info') {
        const existing = document.querySelector('.error-handler-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'error-handler-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            background: ${type === 'error' ? 'rgba(139, 26, 26, 0.9)' : 'rgba(16, 100, 112, 0.9)'};
            backdrop-filter: blur(10px);
        `;
        toast.textContent = message;

        // Add animation keyframes if not present
        if (!document.querySelector('#error-handler-styles')) {
            const style = document.createElement('style');
            style.id = 'error-handler-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    /**
     * Helper: delay for retry logic
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Manually log an error (for use in catch blocks)
     */
    logError(type, message, context = {}, showNotification = true) {
        return this.handleError({
            type,
            message,
            stack: new Error().stack,
            context
        }, showNotification);
    }

    /**
     * Wrap an async function with error handling
     */
    wrapAsync(fn, errorType = 'async_error') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError({
                    type: errorType,
                    message: error.message,
                    stack: error.stack,
                    context: { args: args.map(a => typeof a === 'object' ? '[object]' : String(a)) }
                });
                throw error;
            }
        };
    }
}

// Create and export singleton instance
const errorHandler = new ErrorHandler();

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    errorHandler.init();
    // Flush any locally stored errors
    errorHandler.flushLocalErrors();
}

export { ErrorHandler, errorHandler };

// Attach to window for non-module scripts
window.errorHandler = errorHandler;
