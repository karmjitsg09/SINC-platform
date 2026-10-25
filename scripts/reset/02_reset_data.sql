-- ============================================================================
-- SINC PRODUCTION DATA RESET SCRIPT (Users & User-Generated Content)
-- ============================================================================
-- IMPORTANT INSTRUCTIONS FOR OPERATOR:
-- 1. Take a full backup first (see scripts/reset/01_backup.md).
-- 2. Open Supabase Dashboard -> SQL Editor on your target project.
-- 3. Review and set the KEEP_EMAIL parameter below:
--      KEEP_EMAIL := '';               --> Wipe ALL accounts (starts completely fresh)
--      KEEP_EMAIL := 'you@domain.com'; --> Keep your own account login & profile, wipe content
-- 4. Execute this entire script inside the SQL Editor.
-- 5. Review the final verification table returned by the script.
-- 6. If the after-counts match expectations, proceed to Step 4 (Storage Cleanup).
--    IF AFTER-COUNTS LOOK WRONG, RUN: ROLLBACK; INSTEAD OF COMMIT;
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: CAPTURE & DISPLAY BEFORE-COUNTS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS _reset_audit_before;
CREATE TEMP TABLE _reset_audit_before (
  table_name text PRIMARY KEY,
  category text,
  row_count bigint
);

INSERT INTO _reset_audit_before (table_name, category, row_count)
SELECT 'public.update_views', 'A (User Content)', count(*) FROM public.update_views
UNION ALL SELECT 'public.updates', 'A (User Content)', count(*) FROM public.updates
UNION ALL SELECT 'public.post_likes', 'A (User Content)', count(*) FROM public.post_likes
UNION ALL SELECT 'public.post_comments', 'A (User Content)', count(*) FROM public.post_comments
UNION ALL SELECT 'public.post_saves', 'A (User Content)', count(*) FROM public.post_saves
UNION ALL SELECT 'public.post_shares', 'A (User Content)', count(*) FROM public.post_shares
UNION ALL SELECT 'public.posts', 'A (User Content)', count(*) FROM public.posts
UNION ALL SELECT 'public.notifications', 'A (User Content)', count(*) FROM public.notifications
UNION ALL SELECT 'public.follow_requests', 'A (User Content)', count(*) FROM public.follow_requests
UNION ALL SELECT 'public.messages', 'A (User Content)', count(*) FROM public.messages
UNION ALL SELECT 'public.conversation_members', 'A (User Content)', count(*) FROM public.conversation_members
UNION ALL SELECT 'public.conversations', 'A (User Content)', count(*) FROM public.conversations
UNION ALL SELECT 'public.profiles', 'A (User Profile)', count(*) FROM public.profiles
UNION ALL SELECT 'auth.users', 'A (Auth Identity)', count(*) FROM auth.users;

-- Also log category B reference tables if they exist in this environment
DO $$
BEGIN
  IF to_regclass('public.domains') IS NOT NULL THEN
    EXECUTE 'INSERT INTO _reset_audit_before SELECT ''public.domains'', ''B (Reference/Config)'', count(*) FROM public.domains';
  END IF;
  IF to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'INSERT INTO _reset_audit_before SELECT ''public.categories'', ''B (Reference/Config)'', count(*) FROM public.categories';
  END IF;
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    EXECUTE 'INSERT INTO _reset_audit_before SELECT ''public.app_settings'', ''B (Reference/Config)'', count(*) FROM public.app_settings';
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- STEP 2: EXECUTE CONTROLLED RESET
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  -- >>> OPERATOR CONFIGURATION: ENTER EMAIL TO PRESERVE, OR LEAVE EMPTY FOR NONE <<<
  v_keep_email text := ''; -- e.g. 'operator@sinc.com' or '' to wipe all
  v_keep_user_id uuid := NULL;
BEGIN
  -- Resolve keep user ID if an email was provided
  IF trim(v_keep_email) <> '' THEN
    SELECT id INTO v_keep_user_id
    FROM auth.users
    WHERE lower(email) = lower(trim(v_keep_email))
    LIMIT 1;

    IF v_keep_user_id IS NOT NULL THEN
      RAISE NOTICE 'Preserving operator account: % (UUID: %)', v_keep_email, v_keep_user_id;
    ELSE
      RAISE WARNING 'KEEP_EMAIL specified (%) was not found in auth.users. Proceeding to wipe all accounts.', v_keep_email;
      v_keep_user_id := NULL;
    END IF;
  ELSE
    RAISE NOTICE 'KEEP_ACCOUNTS = none. Proceeding to wipe all accounts and content.';
  END IF;

  -- 1. Break circular FK dependency between conversations and messages
  -- (conversations.last_message_id -> messages.id)
  RAISE NOTICE 'Nullifying circular FK: conversations.last_message_id...';
  UPDATE public.conversations SET last_message_id = NULL;

  -- 2. Delete update views (child of updates & profiles)
  RAISE NOTICE 'Deleting update_views...';
  DELETE FROM public.update_views;

  -- 3. Delete updates (stories)
  RAISE NOTICE 'Deleting updates...';
  DELETE FROM public.updates;

  -- 4. Delete post interaction child tables (likes, comments, saves, shares)
  RAISE NOTICE 'Deleting post interactions (likes, comments, saves, shares)...';
  DELETE FROM public.post_likes;
  DELETE FROM public.post_comments;
  DELETE FROM public.post_saves;
  DELETE FROM public.post_shares;

  -- 5. Delete post media if table exists
  IF to_regclass('public.post_media') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.post_media';
  END IF;

  -- 6. Delete posts
  RAISE NOTICE 'Deleting posts...';
  DELETE FROM public.posts;

  -- 7. Delete notifications
  RAISE NOTICE 'Deleting notifications...';
  DELETE FROM public.notifications;

  -- 8. Delete follow requests
  RAISE NOTICE 'Deleting follow_requests...';
  DELETE FROM public.follow_requests;

  -- 9. Delete messages
  RAISE NOTICE 'Deleting messages...';
  DELETE FROM public.messages;

  -- 10. Delete conversation members
  RAISE NOTICE 'Deleting conversation_members...';
  DELETE FROM public.conversation_members;

  -- 11. Delete conversations
  RAISE NOTICE 'Deleting conversations...';
  DELETE FROM public.conversations;

  -- 12. Delete candidate tables if present in schema
  IF to_regclass('public.blocked_users') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.blocked_users';
  END IF;
  IF to_regclass('public.push_idempotency_keys') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.push_idempotency_keys';
  END IF;
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    IF v_keep_user_id IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.push_subscriptions WHERE user_id <> $1' USING v_keep_user_id;
    ELSE
      EXECUTE 'DELETE FROM public.push_subscriptions';
    END IF;
  END IF;
  IF to_regclass('public.user_private_details') IS NOT NULL THEN
    IF v_keep_user_id IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.user_private_details WHERE user_id <> $1' USING v_keep_user_id;
    ELSE
      EXECUTE 'DELETE FROM public.user_private_details';
    END IF;
  END IF;

  -- 13. Delete public profiles (honoring KEEP_ACCOUNTS)
  RAISE NOTICE 'Deleting profiles (excluding kept account if configured)...';
  IF v_keep_user_id IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id <> v_keep_user_id;
  ELSE
    DELETE FROM public.profiles;
  END IF;

  -- 14. Delete auth.users last (honoring KEEP_ACCOUNTS)
  RAISE NOTICE 'Deleting auth.users (excluding kept account if configured)...';
  IF v_keep_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id <> v_keep_user_id;
  ELSE
    DELETE FROM auth.users;
  END IF;

  RAISE NOTICE 'Reset execution completed successfully.';
END $$;


-- ----------------------------------------------------------------------------
-- STEP 3: CAPTURE & REPORT AFTER-COUNTS WITH COMPARISON
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS _reset_audit_after;
CREATE TEMP TABLE _reset_audit_after (
  table_name text PRIMARY KEY,
  row_count bigint
);

INSERT INTO _reset_audit_after (table_name, row_count)
SELECT 'public.update_views', count(*) FROM public.update_views
UNION ALL SELECT 'public.updates', count(*) FROM public.updates
UNION ALL SELECT 'public.post_likes', count(*) FROM public.post_likes
UNION ALL SELECT 'public.post_comments', count(*) FROM public.post_comments
UNION ALL SELECT 'public.post_saves', count(*) FROM public.post_saves
UNION ALL SELECT 'public.post_shares', count(*) FROM public.post_shares
UNION ALL SELECT 'public.posts', count(*) FROM public.posts
UNION ALL SELECT 'public.notifications', count(*) FROM public.notifications
UNION ALL SELECT 'public.follow_requests', count(*) FROM public.follow_requests
UNION ALL SELECT 'public.messages', count(*) FROM public.messages
UNION ALL SELECT 'public.conversation_members', count(*) FROM public.conversation_members
UNION ALL SELECT 'public.conversations', count(*) FROM public.conversations
UNION ALL SELECT 'public.profiles', count(*) FROM public.profiles
UNION ALL SELECT 'auth.users', count(*) FROM auth.users;

DO $$
BEGIN
  IF to_regclass('public.domains') IS NOT NULL THEN
    EXECUTE 'INSERT INTO _reset_audit_after SELECT ''public.domains'', count(*) FROM public.domains';
  END IF;
  IF to_regclass('public.categories') IS NOT NULL THEN
    EXECUTE 'INSERT INTO _reset_audit_after SELECT ''public.categories'', count(*) FROM public.categories';
  END IF;
  IF to_regclass('public.app_settings') IS NOT NULL THEN
    EXECUTE 'INSERT INTO _reset_audit_after SELECT ''public.app_settings'', count(*) FROM public.app_settings';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- FINAL VERIFICATION AUDIT TABLE
-- Review this table in the query results grid:
-- ----------------------------------------------------------------------------
SELECT 
  b.table_name,
  b.category,
  b.row_count AS count_before,
  a.row_count AS count_after,
  CASE
    -- Reference tables must not change
    WHEN b.category LIKE 'B%' AND b.row_count = a.row_count THEN 'VERIFIED_UNCHANGED'
    WHEN b.category LIKE 'B%' AND b.row_count <> a.row_count THEN 'CRITICAL_REFERENCE_CHANGED'
    -- User content tables must be 0
    WHEN b.category LIKE 'A%Content%' AND a.row_count = 0 THEN 'VERIFIED_WIPED'
    -- Profiles and Auth Users: 0 (if wipe all) or 1 (if keep account)
    WHEN b.table_name IN ('public.profiles', 'auth.users') AND a.row_count = 0 THEN 'VERIFIED_WIPED_ALL'
    WHEN b.table_name IN ('public.profiles', 'auth.users') AND a.row_count = 1 THEN 'VERIFIED_ACCOUNT_KEPT'
    ELSE 'CHECK_UNEXPECTED_COUNT'
  END AS status
FROM _reset_audit_before b
JOIN _reset_audit_after a ON b.table_name = a.table_name
ORDER BY b.category, b.table_name;

-- ----------------------------------------------------------------------------
-- STEP 4: COMMIT OR ROLLBACK
-- ----------------------------------------------------------------------------
-- IF ALL STATUSES SHOW 'VERIFIED_*', RUN COMMIT:
COMMIT;

-- IF ANYTHING LOOKS WRONG OR UNEXPECTED, HIGHLIGHT AND RUN ROLLBACK INSTEAD:
-- ROLLBACK;
