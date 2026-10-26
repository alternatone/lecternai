/**
 * Demo client for Lectern
 *
 * A localStorage-backed stand-in for the subset of supabase-js the app uses
 * (query builder, nested selects, auth). Lets the app run as a static site
 * with sample data and no backend — used for the public GitHub Pages demo.
 */

import { buildDemoData, DEMO_ACCOUNTS } from './demo-data.js'

const DB_KEY = 'lectern-demo-db'
const SESSION_KEY = 'lectern-demo-session'

// Column defaults (mirrors schema.sql) — every row gets every column
const SCHEMA = {
    users: { email: null, name: null, role: 'student', status: 'pending' },
    modules: { title: null, description: null, instructor: null, duration: null, participation: null, time_expectations: null, status: 'draft', template_id: null, launched_at: null, archived_at: null },
    module_zoom_info: { module_id: null, url: null, meeting_id: null, passcode: null, day: null, time: null, timezone: 'EST' },
    weeks: { module_id: null, week_number: null, title: null, description: null, unlock_date: null },
    pages: { week_id: null, page_number: null, title: null, type: null, content: null },
    questions: { page_id: null, question_number: 1, text: null },
    resources: { page_id: null, title: null, url: null, description: null, sort_order: 0 },
    videos: { page_id: null, title: null, url: null, description: null, duration: null, sort_order: 0 },
    enrollments: { user_id: null, module_id: null },
    progress: { user_id: null, week_id: null, current_page: 1, completed: false, completed_at: null },
    discussion_posts: { question_id: null, user_id: null, parent_id: null, content: null, is_deleted: false, edited_at: null },
    error_logs: { user_id: null, error_type: null, error_message: null, stack_trace: null, page_url: null, user_agent: null, additional_context: null }
}

const UNIQUE = {
    module_zoom_info: [['module_id']],
    weeks: [['module_id', 'week_number']],
    pages: [['week_id', 'page_number']],
    enrollments: [['user_id', 'module_id']],
    progress: [['user_id', 'week_id']]
}

// child table -> [[column, parent table, on delete]]
const FOREIGN_KEYS = {
    modules: [['template_id', 'modules', 'set null']],
    module_zoom_info: [['module_id', 'modules', 'cascade']],
    weeks: [['module_id', 'modules', 'cascade']],
    pages: [['week_id', 'weeks', 'cascade']],
    questions: [['page_id', 'pages', 'cascade']],
    resources: [['page_id', 'pages', 'cascade']],
    videos: [['page_id', 'pages', 'cascade']],
    enrollments: [['user_id', 'users', 'cascade'], ['module_id', 'modules', 'cascade']],
    progress: [['user_id', 'users', 'cascade'], ['week_id', 'weeks', 'cascade']],
    discussion_posts: [['question_id', 'questions', 'cascade'], ['user_id', 'users', 'cascade'], ['parent_id', 'discussion_posts', 'cascade']],
    error_logs: [['user_id', 'users', 'set null']]
}

// ==================== Storage ====================

function loadDb() {
    try {
        const raw = localStorage.getItem(DB_KEY)
        if (raw) return JSON.parse(raw)
    } catch (e) { /* fall through to reseed */ }
    return seedDb()
}

function saveDb(db) {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db))
    } catch (e) {
        console.warn('[demo] could not persist demo data:', e)
    }
}

function seedDb() {
    const db = { tables: {}, seq: {} }
    for (const table of Object.keys(SCHEMA)) {
        db.tables[table] = []
        db.seq[table] = 0
    }
    const seed = buildDemoData()
    for (const [table, rows] of Object.entries(seed)) {
        for (const row of rows) insertRow(db, table, row)
    }
    saveDb(db)
    return db
}

export function resetDemoData() {
    localStorage.removeItem(DB_KEY)
    seedDb()
}

const now = () => new Date().toISOString()

function insertRow(db, table, row) {
    const rows = db.tables[table]
    if (!rows) throw dbError('42P01', `relation "${table}" does not exist`)

    const record = { ...SCHEMA[table], ...row }
    if (record.id === undefined || record.id === null) record.id = ++db.seq[table]
    else if (typeof record.id === 'number') db.seq[table] = Math.max(db.seq[table], record.id)
    if (table === 'error_logs') record.timestamp ??= now()
    else if (table === 'enrollments') record.enrolled_at ??= now()
    else record.created_at ??= now()
    if (table !== 'enrollments' && table !== 'error_logs') record.updated_at ??= now()

    checkUnique(db, table, record)
    rows.push(record)
    return record
}

function checkUnique(db, table, record, ignore = null) {
    for (const cols of UNIQUE[table] || []) {
        const clash = db.tables[table].find(r => r !== ignore && cols.every(c => r[c] == record[c]))
        if (clash) {
            throw dbError('23505', `duplicate key value violates unique constraint "${table}_${cols.join('_')}_key"`)
        }
    }
}

function deleteRows(db, table, doomed) {
    if (!doomed.length) return
    const ids = new Set(doomed.map(r => r.id))
    db.tables[table] = db.tables[table].filter(r => !ids.has(r.id))

    for (const [child, fks] of Object.entries(FOREIGN_KEYS)) {
        for (const [col, parent, onDelete] of fks) {
            if (parent !== table) continue
            const affected = db.tables[child].filter(r => ids.has(r[col]))
            if (onDelete === 'cascade') deleteRows(db, child, affected)
            else affected.forEach(r => { r[col] = null })
        }
    }
}

function dbError(code, message) {
    const err = new Error(message)
    err.code = code
    err.details = null
    err.hint = null
    return err
}

// ==================== Select parsing / embedding ====================

// Parses "id, pages!inner(id, questions(*)), users:user_id(name)" into a tree
function parseSelect(str) {
    const items = []
    let depth = 0, token = ''
    const s = (str || '*').replace(/\s+/g, '')
    for (const ch of s) {
        if (ch === '(') depth++
        if (ch === ')') depth--
        if (ch === ',' && depth === 0) { items.push(token); token = '' }
        else token += ch
    }
    if (token) items.push(token)

    return items.map(item => {
        const open = item.indexOf('(')
        if (open === -1) return { col: item }
        let head = item.slice(0, open)
        const inner = item.slice(open + 1, -1)
        let alias = null
        if (head.includes(':')) [alias, head] = head.split(':')
        const isInner = head.endsWith('!inner')
        head = head.replace(/!.*$/, '')
        return { embed: head, alias: alias || head, inner: isInner, children: parseSelect(inner) }
    })
}

function project(db, table, row, fields) {
    const out = {}
    const all = fields.some(f => f.col === '*')
    if (all) Object.assign(out, row)

    for (const f of fields) {
        if (f.col) {
            if (f.col !== '*') out[f.col] = row[f.col]
            continue
        }
        if (f.embed.endsWith('_id')) {
            // Many-to-one: alias names the target table, embed is the FK column
            const target = (db.tables[f.alias] || []).find(r => r.id == row[f.embed])
            out[f.alias] = target ? project(db, f.alias, target, f.children) : null
        } else {
            // One-to-many: child rows reference this table via <singular>_id
            const fk = table.replace(/s$/, '') + '_id'
            out[f.alias] = (db.tables[f.embed] || [])
                .filter(r => r[fk] == row.id)
                .map(r => project(db, f.embed, r, f.children))
                .filter(r => !innerEmpty(r, f.children))
        }
    }
    return out
}

function innerEmpty(row, fields) {
    return fields.some(f => f.inner && Array.isArray(row[f.alias]) && row[f.alias].length === 0)
}

// ==================== Query builder ====================

function likeToRegex(pattern) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp('^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i')
}

class DemoQuery {
    constructor(table) {
        this.table = table
        this.op = 'select'
        this.columns = '*'
        this.countMode = null
        this.head = false
        this.returning = false
        this.filters = []
        this.orders = []
        this.limitN = null
        this.rangeAB = null
        this.singleMode = null
    }

    select(columns = '*', opts = {}) {
        this.columns = columns
        if (this.op === 'select') {
            this.countMode = opts.count || null
            this.head = !!opts.head
        } else {
            this.returning = true
        }
        return this
    }

    insert(rows) { this.op = 'insert'; this.payload = rows; return this }
    update(values) { this.op = 'update'; this.payload = values; return this }
    delete() { this.op = 'delete'; return this }
    upsert(rows, opts = {}) {
        this.op = 'upsert'
        this.payload = rows
        this.conflictCols = (opts.onConflict || 'id').split(',').map(c => c.trim())
        return this
    }

    where(fn) { this.filters.push(fn); return this }
    eq(col, val) { return this.where(r => r[col] == val) }
    neq(col, val) { return this.where(r => r[col] != val) }
    gt(col, val) { return this.where(r => r[col] > val) }
    gte(col, val) { return this.where(r => r[col] >= val) }
    lt(col, val) { return this.where(r => r[col] < val) }
    lte(col, val) { return this.where(r => r[col] <= val) }
    in(col, vals) { return this.where(r => vals.some(v => v == r[col])) }
    is(col, val) { return this.where(r => (val === null ? r[col] == null : r[col] === val)) }
    ilike(col, pattern) { const re = likeToRegex(pattern); return this.where(r => re.test(String(r[col] ?? ''))) }
    like(col, pattern) { return this.ilike(col, pattern) }
    match(obj) { Object.entries(obj).forEach(([c, v]) => this.eq(c, v)); return this }
    filter(col, op, val) { return this[op] ? this[op](col, val) : this }

    order(col, { ascending = true } = {}) { this.orders.push([col, ascending]); return this }
    limit(n) { this.limitN = n; return this }
    range(from, to) { this.rangeAB = [from, to]; return this }
    single() { this.singleMode = 'single'; return this }
    maybeSingle() { this.singleMode = 'maybe'; return this }

    then(resolve, reject) {
        return Promise.resolve().then(() => this.execute()).then(resolve, reject)
    }

    execute() {
        const db = loadDb()
        try {
            const result = this.run(db)
            if (this.op !== 'select') saveDb(db)
            return result
        } catch (err) {
            return { data: null, error: err, count: null, status: 400 }
        }
    }

    matching(db) {
        const rows = db.tables[this.table]
        if (!rows) throw dbError('42P01', `relation "${this.table}" does not exist`)
        return rows.filter(r => this.filters.every(f => f(r)))
    }

    run(db) {
        let rows
        switch (this.op) {
            case 'select':
                rows = this.matching(db)
                break
            case 'insert':
                rows = [].concat(this.payload).map(r => insertRow(db, this.table, r))
                break
            case 'upsert':
                rows = [].concat(this.payload).map(r => {
                    const existing = db.tables[this.table].find(x => this.conflictCols.every(c => x[c] == r[c]))
                    if (!existing) return insertRow(db, this.table, r)
                    Object.assign(existing, r)
                    if ('updated_at' in existing) existing.updated_at = now()
                    return existing
                })
                break
            case 'update':
                rows = this.matching(db)
                for (const row of rows) {
                    const next = { ...row, ...this.payload }
                    checkUnique(db, this.table, next, row)
                    Object.assign(row, this.payload)
                    if ('updated_at' in row) row.updated_at = now()
                }
                break
            case 'delete':
                rows = this.matching(db)
                deleteRows(db, this.table, rows)
                break
        }

        if (this.op !== 'select' && !this.returning) {
            return { data: null, error: null, count: null, status: 204 }
        }

        for (const [col, asc] of [...this.orders].reverse()) {
            rows = [...rows].sort((a, b) => {
                if (a[col] == b[col]) return 0
                if (a[col] == null) return 1
                if (b[col] == null) return -1
                return (a[col] < b[col] ? -1 : 1) * (asc ? 1 : -1)
            })
        }

        const count = this.countMode ? rows.length : null
        if (this.rangeAB) rows = rows.slice(this.rangeAB[0], this.rangeAB[1] + 1)
        if (this.limitN !== null) rows = rows.slice(0, this.limitN)

        const fields = parseSelect(this.columns)
        let data = rows.map(r => project(db, this.table, r, fields))
            .filter(r => !innerEmpty(r, fields))
        data = JSON.parse(JSON.stringify(data)) // callers must not mutate stored rows

        if (this.head) return { data: null, error: null, count, status: 200 }

        if (this.singleMode) {
            if (data.length === 1) return { data: data[0], error: null, count, status: 200 }
            if (data.length === 0 && this.singleMode === 'maybe') return { data: null, error: null, count, status: 200 }
            const err = dbError('PGRST116', 'JSON object requested, multiple (or no) rows returned')
            return { data: null, error: err, count, status: 406 }
        }
        return { data, error: null, count, status: 200 }
    }
}

// ==================== Auth ====================

function sessionUser() {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const profile = loadDb().tables.users.find(u => u.id === id)
    if (!profile) return null
    return { id: profile.id, email: profile.email, user_metadata: { name: profile.name } }
}

function sessionFor(user) {
    return user ? { user, access_token: 'demo', token_type: 'bearer' } : null
}

const auth = {
    async getUser() {
        return { data: { user: sessionUser() }, error: null }
    },
    async getSession() {
        return { data: { session: sessionFor(sessionUser()) }, error: null }
    },
    async signInWithPassword({ email }) {
        const profile = loadDb().tables.users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase())
        if (!profile) {
            return { data: { user: null, session: null }, error: dbError('invalid_credentials', 'Invalid login credentials') }
        }
        localStorage.setItem(SESSION_KEY, profile.id)
        const user = sessionUser()
        return { data: { user, session: sessionFor(user) }, error: null }
    },
    async signUp({ email, options }) {
        const db = loadDb()
        if (db.tables.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { data: { user: null, session: null }, error: dbError('user_already_exists', 'User already registered') }
        }
        // Mirrors the handle_new_user trigger
        const profile = insertRow(db, 'users', {
            id: crypto.randomUUID(),
            email,
            name: options?.data?.name || null
        })
        saveDb(db)
        localStorage.setItem(SESSION_KEY, profile.id)
        const user = sessionUser()
        return { data: { user, session: sessionFor(user) }, error: null }
    },
    async signOut() {
        localStorage.removeItem(SESSION_KEY)
        return { error: null }
    },
    async resetPasswordForEmail() {
        return { data: {}, error: null }
    },
    async updateUser() {
        return { data: { user: sessionUser() }, error: null }
    },
    onAuthStateChange(callback) {
        const user = sessionUser()
        if (user) setTimeout(() => callback('PASSWORD_RECOVERY', sessionFor(user)), 0)
        return { data: { subscription: { unsubscribe() {} } } }
    }
}

// ==================== Banner / login ====================

function renderBanner() {
    if (document.getElementById('demo-banner')) return
    const banner = document.createElement('div')
    banner.id = 'demo-banner'
    banner.style.cssText = 'position:sticky;top:0;z-index:10000;display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center;justify-content:center;padding:.5rem 1rem;background:#2f4f4f;color:#fff;font:14px/1.4 system-ui,sans-serif;text-align:center'
    banner.innerHTML = '<span><strong>Demo mode</strong> — sample data, stored only in your browser</span>'
    const reset = document.createElement('button')
    reset.textContent = 'Reset Demo Data'
    reset.style.cssText = 'padding:.25rem .75rem;border:1px solid #fff;border-radius:4px;background:transparent;color:#fff;cursor:pointer;font:inherit'
    reset.onclick = () => {
        if (!confirm('Reset all demo data to the original sample content?')) return
        resetDemoData()
        location.href = 'index.html'
    }
    banner.appendChild(reset)
    document.body.prepend(banner)
}

// Replaces the login form with one-click demo logins
function renderDemoLogin() {
    const form = document.getElementById('login-form')
    if (!form) return
    const buttons = document.createElement('div')
    buttons.style.cssText = 'display:flex;flex-direction:column;gap:.75rem'
    for (const [label, account] of [['Log in as Student', DEMO_ACCOUNTS.student], ['Log in as Admin', DEMO_ACCOUNTS.admin]]) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'auth-btn'
        btn.textContent = label
        btn.onclick = async () => {
            await auth.signInWithPassword({ email: account.email })
            location.href = 'index.html'
        }
        buttons.appendChild(btn)
    }
    // Hide rather than remove: login.html's own script still binds to the form
    form.hidden = true
    form.before(buttons)
    document.querySelector('a[href="forgot-password.html"]')?.parentElement.remove()
    document.querySelector('.auth-footer')?.remove()
}

function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn)
    else fn()
}

// ==================== Client ====================

export function createDemoClient() {
    // First visit: seed sample data (visitors then pick a role on the login page)
    if (!localStorage.getItem(DB_KEY)) resetDemoData()

    onReady(renderBanner)
    onReady(renderDemoLogin)

    return {
        from: table => new DemoQuery(table),
        auth
    }
}
