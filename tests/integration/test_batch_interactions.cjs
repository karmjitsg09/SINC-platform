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

async function testBatchedInteractions() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'user.a.test@gmail.com',
    password: 'TestPassword123!'
  });
  const currentUserId = authData.user.id;

  const { data: posts } = await supabase.from('posts').select('id').limit(26);
  const postIds = posts.map(p => p.id);
  console.log(`Testing batch interactions for ${postIds.length} posts...`);

  const tStart = Date.now();
  const [likesRes, commentsRes, savesRes, sharesRes] = await Promise.all([
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
    supabase.from('post_saves').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_shares').select('post_id').in('post_id', postIds)
  ]);
  const duration = Date.now() - tStart;

  console.log(`Batched 4 queries completed in: ${duration}ms!`);
  console.log(`Likes rows returned: ${likesRes.data?.length || 0}`);
  console.log(`Comments rows returned: ${commentsRes.data?.length || 0}`);
  console.log(`Saves rows returned: ${savesRes.data?.length || 0}`);
  console.log(`Shares rows returned: ${sharesRes.data?.length || 0}`);

  // Build the summary map
  const summaryMap = {};
  postIds.forEach(id => {
    summaryMap[id] = {
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      saveCount: 0,
      likedByMe: false,
      savedByMe: false
    };
  });

  (likesRes.data || []).forEach(r => {
    if (summaryMap[r.post_id]) {
      summaryMap[r.post_id].likeCount++;
      if (r.user_id === currentUserId) summaryMap[r.post_id].likedByMe = true;
    }
  });

  (commentsRes.data || []).forEach(r => {
    if (summaryMap[r.post_id]) {
      summaryMap[r.post_id].commentCount++;
    }
  });

  (savesRes.data || []).forEach(r => {
    if (summaryMap[r.post_id]) {
      summaryMap[r.post_id].saveCount++;
      if (r.user_id === currentUserId) summaryMap[r.post_id].savedByMe = true;
    }
  });

  (sharesRes.data || []).forEach(r => {
    if (summaryMap[r.post_id]) {
      summaryMap[r.post_id].shareCount++;
    }
  });

  const sampleKey = Object.keys(summaryMap)[0];
  console.log('Sample summary for first post:', JSON.stringify(summaryMap[sampleKey], null, 2));
}

testBatchedInteractions();
