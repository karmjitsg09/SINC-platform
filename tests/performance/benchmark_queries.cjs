const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
  path.join(process.cwd(), '.env')
].find(p => fs.existsSync(p));
const envContent = envPath ? fs.readFileSync(envPath, 'utf8') : '';
let supabaseUrl = '';
let supabaseKey = '';

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) return;
  const k = trimmed.substring(0, eqIdx).trim();
  const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  if (k === 'VITE_SUPABASE_URL') supabaseUrl = val;
  if (k === 'VITE_SUPABASE_PUBLISHABLE_KEY' || k === 'VITE_SUPABASE_ANON_KEY') {
    if (!supabaseKey) supabaseKey = val;
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function benchmarkAuthenticatedQueries() {
  console.log('--- Authenticated Supabase Benchmark ---');
  const tAuthStart = Date.now();
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'user.a.test@gmail.com',
    password: 'TestPassword123!'
  });
  console.log(`Auth Sign-In Duration: ${Date.now() - tAuthStart}ms`);

  const currentUserId = authData.user.id;

  // 1. Home feed: getPosts() query
  const tPostsStart = Date.now();
  const { data: posts, error: pErr } = await supabase
    .from('posts')
    .select('*, profiles:user_id(id, name, username, role, avatar_url)')
    .order('created_at', { ascending: false });
  const tPostsEnd = Date.now();
  console.log(`[getPosts()] Duration: ${tPostsEnd - tPostsStart}ms | Returned ${posts?.length || 0} posts`);

  // 2. attachPostMedia()
  const postIds = (posts || []).map(p => p.id);
  const tMediaStart = Date.now();
  const { data: mediaData, error: mErr } = await supabase
    .from('post_media')
    .select('*')
    .in('post_id', postIds)
    .order('display_order', { ascending: true });
  const tMediaEnd = Date.now();
  console.log(`[attachPostMedia()] Duration: ${tMediaEnd - tMediaStart}ms | Error: ${mErr ? mErr.message : 'none'}`);

  // 3. PostCardInteractions: getPostInteractionSummary() for ALL 26 posts
  console.log(`\nMeasuring getPostInteractionSummary for all ${posts.length} posts as executed by Feed...`);
  const tInteractionsStart = Date.now();

  const interactionResults = await Promise.all(
    posts.map(async (p, idx) => {
      const pStart = Date.now();
      const [lCountRes, myLikeRes, cCountRes, shCountRes, svCountRes, mySaveRes] = await Promise.all([
        supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('post_likes').select('id').eq('post_id', p.id).eq('user_id', currentUserId).maybeSingle(),
        supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('post_shares').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('post_saves').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('post_saves').select('id').eq('post_id', p.id).eq('user_id', currentUserId).maybeSingle()
      ]);
      const pEnd = Date.now();
      return { id: p.id, durationMs: pEnd - pStart };
    })
  );
  const tInteractionsEnd = Date.now();

  console.log(`[Interactions Batch] Total wall-clock time for ${posts.length * 6} = ${posts.length * 6} queries: ${tInteractionsEnd - tInteractionsStart}ms`);
  const durations = interactionResults.map(r => r.durationMs);
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const max = Math.max(...durations);
  const min = Math.min(...durations);
  console.log(`Interaction timing per post: Avg = ${avg}ms, Min = ${min}ms, Max = ${max}ms`);

  // 4. Dedicated Post Opening benchmark: getPostById(postId) + PostView mounting
  const samplePost = posts[0];
  console.log(`\nBenchmarking Post Opening for Post ID: ${samplePost.id}...`);
  const tOpenStart = Date.now();
  const { data: singlePost, error: spErr } = await supabase
    .from('posts')
    .select('*, profiles:user_id(id, name, username, role, avatar_url)')
    .eq('id', samplePost.id)
    .maybeSingle();
  const tSinglePost = Date.now();

  const { data: singleMedia } = await supabase
    .from('post_media')
    .select('*')
    .eq('post_id', samplePost.id);
  const tSingleMedia = Date.now();

  // Then post interactions query for single post
  const [l1, l2, c1, s1, sv1, sv2] = await Promise.all([
    supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', samplePost.id),
    supabase.from('post_likes').select('id').eq('post_id', samplePost.id).eq('user_id', currentUserId).maybeSingle(),
    supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', samplePost.id),
    supabase.from('post_shares').select('*', { count: 'exact', head: true }).eq('post_id', samplePost.id),
    supabase.from('post_saves').select('*', { count: 'exact', head: true }).eq('post_id', samplePost.id),
    supabase.from('post_saves').select('id').eq('post_id', samplePost.id).eq('user_id', currentUserId).maybeSingle()
  ]);
  const tOpenEnd = Date.now();

  console.log(`[Post Opening Latency] Total: ${tOpenEnd - tOpenStart}ms`);
  console.log(`  - Post record lookup: ${tSinglePost - tOpenStart}ms`);
  console.log(`  - Post media lookup: ${tSingleMedia - tSinglePost}ms`);
  console.log(`  - 6 interaction queries: ${tOpenEnd - tSingleMedia}ms`);

  // 5. Profile Loading benchmark: profile + stats + author posts
  console.log(`\nBenchmarking Profile Loading for User: ${currentUserId}...`);
  const tProfStart = Date.now();
  const [profRes, stats1, stats2, stats3, authorPostsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', currentUserId).maybeSingle(),
    supabase.from('follow_requests').select('id', { count: 'exact', head: true }).eq('following_user_id', currentUserId).eq('status', 'accepted'),
    supabase.from('follow_requests').select('id', { count: 'exact', head: true }).eq('follower_user_id', currentUserId).eq('status', 'accepted'),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', currentUserId),
    supabase.from('posts').select('*, profiles:user_id(id, name, username, role, avatar_url)').eq('user_id', currentUserId).order('created_at', { ascending: false })
  ]);
  const tProfEnd = Date.now();
  console.log(`[Profile Loading Latency] Total: ${tProfEnd - tProfStart}ms`);

  // 6. Messaging benchmark: getConversations
  console.log(`\nBenchmarking Messaging getConversations...`);
  const tMsgStart = Date.now();
  const { data: myMembers } = await supabase.from('conversation_members').select('id, conversation_id, user_id, created_at').eq('user_id', currentUserId);
  const convIds = (myMembers || []).map(m => m.conversation_id);
  if (convIds.length > 0) {
    const [cRows, aMem, msgs] = await Promise.all([
      supabase.from('conversations').select('id, created_at, updated_at, last_message_id').in('id', convIds),
      supabase.from('conversation_members').select('id, conversation_id, user_id, created_at').in('conversation_id', convIds),
      supabase.from('messages').select('id, conversation_id, sender_id, content, created_at').in('conversation_id', convIds)
    ]);
  }
  const tMsgEnd = Date.now();
  console.log(`[getConversations Latency] Total: ${tMsgEnd - tMsgStart}ms`);

  // Save metrics to disk
  const benchmarkSummary = {
    authSignInMs: tPostsStart - tAuthStart,
    feedPostsCount: posts.length,
    getPostsQueryMs: tPostsEnd - tPostsStart,
    attachPostMediaMs: tMediaEnd - tMediaStart,
    interactionsTotalWallClockMs: tInteractionsEnd - tInteractionsStart,
    interactionsQueryCount: posts.length * 6,
    avgInteractionMsPerPost: avg,
    postOpeningLatencyMs: tOpenEnd - tOpenStart,
    postOpeningBreakdown: {
      postRecordLookupMs: tSinglePost - tOpenStart,
      postMediaLookupMs: tSingleMedia - tSinglePost,
      interactionsSummaryMs: tOpenEnd - tSingleMedia
    },
    profileLoadingLatencyMs: tProfEnd - tProfStart,
    messagingConversationsLatencyMs: tMsgEnd - tMsgStart
  };

  fs.writeFileSync(path.join(__dirname, '..', '..', 'reports', 'backend_query_benchmarks.json'), JSON.stringify(benchmarkSummary, null, 2));
  console.log('\n✓ Benchmark results written to backend_query_benchmarks.json');
}

benchmarkAuthenticatedQueries();
