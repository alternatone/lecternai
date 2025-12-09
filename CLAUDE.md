# CLAUDE.md - LecternAI Project Context

## Project Overview
LecternAI is a seminary learning platform for the Aquinas Institute. It provides module-based learning with weekly content, video integration, discussions, and progress tracking.

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (ES Modules, no build tools)
- **Backend**: Supabase (PostgreSQL database)
- **Server**: Python HTTP server for local development (`python3 -m http.server 8000`)

## Key Files

### Core Pages
- `index.html` - Homepage with module listing (student/admin views)
- `module-overview.html` - Module details and week listing (handles all module statuses)
- `week-viewer.html` - Week content viewer (used by both student and admin)
- `admin-week-edit.html` - Admin-only week content editing
- `module-archive.html` - Admin-only archived module viewer

### Data Layer
- `js/data-service.js` - Central data service for all localStorage operations
- `js/db-schema.js` - Database schema definitions
- `js/validation.js` - Input validation utilities

### Styles
- `styles.css` - Global styles with CSS variables

## Data Layer - Supabase (Phase 2B Migration Complete)

### Backend
- **Database**: Supabase (PostgreSQL)
- **Project URL**: https://kfsmfllzcumvzsbufwgt.supabase.co
- **Client**: js/supabase-client.js
- **Data Service**: js/data-service-supabase.js (async API)

### Key Files
- `js/supabase-client.js` - Supabase connection and auth helpers
- `js/data-service-supabase.js` - All async database operations
- `seed-data.html` - Tool to seed test data to Supabase

### Database Tables
- `users` - User accounts
- `modules` - Course modules (status: draft/launched/archived)
- `module_zoom_info` - Zoom meeting info per module
- `weeks` - Week content within modules (pages stored as JSONB)
- `enrollments` - Student enrollments in modules
- `progress` - Student page positions and completion status
- `discussion_posts` - Discussion thread posts with replies

### Local Storage (still used for)
```javascript
`currentModuleId` - Currently selected module (session state)
`currentView` - 'student' or 'admin' (session state)
`draft:*` - Unsaved form drafts (auto-save feature)
```

## View System
- **Student View**: Read-only module access, can participate in discussions, progress tracking
- **Admin View**: Full edit access, module/week creation, can participate in discussions

### View Toggle Behavior
The `setView(view, fromToggle)` function handles view switching:
- `fromToggle=false` (page load): Stay on current page, just update UI
- `fromToggle=true` (button click): Redirect to index.html for student view

## Module Statuses
- `draft` - Template, not visible to students
- `launched` - Active, visible to students (has `templateId` linking to source)
- `archived` - Read-only, preserved for reference

## Template → Active Module Sync
Launched modules maintain a `templateId` reference to their source template. Admins can sync updates from the template to active modules.

### How it works
- **Button**: "Update Active Module" appears on module-overview.html for launched modules (admin view)
- **Method**: `dataService.syncFromTemplate(activeModuleId)`

### What gets synced
- Module info: title, description, instructor, duration, participation, timeExpectations
- Week content: title, description, pages (questions, resources, videos)
- Zoom info: url, meetingId, passcode, schedule

### What is preserved
- Student discussions (stored in separate localStorage keys)
- Student progress and page positions
- Week completion status
- Extra weeks added to active module (if template has fewer weeks)

## Week Structure
Each week has 5+ pages with types:
- `discussion` - Opening/closing reflection questions with threaded discussions
- `intro` - Introduction with videos
- `reading` - Resources and materials

## Common Tasks

### Kill and restart server
```bash
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill; python3 -m http.server 8000
```

### Clear test data
Visit: http://localhost:8000/clear-data.html

## Important Conventions
- All discussion posts use `dataService.getDiscussionPosts()` and `dataService.addDiscussionPost()`
- Progress is saved via `dataService.savePagePosition()`
- Week completion via `dataService.completeWeek()`
- Always use `dataService.getCurrentModuleId()` for module context

## Recent Fixes to Remember
- Student view redirect: Use `fromToggle` parameter to distinguish page load vs button click
- Discussion storage: Unified to use dataService methods (not week.discussions array)
- Progress status: Any saved pagePosition means "In Progress" (not just page > 1)

## Phase 2A Cleanup (Dec 2024)
Deleted dead code before Supabase migration:
- Removed `admin-module-edit.html` (dead scheduling board feature)
- Removed `week-access.html` (was just a redirect)
- Removed `module-access.html` (consolidated into module-overview.html)
- Removed duplicate zoom modal and dead zoom functions from module-overview.html
- Fixed `clearPagePosition()` bug (was calling non-existent `this.delete()`)
- Fixed direct localStorage calls in admin-week-edit.html to use dataService

## Phase 2B Supabase Migration (Dec 2024)
Migrated from localStorage to Supabase PostgreSQL:
- Created `js/supabase-client.js` for database connection
- Created `js/data-service-supabase.js` with async API matching old sync interface
- Converted all HTML pages to ES Modules with async/await
- All dataService methods now async (use `await dataService.getModules()` etc.)
- Session state (currentModuleId, currentView, drafts) still in localStorage
- Database tables: modules, weeks, progress, discussion_posts, etc.
