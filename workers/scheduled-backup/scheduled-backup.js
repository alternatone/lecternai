/**
 * Lectern Scheduled Backup Worker
 *
 * Cloudflare Worker that runs on a cron schedule to backup Supabase data to R2.
 * Keeps the last 7 daily backups and deletes older ones.
 *
 * Required environment variables (set in wrangler.toml or Cloudflare dashboard):
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_KEY: Service role key (bypasses RLS)
 * - R2_BUCKET: R2 bucket binding name (configured in wrangler.toml)
 */

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
    'discussion_posts'
    // Note: error_logs excluded from backups - not critical data
];

const MAX_BACKUPS = 7; // Keep last 7 daily backups

export default {
    /**
     * Scheduled handler - runs on cron trigger
     */
    async scheduled(event, env, ctx) {
        console.log('Starting scheduled backup...');

        try {
            const backup = await createBackup(env);
            const filename = `backup-${getTimestamp()}.json`;

            // Save to R2
            await env.BACKUP_BUCKET.put(filename, JSON.stringify(backup, null, 2), {
                httpMetadata: {
                    contentType: 'application/json',
                },
                customMetadata: {
                    created: new Date().toISOString(),
                    tables: TABLES.length.toString(),
                    totalRows: Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0).toString()
                }
            });

            console.log(`Backup saved: ${filename}`);

            // Clean up old backups
            await cleanupOldBackups(env);

            console.log('Scheduled backup completed successfully');
        } catch (error) {
            console.error('Backup failed:', error);
            // Optionally: send alert notification here
            throw error;
        }
    },

    /**
     * HTTP handler - allows manual trigger via HTTP request
     * Protected by checking for admin auth header
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Health check endpoint
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // List backups endpoint
        if (url.pathname === '/backups') {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || authHeader !== `Bearer ${env.ADMIN_API_KEY}`) {
                return new Response('Unauthorized', { status: 401 });
            }

            const backups = await listBackups(env);
            return new Response(JSON.stringify(backups, null, 2), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Manual backup trigger endpoint
        if (url.pathname === '/trigger' && request.method === 'POST') {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || authHeader !== `Bearer ${env.ADMIN_API_KEY}`) {
                return new Response('Unauthorized', { status: 401 });
            }

            try {
                const backup = await createBackup(env);
                const filename = `backup-${getTimestamp()}.json`;

                await env.BACKUP_BUCKET.put(filename, JSON.stringify(backup, null, 2), {
                    httpMetadata: {
                        contentType: 'application/json',
                    },
                    customMetadata: {
                        created: new Date().toISOString(),
                        tables: TABLES.length.toString(),
                        totalRows: Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0).toString(),
                        manual: 'true'
                    }
                });

                await cleanupOldBackups(env);

                return new Response(JSON.stringify({
                    success: true,
                    filename,
                    tables: TABLES.length,
                    totalRows: Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0)
                }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (error) {
                return new Response(JSON.stringify({
                    success: false,
                    error: error.message
                }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Download backup endpoint
        if (url.pathname.startsWith('/download/')) {
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || authHeader !== `Bearer ${env.ADMIN_API_KEY}`) {
                return new Response('Unauthorized', { status: 401 });
            }

            const filename = url.pathname.replace('/download/', '');
            const object = await env.BACKUP_BUCKET.get(filename);

            if (!object) {
                return new Response('Backup not found', { status: 404 });
            }

            return new Response(object.body, {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${filename}"`
                }
            });
        }

        return new Response('Lectern Backup Worker\n\nEndpoints:\n- GET /health - Health check\n- GET /backups - List backups (requires auth)\n- POST /trigger - Manual backup (requires auth)\n- GET /download/:filename - Download backup (requires auth)', {
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};

/**
 * Create a full backup of all tables
 */
async function createBackup(env) {
    const backup = {
        metadata: {
            created_at: new Date().toISOString(),
            supabase_url: env.SUPABASE_URL,
            tables: TABLES,
            version: '1.0',
            source: 'cloudflare-worker'
        },
        data: {}
    };

    for (const table of TABLES) {
        console.log(`Exporting table: ${table}`);

        const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*`, {
            headers: {
                'apikey': env.SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to export ${table}: ${error}`);
            throw new Error(`Failed to export ${table}: ${response.status}`);
        }

        const data = await response.json();
        backup.data[table] = data;
        console.log(`  ${table}: ${data.length} rows`);
    }

    return backup;
}

/**
 * List all backups in the R2 bucket
 */
async function listBackups(env) {
    const listed = await env.BACKUP_BUCKET.list({ prefix: 'backup-' });

    return listed.objects.map(obj => ({
        name: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        ...obj.customMetadata
    })).sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
}

/**
 * Delete backups older than MAX_BACKUPS
 */
async function cleanupOldBackups(env) {
    const listed = await env.BACKUP_BUCKET.list({ prefix: 'backup-' });

    // Sort by upload date, newest first
    const sorted = listed.objects.sort((a, b) =>
        new Date(b.uploaded) - new Date(a.uploaded)
    );

    // Delete backups beyond MAX_BACKUPS
    if (sorted.length > MAX_BACKUPS) {
        const toDelete = sorted.slice(MAX_BACKUPS);
        console.log(`Cleaning up ${toDelete.length} old backups...`);

        for (const obj of toDelete) {
            console.log(`  Deleting: ${obj.key}`);
            await env.BACKUP_BUCKET.delete(obj.key);
        }
    }
}

/**
 * Generate timestamp string for backup filename
 */
function getTimestamp() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}
