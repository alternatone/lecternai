# LecternAI Architecture Documentation

## Overview

LecternAI is a seminary learning platform designed with a clean, scalable architecture that supports future web synchronization. The codebase follows professional best practices with clear separation of concerns and a well-defined data layer.

## Architecture Principles

1. **Separation of Concerns**: Data, business logic, and presentation are clearly separated
2. **Single Source of Truth**: Centralized data service manages all storage operations
3. **Future-Ready**: Built to easily transition from localStorage to backend API
4. **Consistent Patterns**: Standardized naming conventions and data structures
5. **Type Safety**: Clear schema definitions with validation
6. **Scalability**: Normalized database structure prevents data duplication

## Directory Structure

```
LecternAI/
├── index.html                 # Homepage (module selection, admin/student views)
├── module-overview.html       # Module template management and week listing
├── admin-module-edit.html     # Module settings editing (admin)
├── admin-week-edit.html       # Week content editing (admin)
├── week-viewer.html           # Week content viewing (student/preview)
├── module-access.html         # Active module viewing (admin read-only + discussions)
├── week-access.html           # Week access with discussion participation (admin)
├── module-archive.html        # Archived module viewer (read-only)
├── clear-data.html            # Data management utility
│
├── js/                        # JavaScript modules
│   ├── db-schema.js          # Database schema definitions
│   ├── data-service.js       # Centralized data access layer
│   ├── validation.js         # Data validation utilities
│   └── [future: api-client.js, state-manager.js]
│
├── css/
│   └── styles.css            # Global styles
│
├── docs/
│   ├── ARCHITECTURE.md       # This file
│   ├── API.md               # API documentation (future)
│   └── MIGRATION.md         # Migration guide (future)
│
└── [future: tests/, config/, migrations/]
```

## Data Architecture

### Entity Relationship Diagram

```
User (1) ──────< (N) UserProgress (N) ────── (1) Week
                                                │
Module (1) ────< (N) Week (1) ───────< (N) Resource
                          │
                          └───────< (N) Question (1) ───< (N) Response
```

### Core Entities

1. **User** - User profiles and preferences
2. **Module** - Course modules with metadata
3. **Week** - Weekly content within modules
4. **Resource** - Learning materials (readings, videos)
5. **Question** - Reflection and discussion questions
6. **UserProgress** - Student progress tracking
7. **Response** - Student answers and discussions
8. **Draft** - Temporary unsaved work

### Storage Keys Convention

All localStorage keys follow a consistent pattern:

```javascript
// User data
user:current
user:preferences

// Module data
modules                          // Array of all modules
module:{id}                      // Single module data
module:{id}:weeks               // Weeks for this module
module:{id}:zoom                // Zoom info for this module

// Week data
week:{id}:progress              // Progress for this week
week:{id}:completed             // Completion status

// Responses
response:week:{weekId}:question:{qId}
discussion:week:{weekId}:question:{qId}

// Drafts
draft:module
draft:week
draft:response:week:{weekId}

// UI state
currentView                      // student | teacher
currentModuleId                  // Currently selected module
```

## Data Service Layer

The `DataService` class provides a consistent API for all data operations:

### Module Operations
- `getModules()` - Get all modules
- `getModule(id)` - Get single module
- `createModule(data)` - Create new module
- `updateModule(id, updates)` - Update module
- `deleteModule(id)` - Delete module

### Week Operations
- `getWeeks(moduleId)` - Get all weeks for module
- `getWeek(moduleId, weekId)` - Get single week
- `createWeek(moduleId, data)` - Create new week
- `updateWeek(moduleId, weekId, updates)` - Update week
- `deleteWeek(moduleId, weekId)` - Delete week

### Progress Operations
- `getProgress(weekId)` - Get progress for week
- `updateProgress(weekId, data)` - Update progress
- `completeWeek(weekId)` - Mark week as complete
- `isWeekCompleted(weekId)` - Check completion status

### Draft Operations
- `saveDraft(type, data)` - Save draft
- `getDraft(type)` - Get draft
- `deleteDraft(type)` - Delete draft

## Data Flow

### Creating a Module Template (Admin)

```
index.html (Admin View)
    ↓ [User clicks "New Module Template"]
    ↓ [Fills out form]
    ↓ [Clicks "Save & Close"]
dataService.createModule(moduleData)
    ↓ [Validates data]
    ↓ [Generates ID]
    ↓ [Saves to localStorage: "modules"]
    ↓ [Initializes module storage: "module:{id}:weeks"]
    ↓ [Returns new module object]
    ↓ [Redirects to module-overview.html]
```

### Editing Week Content (Admin)

```
admin-week-edit.html
    ↓ [Loads week from URL param]
loadWeekContent()
    ↓ dataService.getWeek(moduleId, weekId)
    ↓ [Populates form fields]
    ↓ [User edits content]
    ↓ [Clicks "Save Week"]
saveWeek()
    ↓ dataService.updateWeek(moduleId, weekId, weekData)
    ↓ [Validates data]
    ↓ [Updates localStorage: "module:{id}:weeks"]
    ↓ [Shows success message]
```

### Viewing Week (Student/Preview)

```
week-viewer.html?week={id}&page={num}
    ↓ [Loads week and page from URL]
loadWeekData()
    ↓ dataService.getWeek(moduleId, weekId)
    ↓ [Gets page data from week.pages array]
renderPage()
    ↓ [Renders content based on page type]
    ↓ [Loads discussion posts if needed]
    ↓ [Tracks progress]
    ↓ dataService.updateProgress(weekId, progressData)
```

## Page Types

Weeks contain an array of pages with different types:

1. **discussion** - Reflection questions with text input
2. **intro** - Introduction text with videos
3. **reading** - List of reading resources
4. **video** - Video playlist

Each page type has a specific rendering function in week-viewer.html.

## State Management

### Current State (localStorage)

- Module list in memory
- Current view (student/admin)
- Current module ID
- Progress per week
- Draft content

### Future State (Backend Sync)

- User authentication state
- Real-time collaboration
- Offline-first with sync queue
- Conflict resolution

## Validation

All data is validated before storage using the `Validator` class:

```javascript
const result = Validator.validateModule(moduleData);
if (!result.valid) {
    console.error('Validation errors:', result.errors);
    return;
}
```

## Migration Strategy

### Phase 1: Current (localStorage only)
- Single-user, local storage
- Manual backup/restore via export
- ✅ Currently implemented

### Phase 2: Backend API Integration
- RESTful API endpoints matching data service methods
- JWT authentication
- Multi-user support
- Real-time updates via WebSockets

### Phase 3: Advanced Features
- Collaborative editing
- Rich media uploads
- Analytics and reporting
- Mobile app support

## API Endpoint Design (Future)

```
GET    /api/v1/modules                  → List modules
POST   /api/v1/modules                  → Create module
GET    /api/v1/modules/:id              → Get module
PUT    /api/v1/modules/:id              → Update module
DELETE /api/v1/modules/:id              → Delete module

GET    /api/v1/modules/:id/weeks        → List weeks
POST   /api/v1/modules/:id/weeks        → Create week
GET    /api/v1/weeks/:id                → Get week
PUT    /api/v1/weeks/:id                → Update week
DELETE /api/v1/weeks/:id                → Delete week

GET    /api/v1/weeks/:id/progress       → Get progress
PUT    /api/v1/weeks/:id/progress       → Update progress

GET    /api/v1/discussions/:weekId/:qId → Get posts
POST   /api/v1/discussions/:weekId/:qId → Add post
```

## Security Considerations

### Current
- XSS prevention via HTML sanitization
- Input validation
- No sensitive data in localStorage

### Future (Backend)
- JWT authentication
- HTTPS only
- Rate limiting
- Input sanitization server-side
- SQL injection prevention
- CSRF protection

## Performance Optimization

### Current
- Lazy loading of week content
- Debounced auto-save for drafts
- Minimal DOM manipulation

### Future
- Code splitting
- Image lazy loading
- Service worker for offline support
- CDN for static assets
- Database indexing
- Caching strategy

## Testing Strategy (Future)

```
tests/
├── unit/
│   ├── data-service.test.js
│   ├── validation.test.js
│   └── ...
├── integration/
│   ├── module-creation.test.js
│   ├── week-editing.test.js
│   └── ...
└── e2e/
    ├── admin-workflow.test.js
    ├── student-workflow.test.js
    └── ...
```

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- localStorage API required
- ES6+ JavaScript
- No legacy IE support

## Contributing

When adding new features:

1. Update schema in `db-schema.js`
2. Add data service methods in `data-service.js`
3. Add validation in `validation.js`
4. Update this documentation
5. Follow existing naming conventions
6. Test with sample data

## Questions or Issues?

Contact the development team or file an issue in the repository.
