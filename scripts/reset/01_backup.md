# SINC Production Database & Storage Backup Guide

This document contains exact, non-destructive, read-only commands for the operator to take a complete local backup of the **Production Supabase** project before running any data reset.

> [!CRITICAL]
> **DO NOT PROCEED WITH THE DATA RESET WITHOUT A COMPLETE, VERIFIED LOCAL BACKUP.**
> Store backup files outside the git repository (e.g. `~/sinc-backups/` or a secure external drive) to avoid accidentally committing sensitive data.

---

## 1. Prerequisites & Environment Setup

Obtain your Supabase database connection string or Project Reference ID from the Supabase Dashboard:
- **Project Ref**: `Project Settings -> General -> Reference ID`
- **Database Direct / Pooled URI**: `Project Settings -> Database -> Connection string -> URI`

In your terminal (PowerShell, Bash, or Zsh):

```bash
# Set your production database connection URI (replace with actual credentials)
# Direct connection (port 5432) or Session pooler (port 5432) recommended for dumps
export PROD_DB_URL="postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Create a local backup directory outside the repository
mkdir -p ~/sinc-backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/sinc-backups/$(date +%Y%m%d_%H%M%S)
cd "$BACKUP_DIR"
```

*(On Windows PowerShell):*
```powershell
$BACKUP_DIR = "$HOME\sinc-backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Force -Path $BACKUP_DIR
Set-Location $BACKUP_DIR
$env:PROD_DB_URL = "postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
```

---

## 2. PostgreSQL Dumps (via `pg_dump` or Supabase CLI)

### Option A: Using `pg_dump` (Recommended for direct control)

#### 2.1 Schema-Only Dump (DDL: tables, types, triggers, RLS, functions)
```bash
pg_dump "$PROD_DB_URL" \
  --schema-only \
  --schema=public \
  --quote-all-identifiers \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_DIR/01_prod_schema.sql"
```

#### 2.2 Data-Only Dump (All table records)
```bash
pg_dump "$PROD_DB_URL" \
  --data-only \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --quote-all-identifiers \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_DIR/02_prod_data.sql"
```

#### 2.3 Full Combined Binary Dump (Best for point-in-time restore with `pg_restore`)
```bash
pg_dump "$PROD_DB_URL" \
  --format=custom \
  --schema=public \
  --schema=auth \
  --schema=storage \
  --file="$BACKUP_DIR/03_prod_full_custom.dump"
```

---

### Option B: Using Supabase CLI (if project is linked)

If you have Supabase CLI logged in and linked (`supabase link --project-ref [PROJECT_REF]`):

```bash
# Schema dump
supabase db dump --project-ref [PROJECT_REF] --schema-only -f "$BACKUP_DIR/01_prod_schema.sql"

# Data dump (public schema)
supabase db dump --project-ref [PROJECT_REF] --data-only --schema public -f "$BACKUP_DIR/02_prod_data_public.sql"

# Data dump (auth schema)
supabase db dump --project-ref [PROJECT_REF] --data-only --schema auth -f "$BACKUP_DIR/02_prod_data_auth.sql"

# Data dump (storage schema)
supabase db dump --project-ref [PROJECT_REF] --data-only --schema storage -f "$BACKUP_DIR/02_prod_data_storage.sql"
```

---

## 3. Storage Bucket Asset Backup

SINC user upload files reside in the following Supabase Storage buckets:
- `post-media` (Post attachments, photos, videos)
- `updates-media` (24-hour expiring updates/stories media)

### Option A: Node.js Automated Bucket Downloader (No extra CLI required)

Run this quick inline Node script from your project root to download all objects locally into your backup folder:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const backupDir = process.env.BACKUP_DIR || path.join(process.env.HOME || process.env.USERPROFILE, 'sinc-backups', 'storage');

if (!url || !key) {
  console.error('Error: SUPABASE_URL and SUPABASE_SECRET_KEY environment variables required.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const buckets = ['post-media', 'updates-media'];

async function downloadAll() {
  for (const b of buckets) {
    const dest = path.join(backupDir, b);
    fs.mkdirSync(dest, { recursive: true });
    console.log('Downloading bucket:', b);
    const { data: files, error } = await supabase.storage.from(b).list('', { limit: 1000 });
    if (error) { console.error('Failed listing', b, error.message); continue; }
    console.log('Found', files.length, 'objects in', b);
    for (const f of files) {
      if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
      const { data, error: downErr } = await supabase.storage.from(b).download(f.name);
      if (downErr) { console.error('Download error:', f.name, downErr.message); continue; }
      const buf = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(path.join(dest, f.name), buf);
      console.log('Saved:', f.name, '(' + buf.length + ' bytes)');
    }
  }
}
downloadAll();
"
```

### Option B: Supabase CLI / S3 API

If S3-compatible credentials are enabled in Supabase Storage settings (`Project Settings -> Storage -> S3 Access Keys`):
```bash
aws s3 sync s3://[PROJECT_REF]-post-media "$BACKUP_DIR/storage/post-media" --endpoint-url https://[PROJECT_REF].supabase.co/storage/v1/s3
aws s3 sync s3://[PROJECT_REF]-updates-media "$BACKUP_DIR/storage/updates-media" --endpoint-url https://[PROJECT_REF].supabase.co/storage/v1/s3
```

---

## 4. Verification Checklist Before Resetting

Ensure each generated backup file exists and has non-zero size:

```bash
# Check SQL file sizes
ls -lh "$BACKUP_DIR"

# Verify SQL dump contains expected table definitions
grep -E "CREATE TABLE.*profiles" "$BACKUP_DIR/01_prod_schema.sql"
grep -E "INSERT INTO.*profiles" "$BACKUP_DIR/02_prod_data.sql"
```

*(On Windows PowerShell):*
```powershell
Get-ChildItem -Path $BACKUP_DIR | Select-Object Name, Length, LastWriteTime
Select-String -Pattern "CREATE TABLE.*profiles" -Path "$BACKUP_DIR\01_prod_schema.sql"
Select-String -Pattern "INSERT INTO.*profiles" -Path "$BACKUP_DIR\02_prod_data.sql"
```

Confirm that:
1. `01_prod_schema.sql` is non-empty and contains `CREATE TABLE` statements for `profiles`, `posts`, `conversations`, etc.
2. `02_prod_data.sql` is non-empty and contains `INSERT INTO` records for existing users and posts.
3. Storage media files have been downloaded locally.

Only after confirming all three should you proceed to step `02_reset_data.sql`.
