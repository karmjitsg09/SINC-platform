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

async function checkAuthRowCounts() {
  console.log('Signing in as test user...');
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'user.a.test@gmail.com',
    password: 'TestPassword123!'
  });

  if (authErr) {
    console.error('Sign in error:', authErr.message);
    return;
  }

  console.log('Signed in successfully as:', authData.user.id);

  const tables = ['posts', 'post_media', 'post_likes', 'post_comments', 'post_saves', 'post_shares', 'profiles', 'conversations', 'messages'];
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`Table ${t.padEnd(20)}: ${error ? 'ERROR: ' + error.message : count + ' rows'}`);
  }
}

checkAuthRowCounts();
