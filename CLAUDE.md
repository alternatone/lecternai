# CLAUDE.md - LecternAI Project Context

## Project Overview
LecternAI is a seminary learning platform for the Aquinas Institute. It provides module-based learning with weekly content, video integration, discussions, and progress tracking.

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (no build tools)
- **Storage**: localStorage (no backend database)
- **Server**: Python HTTP server for local development (`python3 -m http.server 8000`)

## Key Files

### Core Pages
- `index.html` - Homepage with module listing (student/admin views)
- `module-overview.html` - Module details and week listing
- `week-viewer.html` - **Primary week viewing page** (used by both student and admin)
- `week-access.html` - Redirects to week-viewer.html (deprecated)

### Data Layer
- `js/data-service.js` - Central data service for all localStorage operations
- `js/db-schema.js` - Database schema definitions
- `js/validation.js` - Input validation utilities

### Styles
- `styles.css` - Global styles with CSS variables

## Data Storage Patterns

### Module-scoped keys
```javascript
`module:${moduleId}:weeks` - Week data for a module
`module:${moduleId}:week:${weekId}:pagePosition` - Student's saved page position
`module:${moduleId}:week:${weekId}:completed` - Week completion status
```

### Discussion storage
```javascript
`discussion:module:${moduleId}:week:${weekId}:page:${pageIndex}:question:${questionId}`
```

### Global keys
```javascript
`modules` - Array of all modules
`currentModuleId` - Currently selected module
`currentView` - 'student' or 'admin'
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
