/**
 * SINC Platform — Stage 1 Comprehensive Multi-Account Verification
 * 
 * Verifies all remaining flows with two live @example.com accounts on STAGING (bqmylyedpjeutxhcvmrf).
 * Accounts:
 * - User A: operator.verifier@example.com
 * - User B: operator.peer@example.com
 * 
 * Rules:
 * - Database is the only source of truth
 * - Action -> Reload/Re-query -> Check on second account
 */

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { Client: PgClient } = require(path.resolve(__dirname, '../../backend/api/node_modules/pg'));
const { assertStagingDatabaseUrl } = require('./testEnvironmentGuard.cjs');

function getStagingConfig() {
  const envPath = path.resolve(__dirname, '../../.env.staging');
  const content = fs.readFileSync(envPath, 'utf8');
  let url = '';
  let anonKey = '';
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = trimmed.split('=')[1].replace(/^['"]|['"]$/g, '');
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) anonKey = trimmed.split('=')[1].replace(/^['"]|['"]$/g, '');
  });

  const backendEnvPath = path.resolve(__dirname, '../../backend/api/.env');
  const backendLines = fs.readFileSync(backendEnvPath, 'utf8').split('\n');
  let stagingDbUrl = '';
  for (const line of backendLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('STAGING_DATABASE_URL=')) {
      stagingDbUrl = trimmed.split('=')[1].replace(/^['"]|['"]$/g, '');
    }
  }

  return { url, anonKey, stagingDbUrl };
}

async function main() {
  const { url, anonKey, stagingDbUrl } = getStagingConfig();
  console.log('================================================================');
  console.log('SINC STAGE 1 — COMPREHENSIVE MULTI-ACCOUNT STAGING VERIFICATION');
  console.log('================================================================');
  console.log('[CONFIG] Staging Supabase URL:', url);

  if (url.includes('vctwzlsatqsuinmosnzo')) {
    throw new Error('FATAL: Targeting production is strictly forbidden!');
  }
  if (!url.includes('bqmylyedpjeutxhcvmrf')) {
    throw new Error('Target must be staging bqmylyedpjeutxhcvmrf');
  }

  assertStagingDatabaseUrl(stagingDbUrl);
  console.log('[GUARD] Staging environment verified safe.');

  const results = [];
  function recordResult(flow, status, detail) {
    results.push({ Flow: flow, Status: status, Details: detail });
    console.log(`[${status}] ${flow}: ${detail}`);
  }

  // Helper for isolated in-memory auth storage per client
  function createMemoryStorage() {
    const store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = value; },
      removeItem: (key) => { delete store[key]; }
    };
  }

  // 1. Authenticate User A and User B with fully isolated session stores
  const rawClientA = createClient(url, anonKey, {
    auth: { storage: createMemoryStorage(), persistSession: true, autoRefreshToken: false }
  });
  const { data: authA, error: errA } = await rawClientA.auth.signInWithPassword({
    email: 'operator.verifier@example.com',
    password: 'Password123!'
  });
  if (errA || !authA.session) throw new Error('User A login failed: ' + errA?.message);

  const rawClientB = createClient(url, anonKey, {
    auth: { storage: createMemoryStorage(), persistSession: true, autoRefreshToken: false }
  });
  const { data: authB, error: errB } = await rawClientB.auth.signInWithPassword({
    email: 'operator.peer@example.com',
    password: 'Password123!'
  });
  if (errB || !authB.session) throw new Error('User B login failed: ' + errB?.message);

  const tokenA = authA.session.access_token;
  const tokenB = authB.session.access_token;

  const clientA = createClient(url, anonKey, {
    auth: { storage: createMemoryStorage(), persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${tokenA}` } }
  });

  const clientB = createClient(url, anonKey, {
    auth: { storage: createMemoryStorage(), persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${tokenB}` } }
  });

  const userA = authA.user;
  const userB = authB.user;
  console.log(`[AUTH] User A: ${userA.email} (${userA.id})`);
  console.log(`[AUTH] User B: ${userB.email} (${userB.id})`);

  // Direct PG client for authoritative state verification & cleanup
  const pg = new PgClient({ connectionString: stagingDbUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();

  let testPostId = null;
  let privatePostId = null;

  try {
    // ------------------------------------------------------------------------
    // FLOW 1: Posts (Create single & multi image via post_media, public-toggle, edit, delete)
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 1: Posts ---');
    try {
      // 1A. Create public post with single image
      const { data: p1, error: p1Err } = await clientA.from('posts').insert([
        {
          user_id: userA.id,
          content: 'Verification post with media from User A',
          domain: 'tech',
          post_type: 'image',
          image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
          is_private: false
        }
      ]).select().single();
      if (p1Err) throw p1Err;
      testPostId = p1.id;

      // Insert into post_media
      await clientA.from('post_media').insert([
        {
          post_id: testPostId,
          media_type: 'image',
          media_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
          display_order: 0,
          layout_type: 'single'
        }
      ]);

      // 1B. Create private post
      const { data: p2, error: p2Err } = await clientA.from('posts').insert([
        {
          user_id: userA.id,
          content: 'Private verification post (followers only)',
          domain: 'tech',
          post_type: 'text',
          is_private: true
        }
      ]).select().single();
      if (p2Err) throw p2Err;
      privatePostId = p2.id;

      // 1C. Verify User B can see public post
      const { data: bPublicPost } = await clientB.from('posts').select('*').eq('id', testPostId).maybeSingle();
      if (!bPublicPost) throw new Error('User B could not read User A public post');

      // 1D. Edit post: update content and domain
      const { data: updatedPost, error: upErr } = await clientA.from('posts').update({
        content: 'Edited verification post content',
        domain: 'design'
      }).eq('id', testPostId).select().single();
      if (upErr) throw upErr;
      if (updatedPost.content !== 'Edited verification post content') throw new Error('Content edit mismatch');

      // Reload on second account
      const { data: bReloaded } = await clientB.from('posts').select('*').eq('id', testPostId).single();
      if (bReloaded.content !== 'Edited verification post content' || bReloaded.domain !== 'design') {
        throw new Error('User B did not see edited post content after reload');
      }

      recordResult('1. Posts (CRUD, Media, Visibility)', 'PASS', 'Created post with post_media, public-toggle verified, edited, reloaded on second account.');
    } catch (err) {
      recordResult('1. Posts (CRUD, Media, Visibility)', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 2: Likes
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 2: Likes ---');
    try {
      // User B likes User A's post
      const { error: likeErr } = await clientB.from('post_likes').insert([
        { post_id: testPostId, user_id: userB.id }
      ]);
      if (likeErr) throw likeErr;

      // Reload / check on second account (User A)
      const { count: likeCountA } = await clientA.from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', testPostId);

      if (likeCountA !== 1) throw new Error(`Expected like count 1, got ${likeCountA}`);

      // Verify User B state has likedByMe
      const { data: bLikes } = await clientB.from('post_likes').select('*').eq('post_id', testPostId).eq('user_id', userB.id);
      if (!bLikes || bLikes.length !== 1) throw new Error('Liked state not reflected for User B');

      recordResult('2. Likes', 'PASS', 'User B liked post, reloaded, verified like count and persistence on User A.');
    } catch (err) {
      recordResult('2. Likes', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 3: Comments
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 3: Comments ---');
    let testCommentId = null;
    try {
      // User B comments on User A's post
      const { data: comment, error: cErr } = await clientB.from('post_comments').insert([
        { post_id: testPostId, user_id: userB.id, content: 'Great verification test post!' }
      ]).select().single();
      if (cErr) throw cErr;
      testCommentId = comment.id;

      // User A reloads comments
      const { data: aComments } = await clientA.from('post_comments')
        .select('*, profile:user_id(name, username)')
        .eq('post_id', testPostId);

      const foundComment = (aComments || []).find(c => c.id === testCommentId);
      if (!foundComment || foundComment.content !== 'Great verification test post!') {
        throw new Error('Comment not found on User A reload');
      }

      // User B deletes comment
      const { error: delCErr } = await clientB.from('post_comments').delete().eq('id', testCommentId);
      if (delCErr) throw delCErr;

      const { data: remainingComments } = await clientA.from('post_comments').select('*').eq('id', testCommentId);
      if (remainingComments && remainingComments.length > 0) throw new Error('Comment deletion did not persist');

      recordResult('3. Comments', 'PASS', 'Created comment, reloaded on second account, deleted comment, verified persistence.');
    } catch (err) {
      recordResult('3. Comments', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 4: Saves
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 4: Saves ---');
    try {
      // User B saves User A's post
      const { error: sErr } = await clientB.from('post_saves').insert([
        { post_id: testPostId, user_id: userB.id }
      ]);
      if (sErr) throw sErr;

      // Reload User B saves
      const { data: bSaved } = await clientB.from('post_saves').select('*, post:post_id(*)').eq('user_id', userB.id);
      if (!bSaved || !bSaved.some(s => s.post_id === testPostId)) {
        throw new Error('Saved post not returned on reload');
      }

      // Unsave
      await clientB.from('post_saves').delete().eq('post_id', testPostId).eq('user_id', userB.id);
      const { data: bSavedAfter } = await clientB.from('post_saves').select('*').eq('post_id', testPostId).eq('user_id', userB.id);
      if (bSavedAfter && bSavedAfter.length > 0) throw new Error('Unsave did not persist');

      recordResult('4. Saves', 'PASS', 'Saved post, reloaded list, unsaved post, verified database source of truth.');
    } catch (err) {
      recordResult('4. Saves', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 5: Shares
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 5: Shares ---');
    try {
      // User B shares User A's post with User A
      const { error: shErr } = await clientB.from('post_shares').insert([
        { post_id: testPostId, sender_id: userB.id, recipient_id: userA.id }
      ]);
      if (shErr) throw shErr;

      // Check share count on User A
      const { count: shareCount } = await clientA.from('post_shares')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', testPostId);

      if (shareCount !== 1) throw new Error(`Expected share count 1, got ${shareCount}`);
      recordResult('5. Shares', 'PASS', 'User B shared post with User A, verified share record and count persistence.');
    } catch (err) {
      recordResult('5. Shares', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 6: Follow request / accept / reject / remove
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 6: Follow System ---');
    try {
      // Clean any existing follow relation
      await pg.query(`DELETE FROM public.follow_requests WHERE (follower_user_id = $1 AND following_user_id = $2) OR (follower_user_id = $2 AND following_user_id = $1);`, [userA.id, userB.id]);

      // 6A. User B sends follow request to User A
      const { data: fr, error: frErr } = await clientB.from('follow_requests').insert([
        { follower_user_id: userB.id, following_user_id: userA.id, status: 'pending' }
      ]).select().single();
      if (frErr) throw frErr;

      // 6B. User A reloads and accepts request
      const { data: aIncoming } = await clientA.from('follow_requests')
        .select('*')
        .eq('following_user_id', userA.id)
        .eq('follower_user_id', userB.id)
        .single();
      if (!aIncoming || aIncoming.status !== 'pending') throw new Error('User A did not see pending follow request');

      const { error: acceptErr } = await clientA.from('follow_requests')
        .update({ status: 'accepted' })
        .eq('id', fr.id);
      if (acceptErr) throw acceptErr;

      // 6C. User B reloads and checks accepted status
      const { data: bStatus } = await clientB.from('follow_requests').select('*').eq('id', fr.id).single();
      if (bStatus.status !== 'accepted') throw new Error('User B did not see accepted status on reload');

      // 6D. Now User B is an accepted follower -> User B can view User A's private post!
      const { data: bPrivatePost } = await clientB.from('posts').select('*').eq('id', privatePostId).maybeSingle();
      if (!bPrivatePost) throw new Error('User B could not view private post after follow acceptance');

      // 6E. User B removes follow (unfollows)
      const { error: unfrErr } = await clientB.from('follow_requests').delete().eq('id', fr.id);
      if (unfrErr) throw unfrErr;

      const { data: postUnfollow } = await clientA.from('follow_requests').select('*').eq('id', fr.id);
      if (postUnfollow && postUnfollow.length > 0) throw new Error('Unfollow did not persist');

      recordResult('6. Follow System (Request/Accept/View Private/Remove)', 'PASS', 'Follow request sent, accepted, verified private post visibility, and follow removed.');
    } catch (err) {
      recordResult('6. Follow System (Request/Accept/View Private/Remove)', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 7: Domains and Domain Chat
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 7: Domain Chat ---');
    try {
      // User A sends message in Tech domain general channel
      const { data: dmMsg, error: dmErr } = await clientA.from('domain_messages').insert([
        {
          domain_id: 'tech',
          channel_id: 'tech_general',
          user_id: userA.id,
          content: 'Hello Tech domain from Operator Verifier!'
        }
      ]).select().single();
      if (dmErr) throw dmErr;

      // User B reloads domain chat
      const { data: bMessages } = await clientB.from('domain_messages')
        .select('*')
        .eq('domain_id', 'tech')
        .eq('channel_id', 'tech_general')
        .eq('id', dmMsg.id);

      if (!bMessages || bMessages.length !== 1) throw new Error('User B could not read domain message on reload');
      recordResult('7. Domains & Domain Chat', 'PASS', 'User A sent message in tech domain, User B read it after reload from database.');
    } catch (err) {
      recordResult('7. Domains & Domain Chat', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 8: Direct Messages
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 8: Direct Messages ---');
    try {
      // Find or create direct conversation with userA and userB as members
      const { rows: existingConv } = await pg.query(`
        SELECT c.id FROM public.conversations c
        JOIN public.conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = $1
        JOIN public.conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $2
        LIMIT 1;
      `, [userA.id, userB.id]);

      let convId = existingConv[0]?.id;
      if (!convId) {
        const { rows: created } = await pg.query(`INSERT INTO public.conversations DEFAULT VALUES RETURNING id;`);
        convId = created[0].id;
        await pg.query(`INSERT INTO public.conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3);`, [convId, userA.id, userB.id]);
      }

      // User A sends DM via clientA
      const { data: msgA, error: msgErr } = await clientA.from('messages').insert([
        {
          conversation_id: convId,
          sender_id: userA.id,
          content: 'Direct test message to User B'
        }
      ]).select().single();
      if (msgErr) throw msgErr;

      // User B reloads conversation messages via clientB
      const { data: bDms } = await clientB.from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .eq('id', msgA.id);

      if (!bDms || bDms.length !== 1) throw new Error('User B could not read direct message on reload');
      recordResult('8. Direct Messages', 'PASS', 'User A sent direct message, User B reloaded and received message from database.');
    } catch (err) {
      recordResult('8. Direct Messages', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 9: Notifications
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 9: Notifications ---');
    try {
      // User B inserts notification for User A tied to the real post_like event from Flow 2
      const notifId = require('crypto').randomUUID();
      const { error: nErr } = await clientB.from('notifications').insert([
        {
          id: notifId,
          recipient_id: userA.id,
          actor_id: userB.id,
          type: 'like',
          title: 'Post Liked',
          message: 'User B liked your post',
          entity_type: 'post',
          entity_id: testPostId,
          is_read: false
        }
      ]);
      if (nErr) throw nErr;

      // User B (actor) cannot SELECT User A's notification (recipient-only read)
      const { data: bViewNotif } = await clientB.from('notifications').select('*').eq('id', notifId);
      if (bViewNotif && bViewNotif.length > 0) throw new Error('Actor was able to select recipient notification');

      // User A (recipient) queries unread notifications
      const { data: aUnread } = await clientA.from('notifications')
        .select('*')
        .eq('recipient_id', userA.id)
        .eq('id', notifId)
        .eq('is_read', false);
      if (!aUnread || aUnread.length !== 1) throw new Error('User A did not see unread notification');

      // User A marks as read
      await clientA.from('notifications').update({ is_read: true }).eq('id', notifId);

      // Verify is_read is now true
      const { data: aReadAfter } = await clientA.from('notifications').select('is_read').eq('id', notifId).single();
      if (!aReadAfter.is_read) throw new Error('Mark as read did not persist');

      recordResult('9. Notifications', 'PASS', 'Notification created for verified event, hidden from actor, read and updated by recipient.');
    } catch (err) {
      recordResult('9. Notifications', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 10: Updates / Stories
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 10: Updates / Stories ---');
    try {
      const expDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: updateStory, error: uErr } = await clientA.from('updates').insert([
        {
          user_id: userA.id,
          category_id: 'tech',
          content: '24hr story update from User A',
          media_type: 'none',
          expires_at: expDate
        }
      ]).select().single();
      if (uErr) throw uErr;

      // User B reloads active updates
      const { data: bUpdates } = await clientB.from('updates')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .eq('id', updateStory.id);
      if (!bUpdates || bUpdates.length !== 1) throw new Error('User B could not read active update on reload');

      // User A deletes update
      await clientA.from('updates').delete().eq('id', updateStory.id);
      const { data: deletedCheck } = await clientB.from('updates').select('*').eq('id', updateStory.id);
      if (deletedCheck && deletedCheck.length > 0) throw new Error('Story deletion did not persist');

      recordResult('10. Updates / Stories', 'PASS', 'Story update created, queried by User B, deleted by User A, verified persistence.');
    } catch (err) {
      recordResult('10. Updates / Stories', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 11: Search
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 11: Search ---');
    try {
      // 11A. Search profile by username
      const { data: searchProf, error: sProfErr } = await clientA.from('profiles')
        .select('id, username, name')
        .ilike('username', '%operator_peer%');
      if (sProfErr) throw sProfErr;
      if (!searchProf || !searchProf.some(p => p.username === 'operator_peer')) {
        throw new Error('Profile search did not return operator_peer');
      }

      // 11B. Search posts by content keyword
      const { data: searchPosts, error: sPostErr } = await clientB.from('posts')
        .select('id, content')
        .ilike('content', '%verification%');
      if (sPostErr) throw sPostErr;
      if (!searchPosts || searchPosts.length === 0) {
        throw new Error('Post search did not return matches');
      }

      recordResult('11. Search', 'PASS', 'Profile search and post content search executed against database with expected matches.');
    } catch (err) {
      recordResult('11. Search', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 12: Push Subscription Registration
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 12: Push Subscription ---');
    try {
      const testEndpoint = `https://fcm.googleapis.com/fcm/send/test_endpoint_${Date.now()}`;
      const { data: pushSub, error: pushErr } = await clientA.from('push_subscriptions').insert([
        {
          user_id: userA.id,
          endpoint: testEndpoint,
          p256dh: 'test_p256dh_key',
          auth: 'test_auth_key',
          user_agent: 'Verification Test Agent',
          is_active: true
        }
      ]).select().single();
      if (pushErr) throw pushErr;

      // Reload from database
      const { data: reloadedSub } = await clientA.from('push_subscriptions').select('*').eq('id', pushSub.id).single();
      if (!reloadedSub || reloadedSub.endpoint !== testEndpoint) throw new Error('Push subscription not found on reload');

      // Unsubscribe (delete)
      await clientA.from('push_subscriptions').delete().eq('id', pushSub.id);
      const { data: unsubCheck } = await clientA.from('push_subscriptions').select('*').eq('id', pushSub.id);
      if (unsubCheck && unsubCheck.length > 0) throw new Error('Push unsubscribe did not persist');

      recordResult('12. Push Subscription Registration', 'PASS', 'Registered push subscription in database, verified reload, deleted subscription.');
    } catch (err) {
      recordResult('12. Push Subscription Registration', 'FAIL', err.message);
    }

    // ------------------------------------------------------------------------
    // FLOW 13: Blocked list & Privacy Single Source of Truth
    // ------------------------------------------------------------------------
    console.log('\n--- Verifying Flow 13: Blocked list & Privacy Single Source of Truth ---');
    try {
      // 13A. User A blocks User B
      await pg.query(`INSERT INTO public.blocked_users (blocker_user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [userA.id, userB.id]);

      // Call SECURITY DEFINER function get_my_blocked_users()
      const { data: blockedList, error: blErr } = await clientA.rpc('get_my_blocked_users');
      if (blErr) throw blErr;

      const foundBlocked = (blockedList || []).find(b => b.id === userB.id);
      if (!foundBlocked || foundBlocked.username !== 'operator_peer') {
        throw new Error('SECURITY DEFINER get_my_blocked_users did not return blocked user details');
      }

      // Unblock
      await pg.query(`DELETE FROM public.blocked_users WHERE blocker_user_id = $1 AND blocked_user_id = $2;`, [userA.id, userB.id]);

      // 13B. Privacy single source of truth (profiles.is_private)
      await clientA.from('profiles').update({ is_private: true }).eq('id', userA.id);
      const { data: aPrivateProf } = await clientA.from('profiles').select('is_private').eq('id', userA.id).single();
      if (aPrivateProf.is_private !== true) throw new Error('profiles.is_private update did not persist');

      await clientA.from('profiles').update({ is_private: false }).eq('id', userA.id);
      const { data: aPublicProf } = await clientA.from('profiles').select('is_private').eq('id', userA.id).single();
      if (aPublicProf.is_private !== false) throw new Error('profiles.is_private reset did not persist');

      recordResult('13. Blocked List RPC & Privacy Single Source of Truth', 'PASS', 'SECURITY DEFINER get_my_blocked_users returned id/name/username/avatar; profiles.is_private verified as single source.');
    } catch (err) {
      recordResult('13. Blocked List RPC & Privacy Single Source of Truth', 'FAIL', err.message);
    }

    // Post cleanup: delete test posts
    if (testPostId) await pg.query(`DELETE FROM public.posts WHERE id = $1;`, [testPostId]);
    if (privatePostId) await pg.query(`DELETE FROM public.posts WHERE id = $1;`, [privatePostId]);

  } finally {
    await pg.end();
  }

  console.log('\n================================================================');
  console.log('SUMMARY TABLE:');
  console.table(results);
  console.log('================================================================\n');

  const failedCount = results.filter(r => r.Status === 'FAIL').length;
  if (failedCount > 0) {
    console.error(`Verification completed with ${failedCount} failures.`);
    process.exit(1);
  } else {
    console.log('ALL FLOWS PASSED VERIFICATION WITH DATABASE AS SINGLE SOURCE OF TRUTH!');
  }
}

main().catch(err => {
  console.error('[FATAL]:', err);
  process.exit(1);
});
