#!/usr/bin/env node
/**
 * scripts/reset/03_storage_cleanup.cjs
 *
 * Empties user-upload storage buckets ('post-media', 'updates-media') via the
 * Supabase Storage API using the server-only secret key.
 *
 * SAFETY FEATURES:
 * - Default mode is --dry-run (counts objects only, mutates nothing).
 * - Requires explicit --confirm flag to execute object deletion.
 * - Deletes ONLY user-upload objects within specified buckets.
 * - Does NOT delete the buckets themselves or modify storage policies.
 * - Does NOT execute raw SQL against storage schema.
 * - Reads credentials from environment variables only (never hardcoded).
 *
 * Usage:
 *   node scripts/reset/03_storage_cleanup.cjs              # Dry run (safe, reports counts)
 *   node scripts/reset/03_storage_cleanup.cjs --dry-run    # Explicit dry run
 *   node scripts/reset/03_storage_cleanup.cjs --confirm    # Performs deletion
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables (.env.local, .env)
dotenv.config({ path: '.env.local' });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

// Only user-upload buckets are targeted
const USER_MEDIA_BUCKETS = ['post-media', 'updates-media'];

const args = process.argv.slice(2);
const isConfirm = args.includes('--confirm');
const isDryRun = args.includes('--dry-run') || !isConfirm;

async function main() {
  console.log('================================================================');
  console.log('SINC Storage Cleanup Utility');
  console.log('================================================================');
  console.log(`Execution Mode: ${isDryRun ? 'DRY RUN (Read-Only)' : 'CONFIRM (Destructive Deletion)'}`);

  if (!SUPABASE_URL) {
    console.error('FAIL-CLOSED: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is not defined in environment.');
    process.exit(1);
  }

  if (!SUPABASE_SECRET_KEY) {
    console.error('FAIL-CLOSED: SUPABASE_SECRET_KEY is not defined in environment.');
    console.error('This cleanup requires server-only admin permissions to list and delete storage objects.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  // Verify connection by listing buckets
  const { data: bucketList, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error('FAIL-CLOSED: Unable to list storage buckets:', bucketError.message);
    process.exit(1);
  }

  const existingBucketIds = new Set(bucketList.map((b) => b.id));
  console.log(`Found ${bucketList.length} total buckets in project.`);

  let totalObjectsFound = 0;
  let totalObjectsDeleted = 0;

  for (const bucketName of USER_MEDIA_BUCKETS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Checking bucket: [${bucketName}]`);

    if (!existingBucketIds.has(bucketName)) {
      console.log(`Bucket [${bucketName}] does not exist on this project. Skipping.`);
      continue;
    }

    // List all files in bucket
    const allFiles = await listAllObjects(supabase, bucketName);
    console.log(`Bucket [${bucketName}] contains ${allFiles.length} object(s).`);
    totalObjectsFound += allFiles.length;

    if (allFiles.length === 0) {
      console.log(`Bucket [${bucketName}] is already empty.`);
      continue;
    }

    if (isDryRun) {
      console.log(`[DRY RUN] Would delete ${allFiles.length} file(s) from [${bucketName}]. No files removed.`);
    } else {
      console.log(`[CONFIRM] Deleting ${allFiles.length} file(s) from [${bucketName}]...`);
      const pathsToDelete = allFiles.map((f) => f.name);

      // Delete in batches of 100 to avoid payload limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < pathsToDelete.length; i += BATCH_SIZE) {
        const batch = pathsToDelete.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.storage.from(bucketName).remove(batch);

        if (error) {
          console.error(`Error deleting batch from [${bucketName}]:`, error.message);
          throw error;
        }

        const count = data ? data.length : batch.length;
        totalObjectsDeleted += count;
        console.log(`Deleted batch of ${count} file(s) from [${bucketName}].`);
      }
      console.log(`Successfully emptied bucket [${bucketName}].`);
    }
  }

  console.log(`\n============================================================`);
  console.log(`SUMMARY:`);
  console.log(`Target User Buckets:   ${USER_MEDIA_BUCKETS.join(', ')}`);
  console.log(`Total Objects Found:    ${totalObjectsFound}`);
  if (isDryRun) {
    console.log(`Total Objects Deleted:  0 (DRY RUN MODE)`);
    console.log(`To execute deletion, rerun with: node scripts/reset/03_storage_cleanup.cjs --confirm`);
  } else {
    console.log(`Total Objects Deleted:  ${totalObjectsDeleted}`);
    console.log(`Storage cleanup completed successfully.`);
  }
  console.log(`============================================================`);
}

/**
 * Recursively list all files in a bucket
 */
async function listAllObjects(supabase, bucketName, folder = '') {
  let fileList = [];
  const { data, error } = await supabase.storage.from(bucketName).list(folder, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) {
    console.error(`Error listing folder "${folder}" in bucket [${bucketName}]:`, error.message);
    throw error;
  }

  for (const item of (data || [])) {
    if (item.name === '.emptyFolderPlaceholder') continue;

    const fullPath = folder ? `${folder}/${item.name}` : item.name;
    // Check if item is a folder (id is null or metadata is null)
    if (item.id === null || !item.metadata) {
      const nested = await listAllObjects(supabase, bucketName, fullPath);
      fileList = fileList.concat(nested);
    } else {
      fileList.push({ name: fullPath, size: item.metadata?.size || 0 });
    }
  }

  return fileList;
}

main().catch((err) => {
  console.error('FATAL: Storage cleanup failed:', err);
  process.exit(1);
});
