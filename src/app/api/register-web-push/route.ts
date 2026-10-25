import { NextRequest, NextResponse } from 'next/server';
import { verifyServerAuth } from '@/lib/serverAuth';
const { registerLocalSubscription } = require('../../../lib/serverPushDispatcher.cjs');

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller authentication
    const auth = verifyServerAuth(req);
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

    const { userId, subscription } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 });
    }

    // 3. Authorization: Users may only register subscriptions for their own identity
    if (auth.userId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot register push subscription for another user' },
        { status: 403 }
      );
    }

    // 4. Validate subscription object
    if (!subscription || typeof subscription !== 'object' || !subscription.endpoint || typeof subscription.endpoint !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid subscription.endpoint' }, { status: 400 });
    }

    const record = registerLocalSubscription(userId, subscription);
    return NextResponse.json({ success: true, record });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Registration failure' }, { status: 500 });
  }
}
