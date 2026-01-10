/**
 * Lectern Data Service - Supabase Implementation
 *
 * Async data access layer using Supabase as backend.
 * Mirrors the localStorage dataService API for minimal page changes.
 * All methods are async and return Promises.
 */

import { supabase, getCurrentUserId, isAdmin } from './supabase-client.js'

// Retry configuration
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 1000,
    retryableCodes: ['PGRST301', '500', '502', '503', '504', 'NETWORK_ERROR']
}

/**
 * Delay helper for retry logic
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Check if an error is retryable (transient network/server errors)
 */
function isRetryableError(error) {
    if (!error) return false
    const code = error.code || error.status || ''
    return RETRY_CONFIG.retryableCodes.some(c =>
        String(code).includes(c) || error.message?.includes('network') || error.message?.includes('fetch')
    )
}

/**
 * Execute a Supabase operation with retry logic
 */
async function withRetry(operation, context = 'operation') {
    let lastError = null

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            const result = await operation()
            return result
        } catch (error) {
            lastError = error

            if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
                throw error
            }

            const delayMs = RETRY_CONFIG.baseDelay * Math.pow(2, attempt)
            console.warn(`[DataService] Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} for ${context} after ${delayMs}ms`)
            await delay(delayMs)
        }
    }

    throw lastError
}

/**
 * Log error to Supabase error_logs table
 */
async function logError(errorType, message, context = {}) {
    try {
        const userId = await getCurrentUserId()
        await supabase.from('error_logs').insert({
            error_type: errorType,
            error_message: message,
            page_url: typeof window !== 'undefined' ? window.location.href : null,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
            user_id: userId || null,
            additional_context: context
        })
    } catch (e) {
        // Don't let error logging failures break the app
        console.warn('[DataService] Failed to log error:', e.message)
    }
}

class DataServiceSupabase {
    constructor() {
        this.currentModuleId = null
        this.currentView = 'student'
        // Load view from localStorage for persistence during migration
        const savedView = localStorage.getItem('currentView')
        if (savedView) {
            this.currentView = savedView
        }
    }

    // ==================== Operation Result Helpers ====================

    success(data, message = 'Operation successful') {
        return { success: true, data, message, error: null }
    }

    error(message, code = 'UNKNOWN_ERROR', context = {}) {
        console.error(`[DataServiceSupabase] Error: ${message}`)
        // Log to error_logs table (async, don't await)
        logError(`data_service_${code.toLowerCase()}`, message, context)
        return { success: false, data: null, message, error: { code, message } }
    }

    // ==================== View Management (localStorage for now) ====================

    getCurrentView() {
        return this.currentView
    }

    setCurrentView(view) {
        this.currentView = view
        localStorage.setItem('currentView', view)
        return view
    }

    getCurrentModuleId() {
        return this.currentModuleId || localStorage.getItem('currentModuleId')
    }

    setCurrentModuleId(moduleId) {
        this.currentModuleId = moduleId
        localStorage.setItem('currentModuleId', moduleId)
        return moduleId
    }

    // ==================== Module Operations ====================

    async getModules() {
        try {
            const { data, error } = await withRetry(async () => {
                const result = await supabase
                    .from('modules')
                    .select('*')
                    .order('created_at', { ascending: false })
                if (result.error) throw result.error
                return result
            }, 'getModules')

            if (error) {
                logError('fetch_modules', error.message, { operation: 'getModules' })
                return []
            }

            // Map to expected format
            return data.map(m => ({
                id: m.id,
                title: m.title,
                description: m.description,
                instructor: m.instructor,
                duration: m.duration,
                participation: m.participation,
                timeExpectations: m.time_expectations,
                status: m.status,
                templateId: m.template_id,
                launchedAt: m.launched_at,
                archivedAt: m.archived_at,
                createdAt: m.created_at,
                updatedAt: m.updated_at
            }))
        } catch (err) {
            logError('fetch_modules', err.message, { operation: 'getModules' })
            return []
        }
    }

    async getModulesByStatus(status) {
        // Filter at database level for better performance
        try {
            const { data, error } = await supabase
                .from('modules')
                .select('*')
                .eq('status', status)

            if (error) {
                logError('fetch_modules_by_status', error.message, { status })
                return []
            }

            return data.map(m => ({
                id: m.id,
                title: m.title,
                description: m.description,
                instructor: m.instructor,
                duration: m.duration,
                participation: m.participation,
                timeExpectations: m.time_expectations,
                status: m.status,
                templateId: m.template_id,
                launchedAt: m.launched_at,
                archivedAt: m.archived_at,
                createdAt: m.created_at,
                updatedAt: m.updated_at
            }))
        } catch (err) {
            logError('fetch_modules_by_status', err.message, { status })
            return []
        }
    }

    async getTemplateModules() {
        return this.getModulesByStatus('draft')
    }

    async getActiveModules() {
        return this.getModulesByStatus('launched')
    }

    async getArchivedModules() {
        return this.getModulesByStatus('archived')
    }

    async getStudentModules() {
        const launchedModules = await this.getActiveModules()
        const today = new Date().toISOString().split('T')[0]

        // Filter to modules with at least one unlocked week
        const modulesWithWeeks = await Promise.all(
            launchedModules.map(async module => {
                const weeks = await this.getWeeks(module.id)
                const hasUnlockedWeek = weeks.some(week => {
                    if (!week.unlockDate) return true
                    return week.unlockDate <= today
                })
                return hasUnlockedWeek ? module : null
            })
        )

        return modulesWithWeeks.filter(m => m !== null)
    }

    async getModule(moduleId) {
        const { data, error } = await supabase
            .from('modules')
            .select('*')
            .eq('id', moduleId)
            .single()

        if (error) {
            console.error('Error fetching module:', error)
            return null
        }

        return {
            id: data.id,
            title: data.title,
            description: data.description,
            instructor: data.instructor,
            duration: data.duration,
            participation: data.participation,
            timeExpectations: data.time_expectations,
            status: data.status,
            templateId: data.template_id,
            launchedAt: data.launched_at,
            archivedAt: data.archived_at,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }
    }

    async createModule(moduleData) {
        try {
            const { data, error } = await supabase
                .from('modules')
                .insert({
                    title: moduleData.title,
                    description: moduleData.description || null,
                    instructor: moduleData.instructor || null,
                    duration: moduleData.duration || null,
                    participation: moduleData.participation || null,
                    time_expectations: moduleData.timeExpectations || null,
                    status: moduleData.status || 'draft'
                })
                .select()
                .single()

            if (error) {
                return this.error('Failed to create module: ' + error.message, 'CREATE_ERROR')
            }

            return this.success({
                id: data.id,
                title: data.title,
                description: data.description,
                instructor: data.instructor,
                duration: data.duration,
                participation: data.participation,
                timeExpectations: data.time_expectations,
                status: data.status,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            }, 'Module created successfully')
        } catch (err) {
            return this.error('Failed to create module: ' + err.message, 'CREATE_ERROR')
        }
    }

    async updateModule(moduleId, updates) {
        try {
            const dbUpdates = {}
            if (updates.title !== undefined) dbUpdates.title = updates.title
            if (updates.description !== undefined) dbUpdates.description = updates.description
            if (updates.instructor !== undefined) dbUpdates.instructor = updates.instructor
            if (updates.duration !== undefined) dbUpdates.duration = updates.duration
            if (updates.participation !== undefined) dbUpdates.participation = updates.participation
            if (updates.timeExpectations !== undefined) dbUpdates.time_expectations = updates.timeExpectations
            if (updates.status !== undefined) dbUpdates.status = updates.status
            if (updates.archivedAt !== undefined) dbUpdates.archived_at = updates.archivedAt

            const { data, error } = await supabase
                .from('modules')
                .update(dbUpdates)
                .eq('id', moduleId)
                .select()
                .single()

            if (error) {
                return this.error('Failed to update module: ' + error.message, 'UPDATE_ERROR')
            }

            return this.success({
                id: data.id,
                title: data.title,
                description: data.description,
                status: data.status,
                updatedAt: data.updated_at
            }, 'Module updated successfully')
        } catch (err) {
            return this.error('Failed to update module: ' + err.message, 'UPDATE_ERROR')
        }
    }

    async deleteModule(moduleId) {
        try {
            const { error } = await supabase
                .from('modules')
                .delete()
                .eq('id', moduleId)

            if (error) {
                return this.error('Failed to delete module: ' + error.message, 'DELETE_ERROR')
            }

            return this.success(null, 'Module deleted successfully')
        } catch (err) {
            return this.error('Failed to delete module: ' + err.message, 'DELETE_ERROR')
        }
    }

    async launchModule(templateId) {
        try {
            const template = await this.getModule(templateId)
            if (!template) {
                return this.error('Template module not found', 'NOT_FOUND')
            }

            // Get template weeks
            const templateWeeks = await this.getWeeks(templateId)

            // Check all weeks have unlock dates
            const missingUnlockDates = templateWeeks.filter(w => !w.unlockDate)
            if (missingUnlockDates.length > 0) {
                return this.error('All weeks must have unlock dates before launching', 'VALIDATION_ERROR')
            }

            // Create new launched module
            const { data: newModule, error: moduleError } = await supabase
                .from('modules')
                .insert({
                    title: template.title,
                    description: template.description,
                    instructor: template.instructor,
                    duration: template.duration,
                    participation: template.participation,
                    time_expectations: template.timeExpectations,
                    status: 'launched',
                    template_id: templateId,
                    launched_at: new Date().toISOString()
                })
                .select()
                .single()

            if (moduleError) {
                return this.error('Failed to launch module: ' + moduleError.message, 'LAUNCH_ERROR')
            }

            // Copy weeks to new module
            for (const templateWeek of templateWeeks) {
                await this.createWeek(newModule.id, {
                    title: templateWeek.title,
                    description: templateWeek.description,
                    unlockDate: templateWeek.unlockDate,
                    pages: templateWeek.pages
                })
            }

            // Copy zoom info
            const zoomInfo = await this.getZoomInfo(templateId)
            if (zoomInfo && (zoomInfo.url || zoomInfo.meetingId)) {
                await this.updateZoomInfo(newModule.id, zoomInfo)
            }

            return this.success({
                id: newModule.id,
                title: newModule.title,
                status: newModule.status,
                templateId: newModule.template_id,
                launchedAt: newModule.launched_at
            }, 'Module launched successfully')
        } catch (err) {
            return this.error('Failed to launch module: ' + err.message, 'LAUNCH_ERROR')
        }
    }

    async archiveModule(moduleId) {
        try {
            const module = await this.getModule(moduleId)
            if (!module) {
                return this.error('Module not found', 'NOT_FOUND')
            }

            if (module.status !== 'launched') {
                return this.error('Only launched modules can be archived', 'INVALID_STATUS')
            }

            return this.updateModule(moduleId, {
                status: 'archived',
                archivedAt: new Date().toISOString()
            })
        } catch (err) {
            return this.error('Failed to archive module: ' + err.message, 'ARCHIVE_ERROR')
        }
    }

    async restoreModule(moduleId) {
        try {
            const module = await this.getModule(moduleId)
            if (!module) {
                return this.error('Module not found', 'NOT_FOUND')
            }

            if (module.status !== 'archived') {
                return this.error('Only archived modules can be restored', 'INVALID_STATUS')
            }

            return this.updateModule(moduleId, {
                status: 'launched',
                archivedAt: null
            })
        } catch (err) {
            return this.error('Failed to restore module: ' + err.message, 'RESTORE_ERROR')
        }
    }

    async syncFromTemplate(activeModuleId) {
        try {
            const activeModule = await this.getModule(activeModuleId)
            if (!activeModule) {
                return this.error('Active module not found', 'NOT_FOUND')
            }

            if (activeModule.status !== 'launched') {
                return this.error('Can only sync launched modules', 'INVALID_STATUS')
            }

            if (!activeModule.templateId) {
                return this.error('Module has no linked template', 'NO_TEMPLATE')
            }

            const template = await this.getModule(activeModule.templateId)
            if (!template) {
                return this.error('Source template no longer exists', 'TEMPLATE_NOT_FOUND')
            }

            // Update module info
            await this.updateModule(activeModuleId, {
                title: template.title,
                description: template.description,
                instructor: template.instructor,
                duration: template.duration,
                participation: template.participation,
                timeExpectations: template.timeExpectations
            })

            // Sync zoom info
            const templateZoom = await this.getZoomInfo(activeModule.templateId)
            if (templateZoom && Object.keys(templateZoom).length > 0) {
                await this.updateZoomInfo(activeModuleId, templateZoom)
            }

            // Note: Week syncing is more complex - would need to preserve discussions
            // For now, only sync module-level info

            return this.success(null, 'Module synced from template successfully')
        } catch (err) {
            return this.error('Failed to sync from template: ' + err.message, 'SYNC_ERROR')
        }
    }

    /**
     * Sync content from a template to an active module
     * Preserves: discussions, student progress
     * Updates: module info, zoom info, week content (titles, descriptions, pages, questions, resources, videos)
     */
    async syncToActiveModule(templateId, activeModuleId) {
        try {
            const template = await this.getModule(templateId)
            if (!template) {
                return this.error('Template not found', 'NOT_FOUND')
            }

            if (template.status !== 'draft') {
                return this.error('Source must be a template (draft module)', 'INVALID_STATUS')
            }

            const activeModule = await this.getModule(activeModuleId)
            if (!activeModule) {
                return this.error('Active module not found', 'NOT_FOUND')
            }

            if (activeModule.status !== 'launched') {
                return this.error('Target must be a launched module', 'INVALID_STATUS')
            }

            // 1. Update module info (but preserve status, launchedAt, templateId)
            await this.updateModule(activeModuleId, {
                title: template.title,
                description: template.description,
                instructor: template.instructor,
                duration: template.duration,
                participation: template.participation,
                timeExpectations: template.timeExpectations
            })

            // 2. Sync zoom info
            const templateZoom = await this.getZoomInfo(templateId)
            if (templateZoom && Object.keys(templateZoom).length > 0) {
                await this.updateZoomInfo(activeModuleId, templateZoom)
            }

            // 3. Sync weeks - this is the complex part
            // We need to preserve discussions but update content
            const templateWeeks = await this.getWeeks(templateId)
            const activeWeeks = await this.getWeeks(activeModuleId)

            // Create a map of active weeks by week id (which is week_number) for easy lookup
            const activeWeekMap = new Map(activeWeeks.map(w => [w.id, w]))

            for (const templateWeek of templateWeeks) {
                const activeWeek = activeWeekMap.get(templateWeek.id)

                if (activeWeek) {
                    // Week exists in active module - update it while preserving discussions
                    await this.syncWeekContent(templateWeek, activeWeek, activeModuleId)
                } else {
                    // Week doesn't exist in active module - create it with same week_number
                    await this.createWeekWithNumber(activeModuleId, templateWeek.id, {
                        title: templateWeek.title,
                        description: templateWeek.description,
                        unlockDate: templateWeek.unlockDate,
                        pages: templateWeek.pages
                    })
                }
            }

            return this.success(null, 'Template synced to active module successfully')
        } catch (err) {
            console.error('Sync error:', err)
            return this.error('Failed to sync to active module: ' + err.message, 'SYNC_ERROR')
        }
    }

    /**
     * Sync week content from template to active week
     * Preserves discussions by not touching the questions table entries that have discussion_posts
     */
    async syncWeekContent(templateWeek, activeWeek, activeModuleId) {
        // Update week-level info (title, description, unlock date)
        const { error: weekUpdateError } = await supabase
            .from('weeks')
            .update({
                title: templateWeek.title,
                description: templateWeek.description,
                unlock_date: templateWeek.unlockDate
            })
            .eq('module_id', activeModuleId)
            .eq('week_number', activeWeek.id)

        if (weekUpdateError) {
            console.error('Error updating week:', weekUpdateError)
            throw weekUpdateError
        }

        // Get the week's actual DB ID first
        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', activeModuleId)
            .eq('week_number', activeWeek.id)
            .single()

        if (!weekRecord) {
            console.error('Could not find week record')
            return
        }

        const { data: activePagesData } = await supabase
            .from('pages')
            .select('id, page_number, type')
            .eq('week_id', weekRecord.id)
            .order('page_number', { ascending: true })

        const activePagesList = activePagesData || []

        // Process all pages in parallel for speed
        const pagePromises = templateWeek.pages.map(async (templatePage, i) => {
            const activePage = activePagesList[i]
            if (!activePage) return

            // Run page update, resources sync, and videos sync in parallel
            const [pageUpdateResult, , ] = await Promise.all([
                // Update page content
                supabase
                    .from('pages')
                    .update({
                        title: templatePage.title,
                        type: templatePage.type,
                        content: templatePage.content
                    })
                    .eq('id', activePage.id),

                // Sync resources - delete then insert
                (async () => {
                    await supabase.from('resources').delete().eq('page_id', activePage.id)
                    if (templatePage.resources && templatePage.resources.length > 0) {
                        const resources = templatePage.resources.map((r, idx) => ({
                            page_id: activePage.id,
                            title: r.title,
                            url: r.url || null,
                            description: r.description || null,
                            sort_order: idx
                        }))
                        await supabase.from('resources').insert(resources)
                    }
                })(),

                // Sync videos - delete then insert
                (async () => {
                    await supabase.from('videos').delete().eq('page_id', activePage.id)
                    if (templatePage.videos && templatePage.videos.length > 0) {
                        const videos = templatePage.videos.map((v, idx) => ({
                            page_id: activePage.id,
                            title: v.title,
                            url: v.url,
                            description: v.description || null,
                            sort_order: idx
                        }))
                        await supabase.from('videos').insert(videos)
                    }
                })()
            ])

            if (pageUpdateResult.error) {
                console.error('Error updating page:', pageUpdateResult.error)
            }

            // Sync questions - must be sequential to preserve discussions
            const { data: existingQuestions } = await supabase
                .from('questions')
                .select('id, question_number, text')
                .eq('page_id', activePage.id)
                .order('question_number', { ascending: true })

            const existingQList = existingQuestions || []
            const templateQuestions = templatePage.questions || []

            // Batch question updates/inserts
            const questionUpdates = []
            const questionInserts = []

            for (let qIdx = 0; qIdx < templateQuestions.length; qIdx++) {
                const templateQ = templateQuestions[qIdx]
                const existingQ = existingQList.find(q => q.question_number === qIdx + 1)

                if (existingQ) {
                    questionUpdates.push(
                        supabase
                            .from('questions')
                            .update({ text: templateQ.text })
                            .eq('id', existingQ.id)
                    )
                } else {
                    questionInserts.push({
                        page_id: activePage.id,
                        question_number: qIdx + 1,
                        text: templateQ.text
                    })
                }
            }

            // Run question updates in parallel, then batch insert new ones
            await Promise.all(questionUpdates)
            if (questionInserts.length > 0) {
                await supabase.from('questions').insert(questionInserts)
            }
        })

        await Promise.all(pagePromises)
    }

    // ==================== Week Operations ====================

    async getWeeks(moduleId) {
        const { data: weeks, error } = await supabase
            .from('weeks')
            .select(`
                *,
                pages (
                    *,
                    questions (*),
                    resources (*),
                    videos (*)
                )
            `)
            .eq('module_id', moduleId)
            .order('week_number', { ascending: true })

        if (error) {
            console.error('Error fetching weeks:', error)
            return []
        }

        // Map to expected format with nested pages
        return weeks.map(week => ({
            id: week.week_number,
            moduleId: week.module_id,
            title: week.title,
            description: week.description,
            unlockDate: week.unlock_date,
            createdAt: week.created_at,
            updatedAt: week.updated_at,
            pages: (week.pages || [])
                .sort((a, b) => a.page_number - b.page_number)
                .map(page => ({
                    title: page.title,
                    type: page.type,
                    content: page.content,
                    questions: (page.questions || [])
                        .sort((a, b) => a.question_number - b.question_number)
                        .map(q => ({ id: q.question_number, text: q.text })),
                    resources: (page.resources || [])
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(r => ({
                            id: r.id,
                            title: r.title,
                            url: r.url,
                            description: r.description
                        })),
                    videos: (page.videos || [])
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map(v => ({
                            id: v.id,
                            title: v.title,
                            url: v.url,
                            duration: v.duration
                        }))
                }))
        }))
    }

    async getWeek(moduleId, weekId) {
        const weeks = await this.getWeeks(moduleId)
        return weeks.find(w => w.id === weekId)
    }

    async getVisibleWeeks(moduleId) {
        const weeks = await this.getWeeks(moduleId)
        const today = new Date().toISOString().split('T')[0]

        return weeks.filter(week => {
            if (!week.unlockDate) return true
            return week.unlockDate <= today
        })
    }

    /**
     * Get count of visible weeks without fetching full week data (optimized)
     * Used for module cards where we just need a count
     */
    async getVisibleWeekCount(moduleId) {
        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('weeks')
            .select('week_number, unlock_date')
            .eq('module_id', moduleId)

        if (error || !data) return 0

        return data.filter(week => {
            if (!week.unlock_date) return true
            return week.unlock_date <= today
        }).length
    }

    /**
     * Batch get visible week counts for multiple modules (avoids N+1)
     * Returns a map of moduleId -> count
     */
    async getBatchVisibleWeekCounts(moduleIds) {
        if (!moduleIds || moduleIds.length === 0) return {}

        const today = new Date().toISOString().split('T')[0]

        const { data, error } = await supabase
            .from('weeks')
            .select('module_id, week_number, unlock_date')
            .in('module_id', moduleIds)

        if (error || !data) return {}

        // Group by module and count visible weeks
        const countMap = {}
        for (const moduleId of moduleIds) {
            countMap[moduleId] = 0
        }

        for (const week of data) {
            const isVisible = !week.unlock_date || week.unlock_date <= today
            if (isVisible) {
                countMap[week.module_id] = (countMap[week.module_id] || 0) + 1
            }
        }

        return countMap
    }

    async createWeek(moduleId, weekData) {
        try {
            // Get current max week number
            const { data: existingWeeks } = await supabase
                .from('weeks')
                .select('week_number')
                .eq('module_id', moduleId)
                .order('week_number', { ascending: false })
                .limit(1)

            const weekNumber = existingWeeks && existingWeeks.length > 0
                ? existingWeeks[0].week_number + 1
                : 1

            // Use upsert to handle race conditions - if another user just created this week_number,
            // we'll update it instead of creating a duplicate
            const { data: week, error: weekError } = await supabase
                .from('weeks')
                .upsert({
                    module_id: moduleId,
                    week_number: weekNumber,
                    title: weekData.title,
                    description: weekData.description || null,
                    unlock_date: weekData.unlockDate || null
                }, {
                    onConflict: 'module_id,week_number'
                })
                .select()
                .single()

            if (weekError) {
                // If upsert fails due to constraint violation, retry with next week number
                if (weekError.code === '23505') {
                    // Duplicate key - another user beat us, retry with incremented number
                    return this.createWeek(moduleId, weekData)
                }
                return this.error('Failed to create week: ' + weekError.message, 'CREATE_ERROR')
            }

            // Create pages if provided
            if (weekData.pages && weekData.pages.length > 0) {
                for (let i = 0; i < weekData.pages.length; i++) {
                    const pageData = weekData.pages[i]
                    await this.createPage(week.id, i + 1, pageData)
                }
            }

            return this.success({
                id: week.week_number,
                moduleId: week.module_id,
                title: week.title,
                description: week.description,
                unlockDate: week.unlock_date,
                createdAt: week.created_at
            }, 'Week created successfully')
        } catch (err) {
            return this.error('Failed to create week: ' + err.message, 'CREATE_ERROR')
        }
    }

    /**
     * Create a week with a specific week_number (used for syncing from template)
     */
    async createWeekWithNumber(moduleId, weekNumber, weekData) {
        try {
            const { data: week, error: weekError } = await supabase
                .from('weeks')
                .insert({
                    module_id: moduleId,
                    week_number: weekNumber,
                    title: weekData.title,
                    description: weekData.description || null,
                    unlock_date: weekData.unlockDate || null
                })
                .select()
                .single()

            if (weekError) {
                return this.error('Failed to create week: ' + weekError.message, 'CREATE_ERROR')
            }

            // Create pages if provided
            if (weekData.pages && weekData.pages.length > 0) {
                for (let i = 0; i < weekData.pages.length; i++) {
                    const pageData = weekData.pages[i]
                    await this.createPage(week.id, i + 1, pageData)
                }
            }

            return this.success({
                id: week.week_number,
                moduleId: week.module_id,
                title: week.title,
                description: week.description,
                unlockDate: week.unlock_date,
                createdAt: week.created_at
            }, 'Week created successfully')
        } catch (err) {
            return this.error('Failed to create week: ' + err.message, 'CREATE_ERROR')
        }
    }

    async createPage(weekId, pageNumber, pageData) {
        const { data: page, error: pageError } = await supabase
            .from('pages')
            .insert({
                week_id: weekId,
                page_number: pageNumber,
                title: pageData.title,
                type: pageData.type,
                content: pageData.content || null
            })
            .select()
            .single()

        if (pageError) {
            console.error('Error creating page:', pageError)
            return null
        }

        // Create questions
        if (pageData.questions && pageData.questions.length > 0) {
            const questions = pageData.questions.map((q, idx) => ({
                page_id: page.id,
                question_number: idx + 1,
                text: q.text
            }))
            await supabase.from('questions').insert(questions)
        }

        // Create resources
        if (pageData.resources && pageData.resources.length > 0) {
            const resources = pageData.resources.map((r, idx) => ({
                page_id: page.id,
                title: r.title,
                url: r.url || null,
                description: r.description || null,
                sort_order: idx
            }))
            await supabase.from('resources').insert(resources)
        }

        // Create videos
        if (pageData.videos && pageData.videos.length > 0) {
            const videos = pageData.videos.map((v, idx) => ({
                page_id: page.id,
                title: v.title,
                url: v.url,
                duration: v.duration || null,
                sort_order: idx
            }))
            await supabase.from('videos').insert(videos)
        }

        return page
    }

    async updateWeek(moduleId, weekId, updates) {
        try {
            // First get the actual week record
            const { data: weekRecord, error: fetchError } = await supabase
                .from('weeks')
                .select('id, updated_at')
                .eq('module_id', moduleId)
                .eq('week_number', weekId)
                .single()

            if (fetchError || !weekRecord) {
                return this.error('Week not found', 'NOT_FOUND')
            }

            // Optimistic locking: check if week was modified since user started editing
            if (updates.expectedUpdatedAt) {
                const expectedTime = new Date(updates.expectedUpdatedAt).getTime()
                const actualTime = new Date(weekRecord.updated_at).getTime()

                if (actualTime > expectedTime) {
                    return this.error(
                        'This week was modified by another user. Please reload and try again.',
                        'CONFLICT'
                    )
                }
            }

            // Update week basic info
            const dbUpdates = {}
            if (updates.title !== undefined) dbUpdates.title = updates.title
            if (updates.description !== undefined) dbUpdates.description = updates.description
            if (updates.unlockDate !== undefined) dbUpdates.unlock_date = updates.unlockDate

            if (Object.keys(dbUpdates).length > 0) {
                const { error: updateError } = await supabase
                    .from('weeks')
                    .update(dbUpdates)
                    .eq('id', weekRecord.id)

                if (updateError) {
                    return this.error('Failed to update week: ' + updateError.message, 'UPDATE_ERROR')
                }
            }

            // Update pages if provided - preserve discussions by updating in place
            if (updates.pages) {
                // Get existing pages
                const { data: existingPages } = await supabase
                    .from('pages')
                    .select('id, page_number, type')
                    .eq('week_id', weekRecord.id)
                    .order('page_number', { ascending: true })

                // Process all pages in parallel
                const pagePromises = updates.pages.map(async (pageData, i) => {
                    const pageNumber = i + 1
                    const existingPage = existingPages?.find(p => p.page_number === pageNumber)

                    if (existingPage) {
                        // Run page update, resources, and videos in parallel
                        await Promise.all([
                            // Update page content
                            supabase
                                .from('pages')
                                .update({
                                    title: pageData.title,
                                    type: pageData.type,
                                    content: pageData.content || null
                                })
                                .eq('id', existingPage.id),

                            // Sync resources
                            (async () => {
                                await supabase.from('resources').delete().eq('page_id', existingPage.id)
                                if (pageData.resources && pageData.resources.length > 0) {
                                    const resources = pageData.resources.map((r, idx) => ({
                                        page_id: existingPage.id,
                                        title: r.title,
                                        url: r.url || null,
                                        description: r.description || null,
                                        sort_order: idx
                                    }))
                                    await supabase.from('resources').insert(resources)
                                }
                            })(),

                            // Sync videos
                            (async () => {
                                await supabase.from('videos').delete().eq('page_id', existingPage.id)
                                if (pageData.videos && pageData.videos.length > 0) {
                                    const videos = pageData.videos.map((v, idx) => ({
                                        page_id: existingPage.id,
                                        title: v.title,
                                        url: v.url,
                                        duration: v.duration || null,
                                        sort_order: idx
                                    }))
                                    await supabase.from('videos').insert(videos)
                                }
                            })()
                        ])

                        // Handle questions (need existing data first)
                        if (pageData.questions) {
                            const { data: existingQuestions } = await supabase
                                .from('questions')
                                .select('id, question_number')
                                .eq('page_id', existingPage.id)
                                .order('question_number', { ascending: true })

                            const questionUpdates = []
                            const questionInserts = []

                            for (let qIdx = 0; qIdx < pageData.questions.length; qIdx++) {
                                const questionData = pageData.questions[qIdx]
                                const existingQ = existingQuestions?.find(q => q.question_number === qIdx + 1)

                                if (existingQ) {
                                    questionUpdates.push(
                                        supabase
                                            .from('questions')
                                            .update({ text: questionData.text })
                                            .eq('id', existingQ.id)
                                    )
                                } else {
                                    questionInserts.push({
                                        page_id: existingPage.id,
                                        question_number: qIdx + 1,
                                        text: questionData.text
                                    })
                                }
                            }

                            // Run updates in parallel, batch insert new ones
                            await Promise.all(questionUpdates)
                            if (questionInserts.length > 0) {
                                await supabase.from('questions').insert(questionInserts)
                            }

                            // Delete excess questions in parallel
                            if (existingQuestions && existingQuestions.length > pageData.questions.length) {
                                const deletePromises = existingQuestions
                                    .filter(q => q.question_number > pageData.questions.length)
                                    .map(eq => supabase.from('questions').delete().eq('id', eq.id))
                                await Promise.all(deletePromises)
                            }
                        }
                    } else {
                        // Create new page
                        await this.createPage(weekRecord.id, pageNumber, pageData)
                    }
                })

                await Promise.all(pagePromises)

                // Remove excess pages in parallel
                if (existingPages && existingPages.length > updates.pages.length) {
                    const deletePromises = existingPages
                        .filter(p => p.page_number > updates.pages.length)
                        .map(ep => supabase.from('pages').delete().eq('id', ep.id))
                    await Promise.all(deletePromises)
                }
            }

            return this.success(null, 'Week updated successfully')
        } catch (err) {
            return this.error('Failed to update week: ' + err.message, 'UPDATE_ERROR')
        }
    }

    async deleteWeek(moduleId, weekId) {
        try {
            // First, get all weeks with this week_number to check for duplicates
            const { data: matchingWeeks, error: fetchError } = await supabase
                .from('weeks')
                .select('id, week_number, title')
                .eq('module_id', moduleId)
                .eq('week_number', weekId)

            if (fetchError) {
                return this.error('Failed to find week: ' + fetchError.message, 'DELETE_ERROR')
            }

            if (!matchingWeeks || matchingWeeks.length === 0) {
                return this.error('Week not found', 'NOT_FOUND')
            }

            // If there are duplicates, only delete one (the first one found)
            // This prevents accidentally deleting multiple weeks
            const weekToDelete = matchingWeeks[0]

            const { error } = await supabase
                .from('weeks')
                .delete()
                .eq('id', weekToDelete.id)  // Use actual row ID, not week_number

            if (error) {
                return this.error('Failed to delete week: ' + error.message, 'DELETE_ERROR')
            }

            // Return info about whether there were duplicates
            const hadDuplicates = matchingWeeks.length > 1
            return this.success(
                { hadDuplicates, remainingDuplicates: matchingWeeks.length - 1 },
                hadDuplicates
                    ? `Week deleted. Note: ${matchingWeeks.length - 1} duplicate(s) still exist with the same week number.`
                    : 'Week deleted successfully'
            )
        } catch (err) {
            return this.error('Failed to delete week: ' + err.message, 'DELETE_ERROR')
        }
    }

    // ==================== Progress Operations ====================

    async savePagePosition(moduleId, weekId, pageNumber) {
        const userId = await getCurrentUserId()

        // Get week record ID
        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekRecord) {
            console.error('Week not found for progress save')
            return null
        }

        const { data, error } = await supabase
            .from('progress')
            .upsert({
                user_id: userId,
                week_id: weekRecord.id,
                current_page: pageNumber,
                completed: false
            }, {
                onConflict: 'user_id,week_id'
            })
            .select()
            .single()

        if (error) {
            console.error('Error saving page position:', error)
            return null
        }

        return { page: pageNumber, savedAt: data.updated_at }
    }

    async getPagePosition(moduleId, weekId) {
        const userId = await getCurrentUserId()

        // Get week record ID
        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekRecord) return null

        const { data, error } = await supabase
            .from('progress')
            .select('current_page, updated_at')
            .eq('user_id', userId)
            .eq('week_id', weekRecord.id)
            .single()

        if (error || !data) return null

        return { page: data.current_page, savedAt: data.updated_at }
    }

    async clearPagePosition(moduleId, weekId) {
        const userId = await getCurrentUserId()

        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekRecord) return

        await supabase
            .from('progress')
            .delete()
            .eq('user_id', userId)
            .eq('week_id', weekRecord.id)
    }

    async completeWeek(moduleId, weekId) {
        const userId = await getCurrentUserId()

        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekRecord) return false

        const { error } = await supabase
            .from('progress')
            .upsert({
                user_id: userId,
                week_id: weekRecord.id,
                completed: true,
                completed_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,week_id'
            })

        return !error
    }

    async isWeekCompleted(moduleId, weekId) {
        const userId = await getCurrentUserId()

        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekRecord) return false

        const { data } = await supabase
            .from('progress')
            .select('completed')
            .eq('user_id', userId)
            .eq('week_id', weekRecord.id)
            .single()

        return data?.completed || false
    }

    /**
     * Batch fetch progress for all weeks in a module (avoids N+1 queries)
     * Returns a map of weekNumber -> { page, completed }
     */
    async getBatchWeekProgress(moduleId) {
        const userId = await getCurrentUserId()
        if (!userId) return {}

        // Get all weeks with their progress in one query using a join
        const { data, error } = await supabase
            .from('weeks')
            .select(`
                week_number,
                progress!left (
                    current_page,
                    completed,
                    user_id
                )
            `)
            .eq('module_id', moduleId)

        if (error || !data) return {}

        // Build a map of weekNumber -> progress
        const progressMap = {}
        for (const week of data) {
            // Filter progress to current user (since we can't filter in the nested select easily)
            const userProgress = (week.progress || []).find(p => p.user_id === userId)
            progressMap[week.week_number] = {
                page: userProgress?.current_page || null,
                completed: userProgress?.completed || false
            }
        }

        return progressMap
    }

    // ==================== Zoom Operations ====================

    async getZoomInfo(moduleId) {
        try {
            // Use .maybeSingle() instead of .single() to avoid 406 error when no rows exist
            const { data, error } = await supabase
                .from('module_zoom_info')
                .select('*')
                .eq('module_id', moduleId)
                .maybeSingle()

            // No data is expected for modules without zoom info - not an error
            if (error) {
                // Only log if it's a real error, not just "no rows"
                if (error.code !== 'PGRST116') {
                    console.warn('Error fetching zoom info:', error.message)
                }
                return {}
            }

            if (!data) {
                return {}
            }

            return {
                url: data.url,
                meetingId: data.meeting_id,
                passcode: data.passcode,
                schedule: {
                    day: data.day,
                    time: data.time,
                    timezone: data.timezone
                }
            }
        } catch (err) {
            // Zoom info is optional, so don't log as error
            return {}
        }
    }

    async updateZoomInfo(moduleId, zoomData) {
        const { error } = await supabase
            .from('module_zoom_info')
            .upsert({
                module_id: moduleId,
                url: zoomData.url || null,
                meeting_id: zoomData.meetingId || null,
                passcode: zoomData.passcode || null,
                day: zoomData.schedule?.day || null,
                time: zoomData.schedule?.time || null,
                timezone: zoomData.schedule?.timezone || 'EST'
            }, {
                onConflict: 'module_id'
            })

        if (error) {
            console.error('Error updating zoom info:', error)
        }

        return zoomData
    }

    // ==================== Discussion Operations ====================

    async getDiscussionPosts(moduleId, weekId, pageIndex, questionId) {
        // Get the question ID using a single query with joins
        const { data: weekData } = await supabase
            .from('weeks')
            .select(`
                id,
                pages!inner (
                    id,
                    page_number,
                    questions!inner (
                        id,
                        question_number
                    )
                )
            `)
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekData) return []

        // Find the specific page and question
        const page = weekData.pages?.find(p => p.page_number === pageIndex + 1)
        if (!page) return []

        const question = page.questions?.find(q => q.question_number === questionId + 1)
        if (!question) return []

        // Get ALL posts for this question (both parent posts and replies) in ONE query
        const { data: allPosts, error } = await supabase
            .from('discussion_posts')
            .select('*, users:user_id(name, email, role)')
            .eq('question_id', question.id)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching discussion posts:', error)
            return []
        }

        // Separate parent posts and replies, then assemble the tree
        const parentPosts = allPosts.filter(p => !p.parent_id)
        const repliesMap = {}

        // Group replies by parent_id
        for (const post of allPosts) {
            if (post.parent_id) {
                if (!repliesMap[post.parent_id]) {
                    repliesMap[post.parent_id] = []
                }
                repliesMap[post.parent_id].push(post)
            }
        }

        // Helper to format a post/reply object
        const formatPost = (p) => {
            const user = p.users || {}
            return {
                id: p.id,
                userId: p.user_id,
                author: user.name || user.email || 'Anonymous',
                content: p.content,
                isAdmin: user.role === 'admin',
                isDeleted: p.is_deleted || false,
                createdAt: p.created_at,
                editedAt: p.edited_at,
                replies: []
            }
        }

        // Build final structure with 3 levels: post -> reply -> nested reply
        return parentPosts
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // newest first for parents
            .map(post => {
                const formattedPost = formatPost(post)
                const replies = repliesMap[post.id] || []

                formattedPost.replies = replies.map(reply => {
                    const formattedReply = formatPost(reply)
                    // Get nested replies (replies to this reply)
                    const nestedReplies = repliesMap[reply.id] || []
                    formattedReply.replies = nestedReplies.map(formatPost)
                    return formattedReply
                })

                return formattedPost
            })
    }

    async addDiscussionPost(moduleId, weekId, pageIndex, questionId, post) {
        // Get question ID
        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekRecord) throw new Error('Week not found')

        const { data: page } = await supabase
            .from('pages')
            .select('id')
            .eq('week_id', weekRecord.id)
            .eq('page_number', pageIndex + 1)
            .single()

        if (!page) throw new Error('Page not found')

        const { data: question } = await supabase
            .from('questions')
            .select('id')
            .eq('page_id', page.id)
            .eq('question_number', questionId + 1)
            .single()

        if (!question) throw new Error('Question not found')

        const userId = await getCurrentUserId()

        const { data, error } = await supabase
            .from('discussion_posts')
            .insert({
                question_id: question.id,
                user_id: userId,
                content: post.content
            })
            .select()
            .single()

        if (error) {
            throw new Error('Failed to add post: ' + error.message)
        }

        return {
            id: data.id,
            author: post.author || userId,
            content: data.content,
            isAdmin: isAdmin(),
            createdAt: data.created_at,
            replies: []
        }
    }

    async addReply(moduleId, weekId, pageIndex, questionId, postId, reply) {
        const userId = await getCurrentUserId()

        // Get question ID (needed for foreign key)
        const { data: weekRecord } = await supabase
            .from('weeks')
            .select('id')
            .eq('module_id', moduleId)
            .eq('week_number', weekId)
            .single()

        if (!weekRecord) throw new Error('Week not found')

        const { data: page } = await supabase
            .from('pages')
            .select('id')
            .eq('week_id', weekRecord.id)
            .eq('page_number', pageIndex + 1)
            .single()

        if (!page) throw new Error('Page not found')

        const { data: question } = await supabase
            .from('questions')
            .select('id')
            .eq('page_id', page.id)
            .eq('question_number', questionId + 1)
            .single()

        if (!question) throw new Error('Question not found')

        const { data, error } = await supabase
            .from('discussion_posts')
            .insert({
                question_id: question.id,
                user_id: userId,
                content: reply.content,
                parent_id: postId
            })
            .select()
            .single()

        if (error) {
            throw new Error('Failed to add reply: ' + error.message)
        }

        return {
            id: data.id,
            author: reply.author || userId,
            content: data.content,
            isAdmin: isAdmin(),
            createdAt: data.created_at
        }
    }

    async editDiscussionPost(moduleId, weekId, pageIndex, questionId, postId, newContent) {
        const { data, error } = await supabase
            .from('discussion_posts')
            .update({
                content: newContent,
                edited_at: new Date().toISOString()
            })
            .eq('id', postId)
            .select()
            .single()

        if (error) {
            throw new Error('Failed to edit post: ' + error.message)
        }

        return data
    }

    async editReply(moduleId, weekId, pageIndex, questionId, postId, replyId, newContent) {
        return this.editDiscussionPost(moduleId, weekId, pageIndex, questionId, replyId, newContent)
    }

    async deleteDiscussionPost(postId) {
        // Check if this post has any replies
        const { data: replies } = await supabase
            .from('discussion_posts')
            .select('id')
            .eq('parent_id', postId)
            .limit(1)

        if (replies && replies.length > 0) {
            // Soft delete - post has replies, just mark as deleted
            const { error } = await supabase
                .from('discussion_posts')
                .update({ is_deleted: true, content: '' })
                .eq('id', postId)

            if (error) {
                throw new Error('Failed to delete post: ' + error.message)
            }
        } else {
            // Hard delete - no replies, safe to remove
            const { error } = await supabase
                .from('discussion_posts')
                .delete()
                .eq('id', postId)

            if (error) {
                throw new Error('Failed to delete post: ' + error.message)
            }
        }

        return true
    }

    async deleteReply(replyId) {
        // Check if this reply has any nested replies
        const { data: nestedReplies } = await supabase
            .from('discussion_posts')
            .select('id')
            .eq('parent_id', replyId)
            .limit(1)

        if (nestedReplies && nestedReplies.length > 0) {
            // Soft delete - reply has nested replies
            const { error } = await supabase
                .from('discussion_posts')
                .update({ is_deleted: true, content: '' })
                .eq('id', replyId)

            if (error) {
                throw new Error('Failed to delete reply: ' + error.message)
            }
        } else {
            // Hard delete - no nested replies
            const { error } = await supabase
                .from('discussion_posts')
                .delete()
                .eq('id', replyId)

            if (error) {
                throw new Error('Failed to delete reply: ' + error.message)
            }
        }

        return true
    }

    // ==================== Response Operations ====================

    async saveResponse(moduleId, weekId, pageIndex, questionId, content) {
        // For now, responses are handled via discussion posts
        // This could be extended to have a separate responses table
        console.log('saveResponse not yet implemented for Supabase')
        return { content }
    }

    async getResponse(moduleId, weekId, pageIndex, questionId) {
        console.log('getResponse not yet implemented for Supabase')
        return null
    }

    // ==================== Draft Operations (localStorage fallback) ====================

    saveDraft(type, data) {
        // Include moduleId in key to prevent cross-module draft collisions
        const moduleId = this.getCurrentModuleId() || 'global'
        const key = `draft:${moduleId}:${type}`
        const draft = { ...data, savedAt: new Date().toISOString() }
        localStorage.setItem(key, JSON.stringify(draft))
        return draft
    }

    getDraft(type) {
        const moduleId = this.getCurrentModuleId() || 'global'
        const key = `draft:${moduleId}:${type}`
        const data = localStorage.getItem(key)
        return data ? JSON.parse(data) : null
    }

    deleteDraft(type) {
        const moduleId = this.getCurrentModuleId() || 'global'
        localStorage.removeItem(`draft:${moduleId}:${type}`)
        return true
    }
}

// Create global instance
const dataService = new DataServiceSupabase()

// Export for ES modules
export { DataServiceSupabase, dataService }

// Also attach to window for non-module scripts
window.dataService = dataService
