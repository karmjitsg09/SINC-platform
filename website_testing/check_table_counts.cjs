const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
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

async function checkAllTables() {
  console.log('Checking database table row counts...');
  const tables = ['posts', 'post_media', 'post_likes', 'post_comments', 'post_saves', 'post_shares', 'profiles', 'conversations', 'messages', 'notifications', 'follow_requests'];

  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`Table ${t.padEnd(20)}: ${error ? 'ERROR: ' + error.message : count + ' rows'}`);
  }
}

checkAllTables();
