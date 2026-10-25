# SINC Production Data Reset — Operator Runbook

> [!WARNING]
> **PRODUCTION RESET PROCEDURE**
> This procedure wipes all user accounts, profiles, posts, interactions, messages, notifications, and user-uploaded media from the production environment.
> All operations must be performed manually by the authorized operator in the exact sequence specified below.

---

## Pre-flight Checklist

- [ ] Operator has access to the **Supabase Dashboard** for the production project.
- [ ] Database direct/pooled connection URI is available for `pg_dump` or Supabase CLI is linked.
- [ ] Local disk space is available for full database and media backup (~100 MB+).
- [ ] Operator has decided on account retention:
  - **Full Reset (Start Fresh)**: `v_keep_email := ''`
  - **Preserve Operator Account**: `v_keep_email := 'your-email@example.com'` (Keeps login & profile, wipes content)

---

## Step 1: Announce Maintenance Window (Optional but Recommended)

1. Set a maintenance announcement or temporarily disable user signups if traffic is active.
2. Ensure no active background imports or migration pipelines are executing.

---

## Step 2: Full Local Backup (Mandatory)

Follow [scripts/reset/01_backup.md](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/scripts/reset/01_backup.md).

```bash
# Set up a timestamped backup directory outside the repository
mkdir -p ~/sinc-backups/$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/sinc-backups/$(date +%Y%m%d_%H%M%S)

# 1. Take schema-only dump
pg_dump "$PROD_DB_URL" --schema-only --schema=public --quote-all-identifiers --no-owner --file="$BACKUP_DIR/01_prod_schema.sql"

# 2. Take data-only dump
pg_dump "$PROD_DB_URL" --data-only --schema=public --schema=auth --schema=storage --quote-all-identifiers --no-owner --file="$BACKUP_DIR/02_prod_data.sql"

# 3. Take custom binary dump (all-in-one restore point)
pg_dump "$PROD_DB_URL" --format=custom --schema=public --schema=auth --schema=storage --file="$BACKUP_DIR/03_prod_full_custom.dump"

# 4. Download storage media
node scripts/reset/01_backup_storage.cjs  # (or use the inline Node script in 01_backup.md)
```

**Verification:**
- Confirm `$BACKUP_DIR/01_prod_schema.sql` has non-zero size and contains table schemas.
- Confirm `$BACKUP_DIR/02_prod_data.sql` has non-zero size and contains data inserts.
- Confirm downloaded storage assets exist locally.

---

## Step 3: Execute Database Reset Script

1. Open **Supabase Dashboard** -> Select **Production Project** -> Navigate to **SQL Editor**.
2. Click **New Query**.
3. Copy the entire contents of [scripts/reset/02_reset_data.sql](file:///c:/Users/Karmjit.S.G/OneDrive/Desktop/SINC%20platform/scripts/reset/02_reset_data.sql).
4. **Configure Account Choice** near line 50:
   ```sql
   v_keep_email text := ''; -- Leave empty to wipe ALL, or enter 'your-email@example.com'
   ```
5. Click **Run**.
6. **Inspect the Output Grid**:
   - The query returns a side-by-side comparison table (`count_before`, `count_after`, `status`).
   - Confirm all user content tables (`posts`, `messages`, `notifications`, etc.) show `0` count and `VERIFIED_WIPED`.
   - Confirm `profiles` and `auth.users` show `0` (if wiping all) or `1` (if keeping operator account).
   - If reference tables exist, confirm status is `VERIFIED_UNCHANGED`.
7. **Decision**:
   - If counts match expectations, the script commits automatically via `COMMIT;`.
   - If anything appears anomalous, execute `ROLLBACK;` immediately before closing the tab.

---

## Step 4: Storage Bucket Cleanup

After database reset is committed:

1. **Perform Dry Run**:
   ```bash
   node scripts/reset/03_storage_cleanup.cjs
   ```
   - Review reported object counts for `post-media` and `updates-media`.
   - Confirm no deletions occurred.

2. **Execute Confirmed Cleanup**:
   ```bash
   node scripts/reset/03_storage_cleanup.cjs --confirm
   ```
   - The script empties user-uploaded objects from `post-media` and `updates-media` via Supabase Storage API.
   - Buckets and storage policies remain intact.

---

## Step 5: Client Cache Eviction

Because browsers may retain cached session tokens, user IDs, or local draft state:

1. On any active test browser/device:
   - Sign out of SINC.
   - Open Developer Tools -> **Application** -> **Storage** -> Click **Clear site data** (clears `localStorage`, `sessionStorage`, cookies, and service worker caches).
2. Or run in browser console:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   window.location.href = '/login';
   ```

---

## Step 6: Production Smoke Test

Verify the fresh state of the application:

1. **Sign Up**: Register a new user account with a clean email.
2. **Onboarding**: Complete the multi-step `ProfileSetupWizard` (display name, username, role, domain selection, bio, location). Confirm profile saves to `public.profiles`.
3. **Empty States**:
   - Feed displays clean empty state without crashing or loading mock posts.
   - Updates / Stories displays "No active updates" without mock updates.
   - Who to Follow displays clean state.
   - Messages displays empty conversation list.
   - Notifications displays empty state (0 unread).
4. **Post Creation**: Create a new post with text and an image attachment. Confirm post appears in feed and image renders from `post-media` bucket.
5. **Secondary User Test**:
   - Open an incognito browser window.
   - Register a second user account.
   - Complete profile setup.
   - Follow the first user.
   - Send a direct message to the first user.
6. **Real-time Verification**:
   - First user receives notification and message in real-time.
   - Feed updates cleanly.
