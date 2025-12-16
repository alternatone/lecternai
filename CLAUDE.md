# LecternAI - Current Status Summary

## What is Lectern?
A seminary learning management system for Aquinas Institute. Module-based courses with weekly content, discussions, and progress tracking.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (no build tools)
- **Backend**: Supabase (PostgreSQL)
- **Hosting**: Cloudflare Pages
- **Local Dev**: `python3 -m http.server 8080`

## Current State (Dec 2024)

### What's Working
- Full auth flow: signup → pending approval → admin approves → active user
- Role-based access: admins see all, students see enrolled modules only
- Template system: create draft modules, launch as active copies
- Template sync: update active modules from template changes (parallelized for speed)
- Week content: intro pages, reading materials, videos, discussion questions
- Discussions: threaded posts with replies
- Progress tracking: page position, week completion
- Concurrent editing protection: optimistic locking prevents overwrites
- Locked weeks: students see all weeks but can't access until unlock date

### Key User Flows
1. **Admin creates content**: Create template (draft) → add weeks/pages → launch module
2. **Admin manages users**: Approve pending signups, assign roles, manage enrollments
3. **Student learning**: View enrolled modules → navigate weeks → participate in discussions
4. **Template updates**: Edit template → sync to active modules (preserves discussions)

### Recent Fixes (Pre-Demo)
- Parallelized database saves (much faster)
- Fixed sync function (weeks now sync correctly)
- Fixed restore button, pending page flash, various UI bugs
- Added editable title for active modules (for multiple sections)
- Locked weeks now visible to students with disabled "View Week" button

## Key Files

### Pages
| File | Purpose |
|------|---------|
| `index.html` | Homepage, module listing |
| `module-overview.html` | Module details, week list, edit modal |
| `week-viewer.html` | Week content viewer |
| `admin-week-edit.html` | Week content editor |
| `admin-users.html` | User approval/management |
| `admin-enrollments.html` | Assign students to modules |

### JavaScript
| File | Purpose |
|------|---------|
| `js/data-service-supabase.js` | All database operations |
| `js/auth.js` | Auth guards, user management |
| `js/supabase-client.js` | Supabase connection |

## Database Tables
- `users` - accounts with status (pending/active) and role (admin/student)
- `modules` - courses with status (draft/launched/archived)
- `weeks` - weekly content (linked to module)
- `pages` - page content within weeks
- `questions`, `resources`, `videos` - page content items
- `discussion_posts` - threaded discussions
- `progress` - student progress tracking
- `enrollments` - student-module assignments

## Module Statuses
- **draft**: Template, admin-only, editable
- **launched**: Active module, visible to enrolled students, has `templateId` linking to source
- **archived**: Read-only, preserved for reference

## Known Issues / TODO
- 406 errors appearing in console for zoom info requests (not blocking functionality)
- Email confirmation disabled in Supabase (4/hour limit on free tier)

## Local Development
```bash
cd ~/lectern
python3 -m http.server 8080
# Open http://localhost:8080
```

## Deployment
```bash
cd ~/lectern
CLOUDFLARE_API_TOKEN=<token> npx wrangler pages deploy . --project-name=lectern --commit-dirty=true
```

## Supabase
- Project URL: https://kfsmfllzcumvzsbufwgt.supabase.co
- Dashboard for user management, data inspection, SQL queries
