#!/usr/bin/env node
/**
 * Lectern Database Backup Script
 *
 * Exports all Supabase tables to a timestamped JSON file.
 * Optionally uploads to Cloudflare R2 if credentials are configured.
 *
 * Usage:
 *   node scripts/backup-db.js              # Local backup only
 *   node scripts/backup-db.js --upload     # Also upload to R2
 *
 * Environment variables (optional, for R2 upload):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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

// Tables to backup in order (respecting foreign key dependencies)
const TABLES = [
    'users',
    'modules',
    'module_zoom_info',
    'weeks',
    'pages',
    'questions',
    'resources',
    'videos',
    'enrollments',
    'progress',
    'discussion_posts',
    'error_logs'
]

/**
 * Generate timestamp string for filename
 */
function getTimestamp() {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const hh = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}-${hh}${min}${ss}`
}

/**
 * Export a single table
 */
async function exportTable(tableName) {
    console.log(`  Exporting ${tableName}...`)

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('id', { ascending: true })

    if (error) {
        // Some tables might be empty or have different structures
        if (error.code === 'PGRST116') {
            console.log(`    ${tableName}: empty or no access`)
            return []
        }
        console.error(`    Error exporting ${tableName}:`, error.message)
        return []
    }

    console.log(`    ${tableName}: ${data.length} rows`)
    return data
}

/**
 * Export all tables
 */
async function exportAllTables() {
    const backup = {
        metadata: {
            created_at: new Date().toISOString(),
            supabase_url: SUPABASE_URL,
            tables: TABLES,
            version: '1.0'
        },
        data: {}
    }

    console.log('Starting backup...\n')

    for (const table of TABLES) {
        backup.data[table] = await exportTable(table)
    }

    // Calculate totals
    const totalRows = Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0)
    backup.metadata.total_rows = totalRows

    console.log(`\nTotal: ${totalRows} rows across ${TABLES.length} tables`)

    return backup
}

/**
 * Save backup to local file
 */
function saveBackup(backup, filename) {
    const backupsDir = join(__dirname, '..', 'backups')

    // Create backups directory if it doesn't exist
    if (!existsSync(backupsDir)) {
        mkdirSync(backupsDir, { recursive: true })
    }

    const filepath = join(backupsDir, filename)
    writeFileSync(filepath, JSON.stringify(backup, null, 2))

    console.log(`\nBackup saved to: ${filepath}`)
    return filepath
}

/**
 * Upload to Cloudflare R2 (if configured)
 */
async function uploadToR2(filepath, filename) {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucketName = process.env.R2_BUCKET_NAME || 'lectern-backups'

    if (!accountId || !accessKeyId || !secretAccessKey) {
        console.log('\nR2 upload skipped (credentials not configured)')
        console.log('To enable R2 upload, set these environment variables:')
        console.log('  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
        return false
    }

    console.log(`\nUploading to R2 bucket: ${bucketName}...`)

    try {
        // Use AWS SDK for S3-compatible API
        const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
        const { readFileSync } = await import('fs')

        const s3 = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        })

        const fileContent = readFileSync(filepath)

        await s3.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: filename,
            Body: fileContent,
            ContentType: 'application/json'
        }))

        console.log(`Uploaded to R2: ${filename}`)
        return true
    } catch (err) {
        console.error('R2 upload failed:', err.message)
        return false
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2)
    const shouldUpload = args.includes('--upload')

    try {
        // Export all tables
        const backup = await exportAllTables()

        // Generate filename
        const timestamp = getTimestamp()
        const filename = `backup-${timestamp}.json`

        // Save locally
        const filepath = saveBackup(backup, filename)

        // Upload to R2 if requested
        if (shouldUpload) {
            await uploadToR2(filepath, filename)
        }

        console.log('\nBackup complete!')

        // Return backup info for programmatic use
        return {
            success: true,
            filename,
            filepath,
            metadata: backup.metadata
        }
    } catch (err) {
        console.error('\nBackup failed:', err.message)
        process.exit(1)
    }
}

// Run if called directly
main()
