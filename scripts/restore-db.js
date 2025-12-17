#!/usr/bin/env node
/**
 * Lectern Database Restore Script
 *
 * Restores data from a backup JSON file to Supabase.
 * WARNING: This will overwrite existing data!
 *
 * Usage:
 *   node scripts/restore-db.js backups/backup-2024-01-14-120000.json
 *   node scripts/restore-db.js backups/backup-2024-01-14-120000.json --dry-run
 *   node scripts/restore-db.js backups/backup-2024-01-14-120000.json --force
 *
 * Options:
 *   --dry-run   Show what would be restored without making changes
 *   --force     Skip confirmation prompt
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { createInterface } from 'readline'

// Supabase configuration - loaded from environment variables
// Set these before running:
//   export SUPABASE_URL="https://your-project.supabase.co"
//   export SUPABASE_SERVICE_KEY="your-service-role-key"
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required')
    console.error('Set them before running:')
    console.error('  export SUPABASE_URL="https://your-project.supabase.co"')
    console.error('  export SUPABASE_SERVICE_KEY="your-service-role-key"')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Tables to restore in order (respecting foreign key dependencies)
// Order matters: parent tables first, then child tables
const RESTORE_ORDER = [
    'users',           // No dependencies
    'modules',         // No dependencies (template_id is self-ref)
    'module_zoom_info', // Depends on modules
    'weeks',           // Depends on modules
    'pages',           // Depends on weeks
    'questions',       // Depends on pages
    'resources',       // Depends on pages
    'videos',          // Depends on pages
    'enrollments',     // Depends on users, modules
    'progress',        // Depends on users, weeks
    'discussion_posts' // Depends on questions, users (parent_id is self-ref)
    // Note: error_logs not restored by default (fresh start)
]

// Tables to clear in reverse order (child tables first)
const CLEAR_ORDER = [...RESTORE_ORDER].reverse()

/**
 * Prompt user for confirmation
 */
async function confirm(message) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return new Promise((resolve) => {
        rl.question(`${message} (yes/no): `, (answer) => {
            rl.close()
            resolve(answer.toLowerCase() === 'yes')
        })
    })
}

/**
 * Clear a table
 */
async function clearTable(tableName, dryRun = false) {
    console.log(`  Clearing ${tableName}...`)

    if (dryRun) {
        console.log(`    [DRY RUN] Would delete all rows from ${tableName}`)
        return true
    }

    // Use delete with a condition that matches all rows
    const { error } = await supabase
        .from(tableName)
        .delete()
        .gte('id', 0) // This matches all rows

    if (error) {
        console.error(`    Error clearing ${tableName}:`, error.message)
        return false
    }

    return true
}

/**
 * Restore a single table
 */
async function restoreTable(tableName, data, dryRun = false) {
    if (!data || data.length === 0) {
        console.log(`  ${tableName}: 0 rows (skipping)`)
        return true
    }

    console.log(`  Restoring ${tableName}: ${data.length} rows...`)

    if (dryRun) {
        console.log(`    [DRY RUN] Would insert ${data.length} rows into ${tableName}`)
        return true
    }

    // Insert in batches to avoid request size limits
    const BATCH_SIZE = 100
    let inserted = 0

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE)

        const { error } = await supabase
            .from(tableName)
            .insert(batch)

        if (error) {
            console.error(`    Error restoring ${tableName} (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error.message)
            // Continue with next batch
        } else {
            inserted += batch.length
        }
    }

    console.log(`    Inserted ${inserted}/${data.length} rows`)
    return inserted === data.length
}

/**
 * Load and validate backup file
 */
function loadBackup(filepath) {
    if (!existsSync(filepath)) {
        throw new Error(`Backup file not found: ${filepath}`)
    }

    const content = readFileSync(filepath, 'utf-8')
    const backup = JSON.parse(content)

    // Validate backup structure
    if (!backup.metadata || !backup.data) {
        throw new Error('Invalid backup file: missing metadata or data')
    }

    if (!backup.metadata.version) {
        throw new Error('Invalid backup file: missing version')
    }

    return backup
}

/**
 * Main restore function
 */
async function restore(filepath, options = {}) {
    const { dryRun = false, force = false } = options

    console.log('\n========================================')
    console.log('LECTERN DATABASE RESTORE')
    console.log('========================================\n')

    if (dryRun) {
        console.log('*** DRY RUN MODE - No changes will be made ***\n')
    }

    // Load backup
    console.log(`Loading backup: ${filepath}`)
    const backup = loadBackup(filepath)

    // Show backup info
    console.log('\nBackup information:')
    console.log(`  Created: ${backup.metadata.created_at}`)
    console.log(`  Version: ${backup.metadata.version}`)
    console.log(`  Total rows: ${backup.metadata.total_rows}`)
    console.log(`  Tables: ${backup.metadata.tables.join(', ')}`)

    // Show row counts per table
    console.log('\nData to restore:')
    for (const table of RESTORE_ORDER) {
        const rows = backup.data[table]?.length || 0
        console.log(`  ${table}: ${rows} rows`)
    }

    // Confirm unless --force
    if (!force && !dryRun) {
        console.log('\n⚠️  WARNING: This will DELETE ALL EXISTING DATA and restore from backup!')

        const confirmed = await confirm('Are you sure you want to proceed?')
        if (!confirmed) {
            console.log('Restore cancelled.')
            process.exit(0)
        }
    }

    // Phase 1: Clear existing data
    console.log('\n--- Phase 1: Clearing existing data ---\n')
    for (const table of CLEAR_ORDER) {
        await clearTable(table, dryRun)
    }

    // Phase 2: Restore data
    console.log('\n--- Phase 2: Restoring data ---\n')
    let success = true
    for (const table of RESTORE_ORDER) {
        const tableSuccess = await restoreTable(table, backup.data[table], dryRun)
        if (!tableSuccess) success = false
    }

    // Summary
    console.log('\n========================================')
    if (dryRun) {
        console.log('DRY RUN COMPLETE - No changes were made')
    } else if (success) {
        console.log('RESTORE COMPLETE')
    } else {
        console.log('RESTORE COMPLETED WITH ERRORS')
    }
    console.log('========================================\n')

    return success
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2)

    // Parse arguments
    const filepath = args.find(arg => !arg.startsWith('--'))
    const dryRun = args.includes('--dry-run')
    const force = args.includes('--force')

    if (!filepath) {
        console.log('Usage: node scripts/restore-db.js <backup-file> [options]')
        console.log('')
        console.log('Options:')
        console.log('  --dry-run   Show what would be restored without making changes')
        console.log('  --force     Skip confirmation prompt')
        console.log('')
        console.log('Example:')
        console.log('  node scripts/restore-db.js backups/backup-2024-01-14-120000.json')
        process.exit(1)
    }

    try {
        const success = await restore(filepath, { dryRun, force })
        process.exit(success ? 0 : 1)
    } catch (err) {
        console.error('\nRestore failed:', err.message)
        process.exit(1)
    }
}

// Run if called directly
main()
