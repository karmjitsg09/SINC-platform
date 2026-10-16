const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vctwzlsatqsuinmosnzo.supabase.co', 'sb_publishable_6795xkOZaeelCieIHRzSKA_JJUL4eBr');

async function setupTestData() {
  const { data: authB, error: errB } = await supabase.auth.signInWithPassword({
    email: 'user.b.test@gmail.com',
    password: 'TestPassword123!'
  });
  if (errB) {
    console.error('Sign in B error:', errB);
    return;
  }
  const userB = authB.user;
  console.log('Signed in as User B:', userB.id);

  const { data: profileA } = await supabase.from('profiles').select('*').eq('username', 'useratest').single();
  console.log('User A profile:', profileA?.id, profileA?.username);
  if (!profileA) return;

  const { data: existingFR } = await supabase
    .from('follow_requests')
    .select('*')
    .eq('follower_user_id', userB.id)
    .eq('following_user_id', profileA.id)
    .maybeSingle();

  let frId;
  if (existingFR) {
    const { data: updated } = await supabase
      .from('follow_requests')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', existingFR.id)
      .select()
      .single();
    frId = updated.id;
    console.log('Reset existing FR to pending:', frId);
  } else {
    const { data: created, error: createErr } = await supabase
      .from('follow_requests')
      .insert([{
        follower_user_id: userB.id,
        following_user_id: profileA.id,
        status: 'pending'
      }])
      .select()
      .single();
    if (createErr) console.error('Create FR error:', createErr);
    frId = created?.id;
    console.log('Created new FR:', frId);
  }

  if (frId) {
    await supabase.from('notifications').delete().eq('recipient_id', profileA.id);
    const { error: notifErr } = await supabase.from('notifications').insert([
      {
        recipient_id: profileA.id,
        actor_id: userB.id,
        type: 'follow_request',
        title: 'Follow Request',
        message: '@userbtest sent you a follow request.',
        entity_type: 'follow_request',
        entity_id: frId,
        is_read: false
      },
      {
        recipient_id: profileA.id,
        actor_id: userB.id,
        type: 'post_like',
        title: 'New Like',
        message: '@userbtest liked your post in Tech domain.',
        entity_type: 'post',
        entity_id: 'post-test-1',
        is_read: false
      },
      {
        recipient_id: profileA.id,
        actor_id: userB.id,
        type: 'post_comment',
        title: 'New Comment',
        message: '@userbtest commented on your post.',
        entity_type: 'post',
        entity_id: 'post-test-1',
        is_read: true
      }
    ]);
    console.log('Inserted notifications for User A, error:', notifErr);
  }
}

setupTestData();
