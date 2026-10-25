import { NextRequest, NextResponse } from 'next/server';
import {
  verifyServerAuth,
  authorizeAndVerifyPushNotification,
  computePushEventIdempotencyKey,
  getActivePushIdempotencyStore
} from '@/lib/serverAuth';
const { sendPushNotification } = require('../../../lib/serverPushDispatcher.cjs');

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller authentication
    const auth = verifyServerAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Parse request body
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    // 3. Authorize push notification targeting, payload, & underlying event
    const authz = await authorizeAndVerifyPushNotification(auth.userId, body);
    if (!authz.authorized) {
      // Rejections due to event freshness, social blocking, or content visibility
      // are suppressed safely without producing an error toast in the user's UI.
      if ((authz as any).suppressed) {
        return NextResponse.json(
          {
            success: true,
            delivered: 0,
            suppressed: true,
            reason: (authz as any).reason || 'suppressed',
            message: authz.error
          },
          { status: 200 }
        );
      }
      return NextResponse.json({ error: authz.error }, { status: authz.status });
    }

    // 4. Replay & Duplicate-Dispatch Guard (Idempotency Check)
    const store = getActivePushIdempotencyStore();
    const idempotencyKey = computePushEventIdempotencyKey(authz.payload);
    let lock: any;
    try {
      lock = await store.acquireLock(idempotencyKey);
    } catch (storeErr: any) {
      console.error('[send-web-push] Idempotency store error; failing closed:', storeErr?.message || 'Store error');
      return NextResponse.json(
        { error: storeErr?.message || 'Idempotency verification error' },
        { status: 500 }
      );
    }

    if (lock.state === 'DISPATCHED') {
      return NextResponse.json(
        {
          success: true,
          delivered: 0,
          duplicate: true,
          idempotent: true,
          replayed: true,
          message: 'Push notification for this event has already been dispatched',
          ...(lock.cachedResult || {})
        },
        { status: 200 }
      );
    }

    if (lock.state === 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Concurrent dispatch for this event is already in progress', inProgress: true },
        { status: 409 }
      );
    }

    // 5. Dispatch push notification with authoritatively bound payload
    try {
      const result = await sendPushNotification({
        ...authz.payload,
        authToken: auth.token
      });

      if (result && result.success === false) {
        await store.markFailed(idempotencyKey, result.error || 'Push dispatch failed');
        return NextResponse.json({ error: result.error || 'Web push delivery error' }, { status: 500 });
      }

      await store.markDispatched(idempotencyKey, result);
      return NextResponse.json(result);
    } catch (dispatchErr: any) {
      await store.markFailed(idempotencyKey, dispatchErr?.message || 'Dispatch failed');
      return NextResponse.json({ error: dispatchErr?.message || 'Web push delivery error' }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Web push dispatch failure' }, { status: 500 });
  }
}
