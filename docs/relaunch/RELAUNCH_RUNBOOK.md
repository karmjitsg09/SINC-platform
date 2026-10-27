# SINC Platform — Production Relaunch Runbook

> **OPERATOR DIRECTIVE & HARD CONSTRAINTS**  
> - **PRODUCTION PROJECT:** `vctwzlsatqsuinmosnzo`  
> - **STAGING PROJECT:** `bqmylyedpjeutxhcvmrf`  
> - **ARCHITECTURE PATH:** Path A — Relaunch on the Next.js production app with the consolidated schema (NestJS migration continues post-relaunch).  
> - **POST VISIBILITY:** `public-toggle` (each post has `is_private: boolean`, author can choose public vs followers-only).  
> - **NEVER write to Production without completing Section 1 (Backup) and explicit operator sign-off.**  
> - **NEVER use `TRUNCATE CASCADE` during data reset.** Use explicit `DELETE` statements in foreign-key dependency order within a transaction.  
> - **NEVER execute raw SQL deletes on storage schema (`DELETE FROM storage.objects` is blocked by Supabase).** Use the Storage API script or Dashboard.  
> - **NEVER print or log secrets, service role keys, or database passwords.**

---

## Table of Contents
1. [Pre-Relaunch Backup (Read-Only)](#1-pre-relaunch-backup-read-only)
2. [Production Data Reset](#2-production-data-reset)
3. [Schema Upgrade (Migrations 001–007)](#3-schema-upgrade-migrations-001007)
4. [Storage Buckets & Policies](#4-storage-buckets--policies)
5. [Supabase Dashboard Settings (Production)](#5-supabase-dashboard-settings-production)
6. [Vercel Production Environment Variables & VAPID Generation](#6-vercel-production-environment-variables--vapid-generation)
7. [Deploy & Smoke Test Checklist (Desktop & Mobile)](#7-deploy--smoke-test-checklist-desktop--mobile)
8. [Rollback Plan](#8-rollback-plan)
9. [Socket Gateway Graceful Degradation & Optional Deployment](#9-socket-gateway-graceful-degradation--optional-deployment)
10. [Staging Rehearsal Verification Record](#10-staging-rehearsal-verification-record)

---

## 1. Pre-Relaunch Backup (Read-Only)

Before executing any destructive reset or applying schema migrations to Production (`vctwzlsatqsuinmosnzo`), take complete offline backups of the database schema, table data, and storage objects.

### 1.1 Prerequisites: pg_dump on Windows
Supabase PostgreSQL on production (`vctwzlsatqsuinmosnzo`) runs **PostgreSQL 17.6** (verified via `SELECT version();`). **Your local `pg_dump` client version MUST match or exceed the remote server major version (PostgreSQL 17)**. A lower `pg_dump` version (e.g. PostgreSQL 14, 15, or 16) will fail immediately with version mismatch errors (`pg_dump: error: server version: 17.6; aborting because of server version mismatch`).

#### Installing PostgreSQL 17 Client Tools on Windows:
Open PowerShell as Administrator:
```powershell
# Option A: Windows Package Manager (winget) - Recommended
winget install PostgreSQL.PostgreSQL.17

# Option B: Chocolatey
choco install postgresql17 --params '/NoServer /NoAdmin'
```
Verify the client version:
```powershell
pg_dump --version
# Expected: pg_dump (PostgreSQL) 17.x
```

### 1.2 Database Backup via Windows PowerShell (Session Pooler)
Use the **Supabase Session Pooler** URI (port `5432`, session mode: `aws-0-[REGION].pooler.supabase.com:5432/postgres`) from **Supabase Dashboard** -> **Project Settings** -> **Database** -> **Connection string** (URI, Mode: Session).

In Windows PowerShell:
```powershell
# 1. Set environment variables (replace credentials with operator production password)
$env:PROD_DB_URL = "postgresql://postgres.vctwzlsatqsuinmosnzo:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
$BACKUP_DIR = "$HOME\sinc_production_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
New-Item -ItemType Directory -Force -Path $BACKUP_DIR
Set-Location $BACKUP_DIR

# 2. Schema-Only Backup (DDL: tables, types, triggers, RLS, functions)
pg_dump "$env:PROD_DB_URL" --schema-only --schema=public --quote-all-identifiers --no-owner --no-privileges --file="$BACKUP_DIR\01_prod_schema.sql"

# 3. Data-Only Backup (All existing production table records)
pg_dump "$env:PROD_DB_URL" --data-only --schema=public --schema=auth --no-owner --no-privileges --file="$BACKUP_DIR\02_prod_data.sql"

# 4. Full Custom-Format Archive (For point-in-time pg_restore)
pg_dump "$env:PROD_DB_URL" -Fc --file="$BACKUP_DIR\03_prod_full.dump"
```

### 1.3 Verifying the Backup Files
Verify the dumps succeeded and contain non-zero data:
```powershell
Get-ChildItem $BACKUP_DIR | Select-Object Name, Length, LastWriteTime

# Verify SQL headers and content
Get-Content "$BACKUP_DIR\01_prod_schema.sql" -Head 15
Select-String -Path "$BACKUP_DIR\01_prod_schema.sql" -Pattern "CREATE TABLE" | Measure-Object
```
Ensure all 3 backup files report non-zero byte size before proceeding.

### 1.4 Storage Objects Backup
If production contains user-uploaded media:
- **Option A (Supabase Dashboard):** Navigate to **Storage** -> select bucket (`avatars`, `post-media`, `updates-media`) -> select all files -> click **Download**.
- **Option B (Storage API Script):** Use `node scripts/reset/03_storage_cleanup.cjs --dry-run` to inventory existing files across buckets before cleanup.

---

## 2. Production Data Reset

The relaunch wipes legacy/test records from production while strictly respecting foreign keys.

> [!CAUTION]
> **DO NOT USE `TRUNCATE CASCADE`.**  
> Truncating `auth.users` with `CASCADE` can inadvertently truncate reference tables, drop constraints, or violate trigger chains.  
> **DO NOT USE `DELETE FROM storage.objects`.**  
> Supabase enforces `storage.protect_delete()` which blocks raw SQL deletes on storage tables with error `42501`. Use the Storage API script or Dashboard.

### 2.1 Pre-Reset Verification (Before Counts)
Query the initial row counts for the **exact 14 public tables that exist in production** plus `auth.users`:

```sql
SELECT 'message_status' AS table_name, count(*)::int AS count FROM public.message_status
UNION ALL SELECT 'messages', count(*)::int FROM public.messages
UNION ALL SELECT 'conversation_members', count(*)::int FROM public.conversation_members
UNION ALL SELECT 'conversations', count(*)::int FROM public.conversations
UNION ALL SELECT 'post_likes', count(*)::int FROM public.post_likes
UNION ALL SELECT 'post_comments', count(*)::int FROM public.post_comments
UNION ALL SELECT 'post_saves', count(*)::int FROM public.post_saves
UNION ALL SELECT 'post_shares', count(*)::int FROM public.post_shares
UNION ALL SELECT 'posts', count(*)::int FROM public.posts
UNION ALL SELECT 'follow_requests', count(*)::int FROM public.follow_requests
UNION ALL SELECT 'update_views', count(*)::int FROM public.update_views
UNION ALL SELECT 'updates', count(*)::int FROM public.updates
UNION ALL SELECT 'notifications', count(*)::int FROM public.notifications
UNION ALL SELECT 'profiles', count(*)::int FROM public.profiles
UNION ALL SELECT 'auth.users', count(*)::int FROM auth.users;
```

### 2.2 Atomic Reset SQL Execution
Execute the following atomic transaction block in the Supabase SQL Editor or via `psql`:

```sql
BEGIN;

-- 1. Direct Messaging & Conversation content
DELETE FROM public.message_status;
DELETE FROM public.messages;
DELETE FROM public.conversation_members;
DELETE FROM public.conversations;

-- 2. Post interactions, comments, saves, shares, and posts
DELETE FROM public.post_likes;
DELETE FROM public.post_comments;
DELETE FROM public.post_saves;
DELETE FROM public.post_shares;
DELETE FROM public.posts;

-- 3. Social connections, ephemeral update views, and updates
DELETE FROM public.follow_requests;
DELETE FROM public.update_views;
DELETE FROM public.updates;

-- 4. Notifications
DELETE FROM public.notifications;

-- 5. User Profiles
DELETE FROM public.profiles;

-- 6. Auth Users (Cascades automatically to auth.identities, auth.sessions, auth.mfa_*, etc. via foreign keys)
DELETE FROM auth.users;

COMMIT;
```

### 2.3 Storage Cleanup (Storage API / Dashboard)
Do NOT run SQL against storage tables. Clear storage files using:
- **Option A (Supabase Dashboard):** In **Storage**, open each bucket (`avatars`, `post-media`, `updates-media`), select all files, and click **Empty bucket**.
- **Option B (Script):**
  ```bash
  # 1. Preview objects to be removed (dry-run mode)
  node scripts/reset/03_storage_cleanup.cjs --dry-run

  # 2. Execute deletion via Storage API
  node scripts/reset/03_storage_cleanup.cjs --confirm
  ```

### 2.4 Post-Reset Verification (After Counts)
Re-run the query from Section 2.1:
- Every table listed MUST report **`0`** rows.

---

## 3. Schema Upgrade (Migrations 001–007)

Production already contains `00000000000000_baseline_from_production.sql`. Apply the 7 incremental migrations in exact sequential order, recording each version in `supabase_migrations.schema_migrations` upon success.

### 3.1 Migration Sequence & History Tracking

Ensure the migration tracking schema exists:
```sql
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version character varying(255) PRIMARY KEY,
  inserted_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('00000000000000') ON CONFLICT DO NOTHING;
```

Apply each migration file from `supabase/migrations/`:

| Order | Migration File | Description | History Record SQL |
|:---:|:---|:---|:---|
| 1 | `20261026000001_missing_persistence_tables.sql` | Creates `public.domains` (with seed rows & RLS), `user_domains`, `domain_messages`, `profile_projects`, `profile_experience`, `profile_education`, `profile_certifications`, `profile_achievements`, `blocked_users`, `post_media`, `push_subscriptions`, etc. | `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026000001') ON CONFLICT DO NOTHING;` |
| 2 | `20261026000002_intended_access_rules.sql` | Installs privacy-preserving RLS policies (bidirectional blocking, followers-only private visibility, helper functions `can_view_post`, `can_view_user_content`). | `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026000002') ON CONFLICT DO NOTHING;` |
| 3 | `20261026000003_schema_fixes_and_performance_rules.sql` | Optimizes subqueries `(select auth.uid())`, adds foreign key indexes, sets up performance rules. | `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026000003') ON CONFLICT DO NOTHING;` |
| 4 | `20261026000004_auth_signup_trigger.sql` | Installs idempotent `on_auth_user_created` trigger on `auth.users` to auto-provision `public.profiles` and `public.user_private_details`. | `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026000004') ON CONFLICT DO NOTHING;` |
| 5 | `20261026000005_storage_buckets_and_policies.sql` | Provisions `avatars`, `post-media`, `updates-media` buckets (public: true, 50MB limit) and establishes `storage.objects` RLS policies. | `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026000005') ON CONFLICT DO NOTHING;` |
| 6 | `20261026000006_blocked_users_security_definer.sql` | Installs `public.get_my_blocked_users()` SECURITY DEFINER function (`SET search_path = ''`) so blocked lists display names/avatars safely. | `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026000006') ON CONFLICT DO NOTHING;` |
| 7 | `20261026000007_rls_insert_returning_fix.sql` | Enforces author fast-path SELECT (strictly own rows) on posts, media, likes, comments; push_subscriptions strictly own rows; push_idempotency_keys zero client access; notifications recipient-only read and verified-event client insert via `is_valid_notification_event()`. | `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20261026000007') ON CONFLICT DO NOTHING;` |

---

## 4. Storage Buckets & Policies

### 4.1 Bucket Architecture & Privacy Decision
- **`avatars`**: `public = true`, `file_size_limit = 5242880` (5MB). Read is open for browser `<img>` rendering; write/update/delete restricted to authenticated owners.
- **`post-media`**: `public = true`, `file_size_limit = 52428800` (50MB). Read is open for browser `<img>` rendering; write/delete restricted to authenticated owners.  
  *Privacy Boundary:* Database RLS on `posts` and `post_media` prevents strangers from EVER receiving the post or media URLs for private accounts (`0` rows returned). Strangers never receive the URLs in the browser.
- **`updates-media`**: `public = true`, `file_size_limit = 52428800` (50MB). Read is open for browser `<img>` rendering; write/delete restricted to authenticated owners.  
  *Privacy Boundary:* Database RLS on `updates` shields stories of private accounts from strangers.

> [!NOTE]
> **Public Bucket URLs Remain Reachable Once Shared (Documented Limitation):**  
> Because `avatars`, `post-media`, and `updates-media` buckets are public (`public = true`) to enable CDN caching and direct browser `<img>` rendering without signature expiration churn, any raw public URL that is manually extracted and shared out-of-band remains reachable at the CDN layer. Application and database RLS prevent unauthorized users from ever querying or discovering these URLs, and storage folder listing (`supabase.storage.from(bucket).list()`) is strictly restricted to the folder owner. However, once a public CDN URL is shared, it is directly accessible over HTTP.

### 4.2 Bucket Verification Query
```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id IN ('avatars', 'post-media', 'updates-media')
ORDER BY id;
```
Expected Output:
- `avatars`: `public = true`, `file_size_limit = 5242880`
- `post-media`: `public = true`, `file_size_limit = 52428800`
- `updates-media`: `public = true`, `file_size_limit = 52428800`

---

## 5. Supabase Dashboard Settings (Production)

The operator must configure these settings in the Supabase Dashboard (`https://supabase.com/dashboard/project/vctwzlsatqsuinmosnzo`):

### 5.1 Custom SMTP (Authentication -> Email Settings)
1. Navigate to **Authentication** -> **SMTP Settings**.
2. Toggle **Enable Custom SMTP** to `ON`.
3. Fill in operator SMTP provider credentials (e.g. Resend, SendGrid, Amazon SES):
   - **Sender email:** `noreply@<your-production-domain>`
   - **Sender name:** `SINC Platform`
   - **Host:** `smtp.resend.com`
   - **Port:** `587`
   - **Username:** `resend`
   - **Password:** `<SMTP-API-KEY>`

### 5.2 Auth URL Configuration (Authentication -> URL Configuration)
1. **Site URL:** `https://<your-production-domain>` (e.g. `https://sinc.today`)
2. **Redirect URLs:** Add the following whitelist:
   - `https://<your-production-domain>/**`
   - `https://<your-production-domain>/login`
   - `https://<your-production-domain>/signup`
   - `https://<your-production-domain>/auth/callback`

### 5.3 Google OAuth Provider
1. In **Supabase Dashboard** -> **Authentication** -> **Providers** -> **Google**:
   - Toggle **Enable Google provider** to `ON`.
   - Paste **Client ID** and **Client Secret**.
2. In **Google Cloud Console** -> **APIs & Services** -> **Credentials**:
   - Open OAuth 2.0 Client ID.
   - Add **Authorized redirect URI**:
     `https://vctwzlsatqsuinmosnzo.supabase.co/auth/v1/callback`

### 5.4 JWT Signing Algorithm Confirmation
- **Algorithm:** `ES256` (ECDSA with P-256 curve).
- **Public JWKS Endpoint:** `https://vctwzlsatqsuinmosnzo.supabase.co/auth/v1/.well-known/jwks.json`.
- Next.js verifies tokens directly via asymmetric ES256 signatures from this JWKS endpoint.

---

## 6. Vercel Production Environment Variables & VAPID Generation

### 6.1 Generating Production VAPID Keys
In your terminal, generate a unique, cryptographically secure VAPID keypair:
```bash
npx web-push generate-vapid-keys
```
Output:
```
=======================================
Public Key:
BN... (Copy to NEXT_PUBLIC_VAPID_PUBLIC_KEY)

Private Key:
...   (Copy to VAPID_PRIVATE_KEY)
=======================================
```

### 6.2 Vercel Environment Variables Table
Configure these variables in **Vercel Project Settings** -> **Environment Variables** (Scope: **Production**):

| Variable Name | Value / Description | Notes |
|:---|:---|:---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vctwzlsatqsuinmosnzo.supabase.co` | Production Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<production-anon-key>` | Public Anon Key |
| `SUPABASE_SECRET_KEY` | `<production-service-role-key>` | Server Secret Key (Keep private!) |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-production-domain>` | Canonical production site URL |
| `NEXT_PUBLIC_SOCKET_URL` | `https://<gateway-domain>` or empty | Socket gateway endpoint (optional) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `<generated-public-key>` | Public VAPID key from step 6.1 |
| `VAPID_PRIVATE_KEY` | `<generated-private-key>` | Private VAPID key from step 6.1 |
| `VAPID_SUBJECT` | `mailto:support@<your-production-domain>` | Contact email for Web Push services |
| `PUSH_IDEMPOTENCY_STORE` | `postgres` | Durable replay protection in Postgres |
| `POST_VISIBILITY` | `public-toggle` | Post privacy toggle setting |

---

## 7. Deploy & Smoke Test Checklist (Desktop & Mobile)

Immediately following deployment, run this live verification checklist:

### 7.1 Authentication & Onboarding (Production UI Verification)
- [ ] **UI Email Signup:** Navigate to `/signup` on production in a real browser. Sign up with a new email address. Verify verification email arrives, confirmation link functions, user is redirected to profile setup wizard, and trigger creates profile and `user_private_details` without duplicate-profile or duplicate-key errors.
- [ ] **UI Google OAuth Signup & Login:** Sign in via "Continue with Google" on the production UI. Verify OAuth consent completes, user lands on dashboard/wizard, and trigger handles profile provisioning idempotently.
- [ ] **Profile Setup Wizard:** Set display name, handle, avatar upload, and bio. Verify persistence after reload without duplicate-profile errors.

### 7.2 Profile Sections & Privacy
- [ ] **Profile Sections:** Add Education, Experience, Project, Certification, and Achievement items. Reload and verify.
- [ ] **Account Privacy Toggle:** In Settings, toggle Account Privacy (`is_private`). Verify `profiles.is_private` updates.

### 7.3 Posts & Media Display
- [ ] **Post Creation (Public):** Create a public post with text and image. Verify image renders in feed.
- [ ] **Post Creation (Private):** Create a followers-only post.
- [ ] **Post Editing:** Edit post content via Post Insights Modal -> "Edit Post". Verify updated text.
- [ ] **Likes & Comments:** Like and comment on post. Verify counters increment and persist after page refresh.
- [ ] **Saves & Shares:** Bookmark post. Verify it appears under `/profile/saved-posts`.

### 7.4 Follow System & Privacy Shielding
- [ ] **Follow Request:** Using Account B, send a follow request to private Account A.
- [ ] **Acceptance:** Account A accepts the request.
- [ ] **Content Access:** Account B verifies they can now see Account A's followers-only posts and images.
- [ ] **Stranger Shield:** A non-follower Account C visits Account A's profile. Verify Account C sees "This account is private" and zero post images or stories render.

### 7.5 Direct Messages & Domain Chat
- [ ] **Direct Messaging:** Send a message between Account A and Account B. Verify message persists in chat history.
- [ ] **Domain Chat:** Enter the Tech domain general channel. Send a message, reload page, verify message history.

### 7.6 Push Notifications
- [ ] **Enable Push:** Click "Enable Push Notifications" in Settings. Verify browser push subscription prompt succeeds.

### 7.7 Viewports
- [ ] **Desktop Viewport:** Verify sidebar, feed, and modals at 1920x1080.
- [ ] **Mobile Viewport:** Verify bottom navigation bar, hamburger menu, and touch targets at 375x812.

---

## 8. Rollback Plan

If critical issues arise during production deployment:

1. **Place App in Maintenance Mode:** Enable maintenance mode in Vercel or deploy a static maintenance page.
2. **Database Rollback:**
   ```bash
   # Restore custom archive:
   pg_restore --clean --if-exists -d "$env:PROD_DB_URL" "$BACKUP_DIR\03_prod_full.dump"
   # OR restore data dump:
   psql "$env:PROD_DB_URL" -f "$BACKUP_DIR\02_prod_data.sql"
   ```
3. **Vercel Instant Rollback:** In the Vercel Deployments dashboard, select the previous stable deployment and click **Instant Rollback**.

---

## 9. Socket Gateway Graceful Degradation & Optional Deployment

### 9.1 Graceful Degradation (Gateway Stopped at Relaunch)
The auxiliary Socket.IO gateway is optional at initial relaunch. If `NEXT_PUBLIC_SOCKET_URL` is omitted or the gateway process is stopped:
- **Zero Errors / Zero Crashes:** `src/lib/socketService.ts` catches connection errors via `socket.on('connect_error')`, logs a graceful fallback notice, and sets `isConnected(false)`.
- **Database Persistence:** All chat messages (direct messages and domain messages) are written directly to PostgreSQL via the Supabase client.
- **Message Delivery:** Messages persist authoritatively in PostgreSQL and appear on page refresh or component re-query.
- **Ephemeral Features:** Real-time typing indicators and instant presence pills gracefully sleep until the gateway is connected.

### 9.2 Optional: Deploying the Socket Gateway Post-Relaunch
To enable live typing indicators and instant push relay post-relaunch:
1. Deploy `backend/socket-gateway/server.js` to a Node.js hosting platform (e.g. Render, Railway, Fly.io, or VPS).
2. Set environment variables on the gateway service:
   - `PORT=3001`
   - `SUPABASE_URL=https://vctwzlsatqsuinmosnzo.supabase.co`
   - `CORS_ORIGIN=https://<your-production-domain>`
3. Set `NEXT_PUBLIC_SOCKET_URL=https://<your-gateway-domain>` in Vercel Production Environment Variables and redeploy.

---

## 10. Staging Rehearsal Verification Record

The complete relaunch sequence was rehearsed on STAGING (`bqmylyedpjeutxhcvmrf`) from a clean production-equivalent baseline state.

### 10.1 Rehearsal Execution Log
1. **Initial State Simulation:** Staging was reset to baseline ONLY (`00000000000000_baseline_from_production.sql`) with exactly 14 public tables, 0 unapplied migrations, and legacy `@example.com` data.
2. **Section 2 Reset SQL:** Executed the exact atomic reset SQL from Section 2.2.
   - Initial row count: 14 legacy records across 9 tables.
   - After reset count: **0 rows** across all 14 tables and `auth.users`.
3. **Section 3 Migrations:** Applied migrations `001` through `007` in order. Each migration version was recorded in `supabase_migrations.schema_migrations`.
4. **Section 4 Storage:** Provisioned `avatars`, `post-media`, `updates-media` buckets (`public = true`, 50MB limit) with RLS-safe paths.
5. **Section 5 Provisioning & Tests:** Re-provisioned test accounts and verified all flows.

### 10.2 Test Suite Results on Rehearsed Database

| Verification Suite | Command | Result | Details |
|:---|:---|:---:|:---|
| **RLS Isolation Suite** | `node tests/integration/test_staging_rls_policies.cjs` | **PASS (25/25)** | User B cannot read/write User A's push subscriptions; User B cannot forge notifications; stranger cannot read private posts or media. |
| **Multi-Tenant Flows** | `node tests/integration/verify_all_flows_multitenant.cjs` | **PASS (13/13)** | All 13 flows passed with database as single source of truth. |
| **Image Display & Privacy** | Browser rendering & Storage API | **PASS** | Post images and story media render with HTTP 200 for allowed viewer; fail (shielded by database RLS) for stranger on private account. |
| **Socket Gateway Stopped** | Localhost execution with gateway offline | **PASS** | Socket client degrades gracefully (`connect_error` caught); messages send and persist directly in database without errors. |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **PASS** | 0 type errors. |
| **Next.js Production Build** | `npm run build` | **PASS** | 27/27 static & dynamic routes compiled successfully. |
| **Unit Security Suites** | `tests/unit/*.cjs` | **PASS (100/100)** | Environment guard, Prisma scope, Socket security, and Web Push security suites all passed. |
