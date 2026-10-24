const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8').split(/\r?\n/);
let url = '', key = '';
for (const l of env) {
  if (l.startsWith('VITE_SUPABASE_URL=')) url = l.split('=')[1].trim();
  if (l.startsWith('VITE_SUPABASE_ANON_KEY=') || l.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = l.split('=')[1].trim();
}

const sb = createClient(url, key);

(async () => {
  const qClean = 'user b';
  const { data, error } = await sb
    .from('profiles')
    .select('id, name, username, role')
    .or(`name.ilike.%${qClean}%,username.ilike.%${qClean}%,role.ilike.%${qClean}%`);

  console.log('Query result with "user b":', data);
  console.log('Error:', error);
})();
