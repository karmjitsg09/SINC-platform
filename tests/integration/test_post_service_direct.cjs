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

if (!supabaseUrl || !supabaseKey) {
  console.log('Error: Supabase credentials not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPostQueryPerformance() {
  console.log('--- Direct Supabase Benchmark ---');

  // 1. Measure raw posts query with profile join
  const startPosts = Date.now();
  const { data: posts, error: pErr } = await supabase
    .from('posts')
    .select('*, profiles:user_id(id, name, username, role, avatar_url)')
    .order('created_at', { ascending: false });
  const durationPosts = Date.now() - startPosts;

  console.log(`[Posts Query] Duration: ${durationPosts}ms | Rows returned: ${posts?.length || 0} | Error: ${pErr?.message || 'none'}`);

  if (pErr || !posts || posts.length === 0) {
    console.log('No posts or error occurred.');
    return;
  }

  // 2. Measure post_media query
  const postIds = posts.map(p => p.id);
  const startMedia = Date.now();
  const { data: media, error: mErr } = await supabase
    .from('post_media')
    .select('*')
    .in('post_id', postIds)
    .order('display_order', { ascending: true });
  const durationMedia = Date.now() - startMedia;

  console.log(`[Media Query] Duration: ${durationMedia}ms | Rows returned: ${media?.length || 0} | Error: ${mErr?.message || 'none'}`);

  // 3. Measure N * 4 interaction queries for 5 posts
  console.log(`\nBenchmarking interaction queries for 5 sample posts...`);
  const interactionTimings = [];
  for (let i = 0; i < Math.min(posts.length, 5); i++) {
    const pid = posts[i].id;
    const pStart = Date.now();

    await Promise.all([
      supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', pid),
      supabase.from('post_comments').select('*', { count: 'exact', head: true }).eq('post_id', pid),
      supabase.from('post_shares').select('*', { count: 'exact', head: true }).eq('post_id', pid),
      supabase.from('post_saves').select('*', { count: 'exact', head: true }).eq('post_id', pid)
    ]);
    const duration = Date.now() - pStart;
    interactionTimings.push(duration);
    console.log(`Post ${i + 1} (${pid}): 4 count queries took ${duration}ms`);
  }

  const avgPerPost = Math.round(interactionTimings.reduce((a, b) => a + b, 0) / interactionTimings.length);
  console.log(`Average interaction time per post: ${avgPerPost}ms`);
  console.log(`Estimated cumulative interaction delay for all ${posts.length} posts: ${avgPerPost * posts.length}ms (${((avgPerPost * posts.length) / 1000).toFixed(1)}s)!`);
}

testPostQueryPerformance();
