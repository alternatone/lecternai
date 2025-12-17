# Lectern Scheduled Backup Worker

Cloudflare Worker that automatically backs up the Lectern Supabase database to R2 storage on a daily schedule.

## Features

- **Scheduled backups**: Runs daily at 2:00 AM UTC via cron trigger
- **R2 storage**: Saves backups to Cloudflare R2 (S3-compatible)
- **Automatic cleanup**: Keeps last 7 backups, deletes older ones
- **Manual trigger**: HTTP endpoint for on-demand backups
- **Backup listing**: API to list all available backups

## Setup Instructions

### 1. Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Logged into Cloudflare (`wrangler login`)

### 2. Create R2 Bucket

```bash
cd workers/scheduled-backup
npx wrangler r2 bucket create lectern-backups
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Secrets

You need to set three secrets for the worker:

```bash
# Your Supabase project URL
npx wrangler secret put SUPABASE_URL
# Enter: https://your-project.supabase.co

# Supabase service role key (from Project Settings > API)
npx wrangler secret put SUPABASE_SERVICE_KEY
# Enter: your-service-role-key

# A strong random string for API authentication
npx wrangler secret put ADMIN_API_KEY
# Enter: (generate a random string, e.g., using: openssl rand -hex 32)
```

### 5. Deploy

```bash
npm run deploy
```

## API Endpoints

### Health Check
```
GET /health
```
Returns worker status. No authentication required.

### List Backups
```
GET /backups
Authorization: Bearer YOUR_ADMIN_API_KEY
```
Returns list of all backups with metadata.

### Trigger Manual Backup
```
POST /trigger
Authorization: Bearer YOUR_ADMIN_API_KEY
```
Creates a backup immediately.

### Download Backup
```
GET /download/:filename
Authorization: Bearer YOUR_ADMIN_API_KEY
```
Downloads a specific backup file.

## Local Development

```bash
# Start local dev server (note: cron triggers won't work locally)
npm run dev

# View live logs from deployed worker
npm run tail
```

## Monitoring

After deployment, you can monitor the worker in the Cloudflare dashboard:
1. Go to Workers & Pages
2. Select "lectern-scheduled-backup"
3. View logs, metrics, and cron trigger history

## Backup Format

Backups are stored as JSON files with the naming convention:
```
backup-YYYY-MM-DD-HHMMSS.json
```

Each backup contains:
```json
{
  "metadata": {
    "created_at": "2025-01-15T02:00:00.000Z",
    "supabase_url": "https://xxx.supabase.co",
    "tables": ["users", "modules", ...],
    "version": "1.0",
    "source": "cloudflare-worker"
  },
  "data": {
    "users": [...],
    "modules": [...],
    ...
  }
}
```

## Troubleshooting

### Backup fails with authentication error
- Verify SUPABASE_SERVICE_KEY is the **service role** key (not the anon key)
- Check the key hasn't been rotated in Supabase dashboard

### R2 bucket not found
- Ensure bucket was created: `npx wrangler r2 bucket list`
- Bucket name in wrangler.toml must match created bucket

### Cron not triggering
- Check worker deployment status in Cloudflare dashboard
- View cron trigger history under worker settings
- Triggers may take up to 1 minute from scheduled time
