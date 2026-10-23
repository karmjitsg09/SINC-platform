// Supabase Edge Function: send-web-push
// Production Web Push Notification Dispatcher for SINC Platform
// Uses web-push protocol (RFC 8030 / RFC 8292) with VAPID authentication

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// In-memory rate limiting cache: key: `${senderId}_${recipientId}_${type}` -> lastTimestamp
const rateLimitCache = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 2500; // Minimum 2.5s between identical notification triggers

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@sinc.network';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: Supabase credentials missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'Server misconfiguration: VAPID keys missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Authenticate the caller using user JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Supabase Admin client with service_role to query subscriptions and verify permissions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Supabase User client using token to verify user identity
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parse and validate request body
    const body = await req.json();
    const {
      recipientId,
      type,
      title,
      message,
      url,
      entityType,
      entityId
    } = body;

    if (!recipientId || typeof recipientId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'recipientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Security check: users cannot send push notifications to themselves
    if (recipientId === user.id) {
      return new Response(
        JSON.stringify({ error: 'Cannot send push notification to yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Rate-limiting & duplicate prevention check
    const rateLimitKey = `${user.id}_${recipientId}_${type}_${entityId || ''}`;
    const now = Date.now();
    const lastTriggered = rateLimitCache.get(rateLimitKey);
    if (lastTriggered && now - lastTriggered < RATE_LIMIT_WINDOW_MS) {
      return new Response(
        JSON.stringify({ message: 'Throttled: duplicate notification suppressed', delivered: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    rateLimitCache.set(rateLimitKey, now);

    // Clean up old rate limit entries periodically
    if (rateLimitCache.size > 1000) {
      for (const [key, timestamp] of rateLimitCache.entries()) {
        if (now - timestamp > 60000) {
          rateLimitCache.delete(key);
        }
      }
    }

    // 5. Server-side authorization check based on event type
    if (type === 'message') {
      if (!entityId) {
        return new Response(
          JSON.stringify({ error: 'Conversation entityId is required for direct messages' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify caller is a member of the conversation
      const { data: memberA } = await supabaseAdmin
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', entityId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!memberA) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: You are not a member of this conversation' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify recipient is also a member of the conversation
      const { data: memberB } = await supabaseAdmin
        .from('conversation_members')
        .select('id')
        .eq('conversation_id', entityId)
        .eq('user_id', recipientId)
        .maybeSingle();

      if (!memberB) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: Recipient is not a member of this conversation' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. Check recipient notification preferences if configured in user_private_details
    try {
      const { data: privateDetails } = await supabaseAdmin
        .from('user_private_details')
        .select('notification_preferences')
        .eq('user_id', recipientId)
        .maybeSingle();

      const notifPrefs = privateDetails?.notification_preferences;
      if (notifPrefs && notifPrefs.web_push_enabled === false) {
        return new Response(
          JSON.stringify({ message: 'Push notifications disabled by recipient preferences', delivered: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (prefErr) {
      // If table doesn't have notification_preferences column yet, proceed
    }

    // 7. Fetch active push subscriptions for the recipient
    const { data: subscriptions, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, user_agent')
      .eq('user_id', recipientId)
      .eq('is_active', true);

    if (subsError) {
      console.error('[send-web-push] Error fetching subscriptions:', subsError);
      return new Response(
        JSON.stringify({ error: 'Database error reading subscriptions', details: subsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active push subscriptions found for recipient', delivered: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Configure web-push with VAPID details
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // Prepare push payload
    const pushPayload = JSON.stringify({
      title: title || 'SINC Notification',
      body: message || 'You have a new update on SINC.',
      icon: '/images/sinc-corporate-logo.png',
      badge: '/images/sinc-corporate-logo.png',
      data: {
        url: url || '/notifications',
        entityType: entityType || null,
        entityId: entityId || null
      }
    });

    let deliveredCount = 0;
    const expiredSubIds: string[] = [];

    // 9. Dispatch push notification to all recipient's active subscriptions
    const deliveryPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        deliveredCount++;
      } catch (err: any) {
        console.warn('[send-web-push] Delivery failed for endpoint:', sub.id, err?.statusCode, err?.message);
        // If push service reports 410 Gone or 404 Not Found, subscription is expired/unregistered
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredSubIds.push(sub.id);
        }
      }
    });

    await Promise.allSettled(deliveryPromises);

    // 10. Deactivate expired subscriptions
    if (expiredSubIds.length > 0) {
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ is_active: false })
        .in('id', expiredSubIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivered: deliveredCount,
        totalSubscriptions: subscriptions.length,
        deactivatedExpired: expiredSubIds.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[send-web-push] Unhandled exception:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
