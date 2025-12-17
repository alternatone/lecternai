# Lectern Security Audit Report
**Date:** December 2024
**Branch:** lectern-beta

## Executive Summary

This audit covers schema security, RLS policies, XSS protection, and code vulnerabilities for the Lectern LMS beta deployment.

---

## 1. Database Schema Security

### Tables with RLS Enabled (in schema.sql)
All 11 tables have RLS enabled:
- users
- modules
- module_zoom_info
- weeks
- pages
- questions
- resources
- videos
- enrollments
- progress
- discussion_posts

### RLS Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| users | Own profile + Admin sees all | Own signup | Own profile + Admin | - |
| modules | Admin: all, Student: enrolled launched/archived | Admin only | Admin only | Admin only |
| module_zoom_info | Admin + enrolled students | Admin only | Admin only | Admin only |
| weeks | Admin + enrolled modules | Admin only | Admin only | Admin only |
| pages | Admin + enrolled modules | Admin only | Admin only | Admin only |
| questions | Admin + enrolled modules | Admin only | Admin only | Admin only |
| resources | Admin + enrolled modules | Admin only | Admin only | Admin only |
| videos | Admin + enrolled modules | Admin only | Admin only | Admin only |
| enrollments | Admin: all, Student: own | Admin only | - | Admin only |
| progress | Admin: all, Student: own | Own only | Own only | - |
| discussion_posts | Enrolled in module | Enrolled in module | Own only | Own only |

### Security Verification Checklist
- [x] Students can only see modules they're enrolled in
- [x] Students can only update their own progress
- [x] Only admins can create/edit modules, weeks, pages
- [x] Discussion posts scoped correctly (enrolled can see, only author can edit/delete)
- [x] All tables have RLS enabled

---

## 2. XSS Vulnerability Analysis

### CRITICAL: Discussion Post Content Rendering

**Location:** `week-viewer.html` lines 525, 583

**Issue:** `RichText.toHTML(post.content)` returns raw HTML if content already contains HTML tags. This bypasses sanitization.

**Risk:** An attacker could inject malicious HTML/JS into discussion posts:
```html
<img src=x onerror="alert('XSS')">
<svg onload="alert('XSS')">
```

**Fix Required:** Modify `RichText.toHTML()` to always sanitize output, or use a dedicated sanitizer like DOMPurify.

### Partially Mitigated Areas
- `cleanPastedHTML()` removes `<script>` tags but doesn't prevent event handler injection (onclick, onerror, etc.)
- Plain text content is properly escaped in `formatText()`
- Edit textareas use `escapeHtml()` correctly

### Recommended Fix
1. Add DOMPurify library for HTML sanitization
2. Modify `RichText.toHTML()` to sanitize all HTML output
3. Sanitize content on save (server-side via Supabase function) AND on render (client-side)

---

## 3. Input Validation Audit

### data-service-supabase.js
- **Raw SQL:** None found - all queries use Supabase JS client (parameterized)
- **Input validation:** Limited - mostly relies on database constraints

### Validation Gaps
1. No length limits enforced in JS before sending to DB
2. No URL validation for resource/video URLs
3. Discussion post content not validated for max length

### Recommendations
1. Add client-side validation before DB operations
2. Add database-level CHECK constraints for max lengths
3. Validate URLs match expected patterns

---

## 4. Authentication & Session Security

### Current State
- Using Supabase Auth (secure)
- Session managed by Supabase client
- No custom token handling (good)

### Recommendations for Beta
1. **Rate limiting:** Configure in Supabase Auth settings (recommended: 60 requests/hour for login attempts)
2. **Session timeout:** Current default is reasonable, suggest 7 days for convenience
3. **Password requirements:** Configure minimum 8 characters in Supabase

---

## 5. Code Audit Findings

### API Keys Exposure
- **Anon key in js/supabase-client.js:** Expected and acceptable (public key)
- **Anon key in seed-data.html:** Expected and acceptable
- **No service role keys exposed:** Good

### Hardcoded URLs (need updating for beta)
- [x] js/supabase-client.js - Updated to beta
- [x] seed-data.html - Updated to beta

### Console.log Statements
Several debug statements exist that could leak info:
- `data-service-supabase.js` has error logging (acceptable for debugging)
- No sensitive data logged

---

## 6. Required Actions (Priority Order)

### P0 - Critical (Fix Before Beta)
1. **XSS in discussion posts** - Add HTML sanitization to `RichText.toHTML()`

### P1 - High (Fix Soon)
2. Add DOMPurify or equivalent sanitization library
3. Configure Supabase auth rate limiting

### P2 - Medium (Beta Improvements)
4. Add input validation for max lengths
5. Add URL validation for resources
6. Review and test all RLS policies manually

### P3 - Low (Future)
7. Add CSP headers via Cloudflare
8. Add audit logging for admin actions
9. Implement session activity timeout

---

## 7. Schema Migration Instructions

Run the following in Supabase SQL Editor for the beta project:

1. Copy contents of `schema.sql`
2. Execute in SQL Editor
3. Verify tables exist: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
4. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`

---

## Appendix: Files Reviewed
- js/data-service-supabase.js
- js/supabase-client.js
- js/auth.js
- js/rich-text.js
- week-viewer.html
- module-overview.html
- admin-week-edit.html
- seed-data.html
- schema.sql (created)
