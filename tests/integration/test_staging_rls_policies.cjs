/**
 * Staging Database RLS Verification Test
 *
 * Confirms that PostgreSQL RLS policies themselves enforce the intended rules:
 * - A stranger cannot select a private user's posts.
 * - A pending follower cannot select a private user's posts.
 * - An accepted follower can select a private user's posts.
 * - A blocked user cannot select posts or profile in either direction.
 * - Author can always view own posts.
 *
 * Strict Environment Isolation:
 * - Validates STAGING_DATABASE_URL via assertStagingDatabaseUrl (fails closed if production is detected).
 * - Only runs against Staging.
 * - Cleans up all test fixtures in finally block.
 */

const path = require('path');
const dotenv = require(path.resolve(__dirname, '../../backend/api/node_modules/dotenv'));
const { Client } = require(path.resolve(__dirname, '../../backend/api/node_modules/pg'));
const { assertStagingDatabaseUrl } = require('./testEnvironmentGuard.cjs');

// 1. Load environment from backend/api/.env
dotenv.config({ path: path.resolve(__dirname, '../../backend/api/.env') });
const rawStagingUrl = process.env.STAGING_DATABASE_URL || '';
const stagingUrl = rawStagingUrl.replace(/^["']|["']$/g, '').trim();

// 2. Enforce strict staging guard
assertStagingDatabaseUrl(stagingUrl);

// Test user UUIDs (well-formed, unique test namespace)
const USER_A_ID = '99999999-0000-4000-a000-000000000001';
const USER_B_ID = '99999999-0000-4000-b000-000000000002';
const POST_1_ID = '99999999-0000-4000-c000-000000000001';
const POST_2_ID = '99999999-0000-4000-c000-000000000002';
const FOLLOW_REQ_ID = '99999999-0000-4000-d000-000000000001';
const BLOCK_ID = '99999999-0000-4000-e000-000000000001';
const MEDIA_1_ID = '99999999-0000-4000-f000-000000000001';
const PUSH_SUB_A_ID = '99999999-0000-4000-f000-000000000002';
const NOTIF_1_ID = '99999999-0000-4000-f000-000000000003';

async function runStagingRlsTests() {
  console.log('--- SINC Staging Database RLS Verification ---');
  console.log('[GUARD] Staging Database URL confirmed isolated from production.');

  const adminClient = new Client({
    connectionString: stagingUrl,
    ssl: { rejectUnauthorized: false }
  });
  await adminClient.connect();

  const userClient = new Client({
    connectionString: stagingUrl,
    ssl: { rejectUnauthorized: false }
  });
  await userClient.connect();

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`  FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passedTests++;
    console.log(`  PASS: ${message}`);
  }

  // Helper to run query as an authenticated user under RLS using a single client
  async function queryAsUser(userId, sqlQuery, params = []) {
    try {
      await userClient.query('BEGIN;');
      await userClient.query('SET LOCAL ROLE authenticated;');
      await userClient.query(`SELECT set_config('request.jwt.claim.sub', $1, true);`, [userId]);
      await userClient.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true);`);
      const res = await userClient.query(sqlQuery, params);
      await userClient.query('COMMIT;');
      return res.rows;
    } catch (err) {
      await userClient.query('ROLLBACK;').catch(() => {});
      throw err;
    }
  }

  async function cleanup() {
    console.log('[CLEANUP] Removing test fixtures from staging...');
    await adminClient.query(
      `DELETE FROM public.blocked_users WHERE id = $1 OR blocker_user_id IN ($2, $3) OR blocked_user_id IN ($2, $3);`,
      [BLOCK_ID, USER_A_ID, USER_B_ID]
    );
    await adminClient.query(
      `DELETE FROM public.follow_requests WHERE id = $1 OR follower_user_id IN ($2, $3) OR following_user_id IN ($2, $3);`,
      [FOLLOW_REQ_ID, USER_A_ID, USER_B_ID]
    );
    await adminClient.query(
      `DELETE FROM public.post_media WHERE id = $1 OR post_id IN ($2, $3);`,
      [MEDIA_1_ID, POST_1_ID, POST_2_ID]
    );
    await adminClient.query(
      `DELETE FROM public.posts WHERE id IN ($1, $2) OR user_id IN ($3, $4);`,
      [POST_1_ID, POST_2_ID, USER_A_ID, USER_B_ID]
    );
    await adminClient.query(
      `DELETE FROM public.push_subscriptions WHERE id = $1 OR user_id IN ($2, $3);`,
      [PUSH_SUB_A_ID, USER_A_ID, USER_B_ID]
    );
    await adminClient.query(
      `DELETE FROM public.notifications WHERE id = $1 OR recipient_id IN ($2, $3) OR actor_id IN ($2, $3);`,
      [NOTIF_1_ID, USER_A_ID, USER_B_ID]
    );
    await adminClient.query(
      `DELETE FROM public.profiles WHERE id IN ($1, $2);`,
      [USER_A_ID, USER_B_ID]
    );
    await adminClient.query(
      `DELETE FROM auth.users WHERE id IN ($1, $2);`,
      [USER_A_ID, USER_B_ID]
    );
  }

  try {
    // 0. Pre-cleanup
    await cleanup();

    // 1. Setup Fixtures
    console.log('[SETUP] Seeding auth users, profiles & posts...');
    // Auth users (using @example.com per hard rules)
    await adminClient.query(
      `INSERT INTO auth.users (id, aud, role, email)
       VALUES ($1, 'authenticated', 'authenticated', 'alice.rls@example.com'),
              ($2, 'authenticated', 'authenticated', 'bob.rls@example.com')
       ON CONFLICT (id) DO NOTHING;`,
      [USER_A_ID, USER_B_ID]
    );

    // User A: Private profile
    await adminClient.query(
      `INSERT INTO public.profiles (id, name, username, is_private)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, username = EXCLUDED.username, is_private = EXCLUDED.is_private;`,
      [USER_A_ID, 'Alice Staging', 'alice_staging_test', true]
    );

    // User B: Public profile
    await adminClient.query(
      `INSERT INTO public.profiles (id, name, username, is_private)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, username = EXCLUDED.username, is_private = EXCLUDED.is_private;`,
      [USER_B_ID, 'Bob Staging', 'bob_staging_test', false]
    );

    // Post 1: followers-only post by User A
    await adminClient.query(
      `INSERT INTO public.posts (id, user_id, content, post_type, is_private)
       VALUES ($1, $2, $3, $4, $5);`,
      [POST_1_ID, USER_A_ID, 'Alice private followers-only post', 'text', true]
    );

    // Media for Post 1
    await adminClient.query(
      `INSERT INTO public.post_media (id, post_id, media_type, media_url, display_order)
       VALUES ($1, $2, 'image', 'https://example.com/media.jpg', 0);`,
      [MEDIA_1_ID, POST_1_ID]
    );

    // Post 2: standard post by User A (whose profile is private)
    await adminClient.query(
      `INSERT INTO public.posts (id, user_id, content, post_type, is_private)
       VALUES ($1, $2, $3, $4, $5);`,
      [POST_2_ID, USER_A_ID, 'Alice standard post under private profile', 'text', false]
    );

    console.log('[SETUP] Test fixtures created successfully.');

    // ------------------------------------------------------------------------
    // TEST 1: Stranger cannot view posts of a private profile
    // ------------------------------------------------------------------------
    console.log('\n--- Test 1: Stranger Access to Private Profile Posts ---');
    const strangerPosts = await queryAsUser(
      USER_B_ID,
      `SELECT id, content FROM public.posts WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      strangerPosts.length === 0,
      `Stranger (User B) cannot select posts of private User A (received ${strangerPosts.length} posts, expected 0)`
    );

    // ------------------------------------------------------------------------
    // TEST 2: Pending follower cannot view posts of a private profile
    // ------------------------------------------------------------------------
    console.log('\n--- Test 2: Pending Follower Access ---');
    await adminClient.query(
      `INSERT INTO public.follow_requests (id, follower_user_id, following_user_id, status)
       VALUES ($1, $2, $3, $4);`,
      [FOLLOW_REQ_ID, USER_B_ID, USER_A_ID, 'pending']
    );

    const pendingPosts = await queryAsUser(
      USER_B_ID,
      `SELECT id, content FROM public.posts WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      pendingPosts.length === 0,
      `Pending follower (User B) cannot select posts of private User A (received ${pendingPosts.length} posts, expected 0)`
    );

    // ------------------------------------------------------------------------
    // TEST 3: Accepted follower CAN view posts of private profile
    // ------------------------------------------------------------------------
    console.log('\n--- Test 3: Accepted Follower Access ---');
    await adminClient.query(
      `UPDATE public.follow_requests SET status = 'accepted' WHERE id = $1;`,
      [FOLLOW_REQ_ID]
    );

    const acceptedPosts = await queryAsUser(
      USER_B_ID,
      `SELECT id, content FROM public.posts WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      acceptedPosts.length === 2,
      `Accepted follower (User B) CAN select posts of private User A (received ${acceptedPosts.length} posts, expected 2)`
    );

    // ------------------------------------------------------------------------
    // TEST 4: Blocked user (User A blocks User B) hides posts and profile
    // ------------------------------------------------------------------------
    console.log('\n--- Test 4: Bidirectional Blocking (User A blocks User B) ---');
    await adminClient.query(
      `INSERT INTO public.blocked_users (id, blocker_user_id, blocked_user_id)
       VALUES ($1, $2, $3);`,
      [BLOCK_ID, USER_A_ID, USER_B_ID]
    );

    const blockedPosts = await queryAsUser(
      USER_B_ID,
      `SELECT id, content FROM public.posts WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      blockedPosts.length === 0,
      `Blocked user (User B) cannot select posts of User A even if follow request was accepted (received ${blockedPosts.length} posts, expected 0)`
    );

    const blockedProfile = await queryAsUser(
      USER_B_ID,
      `SELECT id FROM public.profiles WHERE id = $1;`,
      [USER_A_ID]
    );
    assert(
      blockedProfile.length === 0,
      `Blocked user (User B) cannot select profile of User A (received ${blockedProfile.length} profiles, expected 0)`
    );

    // ------------------------------------------------------------------------
    // TEST 5: Bidirectional Blocking in reverse (User B blocks User A)
    // ------------------------------------------------------------------------
    console.log('\n--- Test 5: Bidirectional Blocking (User B blocks User A) ---');
    await adminClient.query(
      `UPDATE public.blocked_users SET blocker_user_id = $1, blocked_user_id = $2 WHERE id = $3;`,
      [USER_B_ID, USER_A_ID, BLOCK_ID]
    );

    const reverseBlockedPosts = await queryAsUser(
      USER_B_ID,
      `SELECT id, content FROM public.posts WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      reverseBlockedPosts.length === 0,
      `User B who blocked User A cannot select User A's posts (received ${reverseBlockedPosts.length} posts, expected 0)`
    );

    // ------------------------------------------------------------------------
    // TEST 6: Author can always view own posts
    // ------------------------------------------------------------------------
    console.log('\n--- Test 6: Author Self-View Access ---');
    const authorPosts = await queryAsUser(
      USER_A_ID,
      `SELECT id, content FROM public.posts WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      authorPosts.length === 2,
      `Author (User A) can always select their own posts (received ${authorPosts.length} posts, expected 2)`
    );

    // ------------------------------------------------------------------------
    // TEST 7: Stranger can see private profile's basic info but NOT its posts
    // ------------------------------------------------------------------------
    console.log('\n--- Test 7: Stranger Sees Private Profile Basic Info, But Not Posts ---');
    // Remove blocks and follow requests to restore pure stranger state
    await adminClient.query(`DELETE FROM public.blocked_users WHERE id = $1;`, [BLOCK_ID]);
    await adminClient.query(`DELETE FROM public.follow_requests WHERE id = $1;`, [FOLLOW_REQ_ID]);

    const strangerProfileView = await queryAsUser(
      USER_B_ID,
      `SELECT id, name, username, is_private, is_verified FROM public.profiles WHERE id = $1;`,
      [USER_A_ID]
    );
    assert(
      strangerProfileView.length === 1 && strangerProfileView[0].is_private === true,
      `Stranger (User B) CAN see private profile's basic info (received ${strangerProfileView.length} profiles, is_private: ${strangerProfileView[0]?.is_private})`
    );

    const strangerContentCheck = await queryAsUser(
      USER_B_ID,
      `SELECT id FROM public.posts WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      strangerContentCheck.length === 0,
      `Stranger (User B) CANNOT see private profile's posts (received ${strangerContentCheck.length} posts, expected 0)`
    );

    // ------------------------------------------------------------------------
    // TEST 8: Blocked user cannot see the profile at all
    // ------------------------------------------------------------------------
    console.log('\n--- Test 8: Blocked User Cannot See Profile At All ---');
    await adminClient.query(
      `INSERT INTO public.blocked_users (id, blocker_user_id, blocked_user_id)
       VALUES ($1, $2, $3);`,
      [BLOCK_ID, USER_A_ID, USER_B_ID]
    );

    const blockedProfileView = await queryAsUser(
      USER_B_ID,
      `SELECT id, name, username FROM public.profiles WHERE id = $1;`,
      [USER_A_ID]
    );
    assert(
      blockedProfileView.length === 0,
      `Blocked user (User B) cannot see User A's profile at all (received ${blockedProfileView.length} profiles, expected 0)`
    );

    // ------------------------------------------------------------------------
    // TEST 9: Search-style query returns private profiles' basic info
    // ------------------------------------------------------------------------
    console.log('\n--- Test 9: Search-Style Query Returns Private Profile Basic Info ---');
    // Unblock so User A is unblocked stranger
    await adminClient.query(`DELETE FROM public.blocked_users WHERE id = $1;`, [BLOCK_ID]);

    const searchResults = await queryAsUser(
      USER_B_ID,
      `SELECT id, name, username, is_private FROM public.profiles 
       WHERE username ILIKE '%alice%' OR name ILIKE '%alice%';`
    );
    assert(
      searchResults.length >= 1 && searchResults.some(p => p.id === USER_A_ID),
      `Search-style query returns private profile's basic info (found ${searchResults.length} matching profiles including Alice)`
    );

    // ------------------------------------------------------------------------
    // TEST 10: Search-style query excludes blocked users
    // ------------------------------------------------------------------------
    console.log('\n--- Test 10: Search-Style Query Excludes Blocked Users ---');
    await adminClient.query(
      `INSERT INTO public.blocked_users (id, blocker_user_id, blocked_user_id)
       VALUES ($1, $2, $3);`,
      [BLOCK_ID, USER_A_ID, USER_B_ID]
    );

    const searchBlockedResults = await queryAsUser(
      USER_B_ID,
      `SELECT id, name, username FROM public.profiles 
       WHERE username ILIKE '%alice%' OR name ILIKE '%alice%';`
    );
    assert(
      !searchBlockedResults.some(p => p.id === USER_A_ID),
      `Search query strictly excludes blocked profiles (Alice not in results)`
    );

    // ------------------------------------------------------------------------
    // TEST 11: Push Subscriptions Isolation
    // ------------------------------------------------------------------------
    console.log('\n--- Test 11: Push Subscriptions Isolation ---');
    // Admin inserts User A's push subscription
    await adminClient.query(
      `INSERT INTO public.push_subscriptions (id, user_id, endpoint, p256dh, auth, is_active)
       VALUES ($1, $2, 'https://push.example.com/a', 'key_p256dh', 'key_auth', true)
       ON CONFLICT (id) DO NOTHING;`,
      [PUSH_SUB_A_ID, USER_A_ID]
    );

    // User B tries to select User A's push subscriptions -> must return 0
    const bReadsASub = await queryAsUser(
      USER_B_ID,
      `SELECT id, endpoint FROM public.push_subscriptions WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      bReadsASub.length === 0,
      `User B cannot select User A's push subscriptions (received ${bReadsASub.length} rows, expected 0)`
    );

    // User B tries to insert a push subscription with user_id = User A -> must fail RLS
    let bInsertAFailed = false;
    try {
      await queryAsUser(
        USER_B_ID,
        `INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1, 'https://push.example.com/b_forged', 'p256', 'auth');`,
        [USER_A_ID]
      );
    } catch (err) {
      bInsertAFailed = true;
    }
    assert(
      bInsertAFailed,
      `User B cannot insert a push subscription with user_id = User A (RLS violation triggered)`
    );

    // User B tries to update User A's push subscription -> affects 0 rows
    const bUpdateASub = await queryAsUser(
      USER_B_ID,
      `UPDATE public.push_subscriptions SET endpoint = 'https://push.example.com/hacked' WHERE user_id = $1 RETURNING id;`,
      [USER_A_ID]
    );
    assert(
      bUpdateASub.length === 0,
      `User B cannot update User A's push subscription (affected ${bUpdateASub.length} rows, expected 0)`
    );

    // User B tries to delete User A's push subscription -> affects 0 rows
    const bDeleteASub = await queryAsUser(
      USER_B_ID,
      `DELETE FROM public.push_subscriptions WHERE user_id = $1 RETURNING id;`,
      [USER_A_ID]
    );
    assert(
      bDeleteASub.length === 0,
      `User B cannot delete User A's push subscription (affected ${bDeleteASub.length} rows, expected 0)`
    );

    // User A can select their own subscription
    const aReadsOwnSub = await queryAsUser(
      USER_A_ID,
      `SELECT id, endpoint FROM public.push_subscriptions WHERE user_id = $1;`,
      [USER_A_ID]
    );
    assert(
      aReadsOwnSub.length === 1,
      `User A CAN select their own push subscription (received ${aReadsOwnSub.length} rows)`
    );

    // ------------------------------------------------------------------------
    // TEST 12: Notification Insert Authorization & Event Verification
    // ------------------------------------------------------------------------
    console.log('\n--- Test 12: Notification Insert Authorization & Event Verification ---');
    // Ensure no follow request or relationship exists between A and B
    await adminClient.query(`DELETE FROM public.follow_requests WHERE follower_user_id IN ($1, $2) OR following_user_id IN ($1, $2);`, [USER_A_ID, USER_B_ID]);
    await adminClient.query(`DELETE FROM public.blocked_users WHERE blocker_user_id IN ($1, $2) OR blocked_user_id IN ($1, $2);`, [USER_A_ID, USER_B_ID]);

    // 12A. User B attempts to insert with forged actor_id = User A -> must fail RLS
    let forgedActorFailed = false;
    try {
      await queryAsUser(
        USER_B_ID,
        `INSERT INTO public.notifications (recipient_id, actor_id, type, title, message)
         VALUES ($1, $2, 'follow_request', 'Fake Ping', 'Message');`,
        [USER_B_ID, USER_A_ID]
      );
    } catch (err) {
      forgedActorFailed = true;
    }
    assert(
      forgedActorFailed,
      `User B cannot insert notification with forged actor_id = User A (RLS violation triggered)`
    );

    // 12B. User B attempts to insert notification for an event that doesn't exist -> must fail RLS
    let nonexistentEventFailed = false;
    try {
      await queryAsUser(
        USER_B_ID,
        `INSERT INTO public.notifications (recipient_id, actor_id, type, title, message, entity_type, entity_id)
         VALUES ($1, $2, 'follow_request', 'Follow Ping', 'Message', 'follow_request', 'nonexistent_event_id');`,
        [USER_A_ID, USER_B_ID]
      );
    } catch (err) {
      nonexistentEventFailed = true;
    }
    assert(
      nonexistentEventFailed,
      `User B cannot insert notification for an event that does not exist (RLS event check triggered)`
    );

    // 12C. User B sends real follow request to User A, then inserts notification -> must succeed
    await queryAsUser(
      USER_B_ID,
      `INSERT INTO public.follow_requests (id, follower_user_id, following_user_id, status)
       VALUES ($1, $2, $3, 'pending');`,
      [FOLLOW_REQ_ID, USER_B_ID, USER_A_ID]
    );

    let legitimateNotifSucceeded = false;
    try {
      await queryAsUser(
        USER_B_ID,
        `INSERT INTO public.notifications (id, recipient_id, actor_id, type, title, message, entity_type, entity_id)
         VALUES ($1, $2, $3, 'follow_request', 'Follow Ping', 'Bob followed Alice', 'follow_request', $4);`,
        [NOTIF_1_ID, USER_A_ID, USER_B_ID, FOLLOW_REQ_ID]
      );
      legitimateNotifSucceeded = true;
    } catch (err) {
      console.error('Legitimate notification error:', err);
    }
    assert(
      legitimateNotifSucceeded,
      `User B CAN insert notification when real follow request event exists`
    );

    // 12D. User B (actor) attempts to SELECT User A's notification -> returns 0 rows (Recipient-only SELECT)
    const bSelectsANotif = await queryAsUser(
      USER_B_ID,
      `SELECT id, message FROM public.notifications WHERE id = $1;`,
      [NOTIF_1_ID]
    );
    assert(
      bSelectsANotif.length === 0,
      `Actor (User B) CANNOT select recipient's notification (received ${bSelectsANotif.length} rows, expected 0)`
    );

    // 12E. User A (recipient) CAN select their incoming notification
    const aSelectsOwnNotif = await queryAsUser(
      USER_A_ID,
      `SELECT id, message FROM public.notifications WHERE id = $1;`,
      [NOTIF_1_ID]
    );
    assert(
      aSelectsOwnNotif.length === 1,
      `Recipient (User A) CAN select their incoming notification (received 1 row)`
    );

    // ------------------------------------------------------------------------
    // TEST 13: Stranger Cannot Read Private Post OR its Post Media
    // ------------------------------------------------------------------------
    console.log('\n--- Test 13: Stranger Cannot Read Private Post or Media ---');
    // Remove follow request so B is pure stranger
    await adminClient.query(`DELETE FROM public.follow_requests WHERE id = $1;`, [FOLLOW_REQ_ID]);

    const strangerPostSelect = await queryAsUser(
      USER_B_ID,
      `SELECT id FROM public.posts WHERE id = $1;`,
      [POST_1_ID]
    );
    assert(
      strangerPostSelect.length === 0,
      `Stranger (User B) cannot read private post (received ${strangerPostSelect.length} posts, expected 0)`
    );

    const strangerMediaSelect = await queryAsUser(
      USER_B_ID,
      `SELECT id FROM public.post_media WHERE post_id = $1;`,
      [POST_1_ID]
    );
    assert(
      strangerMediaSelect.length === 0,
      `Stranger (User B) cannot read private post media (received ${strangerMediaSelect.length} media rows, expected 0)`
    );

    const authorMediaSelect = await queryAsUser(
      USER_A_ID,
      `SELECT id FROM public.post_media WHERE post_id = $1;`,
      [POST_1_ID]
    );
    assert(
      authorMediaSelect.length === 1,
      `Author (User A) CAN read their own post media (received 1 row)`
    );

    console.log(`\n[SUCCESS] All ${passedTests}/${totalTests} staging RLS tests passed!`);
  } catch (err) {
    console.error('[TEST ERROR]:', err);
    throw err;
  } finally {
    await cleanup();
    await adminClient.end();
    await userClient.end();
    console.log('[CLEANUP] Staging test fixtures verified cleaned up.');
  }
}

runStagingRlsTests().catch((err) => {
  console.error('[FATAL ERROR in Staging RLS Tests]:', err.message);
  process.exit(1);
});
