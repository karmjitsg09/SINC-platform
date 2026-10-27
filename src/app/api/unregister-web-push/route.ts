import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAuth } from '@/lib/serverAuth';
const { unregisterLocalSubscription } = require('../../../lib/serverPushDispatcher.cjs');

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller authentication
    const auth = await verifyServerAuth(req);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // 2. Parse and validate payload
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    }

    const { userId, endpoint } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 });
    }

    // 3. Authorization: Users may only unregister subscriptions for their own identity
    if (auth.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot unregister push subscription for another user' },
        { status: 403 }
      );
    }

    if (!endpoint || typeof endpoint !== 'string' || !endpoint.trim().startsWith('https://')) {
      return NextResponse.json({ error: 'Missing or invalid endpoint: must be a secure HTTPS URL' }, { status: 400 });
    }

    unregisterLocalSubscription(userId, endpoint.trim());
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unregistration failure' }, { status: 500 });
  }
}
